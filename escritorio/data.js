/* Painel Lisieux — equipe do escritório (só dados, sem desenho).
 * Usado pela página do escritório (escritorio/index.html) e pelo painel (index.html, rota #/escritorio).
 *
 * window.LisieuxRoster
 *   KEY ("vdp-office-v2")       lista da equipe no localStorage
 *   COMPANIES (getter)          [{ id, num, name, short, label }] — "chefia", "f1".."f8", "central"
 *   companies()                 idem (nomes das frentes lidos de "vdp-painel-state-v1" quando existirem)
 *   company(id) / companyName(id)
 *   load()                      lista saneada do localStorage (sem nada salvo => seed())
 *   save(list)                  saneia, grava e devolve a lista gravada (ou null se falhar)
 *   seed()                      equipe sugerida: Diretoria (Bruno + Esposa) + redator(a) e pesquisador(a) por empresa
 *   sanitize(list)              id ^[a-z0-9-]{2,40}$, textos cortados, empresa desconhecida => "central", máx. 80
 *   robots(metrics, now?)       os 3 robôs reais, com estado calculado a partir de data/metrics.json
 *   look(person)                visual determinístico (pele, cabelo, penteado, roupa) a partir do id
 *   merge(roster, robots, liveMap, demoMap, liveMode)  lista final (ao vivo sobrepõe por id; demo só com liveMode "off")
 *   kindLabel(kind), roleIcon(person), newId(name, list)
 * Tudo que vem do localStorage ou do servidor é tratado como texto não confiável (quem desenha usa textContent).
 */
(function(){
  "use strict";
  var KEY = "vdp-office-v2", STATE_KEY = "vdp-painel-state-v1", MAX = 80;
  var ID_RE = /^[a-z0-9-]{2,40}$/;
  var hasOwn = function(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); };

  var DEFAULT_NAMES = { f1:"Vocação de Pai", f2:"Apostolado São José", f3:"Vocação de Mãe", f4:"Pai de Negócios",
                        f5:"Ateliê Lisieux", f6:"Pequena Via", f7:"Flor de Lisieux", f8:"Apostas" };
  var DEFAULT_SHORT = { f1:"VOCAÇÃO DE PAI", f2:"APOSTOLADO", f3:"VOCAÇÃO DE MÃE", f4:"PAI DE NEGÓCIOS",
                        f5:"ATELIÊ LISIEUX", f6:"PEQUENA VIA", f7:"FLOR DE LISIEUX", f8:"APOSTAS" };
  var COMPANY_IDS = ["chefia", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "central"];
  var KINDS = { chefia:"Diretoria", agente:"Agente IA", funcionario:"Funcionário", robo:"Robô real" };
  var ORIGINS = { chefia:"diretoria", agente:"agente IA", funcionario:"funcionário", robo:"robô real" };

  function pad2(n){ return (n<10 ? "0" : "")+n; }
  function clean(s, n){
    return String(s==null ? "" : s).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  }
  function upper(s){ try{ return s.toLocaleUpperCase("pt-BR"); }catch(e){ return s.toUpperCase(); } }
  function shortOf(name){
    var s = upper(clean(name, 60));
    if(s.length<=15) return s;
    var words = s.split(" "), out = "";
    for(var i=0; i<words.length; i++){
      var t = out ? out+" "+words[i] : words[i];
      if(t.length>15) break;
      out = t;
    }
    return out || s.slice(0, 15);
  }
  function readFronts(){
    try{
      var st = JSON.parse(localStorage.getItem(STATE_KEY));
      return (st && st.fronts && typeof st.fronts==="object") ? st.fronts : {};
    }catch(e){ return {}; }
  }
  function companies(){
    var fr = readFronts();
    var out = [{ id:"chefia", num:0, name:"Diretoria", short:"DIRETORIA", label:"Diretoria" }];
    for(var i=1; i<=8; i++){
      var id = "f"+i, f = hasOwn(fr, id) && fr[id] && typeof fr[id]==="object" ? fr[id] : null;
      var nm = f && typeof f.name==="string" && clean(f.name, 40) ? clean(f.name, 40) : DEFAULT_NAMES[id];
      out.push({ id:id, num:i, name:nm, short:nm===DEFAULT_NAMES[id] ? DEFAULT_SHORT[id] : shortOf(nm), label:pad2(i)+" · "+nm });
    }
    out.push({ id:"central", num:9, name:"Central de dados", short:"CENTRAL DE DADOS", label:"Central de dados" });
    return out;
  }
  function company(id){
    var list = companies();
    for(var i=0; i<list.length; i++){ if(list[i].id===id) return list[i]; }
    return list[list.length-1];
  }

  // ---------- ids ----------
  function slug(s){
    var t = String(s||"");
    try{ t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }catch(e){}
    return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  }
  function uniq(id, seen){
    if(!seen[id]) return id;
    for(var n=2; n<1000; n++){ var t = id.slice(0, 36)+"-"+n; if(!seen[t]) return t; }
    return id.slice(0, 30)+"-"+Math.floor(Math.random()*1e6);
  }
  function newId(name, list){
    var seen = {}; (list||[]).forEach(function(p){ if(p && p.id) seen[p.id] = 1; });
    var base = slug(name); base = base.length>=2 ? "p-"+base : "p-pessoa";
    return uniq(base, seen);
  }

  // ---------- visual ----------
  var COLOR_RE = /^#[0-9a-fA-F]{6}$/, STYLE_RE = /^[a-z-]{2,20}$/;
  function cleanLook(l){
    if(!l || typeof l!=="object") return null;
    var o = {}, n = 0;
    ["skin", "hair", "shirt", "pants", "jacket"].forEach(function(k){ if(typeof l[k]==="string" && COLOR_RE.test(l[k])){ o[k] = l[k].toLowerCase(); n++; } });
    if(typeof l.hairStyle==="string" && STYLE_RE.test(l.hairStyle)){ o.hairStyle = l.hairStyle; n++; }
    if(typeof l.skirt==="boolean"){ o.skirt = l.skirt; n++; }
    return n ? o : null;
  }

  // ---------- saneamento ----------
  function sanitize(list){
    if(!Array.isArray(list)) return null;
    var out = [], seen = {};
    for(var i=0; i<list.length && out.length<MAX; i++){
      var a = list[i];
      if(!a || typeof a!=="object") continue;
      var name = clean(a.name, 32) || "Sem nome";
      var id = typeof a.id==="string" ? a.id.trim().toLowerCase() : "";
      if(!ID_RE.test(id) || id.indexOf("auto-")===0) id = newId(name, out);
      id = uniq(id, seen); seen[id] = 1;
      var comp = typeof a.company==="string" && COMPANY_IDS.indexOf(a.company)>=0 ? a.company : "central";
      var kind = (a.kind==="chefia" || a.kind==="agente" || a.kind==="funcionario") ? a.kind : (comp==="chefia" ? "chefia" : "agente");
      var p = { id:id, name:name, role:clean(a.role, 40), company:comp, kind:kind, status:a.status==="work" ? "work" : "rest", task:clean(a.task, 120) };
      var lk = cleanLook(a.look); if(lk) p.look = lk;
      out.push(p);
    }
    return out;
  }

  // ---------- equipe sugerida ----------
  var SEED_TEAM = [
    ["f1", "Tiago", "Redator", "Helena", "Pesquisadora"],
    ["f2", "Marta", "Redatora", "Bento", "Pesquisador"],
    ["f3", "Cecília", "Redatora", "Lúcia", "Pesquisadora"],
    ["f4", "Rafael", "Redator", "Mateus", "Pesquisador"],
    ["f5", "Beatriz", "Redatora", "Clara", "Pesquisadora"],
    ["f6", "Davi", "Redator", "Isabel", "Pesquisadora"],
    ["f7", "Joana", "Redatora", "Gabriel", "Pesquisador"],
    ["f8", "Pedro", "Redator", "Lucas", "Pesquisador"]
  ];
  function seed(){
    var out = [
      { id:"chefia-bruno", name:"Bruno", role:"Diretor", company:"chefia", kind:"chefia", status:"rest", task:"" },
      { id:"chefia-esposa", name:"Esposa", role:"Diretora", company:"chefia", kind:"chefia", status:"rest", task:"" }
    ];
    SEED_TEAM.forEach(function(t){
      out.push({ id:t[0]+"-redator", name:t[1], role:t[2], company:t[0], kind:"agente", status:"rest", task:"" });
      out.push({ id:t[0]+"-pesquisador", name:t[3], role:t[4], company:t[0], kind:"agente", status:"rest", task:"" });
    });
    return out;
  }

  function load(){
    var raw = null;
    try{ raw = localStorage.getItem(KEY); }catch(e){ raw = null; }
    if(raw==null) return seed();
    var parsed = null;
    try{ parsed = JSON.parse(raw); }catch(e){ parsed = null; }
    var list = sanitize(parsed);
    return list || seed();
  }
  function save(list){
    var clean_ = sanitize(list) || [];
    try{ localStorage.setItem(KEY, JSON.stringify(clean_)); }catch(e){ return null; }
    return clean_;
  }

  // ---------- robôs reais (estado vindo de data/metrics.json) ----------
  function hhmm(ms){ var d = new Date(ms); return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
  function robots(metrics, now){
    var m = metrics && typeof metrics==="object" ? metrics : null;
    now = typeof now==="number" ? now : Date.now();
    var gen = m && m.generatedAt ? Date.parse(m.generatedAt) : NaN;
    var age = now - gen, fresh = !isNaN(gen) && age<=15*60000 && age>-5*60000;
    var yt = { id:"auto-yt", name:"Robô YouTube", role:"Coleta o YouTube a cada 5 min", company:"central", kind:"robo",
      status:fresh ? "work" : "rest",
      task:fresh ? "Coletando YouTube · última leitura "+hhmm(gen)
        : (!m ? "Sem conexão com os dados" : (isNaN(gen) ? "Sem data da última coleta" : "Esperando a próxima coleta · última leitura "+hhmm(gen))) };
    var ok = 0, sites = m && m.sites && typeof m.sites==="object" ? m.sites : {};
    Object.keys(sites).forEach(function(k){
      var s = sites[k]; if(!s || typeof s!=="object") return;
      var er = s.errors && typeof s.errors==="object" ? s.errors : {};
      ["ga4", "searchConsole", "adsense"].forEach(function(src){ if(s[src] && !er[src]) ok++; });
    });
    var st = { id:"auto-sites", name:"Robô dos Sites", role:"GA4 · Search Console · AdSense", company:"central", kind:"robo",
      status:ok>0 ? "work" : "rest",
      task:ok>0 ? "Lendo "+ok+" fonte"+(ok===1 ? "" : "s")+" dos sites (GA4 · Search Console · AdSense)"
        : (m ? "Dormindo: faltam as credenciais do Google" : "Sem conexão com os dados") };
    var lr = { id:"auto-leituras", name:"Analista de Leituras", role:"Escreve as leituras do painel", company:"central", kind:"robo",
      status:m ? "work" : "rest", task:m ? "Lendo os dados do painel" : "Sem dados para ler" };
    return [yt, st, lr];
  }

  // ---------- visual determinístico ----------
  function hash(s){ var h = 2166136261; s = String(s||""); for(var i=0; i<s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h>>>0; }
  var SKINS = ["#fbc2a6", "#f0b29a", "#a77264", "#fbc2a6", "#f0b29a"];
  var HAIRS = ["#815d44", "#5a4340", "#403f4d", "#4f5d75", "#a46533", "#815d44", "#403f4d"];
  var SHIRTS = ["#4563c2", "#ba3335", "#4a7e54", "#a4466a", "#3c4878", "#7fae5a", "#863c3d", "#4563c2"];
  var PANTS = ["#393647", "#3c4878", "#4b5a7a", "#393647"];
  var STYLES_F = ["long", "bob", "bun", "ponytail", "long", "curly"];
  var STYLES_M = ["short", "side-part", "spiky", "messy", "buzz", "curly", "afro", "short"];
  function isFem(p){
    var w = clean(p.role, 40).split(" ")[0].toLowerCase();
    if(/(ora|eira|ada|ira|ana)$/.test(w)) return true;
    if(/(or|eiro|ado|iro)$/.test(w)) return false;
    var n = clean(p.name, 32).split(" ")[0].toLowerCase();
    return /a$/.test(n);
  }
  var SPECIAL = {
    "chefia-bruno": { skin:"#f0b29a", hair:"#815d44", hairStyle:"side-part", shirt:"#dfe0ea", jacket:"#3c4878", pants:"#393647" },
    "chefia-esposa": { skin:"#fbc2a6", hair:"#a46533", hairStyle:"long", shirt:"#dfe0ea", pants:"#a4466a", skirt:true }
  };
  function look(p){
    p = p || {};
    var h = hash(p.id||p.name), o;
    if(hasOwn(SPECIAL, p.id)) o = JSON.parse(JSON.stringify(SPECIAL[p.id]));
    else if(p.kind==="robo") o = { skin:SKINS[h%2], hair:"#58545b", hairStyle:"buzz", shirt:"#dfe0ea", pants:"#3c4878" };
    else {
      var fem = isFem(p);
      o = { skin:SKINS[h%SKINS.length], hair:HAIRS[(h>>>3)%HAIRS.length],
            hairStyle:fem ? STYLES_F[(h>>>6)%STYLES_F.length] : STYLES_M[(h>>>6)%STYLES_M.length],
            shirt:SHIRTS[(h>>>9)%SHIRTS.length], pants:PANTS[(h>>>12)%PANTS.length] };
      if(p.kind==="chefia"){ o.shirt = "#dfe0ea"; if(fem){ o.pants = "#863c3d"; o.skirt = true; } else o.jacket = "#333545"; }
      if(p.kind==="agente" && (h>>>15)%3===0) o.jacket = "#333545";
    }
    var lk = cleanLook(p.look); if(lk) for(var k in lk) if(hasOwn(lk, k)) o[k] = lk[k];
    o.badge = (p.kind==="agente" || p.kind==="robo") ? "A" : null;
    return o;
  }

  // ---------- ícone do balão (pela função) ----------
  function roleIcon(p){
    if(!p) return "clip";
    if(p.kind==="robo") return "chart";
    if(p.kind==="chefia" || p.company==="chefia") return "star";
    var r = clean(p.role, 40).toLowerCase();
    if(/redat|escrit|roteir|copy|revis|edit/.test(r)) return "pencil";
    if(/pesquis|analis|dados|curad/.test(r)) return "search";
    return "clip";
  }

  // ---------- lista final ----------
  function merge(roster, robotsList, liveMap, demoMap, liveMode){
    var out = [], ids = {}, liveOn = !!liveMode && liveMode!=="off";
    (robotsList||[]).concat(roster||[]).forEach(function(p){
      if(!p || !p.id || ids[p.id]) return;
      ids[p.id] = 1;
      var q = {}; for(var k in p) if(hasOwn(p, k)) q[k] = p[k];
      q.origin = ORIGINS[q.kind] || "agente IA";
      var lv = liveOn && liveMap && hasOwn(liveMap, p.id) ? liveMap[p.id] : null;
      if(lv && typeof lv==="object"){
        q.status = lv.status==="work" ? "work" : "rest";
        q.task = clean(lv.task, 120);
        q.live = true; q.stale = !!lv.stale; q.updatedAt = typeof lv.updatedAt==="number" ? lv.updatedAt : null;
        q.origin = "ao vivo";
      } else if(liveMode==="off" && demoMap && hasOwn(demoMap, p.id) && q.kind!=="robo"){
        var d = demoMap[p.id] || {};
        q.status = d.status==="work" ? "work" : "rest";
        q.task = clean(d.task, 120);
        q.demo = true;
      }
      out.push(q);
    });
    return out;
  }

  var api = {
    KEY:KEY, STATE_KEY:STATE_KEY, MAX:MAX, ID_RE:ID_RE, COMPANY_IDS:COMPANY_IDS.slice(),
    companies:companies, company:company,
    companyName:function(id){ return company(id).name; },
    load:load, save:save, seed:seed, sanitize:sanitize, robots:robots, look:look, merge:merge,
    kindLabel:function(k){ return KINDS[k] || "Agente IA"; },
    roleIcon:roleIcon, newId:newId, shortOf:shortOf, clean:clean
  };
  Object.defineProperty(api, "COMPANIES", { get:companies, enumerable:true });
  window.LisieuxRoster = api;
})();
