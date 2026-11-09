// Refreshes the Metricool-sourced (Instagram) rows of data/metrics.json.
// Runs on a schedule via .github/workflows/refresh-youtube.yml once the
// METRICOOL_TOKEN secret is set on the repository. Without it, it exits quietly.
//
// Scope: only snapshotRows of the items below. Each row is
// [...values in the item's metrics order, "YYYYMMDD"]; a column marked null here
// keeps whatever the existing row of the same day already had (e.g. 2.2's YouTube columns).
// The token is read from the environment only; never print it or write it anywhere.

import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.METRICOOL_TOKEN;
const DATA_FILE = "data/metrics.json";
const DAYS = 90;
const API = "https://app.metricool.com/api";

// item id -> Instagram handle of the Metricool brand + one Metricool metric per column (null = keep)
const ITEMS = {
  "2.1": { ig: "escrivatododia", cols: ["followers"] },
  "2.2": { ig: "nomeiodomundocomescriva", cols: ["followers", null, null] },
  "3.2": { ig: "vocacao.demae", cols: ["followers"] },
  "8.1": { ig: "vocacaodejogador", cols: ["followers"] },
  // Seguidores, Alcance, Visualizações, Interações, Publicações, Engajamento
  "8.2": { ig: "tudosobrevascodagama", cols: ["followers", "reach", "views", "postsInteractions", "postsCount", null] },
  "8.3": { ig: "motivacaonaminhavida", cols: ["followers"] },
};

if (!TOKEN) {
  console.log("METRICOOL_TOKEN ausente: Instagram não atualizado.");
  process.exit(0);
}

async function get(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "X-Mc-Auth": TOKEN } });
  if (!res.ok) throw new Error("Metricool " + path + " falhou: " + res.status);
  return res.json();
}

function ymd(d) { return d.toISOString().slice(0, 10); }

async function timeline(userId, blogId, metric, from, to, network = "instagram") {
  const json = await get("/v2/analytics/timelines", {
    from: from + "T00:00:00", to: to + "T23:59:59", metric, network, subject: "account", userId, blogId,
  });
  const out = {};
  const values = (json.data && json.data[0] && json.data[0].values) || [];
  for (const v of values) {
    if (v == null || v.value == null || !v.dateTime) continue;
    out[v.dateTime.slice(0, 10).replaceAll("-", "")] = String(Number(v.value).toFixed(1));
  }
  return out;
}

const profiles = await get("/admin/simpleProfiles");
const byHandle = {};
for (const p of profiles) if (p && p.instagram) byHandle[String(p.instagram).toLowerCase()] = p;

const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
data.snapshotRows = data.snapshotRows || {};
const to = ymd(new Date()), from = ymd(new Date(Date.now() - DAYS * 86400000));
let changed = 0;

for (const [itemId, spec] of Object.entries(ITEMS)) {
  const brand = byHandle[spec.ig];
  if (!brand) { console.log(itemId + ": marca @" + spec.ig + " não está na Metricool"); continue; }
  try {
    const series = [];
    for (const m of spec.cols) series.push(m ? await timeline(brand.userId, brand.id, m, from, to) : null);
    // Metricool devolve 0 enquanto ainda não coletou a conta: sem nenhum valor acima de zero, não grava nada
    if (!series.some((s) => s && Object.values(s).some((v) => Number(v) > 0))) { console.log(itemId + " @" + spec.ig + ": ainda sem dados (só zeros)"); continue; }
    const days = new Set();
    series.forEach((s) => s && Object.keys(s).forEach((d) => days.add(d)));
    const rows = {};
    for (const r of data.snapshotRows[itemId] || []) if (Array.isArray(r)) rows[r[r.length - 1]] = r;
    for (const d of days) {
      const old = rows[d] || [];
      const row = spec.cols.map((m, i) => (m ? (series[i][d] ?? null) : (old[i] ?? null)));
      if (row.every((v) => v == null)) continue;
      row.push(d);
      rows[d] = row;
    }
    const next = Object.keys(rows).sort().map((d) => rows[d]);
    if (JSON.stringify(next) !== JSON.stringify(data.snapshotRows[itemId])) { data.snapshotRows[itemId] = next; changed++; }
    const last = next[next.length - 1];
    console.log(itemId + " @" + spec.ig + ": " + next.length + " dias, último " + (last ? last[last.length - 1] + " = " + last[0] : "—"));
  } catch (e) {
    console.log(itemId + " @" + spec.ig + ": " + e.message);
  }
}

// Todas as marcas da Metricool, todas as redes ligadas: seguidores por dia em data.metricool[idDaMarca].
// O painel liga cada projeto à sua marca pelo id; marca nova aparece aqui sozinha.
const NETWORKS = [
  ["instagram", "instagram", "followers"],
  ["facebook", "facebookPageId", "pageFollows"],
  ["youtube", "youtube", "totalSubscribers"],
  ["tiktok", "tiktok", "followers_count"],
  ["threads", "threads", "followers_count"],
];
const brands = {};
for (const p of profiles) {
  if (!p || !p.id) continue;
  const old = (data.metricool || {})[p.id] || {};
  const entry = { label: p.label || "", series: {}, errors: {} };
  for (const [net, field, metric] of NETWORKS) {
    if (!p[field]) continue;
    try {
      const fresh = await timeline(p.userId, p.id, metric, from, to, net);
      const rows = {};
      for (const r of (old.series && old.series[net]) || []) rows[r[1]] = r;
      for (const [d, v] of Object.entries(fresh)) rows[d] = [v, d];
      const list = Object.keys(rows).sort().map((d) => rows[d]);
      // 0 enquanto a Metricool ainda não coletou: só grava quando há algum valor acima de zero
      if (list.some((r) => Number(r[0]) > 0)) entry.series[net] = list;
      else entry.errors[net] = "ainda sem dados";
    } catch (e) { entry.errors[net] = e.message; }
  }
  brands[p.id] = entry;
  const nets = Object.keys(entry.series);
  console.log("marca " + p.id + " " + entry.label + ": " + (nets.length ? nets.map((n) => n + " " + entry.series[n][entry.series[n].length - 1][0]).join(", ") : "sem dados ainda"));
}
if (JSON.stringify(brands) !== JSON.stringify(data.metricool || {})) { data.metricool = brands; changed++; }

if (changed) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log("metrics.json atualizado (" + changed + " itens).");
} else console.log("Nada mudou.");
