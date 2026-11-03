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

async function timeline(userId, blogId, metric, from, to) {
  const json = await get("/v2/analytics/timelines", {
    from: from + "T00:00:00", to: to + "T23:59:59", metric, network: "instagram", subject: "account", userId, blogId,
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

if (changed) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log("metrics.json atualizado (" + changed + " itens).");
} else console.log("Nada mudou.");
