// Checklist de lançamento do Painel Lisieux: guarda as marcações num arquivo do VPS,
// para valerem em qualquer aparelho. Sem dependências (só Node 18+).
//
//   GET  /checklist                → { states: { projeto: { passo: 0|1|2 } }, updatedAt }   (leitura livre)
//   PUT  /checklist/:projeto/:passo  corpo {"v":0|1|2}, cabeçalho Authorization: Bearer <senha>
//   GET  /health                   → ok
//
// Configuração por variáveis de ambiente (arquivo /etc/painel-checklist.env, permissão 600):
//   CHECKLIST_PASSWORD   senha para marcar (obrigatória, 12+ caracteres)
//   CHECKLIST_DATA       arquivo de dados (padrão: /var/lib/painel-checklist/checklist.json)
//   CHECKLIST_ORIGIN     site que pode chamar (padrão: https://vocacaodepai.github.io)
//   PORT                 porta local (padrão: 8787; só escuta em 127.0.0.1, o HTTPS fica com o Caddy)

import http from "node:http";
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";

const PASSWORD = process.env.CHECKLIST_PASSWORD || "";
const DATA = process.env.CHECKLIST_DATA || "/var/lib/painel-checklist/checklist.json";
const ORIGIN = process.env.CHECKLIST_ORIGIN || "https://vocacaodepai.github.io";
const PORT = Number(process.env.PORT || 8787);
const ID_RE = /^[a-z0-9-]{2,40}$/, STEP_RE = /^[a-z0-9:-]{2,40}$/;

if (PASSWORD.length < 12) {
  console.error("CHECKLIST_PASSWORD ausente ou curta demais (mínimo 12 caracteres).");
  process.exit(1);
}
const passHash = createHash("sha256").update(PASSWORD).digest();

let db = { states: {}, updatedAt: null };
if (existsSync(DATA)) {
  try { db = JSON.parse(readFileSync(DATA, "utf8")); } catch { console.error("Arquivo de dados ilegível; começando vazio."); }
}
if (!db.states || typeof db.states !== "object") db.states = {};

function save() {
  mkdirSync(dirname(DATA), { recursive: true });
  const tmp = DATA + ".tmp";
  writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  renameSync(tmp, DATA);
}

// trava quem erra a senha muitas vezes (10 erros em 15 minutos por IP)
const fails = new Map();
function locked(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > 15 * 60000) { fails.delete(ip); return false; }
  return f.n >= 10;
}
function failed(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.since > 15 * 60000) fails.set(ip, { n: 1, since: Date.now() });
  else f.n++;
}
function authorized(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const got = createHash("sha256").update(m[1]).digest();
  return timingSafeEqual(got, passHash);
}

function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") return send(res, 204);
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (req.method === "GET" && url.pathname === "/checklist") return send(res, 200, db);

  const m = /^\/checklist\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (req.method === "PUT" && m) {
    if (locked(ip)) return send(res, 429, { error: "muitas tentativas; espere 15 minutos" });
    if (!authorized(req)) { failed(ip); return send(res, 401, { error: "senha errada" }); }
    const pid = decodeURIComponent(m[1]), sid = decodeURIComponent(m[2]);
    if (!ID_RE.test(pid) || !STEP_RE.test(sid)) return send(res, 400, { error: "id inválido" });
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 256) req.destroy(); });
    req.on("end", () => {
      let v;
      try { v = JSON.parse(body).v; } catch { return send(res, 400, { error: "corpo inválido" }); }
      if (![0, 1, 2].includes(v)) return send(res, 400, { error: "v deve ser 0, 1 ou 2" });
      db.states[pid] = db.states[pid] || {};
      db.states[pid][sid] = v;
      db.updatedAt = new Date().toISOString();
      try { save(); } catch (e) { console.error("falha ao gravar:", e.message); return send(res, 500, { error: "não consegui gravar" }); }
      send(res, 200, { ok: true, updatedAt: db.updatedAt });
    });
    return;
  }
  send(res, 404, { error: "não encontrado" });
});

server.listen(PORT, "127.0.0.1", () => console.log("checklist do painel em 127.0.0.1:" + PORT));
