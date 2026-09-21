// Refreshes data/metrics.json with real YouTube data.
// Runs on a schedule via .github/workflows/refresh-youtube.yml — no manual
// step needed once the four YT_* secrets are set on the repository.
//
// Scope: this script only touches the YouTube-derived parts of metrics.json
// (snapshotRows["1.2"], detailRows/extraInfo/audience/itemVideos/videoDaily
// for "2.2"). Metricool-sourced snapshot rows are left exactly as they are —
// they come from a different pipeline (Claude, manually, for now).

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API_KEY = process.env.YT_API_KEY;
const CLIENT_ID = process.env.YT_CLIENT_ID;
const CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN;

const PAI_CHANNEL = "UCeQmuftGyoX8XFFcfsh5yHQ";
const OPUS_DEI_CHANNEL = "UCxXgNXXCJSeOLWw1GY7TAdw";
const DATA_FILE = "data/metrics.json";

if (!API_KEY || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("Faltam secrets: YT_API_KEY, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN");
  process.exit(1);
}

function compactDate(iso) {
  return iso.replaceAll("-", "");
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("token refresh failed: " + res.status + " " + (await res.text()));
  const json = await res.json();
  return json.access_token;
}

async function dataApi(path, params) {
  const url = new URL("https://www.googleapis.com/youtube/v3/" + path);
  url.searchParams.set("key", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Data API " + path + " failed: " + res.status + " " + (await res.text()));
  return res.json();
}

async function analytics(token, params) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) throw new Error("Analytics API failed: " + res.status + " " + (await res.text()));
  return res.json();
}

const AGE_LABELS = { "age13-17": "13-17", "age18-24": "18-24", "age25-34": "25-34", "age35-44": "35-44", "age45-54": "45-54", "age55-64": "55-64", "age65-": "65+" };
const GENDER_LABELS = { male: "Homens", female: "Mulheres", user_specified: "Não especificado" };
const DEVICE_LABELS = { MOBILE: "Celular", DESKTOP: "Computador", TV: "TV", TABLET: "Tablet", GAME_CONSOLE: "Console" };
const LOCATION_LABELS = { SHORTS_FEED: "Feed de Shorts", WATCH: "Página de exibição", BROWSE: "Explorar/Início", EMBEDDED: "Incorporado em site", SEARCH: "Busca", CHANNEL: "Página do canal", PLAYLIST: "Playlist", EXTERNAL_APP: "App externo", END_SCREEN: "Tela final", NOTIFICATION: "Notificação" };
const TRAFFIC_LABELS = { SHORTS: "Shorts", SUBSCRIBER: "Inscritos (feed)", YT_SEARCH: "Busca no YouTube", RELATED_VIDEO: "Vídeos relacionados", NOTIFICATION: "Notificações", YT_CHANNEL: "Página do canal", YT_OTHER_PAGE: "Outra página do YouTube", EXT_URL: "Link externo", NO_LINK_OTHER: "Outro", HASHTAGS: "Hashtags", PLAYLIST: "Playlist", END_SCREEN: "Tela final" };
const COUNTRY_LABELS = { BR: "Brasil", PT: "Portugal", US: "Estados Unidos", DE: "Alemanha", GR: "Grécia", PL: "Polônia", RO: "Romênia", RS: "Sérvia", AO: "Angola", MZ: "Moçambique" };

function reorderDayRows(rows) {
  // API gives [date, m1..mN]; our stored shape wants [m1..mN, dateCompact]
  return rows.map((r) => {
    const [date, ...rest] = r;
    return [...rest, compactDate(date)];
  });
}

async function main() {
  const token = await getAccessToken();
  const today = new Date();
  const end = isoDate(today);
  const start = isoDate(new Date(today.getTime() - 29 * 86400000));

  const existing = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, "utf8")) : {};

  // --- 1. Channel stats (public, no OAuth needed) ---
  const stats = await dataApi("channels", { part: "statistics", id: `${PAI_CHANNEL},${OPUS_DEI_CHANNEL}` });
  const subsByChannel = {};
  for (const item of stats.items) subsByChannel[item.id] = Number(item.statistics.subscriberCount);

  // Append today's "Vocação de Pai" subscriber count (accumulates real history over time).
  const snapshotRows = existing.snapshotRows || {};
  const paiSubs = subsByChannel[PAI_CHANNEL];
  if (paiSubs !== undefined) {
    const key = "1.2";
    const rows = (snapshotRows[key] || []).filter((r) => r[r.length - 1] !== compactDate(end));
    rows.push([String(paiSubs), compactDate(end)]);
    snapshotRows[key] = rows.slice(-90);
  }

  // --- 2. Opus Dei channel: full YouTube Analytics sweep ---
  const dailyRes = await analytics(token, {
    ids: "channel==" + OPUS_DEI_CHANNEL,
    startDate: start,
    endDate: end,
    metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares",
    dimensions: "day",
    sort: "day",
  });
  const detailRows = existing.detailRows || {};
  detailRows["2.2"] = reorderDayRows(dailyRes.rows || []);

  const trafficRes = await analytics(token, {
    ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end,
    metrics: "views", dimensions: "insightTrafficSourceType", sort: "-views",
  });
  const extraInfo = existing.extraInfo || {};
  extraInfo["2.2"] = {
    traffic: (trafficRes.rows || []).slice(0, 8).map(([type, views]) => ({ label: TRAFFIC_LABELS[type] || type, views })),
  };

  const [ageGenderRes, countryRes, deviceRes, locationRes, subStatusRes] = await Promise.all([
    analytics(token, { ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end, metrics: "viewerPercentage", dimensions: "ageGroup,gender", sort: "ageGroup" }),
    analytics(token, { ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched", dimensions: "country", sort: "-views", maxResults: "8" }),
    analytics(token, { ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end, metrics: "views", dimensions: "deviceType", sort: "-views" }),
    analytics(token, { ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end, metrics: "views", dimensions: "insightPlaybackLocationType", sort: "-views" }),
    analytics(token, { ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end, metrics: "views", dimensions: "subscribedStatus" }),
  ]);

  const audience = existing.audience || {};
  audience["2.2"] = {
    ageGender: (ageGenderRes.rows || [])
      .map(([age, gender, pct]) => ({ label: `${AGE_LABELS[age] || age} · ${GENDER_LABELS[gender] || gender}`, pct }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8),
    countries: (countryRes.rows || []).filter((r) => r[1] > 0).map(([code, views]) => ({ label: COUNTRY_LABELS[code] || code, views })),
    device: (deviceRes.rows || []).map(([type, views]) => ({ label: DEVICE_LABELS[type] || type, views })),
    playbackLocation: (locationRes.rows || []).map(([type, views]) => ({ label: LOCATION_LABELS[type] || type, views })),
    subscriptionStatus: (subStatusRes.rows || []).map(([status, views]) => ({ label: status === "SUBSCRIBED" ? "Inscritos" : "Não inscritos", views })),
  };

  // --- 3. Per-video breakdown + top-video daily series ---
  const perVideoRes = await analytics(token, {
    ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end,
    metrics: "views,likes,comments,estimatedMinutesWatched,subscribersGained,averageViewDuration",
    dimensions: "video", sort: "-views", maxResults: "15",
  });
  const videoRows = perVideoRes.rows || [];
  const videoIds = videoRows.map((r) => r[0]);

  let titleMap = {};
  if (videoIds.length) {
    const titlesRes = await dataApi("videos", { part: "snippet", id: videoIds.join(",") });
    for (const it of titlesRes.items || []) {
      titleMap[it.id] = { title: it.snippet.title, thumb: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url || "" };
    }
  }

  const itemVideos = existing.itemVideos || {};
  itemVideos["2.2"] = videoRows.map(([id, views, likes, comments, minutes, subsGained, avgDuration]) => ({
    id, title: titleMap[id]?.title || id, thumb: titleMap[id]?.thumb || "",
    views, likes, comments, minutes, subsGained, avgDuration,
  }));

  const topSixIds = videoRows.slice(0, 6).map((r) => r[0]);
  const videoDaily = {};
  for (const vid of topSixIds) {
    const res = await analytics(token, {
      ids: "channel==" + OPUS_DEI_CHANNEL, startDate: start, endDate: end,
      metrics: "views", dimensions: "day", filters: "video==" + vid, sort: "day",
    });
    const rows = res.rows || [];
    let idx = rows.findIndex(([, v]) => v > 0);
    if (idx === -1) idx = 0;
    videoDaily[vid] = rows.slice(idx).map(([date, v]) => [v, compactDate(date)]);
  }

  const merged = {
    ...existing,
    generatedAt: new Date().toISOString(),
    snapshotRows,
    detailRows,
    extraInfo,
    audience,
    itemVideos,
    videoDaily,
  };

  writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2) + "\n");
  console.log("data/metrics.json atualizado em", merged.generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
