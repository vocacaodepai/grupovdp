/* Painel Lisieux — equipe do escritório (só dados, sem desenho).
 * Usado pela página do escritório (escritorio/index.html) e pelo painel (index.html, rota #/escritorio).
 *
 * window.LisieuxRoster
 *   KEY ("vdp-office-v2")       lista da equipe no localStorage
 *   COMPANIES (getter)          [{ id, num, name, short, label }] — "chefia", "f1".."f9", "central"
 *   companies()                 idem (nomes das frentes lidos de "vdp-painel-state-v1" quando existirem)
 *   company(id) / companyName(id)
 *   load()                      lista saneada do localStorage (sem nada salvo => seed())
 *   save(list)                  saneia, grava e devolve a lista gravada (ou null se falhar)
 *   seed()                      equipe sugerida: Diretoria (Bruno + Esposa) + redator(a) e pesquisador(a) por empresa
 *   sanitize(list)              id ^[a-z0-9-]{2,40}$, textos cortados, empresa desconhecida => "central", máx. 80
 *   robots(metrics, now?)       os 3 robôs reais, com estado calculado a partir de data/metrics.json
 *   routines()                  agentes fixos, um por rotina agendada real (ids "rt-*"; o status vem do ao vivo)
 *   staff()                     sócios (mesa do Grupo Lisieux), recepcionistas e pessoal da limpeza (ids "st-*")
 *   placeOf(p)                  "Blogs · Portal da AI", "Recepção", "Limpeza"...
 *   BLOGS                       os blogs da empresa 09 (key, name, short, domain), na ordem das baias do escritório
 *   look(person)                visual determinístico (pele, cabelo, penteado, roupa) a partir do id
 *   merge(roster, robots, liveMap, demoMap, liveMode)  lista final: robôs + equipe fixa + rotinas + equipe (ao vivo sobrepõe por id; demo só com liveMode "off")
 *   kindLabel(kind), roleIcon(person), newId(name, list)
 * Tudo que vem do localStorage ou do servidor é tratado como texto não confiável (quem desenha usa textContent).
 */
(function(){
  "use strict";
  var KEY = "vdp-office-v2", STATE_KEY = "vdp-painel-state-v1", MAX = 80;
  var ID_RE = /^[a-z0-9-]{2,40}$/;
  var hasOwn = function(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); };

  var DEFAULT_NAMES = { f1:"Vocação de Pai", f2:"Apostolado São José", f3:"Vocação de Mãe", f4:"Pai de Negócios",
                        f5:"Ateliê Lisieux", f6:"Pequena Via", f7:"Flor de Lisieux", f8:"Apostas", f9:"Blogs" };
  var DEFAULT_SHORT = { f1:"VOCAÇÃO DE PAI", f2:"APOSTOLADO", f3:"VOCAÇÃO DE MÃE", f4:"PAI DE NEGÓCIOS",
                        f5:"ATELIÊ LISIEUX", f6:"PEQUENA VIA", f7:"FLOR DE LISIEUX", f8:"APOSTAS", f9:"BLOGS" };
  var FRONTS = 9;
  var COMPANY_IDS = ["chefia", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "central"];
  var KINDS = { chefia:"Diretoria", agente:"Agente IA", funcionario:"Funcionário", robo:"Robô real", rotina:"Rotina real", ajudante:"Subagente",
                socio:"Sócio", recepcao:"Recepção", limpeza:"Limpeza" };
  var ORIGINS = { chefia:"diretoria", agente:"agente IA", funcionario:"funcionário", robo:"robô real", rotina:"rotina real", ajudante:"subagente da rotina",
                  socio:"sócio do projeto", recepcao:"recepção", limpeza:"limpeza" };
  var RESERVED_RE = /^(auto|rt|st)-/;       // ids dos robôs, das rotinas e da equipe fixa: a equipe editável nunca usa

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
    for(var i=1; i<=FRONTS; i++){
      var id = "f"+i, f = hasOwn(fr, id) && fr[id] && typeof fr[id]==="object" ? fr[id] : null;
      var nm = f && typeof f.name==="string" && clean(f.name, 40) ? clean(f.name, 40) : DEFAULT_NAMES[id];
      out.push({ id:id, num:i, name:nm, short:nm===DEFAULT_NAMES[id] ? DEFAULT_SHORT[id] : shortOf(nm), label:pad2(i)+" · "+nm });
    }
    out.push({ id:"central", num:FRONTS+1, name:"Central de dados", short:"CENTRAL DE DADOS", label:"Central de dados" });
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
      if(!ID_RE.test(id) || RESERVED_RE.test(id)) id = newId(name, out);
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
      { id:"chefia-esposa", name:"Andressa", role:"Diretora", company:"chefia", kind:"chefia", status:"rest", task:"" }
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
    if(list) list.forEach(function(p){ if(p.id==="chefia-esposa" && p.name==="Esposa") p.name = "Andressa"; });   // nome que faltava
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
    var yt = { id:"auto-yt", name:"Yuri", role:"Robô · coleta o YouTube a cada 5 min", company:"central", kind:"robo",
      status:fresh ? "work" : "rest",
      task:fresh ? "Coletando YouTube · última leitura "+hhmm(gen)
        : (!m ? "Sem conexão com os dados" : (isNaN(gen) ? "Sem data da última coleta" : "Esperando a próxima coleta · última leitura "+hhmm(gen))) };
    var ok = 0, sites = m && m.sites && typeof m.sites==="object" ? m.sites : {};
    Object.keys(sites).forEach(function(k){
      var s = sites[k]; if(!s || typeof s!=="object") return;
      var er = s.errors && typeof s.errors==="object" ? s.errors : {};
      ["ga4", "searchConsole", "adsense"].forEach(function(src){ if(s[src] && !er[src]) ok++; });
    });
    var st = { id:"auto-sites", name:"Sara", role:"Robô · GA4, Search Console e AdSense", company:"central", kind:"robo",
      status:ok>0 ? "work" : "rest",
      task:ok>0 ? "Lendo "+ok+" fonte"+(ok===1 ? "" : "s")+" dos sites (GA4 · Search Console · AdSense)"
        : (m ? "Dormindo: faltam as credenciais do Google" : "Sem conexão com os dados") };
    var lr = { id:"auto-leituras", name:"Léo", role:"Robô · escreve as leituras do painel", company:"central", kind:"robo",
      status:m ? "work" : "rest", task:m ? "Lendo os dados do painel" : "Sem dados para ler" };
    return [yt, st, lr];
  }

  // ---------- rotinas reais (agendadas no Claude) ----------
  // Um agente por rotina. Ficam fixos (não entram na equipe editável) e só mudam de estado pelo ao vivo:
  // a rotina chama public.lisieux_set_status com o id abaixo no começo ("work") e no fim ("rest").
  var BLOGS = [
    { key:"portal",   name:"Portal da AI",        short:"PORTAL DA AI",        domain:"portaldaai.com.br" },
    { key:"bitcoin",  name:"Blog do Bitcoin",     short:"BLOG DO BITCOIN",     domain:"blogdobitcoin.com.br" },
    { key:"politica", name:"Política Diária",     short:"POLÍTICA DIÁRIA",     domain:"politicadiaria.com.br" },
    { key:"saude",    name:"Saúde na Minha Vida", short:"SAÚDE NA MINHA VIDA", domain:"saudenaminhavida.com.br" },
    { key:"review",   name:"Review Produtos",     short:"REVIEW PRODUTOS",     domain:"reviewprodutos.com.br" },
    { key:"grama",    name:"Blog da Grama",       short:"BLOG DA GRAMA",       domain:"blogdagrama.com.br" },
    { key:"yangled",  name:"Yang LED",            short:"YANG LED",            domain:"yangled.com.br" }
  ];
  // Equipe de cada rotina, contada no texto da própria rotina: quem lidera (a sessão agendada) + os subagentes
  // que ela abre AO MESMO TEMPO (aparecem no escritório só enquanto a rotina trabalha) + o total por execução.
  var R5 = ["Redator", "Redator", "Redator", "Redator", "Redator"];
  var ROUTINES = [
    // [id, nome, função, empresa, blog, subagentes simultâneos, agentes por execução, como trabalha]
    ["rt-escriva",            "Teresa",   "Redatora · Caminho, Sulco e Forja",   "f2", null, [], 1, "1 agente faz Caminho, Sulco e Forja em sequência"],
    ["rt-vocacaodemae",       "Mariana",  "Editora · artigos, reviews e loja",   "f3", null, ["Redator", "Redator", "Redator", "Redator", "Redator"], 16, "editora + 15 subagentes, até 5 ao mesmo tempo (comparativos e reviews)"],
    ["rt-jogador",            "Gustavo",  "Redator · mercado da bola, 3 posts",  "f8", null, [], 1, "1 agente faz e agenda os 3 carrosséis"],
    ["rt-vasco",              "Roberto",  "Redator · Tudo Sobre Vasco, 4 posts", "f8", null, [], 1, "1 agente faz e agenda os 4 posts"],
    ["rt-motivacao",          "Júlia",    "Redatora · Motivação, 3 posts",       "f8", null, [], 1, "1 agente faz e agenda os 3 posts"],
    ["rt-portal-noticias",    "Felipe",   "Redator · notícias de hora em hora",  "f9", "portal", [], 1, "1 agente por rodada"],
    ["rt-portal-artigos",     "Camila",   "Redatora · 15 artigos por dia",       "f9", "portal", [], 1, "1 agente escreve os 5 artigos de cada rodada (3 rodadas)"],
    ["rt-portal-indica",      "Diego",    "Pesquisador · AI Indica, 5 por dia",  "f9", "portal", [], 1, "1 agente faz os 5 AI Indica"],
    ["rt-bitcoin-noticias",   "Henrique", "Redator · notícias de hora em hora",  "f9", "bitcoin", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-bitcoin-artigos",    "Larissa",  "Redatora · 10 artigos por dia",       "f9", "bitcoin", ["Executor"].concat(R5), 7, "coordenador + executor + 5 redatores em paralelo (2 rodadas)"],
    ["rt-bitcoin-indica",     "Marcelo",  "Pesquisador · Cripto Indica e loja",  "f9", "bitcoin", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-bitcoin-manutencao", "Otávio",   "Analista · dados, erros e segurança", "f9", "bitcoin", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-politica-noticias",  "Renato",   "Redator · notícias de hora em hora",  "f9", "politica", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-politica-checagem",  "Paula",    "Pesquisadora · checagem de boatos",   "f9", "politica", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-politica-eleicoes",  "Sérgio",   "Analista · dados das eleições",       "f9", "politica", ["Executor"], 2, "coordenador + 1 agente executor"],
    ["rt-politica-congresso", "Vítor",    "Analista · dados do Congresso",       "f9", "politica", [], 1, "1 agente"],
    ["rt-politica-livros",    "Lívia",    "Redatora · 3 resenhas de livros",     "f9", "politica", [], 1, "1 agente escreve as 3 resenhas"],
    ["rt-saude-noticias",     "Fernanda", "Redatora · notícias a cada 2 horas",  "f9", "saude", [], 1, "1 agente por rodada"],
    ["rt-saude-guias",        "Patrícia", "Redatora · 10 guias por dia",         "f9", "saude", [], 1, "1 agente escreve os 5 guias de cada rodada (2 rodadas)"],
    ["rt-saude-produtos",     "Natália",  "Pesquisadora · 20 produtos por dia",  "f9", "saude", R5, 11, "1 + 10 redatores, 5 por vez (2 rodadas)"],
    ["rt-saude-manutencao",   "André",    "Analista · erros e segurança",        "f9", "saude", [], 1, "1 agente"],
    ["rt-review-lote",        "Ricardo",  "Redator · 20 reviews por dia",        "f9", "review", R5, 6, "1 + 5 redatores em paralelo (4 rodadas)"],
    ["rt-grama-noticias",     "Sofia",    "Redatora · notícias, 3 rodadas",      "f9", "grama", [], 1, "1 agente por rodada"],
    ["rt-grama-artigos",      "Eduardo",  "Redator · 5 artigos por dia",         "f9", "grama", [], 1, "1 agente escreve os 5 artigos"],
    ["rt-grama-produtos",     "Murilo",   "Pesquisador · 20 produtos por dia",   "f9", "grama", R5, 21, "1 + 20 redatores, em 4 lotes de 5"],
    ["rt-yangled-blog",       "Yasmin",   "Redatora · 5 artigos por dia",        "f9", "yangled", [], 1, "1 agente escreve os 5 artigos"]
  ];
  // nomes dos subagentes (fixos, na ordem das rotinas acima), com a função no gênero do nome
  var HELPER_NAMES = [["Alice","f"],["Arthur","m"],["Bernardo","m"],["Laura","f"],["Heitor","m"],["Valentina","f"],["Enzo","m"],["Manuela","f"],
    ["Samuel","m"],["Lorena","f"],["Benício","m"],["Melissa","f"],["Daniel","m"],["Elisa","f"],["Joaquim","m"],["Rebeca","f"],["Gael","m"],
    ["Giovana","f"],["Nicolas","m"],["Luana","f"],["Caetano","m"],["Bianca","f"],["Leonardo","m"],["Aurora","f"],["Raul","m"],["Estela","f"],
    ["Hugo","m"],["Olívia","f"],["Matias","m"],["Pietra","f"],["Emanuel","m"],["Antônia","f"]];
  var HELPERS = {};
  (function(){ var n = 0; ROUTINES.forEach(function(r){ HELPERS[r[0]] = r[5].map(function(){ return HELPER_NAMES[n++ % HELPER_NAMES.length]; }); }); })();
  function routines(){
    return ROUTINES.map(function(r){
      var p = { id:r[0], name:r[1], role:r[2], company:r[3], kind:"rotina", status:"rest", task:"",
                team:{ helpers:r[5].length, perRun:r[6], how:r[7] } };
      if(r[4]) p.blog = r[4];
      return p;
    });
  }
  // subagentes de uma rotina que está trabalhando (ids "<rotina>-1".."-n"); somem quando ela termina
  function helpersOf(q){
    var r = null;
    for(var i=0; i<ROUTINES.length; i++) if(ROUTINES[i][0]===q.id){ r = ROUTINES[i]; break; }
    if(!r || q.status!=="work") return [];
    return r[5].map(function(label, k){
      var nm = HELPERS[q.id][k], fem = nm[1]==="f";
      var h = { id:q.id+"-"+(k+1), name:nm[0], role:(fem ? label + "a" : label) + " · equipe de " + r[1], company:r[3], kind:"ajudante",
                status:"work", task:q.task, lead:q.id };
      if(r[4]) h.blog = r[4];
      if(q.live){ h.live = true; h.stale = q.stale; h.updatedAt = q.updatedAt; h.origin = "ao vivo"; }
      else if(q.demo){ h.demo = true; h.origin = ORIGINS.ajudante; }
      else h.origin = ORIGINS.ajudante;
      return h;
    });
  }
  // ---------- equipe fixa: sócios na mesa do Grupo Lisieux, recepção e limpeza ----------
  var STAFF = [
    { id:"st-fio",       name:"Fio",       role:"Sócio · São Josemaría Escrivá",       company:"f2", kind:"socio", task:"Reunião do Grupo Lisieux" },
    { id:"st-joaozinho", name:"Joãozinho", role:"Sócio · São Josemaría Escrivá",       company:"f2", kind:"socio", task:"Reunião do Grupo Lisieux" },
    { id:"st-caio",      name:"Caio",      role:"Sócio · Política Diária, diplomata",  company:"f9", blog:"politica", kind:"socio", task:"Reunião do Grupo Lisieux" },
    { id:"st-penido",    name:"Penido",    role:"Sócio · Escrivá Todo Dia",            company:"f2", kind:"socio", task:"Reunião do Grupo Lisieux" },
    { id:"st-ciro",      name:"Ciro",      role:"Sócio · Contos de Fence",             company:"f1", kind:"socio", task:"Reunião do Grupo Lisieux" },
    { id:"st-aline",     name:"Aline",     role:"Recepcionista",                       company:"central", kind:"recepcao", task:"Atendendo o telefone e a agenda" },
    { id:"st-carol",     name:"Carol",     role:"Recepcionista",                       company:"central", kind:"recepcao", task:"Atendendo o telefone e a agenda" },
    { id:"st-cida",      name:"Dona Cida", role:"Limpeza",                             company:"central", kind:"limpeza", task:"Limpando o escritório" },
    { id:"st-ze",        name:"Seu Zé",    role:"Limpeza",                             company:"central", kind:"limpeza", task:"Limpando o escritório" }
  ];
  function staff(){ return STAFF.map(function(p){ var q = {}; for(var k in p) if(hasOwn(p, k)) q[k] = p[k]; q.status = "work"; return q; }); }
  function placeOf(p){
    if(!p) return "";
    if(p.kind==="recepcao") return "Recepção";
    if(p.kind==="limpeza") return "Limpeza";
    var b = p.blog ? blogName(p.blog) : "";
    return company(p.company).name + (b ? " · " + b : "");
  }

  function blogName(key){
    for(var i=0; i<BLOGS.length; i++) if(BLOGS[i].key===key) return BLOGS[i].name;
    return "";
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
    // Bruno de rei (coroa grande, manto vermelho com gola de arminho, túnica dourada) e Andressa de princesa (tiara e vestido)
    "chefia-bruno": { skin:"#f0b29a", hair:"#815d44", hairStyle:"side-part", shirt:"#efb829", jacket:"#ba3335", pants:"#393647", cape:"#ba3335", crown:"king" },
    "chefia-esposa": { skin:"#fbc2a6", hair:"#a46533", hairStyle:"long", shirt:"#e8a3c4", pants:"#d978a8", skirt:true, crown:"tiara" },
    // sócios de terno
    "st-fio":       { skin:"#f0b29a", hair:"#403f4d", hairStyle:"short", shirt:"#dfe0ea", jacket:"#333545", pants:"#393647" },
    "st-joaozinho": { skin:"#fbc2a6", hair:"#a46533", hairStyle:"messy", shirt:"#dfe0ea", jacket:"#4b5a7a", pants:"#393647" },
    "st-caio":      { skin:"#a77264", hair:"#403f4d", hairStyle:"buzz", shirt:"#dfe0ea", jacket:"#3c4878", pants:"#3c4878" },
    "st-penido":    { skin:"#f0b29a", hair:"#5a4340", hairStyle:"side-part", shirt:"#dfe0ea", jacket:"#5b422c", pants:"#393647" },
    "st-ciro":      { skin:"#fbc2a6", hair:"#815d44", hairStyle:"curly", shirt:"#dfe0ea", jacket:"#863c3d", pants:"#393647" },
    // recepção (blusa branca e saia azul-marinho) e limpeza (uniforme azul-claro)
    "st-aline":     { skin:"#f0b29a", hair:"#403f4d", hairStyle:"ponytail", shirt:"#dfe0ea", pants:"#3c4878", skirt:true },
    "st-carol":     { skin:"#fbc2a6", hair:"#a46533", hairStyle:"bob", shirt:"#dfe0ea", pants:"#3c4878", skirt:true },
    "st-cida":      { skin:"#a77264", hair:"#58545b", hairStyle:"bun", shirt:"#7d97c8", pants:"#4b5a7a", skirt:true },
    "st-ze":        { skin:"#f0b29a", hair:"#58545b", hairStyle:"short", shirt:"#7d97c8", pants:"#4b5a7a" }
  };
  function look(p){
    p = p || {};
    var h = hash(p.id||p.name), o;
    if(hasOwn(SPECIAL, p.id)) o = JSON.parse(JSON.stringify(SPECIAL[p.id]));
    else if(p.kind==="robo") o = { skin:SKINS[h%2], hair:"#58545b", hairStyle:"buzz", shirt:"#dfe0ea", pants:"#3c4878" };
    else {
      var fem = isFem(p.kind==="ajudante" ? { name:p.name, role:p.name } : p);
      o = { skin:SKINS[h%SKINS.length], hair:HAIRS[(h>>>3)%HAIRS.length],
            hairStyle:fem ? STYLES_F[(h>>>6)%STYLES_F.length] : STYLES_M[(h>>>6)%STYLES_M.length],
            shirt:SHIRTS[(h>>>9)%SHIRTS.length], pants:PANTS[(h>>>12)%PANTS.length] };
      if(p.kind==="chefia"){ o.shirt = "#dfe0ea"; if(fem){ o.pants = "#863c3d"; o.skirt = true; } else o.jacket = "#333545"; }
      if((p.kind==="agente" || p.kind==="rotina" || p.kind==="ajudante") && (h>>>15)%3===0) o.jacket = "#333545";
    }
    var lk = cleanLook(p.look); if(lk) for(var k in lk) if(hasOwn(lk, k)) o[k] = lk[k];
    o.badge = (p.kind==="agente" || p.kind==="robo" || p.kind==="rotina" || p.kind==="ajudante") ? "A" : null;
    return o;
  }

  // ---------- ícone do balão (pela função) ----------
  function roleIcon(p){
    if(!p) return "clip";
    if(p.kind==="robo") return "chart";
    if(p.kind==="recepcao") return "phone";
    if(p.kind==="socio") return "talk";
    if(p.kind==="limpeza") return "clip";
    if(p.kind==="chefia" || p.company==="chefia") return "star";
    var r = clean(p.kind==="ajudante" ? p.name : p.role, 40).toLowerCase();
    if(/redat|escrit|roteir|copy|revis|edit/.test(r)) return "pencil";
    if(/pesquis|analis|dados|curad/.test(r)) return "search";
    return "clip";
  }

  // ---------- lista final ----------
  function merge(roster, robotsList, liveMap, demoMap, liveMode){
    var out = [], ids = {}, liveOn = !!liveMode && liveMode!=="off";
    (robotsList||[]).concat(staff(), routines(), roster||[]).forEach(function(p){
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
      if(q.kind==="rotina") helpersOf(q).forEach(function(h){ if(!ids[h.id]){ ids[h.id] = 1; out.push(h); } });
    });
    return out;
  }

  var api = {
    KEY:KEY, STATE_KEY:STATE_KEY, MAX:MAX, ID_RE:ID_RE, COMPANY_IDS:COMPANY_IDS.slice(),
    companies:companies, company:company,
    companyName:function(id){ return company(id).name; },
    load:load, save:save, seed:seed, sanitize:sanitize, robots:robots, routines:routines, staff:staff, placeOf:placeOf, look:look, merge:merge,
    BLOGS:BLOGS.map(function(b){ return { key:b.key, name:b.name, short:b.short, domain:b.domain }; }), blogName:blogName, FRONTS:FRONTS,
    kindLabel:function(k){ return KINDS[k] || "Agente IA"; },
    roleIcon:roleIcon, newId:newId, shortOf:shortOf, clean:clean
  };
  Object.defineProperty(api, "COMPANIES", { get:companies, enumerable:true });
  window.LisieuxRoster = api;
})();
