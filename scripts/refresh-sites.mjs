// Atualiza data/metrics.json → "sites" com GA4, Search Console e AdSense dos sites do grupo.
// Roda no workflow refresh-youtube.yml, depois do script do YouTube (que preserva este bloco).
// GA4 + Search Console: conta de serviço (secret GOOGLE_SA_JSON), sem expiração.
// AdSense: OAuth (YT_CLIENT_ID/YT_CLIENT_SECRET + ADSENSE_REFRESH_TOKEN); pulado se o secret não existir.
// Cada fonte falha isolada: o erro vira texto em sites[x].errors e o painel mostra a mensagem honesta.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createSign } from "node:crypto";

const DATA_FILE = "data/metrics.json";

const SITES = [
  { key: "portaldaai", label: "Portal da AI", domain: "portaldaai.com.br", ga4Env: "GA4_PROPERTY_PORTALDAAI" },
  { key: "vocacaodemae", label: "Vocação de Mãe", domain: "vocacaodemae.com.br", ga4Env: "GA4_PROPERTY_VOCACAODEMAE" },
];

const SA_JSON = process.env.GOOGLE_SA_JSON;
const OAUTH_ID = process.env.YT_CLIENT_ID;
const OAUTH_SECRET = process.env.YT_CLIENT_SECRET;
const ADSENSE_REFRESH = process.env.ADSENSE_REFRESH_TOKEN;

const iso = (d) => d.toISOString().slice(0, 10);
const compact = (s) => s.replaceAll("-", "");
const today = new Date();
const START = iso(new Date(today.getTime() - 29 * 86400000));
const END = iso(today);

function b64url(b) {
  return Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function serviceAccountToken(sa, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(header + "." + claim).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: header + "." + claim + "." + b64url(sig) }),
  });
  if (!res.ok) throw new Error("token da conta de serviço falhou: " + res.status + " " + (await res.text()).slice(0, 200));
  return (await res.json()).access_token;
}

async function oauthToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: OAUTH_ID, client_secret: OAUTH_SECRET, refresh_token: ADSENSE_REFRESH, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error("token OAuth do AdSense falhou: " + res.status + " " + (await res.text()).slice(0, 200));
  return (await res.json()).access_token;
}

async function getJson(url, token, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 240));
  return res.json();
}

// ---------- GA4 ----------
async function ga4Report(token, property, body) {
  return getJson(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, token, { method: "POST", body: JSON.stringify(body) });
}
const num = (v) => (v === undefined || v === "" ? null : Number(v));

async function fetchGa4(token, property) {
  const range = [{ startDate: START, endDate: END }];
  const [daily, pages, channels, countries, devices] = await Promise.all([
    ga4Report(token, property, { dateRanges: range, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagedSessions" }, { name: "averageSessionDuration" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
    ga4Report(token, property, { dateRanges: range, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 }),
    ga4Report(token, property, { dateRanges: range, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
    ga4Report(token, property, { dateRanges: range, dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 8 }),
    ga4Report(token, property, { dateRanges: range, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
  ]);
  const rows = (r) => r.rows || [];
  return {
    // colunas: [users, newUsers, sessions, pageviews, engagedSessions, avgSessionSeconds, "YYYYMMDD"]
    daily: rows(daily).map((r) => [...r.metricValues.map((m) => num(m.value)), r.dimensionValues[0].value]),
    topPages: rows(pages).map((r) => ({ label: r.dimensionValues[0].value, views: num(r.metricValues[0].value), users: num(r.metricValues[1].value) })),
    channels: rows(channels).map((r) => ({ label: r.dimensionValues[0].value, sessions: num(r.metricValues[0].value) })),
    countries: rows(countries).map((r) => ({ label: r.dimensionValues[0].value, users: num(r.metricValues[0].value) })),
    devices: rows(devices).map((r) => ({ label: r.dimensionValues[0].value, sessions: num(r.metricValues[0].value) })),
  };
}

// ---------- Search Console ----------
async function findSearchConsoleSite(token, domain) {
  const list = await getJson("https://www.googleapis.com/webmasters/v3/sites", token);
  const entries = (list.siteEntry || []).map((s) => s.siteUrl);
  const hit = entries.find((u) => u === "sc-domain:" + domain) || entries.find((u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === domain);
  if (!hit) throw new Error("propriedade não encontrada no Search Console — adicione o e-mail da conta de serviço como usuário. Visíveis: " + (entries.join(", ") || "nenhuma"));
  return hit;
}
async function gscQuery(token, siteUrl, body) {
  return getJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, token, { method: "POST", body: JSON.stringify({ startDate: START, endDate: END, ...body }) });
}
async function fetchSearchConsole(token, domain) {
  const siteUrl = await findSearchConsoleSite(token, domain);
  const [daily, queries, pages] = await Promise.all([
    gscQuery(token, siteUrl, { dimensions: ["date"], rowLimit: 100 }),
    gscQuery(token, siteUrl, { dimensions: ["query"], rowLimit: 10 }),
    gscQuery(token, siteUrl, { dimensions: ["page"], rowLimit: 10 }),
  ]);
  const r = (x) => x.rows || [];
  return {
    siteUrl,
    // colunas: [clicks, impressions, ctr, position, "YYYYMMDD"]
    daily: r(daily).map((x) => [x.clicks, x.impressions, x.ctr, x.position, compact(x.keys[0])]).sort((a, b) => a[4].localeCompare(b[4])),
    queries: r(queries).map((x) => ({ label: x.keys[0], clicks: x.clicks, impressions: x.impressions, position: x.position })),
    pages: r(pages).map((x) => ({ label: x.keys[0], clicks: x.clicks, impressions: x.impressions, position: x.position })),
  };
}

// ---------- AdSense ----------
async function fetchAdsense() {
  const token = await oauthToken();
  const accounts = await getJson("https://adsense.googleapis.com/v2/accounts", token);
  const account = (accounts.accounts || [])[0];
  if (!account) throw new Error("nenhuma conta AdSense visível (conta ainda em aprovação?)");
  const q = new URLSearchParams();
  ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "CLICKS", "IMPRESSIONS", "PAGE_VIEWS_RPM"].forEach((m) => q.append("metrics", m));
  ["DATE", "DOMAIN_NAME"].forEach((d) => q.append("dimensions", d));
  q.set("dateRange", "LAST_30_DAYS");
  q.set("reportingTimeZone", "ACCOUNT_TIME_ZONE");
  const rep = await getJson(`https://adsense.googleapis.com/v2/${account.name}/reports:generate?${q}`, token);
  const byDomain = {};
  for (const row of rep.rows || []) {
    const cells = row.cells.map((c) => c.value);
    const [date, domain, earn, pv, clicks, imp, rpm] = cells;
    (byDomain[domain] ||= []).push([Number(earn), Number(pv), Number(clicks), Number(imp), Number(rpm), compact(date)]);
  }
  for (const d of Object.keys(byDomain)) byDomain[d].sort((a, b) => a[5].localeCompare(b[5]));
  return { account: account.name, currency: (rep.headers || []).find((h) => h.currencyCode)?.currencyCode || null, byDomain };
}

// ---------- main ----------
async function main() {
  const existing = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, "utf8")) : {};
  const sites = {};
  const now = new Date().toISOString();

  let saToken = null, saError = null;
  if (SA_JSON) {
    try { saToken = await serviceAccountToken(JSON.parse(SA_JSON), ["https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/webmasters.readonly"]); }
    catch (e) { saError = String(e.message || e); }
  } else saError = "secret GOOGLE_SA_JSON ausente";

  let adsense = null, adsenseError = null;
  if (ADSENSE_REFRESH && OAUTH_ID && OAUTH_SECRET) {
    try { adsense = await fetchAdsense(); } catch (e) { adsenseError = String(e.message || e); }
  } else adsenseError = "AdSense ainda não conectado (secret ADSENSE_REFRESH_TOKEN ausente)";

  for (const s of SITES) {
    const out = { label: s.label, domain: s.domain, generatedAt: now, errors: {} };
    const property = process.env[s.ga4Env];
    if (saToken && property) {
      try { out.ga4 = await fetchGa4(saToken, property); } catch (e) { out.errors.ga4 = String(e.message || e); }
    } else out.errors.ga4 = saError || `secret ${s.ga4Env} ausente`;
    if (saToken) {
      try { out.searchConsole = await fetchSearchConsole(saToken, s.domain); } catch (e) { out.errors.searchConsole = String(e.message || e); }
    } else out.errors.searchConsole = saError;
    if (adsense) {
      const rows = adsense.byDomain[s.domain] || adsense.byDomain["www." + s.domain];
      if (rows) out.adsense = { currency: adsense.currency, daily: rows };
      else out.errors.adsense = "conta conectada, mas sem dados para este domínio ainda";
    } else out.errors.adsense = adsenseError;

    // preserva a última leitura boa de cada fonte quando a de agora falhou
    const prev = (existing.sites || {})[s.key] || {};
    for (const src of ["ga4", "searchConsole", "adsense"]) if (!out[src] && prev[src]) { out[src] = prev[src]; out.errors[src] = "usando última leitura boa (" + out.errors[src] + ")"; }
    sites[s.key] = out;
    console.log(s.key, Object.keys(out.errors).length ? "erros: " + JSON.stringify(out.errors) : "ok");
  }

  writeFileSync(DATA_FILE, JSON.stringify({ ...existing, sites }, null, 2) + "\n");
}

main().catch((e) => { console.error(e); process.exit(0); });
