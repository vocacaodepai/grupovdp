#!/usr/bin/env node
// Painel Lisieux — avisa o escritório virtual o que um agente está fazendo.
//
// Uso:
//   node scripts/agente.mjs inicio <agentId> "<tarefa>" [empresa]   -> status "work"
//   node scripts/agente.mjs fim <agentId>                           -> status "rest"
//   node scripts/agente.mjs status                                  -> lista todos
//
// Variáveis de ambiente:
//   LISIEUX_SUPABASE_URL       ex.: https://xxxx.supabase.co
//   LISIEUX_SUPABASE_ANON_KEY  chave anon (pública)
//   LISIEUX_STATUS_SECRET      segredo de escrita (o mesmo de lisieux_secrets 'writer'); só inicio/fim
//   LISIEUX_SESSION            (opcional) identificador da sessão, gravado junto
//
// Nunca quebra uma sessão: sem variáveis ou sem rede, avisa em uma linha no
// stderr e sai com código 0. Só sai com 1 em uso errado ou quando o servidor
// recusa (segredo inválido, agentId inválido...). Sem dependências.

const TIMEOUT_MS = 8000;
const ID_RE = /^[a-z0-9-]{2,40}$/;

const [cmd, ...args] = process.argv.slice(2);
const URL_BASE = (process.env.LISIEUX_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON = (process.env.LISIEUX_SUPABASE_ANON_KEY || "").trim();
const SECRET = (process.env.LISIEUX_STATUS_SECRET || "").trim();
const SESSION = (process.env.LISIEUX_SESSION || "").trim().slice(0, 120) || null;

function usage(code = 1) {
  process.stderr.write(
    'uso: node scripts/agente.mjs inicio <agentId> "<tarefa>" [empresa] | fim <agentId> | status\n'
  );
  process.exit(code);
}

function soft(msg) {
  process.stderr.write(`agente: ${msg}\n`);
  process.exit(0);
}

function hard(msg) {
  process.stderr.write(`agente: ${msg}\n`);
  process.exit(1);
}

function headers(extra = {}) {
  return { apikey: ANON, Authorization: `Bearer ${ANON}`, Accept: "application/json", ...extra };
}

async function call(path, init) {
  let res;
  try {
    res = await fetch(URL_BASE + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const why = e && (e.name === "TimeoutError" || e.name === "AbortError") ? "tempo esgotado (8 s)" : "sem conexão";
    soft(`escritório indisponível — ${why}; seguindo sem registrar.`);
  }
  const text = await res.text().catch(() => "");
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || text.slice(0, 200) || `HTTP ${res.status}`;
    if (res.status >= 500) soft(`escritório respondeu ${res.status}: ${String(msg).slice(0, 200)}`);
    hard(`recusado (${res.status}): ${String(msg).slice(0, 200)}`);
  }
  return body;
}

function needEnv(withSecret) {
  const missing = [];
  if (!URL_BASE) missing.push("LISIEUX_SUPABASE_URL");
  if (!ANON) missing.push("LISIEUX_SUPABASE_ANON_KEY");
  if (withSecret && !SECRET) missing.push("LISIEUX_STATUS_SECRET");
  if (missing.length) soft(`escritório ao vivo não configurado (faltando ${missing.join(", ")}); nada a fazer.`);
}

async function setStatus(agentId, status, task, company) {
  if (!ID_RE.test(agentId || "")) hard(`agentId inválido "${agentId || ""}" (use a-z, 0-9 e "-", 2 a 40 caracteres)`);
  needEnv(true);
  const row = await call("/rest/v1/rpc/lisieux_set_status", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      p_secret: SECRET,
      p_agent_id: agentId,
      p_status: status,
      p_task: String(task || "").trim().slice(0, 120),
      p_company: company ? String(company).trim().slice(0, 60) : null,
      p_session: SESSION
    })
  });
  const r = Array.isArray(row) ? row[0] : row;
  if (status === "work") console.log(`ok: ${agentId} trabalhando — ${(r && r.task) || task || "(sem tarefa)"}`);
  else console.log(`ok: ${agentId} descansando`);
}

function ago(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "?";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

async function listStatus() {
  needEnv(false);
  const rows = await call("/rest/v1/lisieux_agent_status?select=*&order=agent_id", { headers: headers() });
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("nenhum agente registrado ainda.");
    return;
  }
  for (const r of rows) {
    const st = r.status === "work" ? "trabalhando" : "descansando";
    const emp = r.company ? ` [${String(r.company).slice(0, 60)}]` : "";
    const task = r.task ? ` — ${String(r.task).slice(0, 120)}` : "";
    console.log(`${String(r.agent_id).slice(0, 40).padEnd(24)} ${st.padEnd(12)} ${ago(r.updated_at).padEnd(10)}${emp}${task}`);
  }
}

try {
  if (cmd === "inicio" || cmd === "início") {
    if (!args[0]) usage();
    await setStatus(args[0], "work", args[1] || "", args[2] || null);
  } else if (cmd === "fim") {
    if (!args[0]) usage();
    await setStatus(args[0], "rest", "", null);
  } else if (cmd === "status") {
    await listStatus();
  } else {
    usage(cmd ? 1 : 0);
  }
} catch (e) {
  soft(`erro inesperado: ${(e && e.message) || e}`);
}
