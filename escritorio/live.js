/* Painel Lisieux — camada AO VIVO do escritório (sem bibliotecas).
 *
 * Contrato:
 *   LisieuxLive.start(onUpdate)  -> inicia (chamar de novo reinicia)
 *   LisieuxLive.stop()           -> para tudo (timers, socket, listeners)
 *   LisieuxLive.isConfigured()   -> true se config.js tem url + anon key
 *
 *   onUpdate(statusMap, meta)
 *     statusMap = { [agentId]: { status: "work"|"rest", task, company,
 *                                updatedAt (ms epoch | null), stale } }
 *       - linha "work" sem atualização há mais de staleMinutes => status "rest", stale: true
 *     meta = { mode: "off"|"connecting"|"live"|"offline", lastEventAt (ms | null),
 *              error (string | null), realtime (bool: socket juntado ao canal) }
 *       - off: config vazio (Modo Demo). onUpdate({}, {mode:"off"}) é chamado 1 vez.
 *       - connecting: ainda sem nenhuma resposta do servidor
 *       - live: última consulta REST deu certo OU o socket está no canal
 *       - offline: REST falhando e socket fora do canal
 *
 * Fluxo: GET REST inicial -> WebSocket Realtime (protocolo Phoenix vsn 1.0.0)
 *   com postgres_changes; heartbeat 25 s; reconexão com backoff (máx. 30 s);
 *   consulta REST a cada pollMs (mín. 1 s) enquanto o socket não está no canal e a cada
 *   60 s mesmo com ele. Pausa com a aba oculta. Dados do servidor = não confiáveis.
 */
(function () {
  "use strict";

  var TOPIC = "realtime:lisieux";
  var TABLE = "lisieux_agent_status";
  var HEARTBEAT_MS = 25000;
  var JOINED_POLL_MS = 60000;
  var MAX_BACKOFF_MS = 30000;
  var FETCH_TIMEOUT_MS = 8000;
  var ID_RE = /^[a-z0-9-]{1,40}$/;

  var S = null; // estado da sessão atual

  function cfg() {
    var c = window.LISIEUX_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim().replace(/\/+$/, ""),
      key: String(c.supabaseAnonKey || "").trim(),
      pollMs: Math.max(1000, Number(c.pollMs) || 4000),
      staleMs: Math.max(1, Number(c.staleMinutes) || 30) * 60000
    };
  }

  function cap(v, n) {
    if (v == null) return null;
    var s = String(v).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  // Normaliza uma linha vinda do servidor; null se inválida.
  function clean(r) {
    if (!r || typeof r !== "object") return null;
    var id = typeof r.agent_id === "string" ? r.agent_id : "";
    if (!ID_RE.test(id)) return null;
    var st = r.status === "work" || r.status === "rest" ? r.status : null;
    if (!st) return null;
    var t = r.updated_at ? Date.parse(String(r.updated_at).slice(0, 40)) : NaN;
    return {
      id: id,
      status: st,
      task: cap(r.task, 120) || "",
      company: cap(r.company, 60),
      updatedAt: isFinite(t) ? t : null
    };
  }

  function buildMap() {
    var out = {}, now = Date.now(), staleMs = S.c.staleMs;
    Object.keys(S.rows).forEach(function (id) {
      var r = S.rows[id];
      var stale = r.status === "work" && (r.updatedAt == null || now - r.updatedAt > staleMs);
      out[id] = {
        status: stale ? "rest" : r.status,
        task: r.task,
        company: r.company,
        updatedAt: r.updatedAt,
        stale: stale
      };
    });
    return out;
  }

  function computeMode() {
    if (S.joined || S.restOk) return "live";
    if (!S.everOk && !S.everFailed) return "connecting";
    return "offline";
  }

  function emit() {
    if (!S || S.stopped) return;
    var meta = {
      mode: computeMode(),
      lastEventAt: S.lastEventAt,
      error: S.error,
      realtime: !!S.joined
    };
    try { S.cb(buildMap(), meta); } catch (e) {
      if (window.console) console.error("[LisieuxLive] erro no onUpdate:", e);
    }
  }

  function warnOnce(msg) {
    S.error = msg;
    if (S.lastWarn === msg) return;
    S.lastWarn = msg;
    if (window.console) console.warn("[LisieuxLive] " + msg);
  }

  // ---------- REST ----------
  function fetchAll() {
    if (!S || S.stopped || S.paused) return Promise.resolve();
    var my = S;
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, FETCH_TIMEOUT_MS);
    return fetch(my.c.url + "/rest/v1/" + TABLE + "?select=*", {
      headers: { apikey: my.c.key, Authorization: "Bearer " + my.c.key, Accept: "application/json" },
      cache: "no-store",
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error("REST " + res.status);
      return res.json();
    }).then(function (data) {
      if (my !== S || my.stopped) return;
      if (!Array.isArray(data)) throw new Error("resposta REST inesperada");
      var rows = {};
      for (var i = 0; i < data.length && i < 500; i++) {
        var r = clean(data[i]);
        if (r) rows[r.id] = r;
      }
      my.rows = rows;
      my.restOk = true;
      my.everOk = true;
      my.lastEventAt = Date.now();
      if (!my.joined) my.error = null;
      emit();
    }).catch(function (e) {
      if (my !== S || my.stopped) return;
      my.restOk = false;
      my.everFailed = true;
      warnOnce("falha ao consultar status: " + (e && e.name === "AbortError" ? "tempo esgotado" : (e && e.message) || e));
      emit();
    }).then(function () { clearTimeout(to); });
  }

  function schedulePoll() {
    if (!S || S.stopped || S.paused) return;
    clearTimeout(S.pollT);
    S.pollT = setTimeout(function () {
      fetchAll().then(schedulePoll);
    }, S.joined ? JOINED_POLL_MS : S.c.pollMs);
  }

  // ---------- Realtime (Phoenix) ----------
  function wsUrl(c) {
    var u = new URL(c.url);
    var proto = u.protocol === "http:" ? "ws:" : "wss:";
    return proto + "//" + u.host + "/realtime/v1/websocket?apikey=" +
      encodeURIComponent(c.key) + "&vsn=1.0.0";
  }

  function send(ws, msg) {
    try { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch (e) { /* ignora */ }
  }

  function connect() {
    if (!S || S.stopped || S.paused || S.ws || typeof WebSocket !== "function") return;
    var my = S, ws;
    try { ws = new WebSocket(wsUrl(my.c)); } catch (e) {
      warnOnce("tempo real indisponível");
      return scheduleReconnect();
    }
    my.ws = ws;
    my.ref = 0;
    my.joinRef = null;

    ws.onopen = function () {
      if (my !== S || my.ws !== ws) return;
      my.ref += 1;
      my.joinRef = String(my.ref);
      send(ws, {
        topic: TOPIC,
        event: "phx_join",
        payload: {
          config: { postgres_changes: [{ event: "*", schema: "public", table: TABLE }] },
          access_token: my.c.key
        },
        ref: my.joinRef,
        join_ref: my.joinRef
      });
      clearInterval(my.hbT);
      my.hbT = setInterval(function () {
        my.ref += 1;
        send(ws, { topic: "phoenix", event: "heartbeat", payload: {}, ref: String(my.ref) });
      }, HEARTBEAT_MS);
    };

    ws.onmessage = function (ev) {
      if (my !== S || my.ws !== ws) return;
      if (typeof ev.data !== "string" || ev.data.length > 65536) return;
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== "object") return;

      if (m.event === "phx_reply" && m.topic === TOPIC && String(m.ref) === my.joinRef) {
        var ok = m.payload && m.payload.status === "ok";
        if (ok) {
          my.joined = true;
          my.backoff = 0;
          my.error = null;
          my.lastEventAt = Date.now();
          emit();
          schedulePoll(); // passa a consultar só a cada 60 s
        } else {
          warnOnce("tempo real recusou o canal");
          try { ws.close(); } catch (e) { /* ignora */ }
        }
        return;
      }

      if (m.topic === TOPIC && (m.event === "phx_error" || m.event === "phx_close")) {
        try { ws.close(); } catch (e) { /* ignora */ }
        return;
      }

      if (m.event === "postgres_changes" && m.topic === TOPIC) {
        var d = m.payload && m.payload.data;
        if (!d || (d.table && d.table !== TABLE)) return;
        my.lastEventAt = Date.now();
        if (d.type === "DELETE") {
          var old = d.old_record || {};
          if (typeof old.agent_id === "string" && ID_RE.test(old.agent_id)) delete my.rows[old.agent_id];
        } else if (d.type === "INSERT" || d.type === "UPDATE") {
          var r = clean(d.record);
          if (r) my.rows[r.id] = r;
        } else {
          return;
        }
        emit();
      }
    };

    ws.onerror = function () { /* onclose cuida */ };

    ws.onclose = function () {
      if (my !== S || my.ws !== ws) return;
      clearInterval(my.hbT);
      var wasJoined = my.joined;
      my.ws = null;
      my.joined = false;
      if (my.stopped || my.paused) return;
      if (wasJoined) {
        emit();
        schedulePoll(); // volta a consultar a cada pollMs
      }
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (!S || S.stopped || S.paused) return;
    clearTimeout(S.reT);
    var base = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, S.backoff || 0));
    S.backoff = Math.min((S.backoff || 0) + 1, 6);
    var delay = Math.min(MAX_BACKOFF_MS, Math.round(base * (0.8 + Math.random() * 0.4)));
    S.reT = setTimeout(connect, delay);
  }

  function closeSocket() {
    if (!S) return;
    clearInterval(S.hbT);
    clearTimeout(S.reT);
    var ws = S.ws;
    S.ws = null;
    S.joined = false;
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* ignora */ } }
  }

  // ---------- Aba oculta ----------
  function onVis() {
    if (!S || S.stopped) return;
    if (document.hidden) {
      S.paused = true;
      clearTimeout(S.pollT);
      closeSocket();
    } else if (S.paused) {
      S.paused = false;
      S.backoff = 0;
      fetchAll().then(schedulePoll);
      connect();
    }
  }

  // ---------- API ----------
  function stop() {
    if (!S) return;
    S.stopped = true;
    clearTimeout(S.pollT);
    closeSocket();
    document.removeEventListener("visibilitychange", onVis);
    S = null;
  }

  function start(onUpdate) {
    stop();
    var c = cfg();
    var cb = typeof onUpdate === "function" ? onUpdate : function () {};
    if (!c.url || !c.key) {
      try { cb({}, { mode: "off", lastEventAt: null, error: null, realtime: false }); } catch (e) { /* ignora */ }
      return;
    }
    try { new URL(c.url); } catch (e) {
      try { cb({}, { mode: "off", lastEventAt: null, error: "supabaseUrl inválida", realtime: false }); } catch (e2) { /* ignora */ }
      return;
    }
    S = {
      c: c, cb: cb, rows: {}, ws: null, joined: false, restOk: false,
      everOk: false, everFailed: false, lastEventAt: null, error: null,
      backoff: 0, paused: !!document.hidden, stopped: false,
      pollT: null, reT: null, hbT: null, ref: 0, joinRef: null, lastWarn: null
    };
    document.addEventListener("visibilitychange", onVis);
    emit(); // mode "connecting"
    if (S.paused) return; // começa quando a aba ficar visível
    fetchAll().then(schedulePoll);
    connect();
  }

  window.LisieuxLive = {
    start: start,
    stop: stop,
    isConfigured: function () { var c = cfg(); return !!(c.url && c.key); }
  };
})();
