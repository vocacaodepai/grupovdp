/* Painel Lisieux — Escritório do Grupo Lisieux (motor da página escritorio/index.html).
 *
 * Mundo de 44×45 tiles de 16 px (704×720 px de jogo), montado só com os sprites próprios de
 * sprites-office.js (of_*), sprites-lounge.js (dc_*, lg_*) e sprites-chars.js (pessoas).
 *   - parede norte com placas 01–04; parede interna com placas 05–08; uma fileira de 3 cubículos por empresa;
 *   - no meio: Diretoria (mesa executiva), Central de dados (estação de 6 monitores + mesa de reunião) e Copa;
 *   - embaixo, a ala 09 Blogs: uma fileira de cubículos por blog, do tamanho da equipe da rotina, e a mesa de pauta.
 * Rotinas reais (data.js) têm um agente fixo; os subagentes que a rotina abre aparecem só enquanto ela trabalha.
 * Pessoas: "work" anda até o próprio lugar e senta digitando (monitor aceso + balão); "rest" vai para a copa.
 * Dados: LisieuxRoster (data.js) + robôs reais (../data/metrics.json a cada 60 s) + LisieuxLive (live.js).
 * O Modo Demo (padrão, só com o ao vivo desligado) troca alguém de estado a cada ~3 s e nunca grava nada.
 * Tudo que vem de fora (nomes, tarefas) entra na página só por textContent.
 */
(function(){
  "use strict";
  var R = window.LisieuxRoster, PX = window.LisieuxPixel, CH = window.LISIEUX_CHARS, SP = window.LISIEUX_SPRITES || {},
      LG = window.LISIEUX_LOUNGE, LIVE = window.LisieuxLive;
  function $(id){ return document.getElementById(id); }
  if(!R || !PX || !CH || !LG || !SP.of_cub_a || !SP.lg_sofa_l){ var fe = $("fatal"); if(fe) fe.hidden = false; return; }

  var TILE = 16, TW = 44, TH = 45, WW = TW*TILE, WH = TH*TILE;
  var QS = null; try{ QS = new URLSearchParams(location.search); }catch(e){}
  var EMBED = !!(QS && QS.get("embed")==="1");
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var REDUCE = !!(mqReduce && mqReduce.matches);
  var K = "#303142", LOUSA = "#f1f3f6", BOLHA = "#f4f6fb", LETTERBOX = "#141420";
  var SPEED = 40;                       // 2,5 tiles por segundo
  var DEMO_KEY = "vdp-office-demo-v1";
  var hasOwn = function(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  function rnd(a, b){ return a + Math.random()*(b-a); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function cap1(s){ s = String(s||""); return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  // =====================================================================================
  // 1. FONTE PIXEL 5×7 (maiúsculas, acentos, números) — desenhada aqui, para as placas
  // =====================================================================================
  var GLYPHS = {
    "A":".###.|#...#|#...#|#####|#...#|#...#|#...#", "B":"####.|#...#|#...#|####.|#...#|#...#|####.",
    "C":".###.|#...#|#....|#....|#....|#...#|.###.", "D":"####.|#...#|#...#|#...#|#...#|#...#|####.",
    "E":"#####|#....|#....|####.|#....|#....|#####", "F":"#####|#....|#....|####.|#....|#....|#....",
    "G":".###.|#...#|#....|#.###|#...#|#...#|.####", "H":"#...#|#...#|#...#|#####|#...#|#...#|#...#",
    "I":"###|.#.|.#.|.#.|.#.|.#.|###",               "J":"..###|...#.|...#.|...#.|#..#.|#..#.|.##..",
    "K":"#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", "L":"#....|#....|#....|#....|#....|#....|#####",
    "M":"#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", "N":"#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    "O":".###.|#...#|#...#|#...#|#...#|#...#|.###.", "P":"####.|#...#|#...#|####.|#....|#....|#....",
    "Q":".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", "R":"####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    "S":".####|#....|#....|.###.|....#|....#|####.", "T":"#####|..#..|..#..|..#..|..#..|..#..|..#..",
    "U":"#...#|#...#|#...#|#...#|#...#|#...#|.###.", "V":"#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    "W":"#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#", "X":"#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    "Y":"#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", "Z":"#####|....#|...#.|..#..|.#...|#....|#####",
    "0":".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", "1":"..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    "2":".###.|#...#|....#|...#.|..#..|.#...|#####", "3":"####.|....#|....#|.###.|....#|....#|####.",
    "4":"...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", "5":"#####|#....|####.|....#|....#|#...#|.###.",
    "6":".###.|#....|#....|####.|#...#|#...#|.###.", "7":"#####|....#|...#.|..#..|.#...|.#...|.#...",
    "8":".###.|#...#|#...#|.###.|#...#|#...#|.###.", "9":".###.|#...#|#...#|.####|....#|....#|.###.",
    " ":"..|..|..|..|..|..|..", "·":"...|...|...|.#.|...|...|...", "–":"....|....|....|####|....|....|....",
    "-":"...|...|...|###|...|...|...", ".":".|.|.|.|.|.|#", ":":".|.|#|.|.|#|.", "'":"#|#|.|.|.|.|.",
    "!":"#|#|#|#|#|.|#", "?":".###.|#...#|....#|...#.|..#..|.....|..#..", "&":".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
    "/":"....#|...#.|...#.|..#..|.#...|.#...|#....", "+":".....|..#..|..#..|#####|..#..|..#..|.....",
    "(":".#|#.|#.|#.|#.|#.|.#", ")":"#.|.#|.#|.#|.#|.#|#.", ",":"..|..|..|..|..|.#|#."
  };
  var ACCENTS = { "\u0301":"...#.|..#..", "\u0300":".#...|..#..", "\u0302":"..#..|.#.#.", "\u0303":".##.#|#..#.", "\u0308":".#.#.|....." };
  var CEDILLA = "..#..|.##..";
  var GL = {};
  Object.keys(GLYPHS).forEach(function(k){ GL[k] = GLYPHS[k].split("|"); });
  function splitChar(ch){
    if(GL[ch]) return { base:ch, marks:"" };
    var d = ch; try{ d = ch.normalize("NFD"); }catch(e){}
    var b = d.charAt(0).toUpperCase();
    if(GL[b]) return { base:b, marks:d.slice(1) };
    return { base:" ", marks:"" };
  }
  function textWidth(s){
    var w = 0, chars = Array.from(String(s||""));
    chars.forEach(function(ch, i){ w += GL[splitChar(ch).base][0].length + (i<chars.length-1 ? 1 : 0); });
    return w;
  }
  function blit(ctx, rows, x, y, color){
    ctx.fillStyle = color;
    for(var j=0; j<rows.length; j++) for(var i=0; i<rows[j].length; i++) if(rows[j].charAt(i)==="#") ctx.fillRect(x+i, y+j, 1, 1);
  }
  // y = topo do corpo das letras (acentos ocupam y-3..y-2; cedilha y+7..y+8)
  function drawText(ctx, s, x, y, color){
    Array.from(String(s||"")).forEach(function(ch){
      var sc = splitChar(ch), g = GL[sc.base], w = g[0].length, off = Math.floor((w-5)/2);
      blit(ctx, g, x, y, color);
      Array.from(sc.marks).forEach(function(m){
        if(ACCENTS[m]) blit(ctx, ACCENTS[m].split("|"), x+off, y-3, color);
        else if(m==="\u0327") blit(ctx, CEDILLA.split("|"), x+off, y+7, color);
      });
      x += w + 1;
    });
  }

  // =====================================================================================
  // 2. ÍCONES DOS BALÕES (7×7) E DESENHOS DE UI EM PIXEL
  // =====================================================================================
  var ICONS = {
    pencil:{ pal:{ o:K, y:"#efb829", p:"#d6a2a7", w:"#fbc2a6" }, rows:[".....oo", "....opo", "...oyo.", "..oyo..", ".oyo...", "owo....", "oo....."] },
    search:{ pal:{ b:"#6f86e8", l:"#c9d0e6" }, rows:[".bbb...", "bl..b..", "b...b..", "b...b..", ".bbbb..", "....bb.", ".....bb"] },
    chart:{ pal:{ o:K, g:"#57a252", b:"#408edd", r:"#d72f2b" }, rows:[".......", ".....r.", "...b.r.", ".g.b.r.", ".g.b.r.", ".g.b.r.", "ooooooo"] },
    star:{ pal:{ a:"#e9901e", y:"#f2c833" }, rows:["...a...", "..aya..", "aayyyaa", ".ayyya.", "..aya..", ".aa.aa.", ".a...a."] },
    clip:{ pal:{ o:K, l:"#9e9fa6" }, rows:["..ooo..", ".oo.oo.", ".o...o.", ".olllo.", ".o...o.", ".olllo.", ".ooooo."] }
  };
  var iconCache = {};
  function iconCanvas(name){
    if(iconCache[name]) return iconCache[name];
    var ic = ICONS[name] || ICONS.clip, c = document.createElement("canvas"); c.width = 7; c.height = 7;
    var x = c.getContext("2d");
    ic.rows.forEach(function(r, j){ for(var i=0; i<r.length; i++){ var col = ic.pal[r.charAt(i)]; if(col){ x.fillStyle = col; x.fillRect(i, j, 1, 1); } } });
    return (iconCache[name] = c);
  }
  // balão 13×11 com bico de 2 px; (cx, tipY) = ponta do bico
  function drawBubble(ctx, cx, tipY, icon){
    var w = 13, h = 11, x0 = Math.round(cx) - 6, y0 = Math.round(tipY) - 2 - h;
    ctx.fillStyle = K;
    ctx.fillRect(x0+2, y0, w-4, 1); ctx.fillRect(x0+2, y0+h-1, w-4, 1);
    ctx.fillRect(x0, y0+2, 1, h-4); ctx.fillRect(x0+w-1, y0+2, 1, h-4);
    ctx.fillRect(x0+1, y0+1, 1, 1); ctx.fillRect(x0+w-2, y0+1, 1, 1); ctx.fillRect(x0+1, y0+h-2, 1, 1); ctx.fillRect(x0+w-2, y0+h-2, 1, 1);
    ctx.fillStyle = BOLHA;
    ctx.fillRect(x0+1, y0+2, w-2, h-4); ctx.fillRect(x0+2, y0+1, w-4, h-2);
    ctx.fillStyle = "#dfe3f0"; ctx.fillRect(x0+2, y0+h-2, w-4, 1);
    // bico
    ctx.fillStyle = BOLHA; ctx.fillRect(x0+5, y0+h-1, 3, 1); ctx.fillRect(x0+6, y0+h, 1, 1);
    ctx.fillStyle = K; ctx.fillRect(x0+4, y0+h-1, 1, 1); ctx.fillRect(x0+8, y0+h-1, 1, 1);
    ctx.fillRect(x0+5, y0+h, 1, 1); ctx.fillRect(x0+7, y0+h, 1, 1); ctx.fillRect(x0+6, y0+h+1, 1, 1);
    ctx.drawImage(iconCanvas(icon), x0+3, y0+2);
  }
  // balão ao lado da cabeça (para quem senta encostado numa parede com placa): (x0, y0) = canto do corpo, bico à esquerda
  function drawBubbleSide(ctx, x0, y0, icon){
    var w = 13, h = 11; x0 = Math.round(x0); y0 = Math.round(y0);
    ctx.fillStyle = K;
    ctx.fillRect(x0+2, y0, w-4, 1); ctx.fillRect(x0+2, y0+h-1, w-4, 1);
    ctx.fillRect(x0, y0+2, 1, h-4); ctx.fillRect(x0+w-1, y0+2, 1, h-4);
    ctx.fillRect(x0+1, y0+1, 1, 1); ctx.fillRect(x0+w-2, y0+1, 1, 1); ctx.fillRect(x0+1, y0+h-2, 1, 1); ctx.fillRect(x0+w-2, y0+h-2, 1, 1);
    ctx.fillStyle = BOLHA;
    ctx.fillRect(x0+1, y0+2, w-2, h-4); ctx.fillRect(x0+2, y0+1, w-4, h-2);
    ctx.fillStyle = "#dfe3f0"; ctx.fillRect(x0+2, y0+h-2, w-4, 1);
    ctx.fillStyle = BOLHA; ctx.fillRect(x0, y0+4, 1, 3); ctx.fillRect(x0-1, y0+5, 1, 1);
    ctx.fillStyle = K; ctx.fillRect(x0-1, y0+4, 1, 1); ctx.fillRect(x0-1, y0+6, 1, 1); ctx.fillRect(x0-2, y0+5, 1, 1);
    ctx.drawImage(iconCanvas(icon), x0+3, y0+2);
  }
  var Z_ROWS = ["####", "..#.", ".#..", "####"];
  function drawZ(ctx, x, y, small){
    var rows = small ? ["###", ".#.", "###"] : Z_ROWS;
    blit(ctx, rows, Math.round(x)+1, Math.round(y)+1, K);
    blit(ctx, rows, Math.round(x), Math.round(y), BOLHA);
  }

  // =====================================================================================
  // 3. PLANTA DO MUNDO
  // =====================================================================================
  var BX = [1, 12, 23, 34], BT = [2, 11];               // coluna (tile) de cada bloco e linha (tile) de cada faixa
  var BLOCKS = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"];
  var WALLS = [
    // endL/endR: "edge" = ponta livre (contorno de 1 px, como a copa da referência); "toco" = desce uma parede lateral
    { x0:0,   x1:704, y:0,   sp:"of_wall", endL:false, endR:false },            // parede norte
    { x0:16,  x1:160, y:144, sp:"of_wall", endL:"edge", endR:"edge" },          // parede interna (atrás das empresas 05–08)
    { x0:192, x1:336, y:144, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:368, x1:512, y:144, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:544, x1:688, y:144, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:0,   x1:160, y:288, sp:"of_wall", endL:false, endR:"edge" },           // Diretoria (porta em 160–192)
    { x0:192, x1:336, y:288, sp:"of_wall", endL:"toco", endR:"edge" },          // Central (porta em 336–368)
    { x0:368, x1:512, y:288, sp:"of_wall", endL:"edge", endR:"toco" },
    { x0:544, x1:704, y:288, sp:"of_wall_brick", endL:"edge", endR:false },     // Copa (porta em 512–544)
    { x0:0,   x1:256, y:432, sp:"of_wall", endL:false, endR:"edge" },           // ala 09 Blogs (portas em 256–288 e 576–608)
    { x0:288, x1:576, y:432, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:608, x1:704, y:432, sp:"of_wall", endL:"edge", endR:false },
    { x0:16,  x1:112, y:576, sp:"of_wall", endL:"edge", endR:"edge" },          // parede interna da ala (fileira de baixo)
    { x0:144, x1:288, y:576, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:320, x1:464, y:576, sp:"of_wall", endL:"edge", endR:"edge" },
    { x0:496, x1:688, y:576, sp:"of_wall", endL:"edge", endR:"edge" }
  ];
  // ala 09 Blogs: blog -> coluna (tile), faixa (linha das cadeiras de trás), módulos (2 lugares cada) e topo da parede da placa
  var BLOG_LAYOUT = [
    { key:"bitcoin",  x0:1,  T:29, n:5, wall:432 },
    { key:"saude",    x0:18, T:29, n:4, wall:432 },
    { key:"yangled",  x0:32, T:29, n:1, wall:432 },
    { key:"portal",   x0:1,  T:38, n:2, wall:576 },
    { key:"politica", x0:9,  T:38, n:3, wall:576 },
    { key:"review",   x0:20, T:38, n:3, wall:576 },
    { key:"grama",    x0:31, T:38, n:4, wall:576 }
  ];
  var TOCOS = [ { x:192, y0:320, y1:432 }, { x:506, y0:320, y1:432 } ];
  var WOOD = [ { c0:0, c1:11, r0:20, r1:26 }, { c0:32, c1:43, r0:20, r1:26 } ];

  var W = null;            // mundo montado (layout fixo; só as placas mudam com os nomes)
  var bgCanvas = null;     // piso + paredes + decoração de parede + placas

  function sp(name){ return SP[name]; }
  function tileOf(x){ return Math.floor(x/TILE); }

  function buildWorld(){
    var w = { objs:[], grid:new Uint8Array(TW*TH), blockSeats:{}, execSeats:[], stationSeats:[], meetSeats:[], spots:{},
              rest:[], overflow:{}, areas:{}, floorRugs:[], wallDecor:[] };
    var i, x, y;
    for(i=0; i<w.grid.length; i++) w.grid[i] = 1;
    function block(tx, ty){ if(tx>=0 && ty>=0 && tx<TW && ty<TH) w.grid[ty*TW+tx] = 0; }
    function free(tx, ty){ if(tx>=0 && ty>=0 && tx<TW && ty<TH) w.grid[ty*TW+tx] = 1; }
    function blockRect(x0, y0, ww, hh){
      for(var ty=0; ty<TH; ty++) for(var tx=0; tx<TW; tx++){
        var cx = tx*TILE+8, cy = ty*TILE+8;
        if(cx>=x0 && cx<x0+ww && cy>=y0 && cy<y0+hh) block(tx, ty);
      }
    }
    var order = 0;
    function obj(name, ax, ay, o){
      o = o || {};
      var s = sp(name), it = { name:name, x:ax, y:ay, sortY:o.sortY!=null ? o.sortY : ay, ord:order++, draw:o.draw || null };
      if(o.solid!==null && s){
        var r = o.solid || { x:ax-s.ox, y:ay-Math.max(6, s.h*0.4), w:s.w, h:Math.max(6, s.h*0.4)+3 };
        blockRect(r.x, r.y, r.w, r.h);
      }
      w.objs.push(it);
      return it;
    }
    // paredes e tocos bloqueiam
    WALLS.forEach(function(wl){ for(var tx=tileOf(wl.x0); tx<Math.ceil(wl.x1/TILE); tx++){ block(tx, wl.y/TILE); block(tx, wl.y/TILE+1); } });
    TOCOS.forEach(function(tc){ for(var ty=tc.y0/TILE; ty<tc.y1/TILE; ty++) block(tileOf(tc.x), ty); });

    function seat(o){
      var s = { id:o.id, x:o.x, y:o.y, dir:o.dir, pose:o.pose||"sit", sortY:o.sortY, stand:o.stand, chair:o.chair||null,
                badge:o.badge||null, kind:o.kind||"seat", area:o.area, occ:null, monitor:o.monitor||null, bubble:o.bubble||"top", bubbleTip:o.bubbleTip||null };
      free(s.stand[0], s.stand[1]);
      return s;
    }

    // ---------- cubículos: uma fileira de n módulos (2 lugares cada) ----------
    var VARIANTS = ["of_cub_a", "of_cub_b", "of_cub_c"];
    function cubicleRow(group, area, x0, T, n, top, vi){
      var bx = x0*TILE, by = T*TILE + 12;
      for(var ty=T+1; ty<=T+3; ty++) for(var tx=x0; tx<=x0+3*n-1; tx++) block(tx, ty);
      var front = [], back = [];
      for(var m=0; m<n; m++){
        var sx = bx + 48*m + 25;
        obj(VARIANTS[(vi+m)%3], sx, by+42, { solid:null });
        obj("of_chair_down", sx, by+8, { solid:null });
        obj("of_chair_up", sx, by+59, { solid:null });
        back.push(seat({ id:group+"-b"+m, x:sx, y:by+7, dir:"down", sortY:by+8.5, stand:[tileOf(sx), T], area:area,
                         badge:{ x:sx, y:by+11 }, bubble:"side" }));
        var fs = seat({ id:group+"-f"+m, x:sx, y:by+47, dir:"up", sortY:by+42.6, stand:[tileOf(sx), T+4], area:area,
                        badge:{ x:sx, y:by+57 }, bubbleTip:by+18 });
        fs.monitor = obj("of_mon_off", sx, by+31, { solid:null, sortY:by+42.5, draw:monitorDrawer(fs) });
        front.push(fs);
      }
      obj("of_cub_post", bx+48*n+1, by+42, { solid:null });
      // ordem de ocupação espalhada (frente/trás alternados), igual para todas as fileiras
      var order = [];
      for(var i=0; i<n; i++) order.push(i%2 ? back[i] : front[i]);
      for(var j=0; j<n; j++) order.push(j%2 ? front[j] : back[j]);
      w.blockSeats[group] = order;
      // vagas "em pé" quando a fileira lota
      var ov = [];
      for(var dx=0; dx<3*n; dx++) if(dx%3!==1) ov.push({ id:group+"-o"+dx, x:(x0+dx)*TILE+8, y:(T+4)*TILE+12, dir:"up", pose:"idle", sortY:(T+4)*TILE+12, stand:[x0+dx, T+4], kind:"stand", area:area, occ:null });
      w.overflow[group] = ov;
      w.areas[area] = { x:bx-10, y:top, w:48*n+23, h:(by+60) - top };
    }
    BLOCKS.forEach(function(cid, bi){
      var band = bi<4 ? 0 : 1;
      cubicleRow(cid, cid, BX[bi%4], BT[band], 3, band ? 144 : 0, bi);
    });
    BLOG_LAYOUT.forEach(function(b, i){ cubicleRow("f9:"+b.key, "f9-"+b.key, b.x0, b.T, b.n, b.wall, i+1); });

    // ---------- plantas no topo dos corredores (deixam sempre 1 tile livre) ----------
    obj("dc_plant_tall", 168, 41);
    obj("dc_plant_s", 360, 41);
    obj("dc_plant_bush", 536, 41);

    // ---------- Diretoria ----------
    obj("dc_shelf", 24, 329, { solid:{ x:9, y:312, w:31, h:20 } });
    obj("of_exec_set", 80, 357, { solid:{ x:48, y:331, w:64, h:27 } });
    [65, 94].forEach(function(sx, k){
      obj("of_chair_exec_down", sx, 342, { solid:null });
      w.execSeats.push(seat({ id:"chefia-"+k, x:sx, y:335, dir:"down", sortY:342.5, stand:[tileOf(sx), 20], area:"chefia", badge:{ x:sx, y:340 }, bubble:"side" }));
    });
    w.floorRugs.push(["lg_rug", 88, 396]);
    obj("lg_sofa_h", 88, 428, { solid:{ x:68, y:407, w:40, h:22 } });
    obj("dc_plant_bush", 176, 428);
    obj("dc_plant_s", 10, 428);
    w.areas.chefia = { x:0, y:288, w:192, h:144 };

    // ---------- Central de dados ----------
    obj("of_station6_off", 280, 376, { solid:{ x:256, y:345, w:49, h:32 }, draw:stationDrawer });
    [265, 280, 296].forEach(function(sx, k){
      obj("of_chair_orange_up", sx, 391, { solid:null });
      w.stationSeats.push(seat({ id:"robo-"+k, x:sx, y:375, dir:"up", sortY:376.5, stand:[tileOf(sx), 24], area:"central", badge:{ x:sx, y:389 } }));
    });
    obj("of_meeting_set", 400, 392, { solid:{ x:377, y:352, w:47, h:40 }, draw:meetingDrawer });
    var MS = [
      { x:389, y:347, dir:"down", chair:["of_chair_down", 389, 354], sortY:354.5, stand:[24, 21], badge:{ x:389, y:353 }, bubble:"side" },
      { x:411, y:347, dir:"down", chair:["of_chair_down", 411, 354], sortY:354.5, stand:[25, 21], badge:{ x:411, y:353 }, bubble:"side" },
      { x:372, y:378, dir:"right", chair:["of_chair_right", 369, 385], sortY:392.5, stand:[23, 23], badge:{ x:372, y:384 } },
      { x:428, y:378, dir:"left", chair:["of_chair_left", 431, 385], sortY:392.5, stand:[26, 23], badge:{ x:428, y:384 } },
      { x:400, y:395, dir:"up", chair:["of_chair_up", 400, 411], sortY:392.6, stand:[25, 25], badge:{ x:400, y:409 } }
    ];
    MS.forEach(function(m, k){
      obj(m.chair[0], m.chair[1], m.chair[2], { solid:null });
      w.meetSeats.push(seat({ id:"reuniao-"+k, x:m.x, y:m.y, dir:m.dir, sortY:m.sortY, stand:m.stand, area:"central", badge:m.badge, kind:"meeting", bubble:m.bubble }));
    });
    obj("dc_plant_tall", 494, 330);
    obj("dc_plant_bush", 215, 428);
    obj("dc_plant_spiky", 490, 428);
    w.areas.central = { x:192, y:288, w:320, h:144 };

    // ---------- Copa ----------
    obj("dc_plant_bush", 556, 328);
    obj("lg_cooler", 577, 328);
    obj("lg_coffee", 606, 328);
    obj("lg_vending", 640, 328);
    obj("dc_plant_spiky", 666, 328);
    obj("dc_plant_s", 692, 328);
    w.floorRugs.push(["lg_rug_lilac", 600, 380]);
    obj("lg_table_set", 600, 373, { solid:{ x:592, y:356, w:16, h:16 } });
    obj("lg_sofa_l", 664, 412, { solid:{ x:646, y:372, w:44, h:42 } });
    obj("lg_sofa_h", 600, 412, { solid:{ x:580, y:391, w:40, h:22 } });
    w.areas.copa = { x:512, y:288, w:192, h:144 };
    function rest(o){ var s = seat(o); s.kind = o.kind; s.area = "copa"; w.rest.push(s); return s; }
    rest({ id:"sofa-l1", x:651, y:393, dir:"down", sortY:412.5, stand:[40, 26], kind:"sofa" });
    rest({ id:"sofa-l2", x:663, y:393, dir:"down", sortY:412.5, stand:[41, 26], kind:"sofa" });
    rest({ id:"sofa-l3", x:679, y:402, dir:"down", sortY:412.5, stand:[42, 26], kind:"sofa" });
    rest({ id:"sofa-h1", x:589, y:407, dir:"down", sortY:412.5, stand:[36, 26], kind:"sofa" });
    rest({ id:"sofa-h2", x:600, y:407, dir:"down", sortY:412.5, stand:[37, 26], kind:"sofa" });
    rest({ id:"sofa-h3", x:611, y:407, dir:"down", sortY:412.5, stand:[38, 26], kind:"sofa" });
    rest({ id:"banco-1", x:586, y:369, dir:"right", sortY:373.5, stand:[36, 23], kind:"stool" });
    rest({ id:"banco-2", x:614, y:369, dir:"left", sortY:373.5, stand:[38, 23], kind:"stool" });
    // em pé diante do bebedouro, do café e da máquina
    rest({ id:"maq-1", x:577, y:347, dir:"up", pose:"idle", sortY:347, stand:[36, 21], kind:"stand" });
    rest({ id:"maq-2", x:606, y:347, dir:"up", pose:"idle", sortY:347, stand:[37, 21], kind:"stand" });
    rest({ id:"maq-3", x:640, y:347, dir:"up", pose:"idle", sortY:347, stand:[40, 21], kind:"stand" });
    // os outros tiles livres da copa viram lugares "em pé"
    var used = {}; w.rest.forEach(function(r){ used[r.stand[0]+","+r.stand[1]] = 1; });
    var standDirs = ["down", "left", "right", "down"];
    function addStandSpots(c0, c1, r0, r1, area, list){
      for(var ty=r0; ty<=r1; ty++) for(var tx=c0; tx<=c1; tx++){
        if(!w.grid[ty*TW+tx] || used[tx+","+ty]) continue;
        used[tx+","+ty] = 1;
        list.push({ id:area+"-"+tx+"-"+ty, x:tx*TILE+8, y:ty*TILE+12, dir:standDirs[(tx*7+ty*3)%4], pose:"idle", sortY:ty*TILE+12,
                    stand:[tx, ty], kind:"stand", area:area, occ:null });
      }
    }
    addStandSpots(32, 43, 21, 26, "copa", w.rest);
    // reserva (muita gente descansando ao mesmo tempo): Central e corredor de baixo
    w.restExtra = [];
    addStandSpots(13, 30, 25, 26, "central", w.restExtra);
    addStandSpots(1, 42, 16, 17, "corredor", w.restExtra);

    // ---------- ala 09 Blogs: mesa de pauta (ao lado da porta da copa), plantas e corredores ----------
    obj("of_meeting_set", 656, 536, { solid:{ x:633, y:496, w:47, h:40 }, draw:meetingDrawer });
    w.blogMeet = [];
    [
      { x:645, y:491, dir:"down", chair:["of_chair_down", 645, 498], sortY:498.5, stand:[40, 30], badge:{ x:645, y:497 }, bubble:"side" },
      { x:667, y:491, dir:"down", chair:["of_chair_down", 667, 498], sortY:498.5, stand:[41, 30], badge:{ x:667, y:497 }, bubble:"side" },
      { x:628, y:522, dir:"right", chair:["of_chair_right", 625, 529], sortY:536.5, stand:[39, 32], badge:{ x:628, y:528 } },
      { x:684, y:522, dir:"left", chair:["of_chair_left", 687, 529], sortY:536.5, stand:[42, 32], badge:{ x:684, y:528 } },
      { x:656, y:539, dir:"up", chair:["of_chair_up", 656, 555], sortY:536.6, stand:[41, 34], badge:{ x:656, y:553 } }
    ].forEach(function(m, k){
      obj(m.chair[0], m.chair[1], m.chair[2], { solid:null });
      w.blogMeet.push(seat({ id:"pauta-"+k, x:m.x, y:m.y, dir:m.dir, sortY:m.sortY, stand:m.stand, area:"f9", badge:m.badge, kind:"meeting", bubble:m.bubble }));
    });
    obj("dc_plant_tall", 696, 474);
    obj("dc_plant_s", 568, 474);
    obj("dc_plant_bush", 8, 698);
    obj("dc_plant_spiky", 696, 698);
    w.restBlogs = [];
    w.blogMeet.forEach(function(m){ used[m.stand[0]+","+m.stand[1]] = 1; });
    addStandSpots(0, 43, 34, 35, "f9", w.restBlogs);
    addStandSpots(1, 42, 43, 44, "f9", w.restBlogs);
    w.blockSeats.f9 = [];
    w.overflow.f9 = [];
    w.areas.f9 = { x:0, y:432, w:WW, h:WH - 432 };
    w.areas.tudo = { x:0, y:0, w:WW, h:WH };
    return w;
  }

  // ---------- desenhos dinâmicos (monitor aceso/apagado, estação, reunião) ----------
  function seatWorking(s){
    var e = s && s.occ ? ents[s.occ] : null;
    return e && e.mode==="sit" && e.at===s && e.p.status==="work" ? e : null;
  }
  function monitorDrawer(s){
    return function(ctx, t){
      var e = seatWorking(s);
      if(e) PX.draw(ctx, "of_mon", this.x, this.y, { frame:REDUCE ? 0 : e.typeStep });
      else PX.draw(ctx, "of_mon_off", this.x, this.y);
    };
  }
  function stationDrawer(ctx, t){
    var on = W.stationSeats.some(seatWorking);
    if(on) PX.draw(ctx, "of_station6", this.x, this.y, { frame:REDUCE ? 0 : (Math.floor(t*2.5)%2) });
    else PX.draw(ctx, "of_station6_off", this.x, this.y);
  }
  function meetingDrawer(ctx, t){
    var on = (this.y>432 ? W.blogMeet : W.meetSeats).some(seatWorking);
    PX.draw(ctx, "of_meeting_set", this.x, this.y, { frame:on && !REDUCE ? (Math.floor(t*2.2)%2) : 0 });
  }

  // ---------- fundo: piso, paredes, quadros e placas ----------
  function isWood(tx, ty){ return WOOD.some(function(r){ return tx>=r.c0 && tx<=r.c1 && ty>=r.r0 && ty<=r.r1; }); }
  function isWallTile(tx, ty){
    return WALLS.some(function(wl){ return ty>=wl.y/TILE && ty<wl.y/TILE+2 && tx*TILE>=wl.x0 && tx*TILE<wl.x1; });
  }
  function signWidth(text, num){ var inner = textWidth(text) + (num ? textWidth(num)+4+4 : 0); return Math.max(28, inner + 8 + 6); }
  function drawSign(ctx, cx, wallTop, text, num){
    var Wd = signWidth(text, num), name = Wd===88 && !num ? "dc_sign" : LG.makeSign(Wd), s = sp(name);
    var base = wallTop + (LG.wallY.dc_sign || 29);
    PX.draw(ctx, name, cx, base);
    var x0 = Math.round(cx - s.ox), y0 = base - s.oy;
    var inner = textWidth(text) + (num ? textWidth(num)+8 : 0);
    var tx = x0 + 4 + Math.floor((s.w - 8 - inner)/2), ty = y0 + 7;
    if(num){
      var nb = textWidth(num) + 4;
      ctx.fillStyle = K; ctx.fillRect(tx, ty-2, nb, 11);
      drawText(ctx, num, tx+2, ty, LOUSA);
      tx += nb + 4;
    }
    drawText(ctx, text, tx, ty, K);
    return { x0:x0, x1:x0+s.w };
  }
  function wallItem(ctx, name, cx, wallTop){ PX.draw(ctx, name, cx, wallTop + (LG.wallY[name] || 24)); }
  function itemW(name){ return sp(name) ? sp(name).w : 0; }

  function renderBackground(){
    var comps = R.companies(), cmap = {};
    comps.forEach(function(c){ cmap[c.id] = c; });
    var c = bgCanvas || document.createElement("canvas");
    c.width = WW; c.height = WH;
    var ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = LETTERBOX; ctx.fillRect(0, 0, WW, WH);
    var tx, ty;
    for(ty=0; ty<TH; ty++) for(tx=0; tx<TW; tx++){
      var h = (tx*73856093 ^ ty*19349663) >>> 0, name;
      if(isWood(tx, ty)) name = h%3===0 ? "of_floor_wood_b" : "of_floor_wood";
      else if(ty>0 && isWallTile(tx, ty-1)) name = "of_floor_top";
      else name = h%5===0 ? "of_floor_b" : "of_floor";
      PX.draw(ctx, name, tx*TILE, ty*TILE);
    }
    W.floorRugs.forEach(function(r){ PX.draw(ctx, r[0], r[1], r[2]); });
    WALLS.forEach(function(wl){
      for(var x=wl.x0; x<wl.x1; x+=TILE) PX.draw(ctx, wl.sp, x, wl.y);
      if(wl.endL==="toco") PX.draw(ctx, "of_wall_end_l", wl.x0, wl.y); else if(wl.endL==="edge") PX.draw(ctx, "of_wall_edge", wl.x0, wl.y);
      if(wl.endR==="toco") PX.draw(ctx, "of_wall_end_r", wl.x1-6, wl.y); else if(wl.endR==="edge") PX.draw(ctx, "of_wall_edge", wl.x1-1, wl.y);
    });
    TOCOS.forEach(function(tc){ for(var y=tc.y0; y<tc.y1; y+=TILE) PX.draw(ctx, "of_wall_side", tc.x, y); });

    // placas das empresas + quadros nas sobras
    var SIDE = [["dc_paint_a", "dc_paint_b"], ["dc_paint_b", "dc_board"], ["dc_board_pie", "dc_paint_a"], ["dc_paint_a", "dc_tv"],
                ["dc_paint_b", "dc_paint_a"], ["dc_board", "dc_paint_b"], ["dc_paint_a", "dc_board_pie"], ["dc_paint_b", "dc_paint_a"]];
    BLOCKS.forEach(function(cid, bi){
      var band = bi<4 ? 0 : 1, bx = BX[bi%4]*TILE, top = band ? 144 : 0;
      var segL = bx + (band ? 6 : 0), segR = bx + (band ? 138 : 147), cx = Math.round((segL+segR)/2);
      var co = cmap[cid] || { num:bi+1, short:cid.toUpperCase() };
      var r = drawSign(ctx, cx, top, co.short, (co.num<10 ? "0" : "")+co.num);
      var side = SIDE[bi], leftSpace = r.x0 - segL - 4, rightSpace = segR - r.x1 - 4;
      if(side[0] && itemW(side[0])<=leftSpace) wallItem(ctx, side[0], Math.round(segL + 2 + leftSpace/2), top);
      if(side[1] && itemW(side[1])<=rightSpace) wallItem(ctx, side[1], Math.round(r.x1 + 2 + rightSpace/2), top);
    });
    // Diretoria
    wallItem(ctx, "dc_paint_a", 54, 288);
    drawSign(ctx, 100, 288, "DIRETORIA");
    wallItem(ctx, "dc_paint_b", 143, 288);
    // Central de dados
    drawSign(ctx, 248, 288, "CENTRAL DE DADOS");
    wallItem(ctx, "dc_tv", 330, 288);
    drawSign(ctx, 432, 288, "GRUPO LISIEUX");
    // ala 09 Blogs: placa da empresa ao lado da porta da copa + uma placa por blog, sobre a sua fileira
    var f9 = cmap.f9 || { num:9, short:"BLOGS" };
    drawSign(ctx, 656, 432, f9.short, (f9.num<10 ? "0" : "")+f9.num);
    var BSIDE = ["dc_board", "dc_paint_a", "dc_paint_b", "dc_board_pie", "dc_paint_a", "dc_tv", "dc_paint_b"];
    BLOG_LAYOUT.forEach(function(b, i){
      var bl = R.BLOGS.filter(function(x){ return x.key===b.key; })[0], bx = b.x0*TILE, wdt = 48*b.n;
      if(!bl) return;
      var segL = bx + (b.wall===576 ? 6 : -10), segR = bx + wdt + (b.wall===576 ? -6 : 10), cx = Math.round(bx + wdt/2);
      var r = drawSign(ctx, cx, b.wall, bl.short);
      var rightSpace = segR - r.x1 - 4, leftSpace = r.x0 - segL - 4, side = BSIDE[i];
      if(itemW(side)<=rightSpace) wallItem(ctx, side, Math.round(r.x1 + 2 + rightSpace/2), b.wall);
      else if(itemW(side)<=leftSpace) wallItem(ctx, side, Math.round(segL + 2 + leftSpace/2), b.wall);
    });
    bgCanvas = c;
  }

  // =====================================================================================
  // 4. PESSOAS
  // =====================================================================================
  var ents = {};                 // id -> entidade
  var people = [];               // lista final (merge)
  var clock = 0;

  function newEnt(p){
    return { id:p.id, p:p, lk:null, x:0, y:0, dir:"down", mode:"stand", step:0, stepT:0, typeStep:0, phase:Math.random()*10,
             path:[], target:null, at:null, tile:null, nextStroll:clock + rnd(6, 16), zNext:clock + rnd(2, 10), zOn:false, placed:false };
  }
  function bfs(from, to){
    var key = function(x, y){ return y*TW+x; }, start = key(from[0], from[1]), goal = key(to[0], to[1]);
    if(start===goal) return [];
    var prev = new Int32Array(TW*TH).fill(-1), q = [start], seen = new Uint8Array(TW*TH);
    seen[start] = 1;
    while(q.length){
      var cur = q.shift(); if(cur===goal) break;
      var cx = cur % TW, cy = (cur - cx)/TW;
      var nb = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
      for(var i=0; i<4; i++){
        var nx = nb[i][0], ny = nb[i][1]; if(nx<0 || ny<0 || nx>=TW || ny>=TH) continue;
        var k = key(nx, ny); if(seen[k]) continue;
        if(!W.grid[k] && k!==goal) continue;
        seen[k] = 1; prev[k] = cur; q.push(k);
      }
    }
    if(!seen[goal]) return null;
    var out = [], n = goal;
    while(n!==start && n>=0){ out.push([n % TW, Math.floor(n/TW)]); n = prev[n]; }
    return out.reverse();
  }
  function nearestFree(tx, ty){
    if(W.grid[ty*TW+tx]) return [tx, ty];
    for(var r=1; r<8; r++) for(var dy=-r; dy<=r; dy++) for(var dx=-r; dx<=r; dx++){
      var x = tx+dx, y = ty+dy; if(x<0 || y<0 || x>=TW || y>=TH) continue;
      if(W.grid[y*TW+x]) return [x, y];
    }
    return [tx, ty];
  }
  function standPoint(s){ return { x:s.stand[0]*TILE+8, y:s.stand[1]*TILE+12 }; }
  function place(e, s){
    e.x = s.x; e.y = s.y; e.dir = s.dir; e.at = s; e.tile = s.stand.slice(); e.path = [];
    e.mode = s.pose==="sit" ? "sit" : "stand"; e.placed = true;
  }
  function goTo(e, s, instant){
    if(e.target && e.target!==s && e.target.occ===e.id) e.target.occ = null;
    e.target = s; s.occ = e.id;
    if(instant || REDUCE || !e.placed){ place(e, s); return; }
    var start = e.tile ? e.tile.slice() : nearestFree(tileOf(e.x), tileOf(e.y - 4));
    var pts = [];
    if(e.at && e.mode==="sit"){ var sp0 = standPoint(e.at); pts.push({ x:sp0.x, y:sp0.y }); }
    var route = bfs(start, s.stand);
    if(route===null){ place(e, s); return; }
    route.forEach(function(t){ pts.push({ x:t[0]*TILE+8, y:t[1]*TILE+12 }); });
    pts.push({ x:s.x, y:s.y, final:true });
    e.path = pts; e.at = null; e.mode = "walk";
  }
  function updateEnt(e, dt){
    if(e.mode==="walk"){
      var dist = SPEED*dt;
      while(dist>0 && e.path.length){
        var p = e.path[0], dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx*dx + dy*dy);
        if(d>0.01){ if(Math.abs(dx)>Math.abs(dy)) e.dir = dx>0 ? "right" : "left"; else e.dir = dy>0 ? "down" : "up"; }
        if(d<=dist){ e.x = p.x; e.y = p.y; dist -= d; e.path.shift(); if(!p.final) e.tile = [tileOf(p.x), tileOf(p.y)]; }
        else { e.x += dx/d*dist; e.y += dy/d*dist; dist = 0; }
      }
      e.stepT += dt; if(e.stepT>0.13){ e.stepT = 0; e.step = (e.step+1) % 4; }
      if(!e.path.length){ var s = e.target; e.at = s; e.dir = s.dir; e.mode = s.pose==="sit" ? "sit" : "stand"; e.tile = s.stand.slice(); e.step = 0; }
      return;
    }
    if(REDUCE){ e.step = 0; e.typeStep = 0; return; }
    if(e.mode==="sit" && e.p.status==="work"){
      var tt = clock + e.phase, pause = Math.floor(tt/2.6) % 5 === 4;
      e.typeStep = pause ? 0 : Math.floor(tt/0.2) % 2;
      e.pauseTyping = pause;
    } else if(e.mode==="stand"){
      e.step = Math.floor((clock + e.phase)/0.75) % 2;
      // passeio: quem está em pé descansando anda uns tiles de vez em quando
      if(e.p.status==="rest" && e.at && e.at.kind==="stand" && clock>e.nextStroll){
        e.nextStroll = clock + rnd(9, 22);
        var cands = W.rest.concat(W.restExtra, W.restBlogs).filter(function(r){
          return r.kind==="stand" && !r.occ && r.area===e.at.area && Math.abs(r.stand[0]-e.at.stand[0]) + Math.abs(r.stand[1]-e.at.stand[1])<=4;
        });
        if(cands.length) goTo(e, pick(cands));
      }
    }
    if(e.p.status==="rest" && e.mode!=="walk"){
      if(clock>e.zNext){ e.zOn = !e.zOn; e.zNext = clock + (e.zOn ? rnd(2.5, 4) : rnd(5, 13)); }
    } else e.zOn = false;
  }

  // ---------- quem vai para onde ----------
  function freeOf(list){ for(var i=0; i<list.length; i++) if(!list[i].occ) return list[i]; return null; }
  function freeRandom(list, pref){
    var free = list.filter(function(r){ return !r.occ; });
    if(!free.length) return null;
    if(pref){ var p = free.filter(pref); if(p.length && Math.random()<0.6) return pick(p); }
    return pick(free);
  }
  function chooseTarget(e, home){
    var p = e.p, cur = e.target;
    var blogs = p.company==="f9", meet = blogs ? W.blogMeet.concat(W.meetSeats) : W.meetSeats, g = e.group || p.company;
    if(p.status==="work"){
      if(/reuni|pauta/i.test(p.task||"")){
        if(cur && cur.kind==="meeting") return cur;
        var m = freeRandom(blogs ? W.blogMeet : W.meetSeats) || freeRandom(meet); if(m) return m;
      }
      if(home) return home;
      if(cur && (cur.kind==="meeting" || (cur.kind==="stand" && cur.area===(W.overflow[g] && W.overflow[g][0] ? W.overflow[g][0].area : p.company)))) return cur;
      var mm = freeOf(meet); if(mm) return mm;
      var ov = freeOf(W.overflow[g] || []); if(ov) return ov;
    }
    var restAll = W.rest.concat(W.restExtra, W.restBlogs);
    if(cur && cur.area && (cur.area==="copa" || cur.area==="corredor" || (cur.area==="central" && cur.kind==="stand") || (blogs && cur.area==="f9")) && restAll.indexOf(cur)>=0) return cur;
    if(blogs){ var rb = freeRandom(W.restBlogs); if(rb) return rb; }        // a ala tem os próprios corredores de descanso
    return freeRandom(W.rest, function(r){ return r.kind!=="stand"; }) || freeRandom(W.restExtra) || freeRandom(W.restBlogs) || W.rest[0];
  }

  function groupOf(p){
    if(p.kind==="robo") return "robo";
    if(p.company==="f9" && p.blog && W.blockSeats["f9:"+p.blog]) return "f9:"+p.blog;
    return p.company;
  }
  function syncPeople(instant){
    if(!W) return;
    var list = R.merge(roster, robotsList, liveMap, demoActive() ? demoMap : null, liveMode);
    people = list;
    var groups = {}, home = {}, alive = {};
    list.forEach(function(p){ (groups[groupOf(p)] = groups[groupOf(p)] || []).push(p); });
    Object.keys(groups).forEach(function(g){
      var seats = g==="robo" ? W.stationSeats : g==="chefia" ? W.execSeats : (W.blockSeats[g] || []);
      // quem é fixo tem lugar próprio; os subagentes ocupam os lugares que sobram (nunca o de quem está trabalhando)
      var fixed = groups[g].filter(function(p){ return p.kind!=="ajudante"; }), taken = {};
      fixed.forEach(function(p, i){ if(seats[i]){ home[p.id] = seats[i]; if(p.status==="work") taken[i] = 1; } });
      var k = 0;
      groups[g].forEach(function(p){
        if(p.kind!=="ajudante") return;
        while(k<seats.length && taken[k]) k++;
        if(k<seats.length){ home[p.id] = seats[k]; taken[k] = 1; }
      });
    });
    list.forEach(function(p){
      alive[p.id] = 1;
      var e = ents[p.id];
      if(!e) e = ents[p.id] = newEnt(p);
      e.p = p; e.lk = R.look(p); e.icon = R.roleIcon(p); e.home = home[p.id] || null; e.group = groupOf(p);
    });
    Object.keys(ents).forEach(function(id){
      if(alive[id]) return;
      var e = ents[id]; if(e.target && e.target.occ===id) e.target.occ = null;
      if(hover===id) hover = null;
      if(cardId===id) closeCard();
      delete ents[id];
    });
    // primeiro solta quem muda de estado (libera vagas), depois escolhe
    list.forEach(function(p){
      var e = ents[p.id], t = e.target;
      if(!t) return;
      var wantsSeat = p.status==="work", isRestSpot = W.rest.indexOf(t)>=0 || W.restExtra.indexOf(t)>=0 || W.restBlogs.indexOf(t)>=0;
      if((wantsSeat && isRestSpot) || (!wantsSeat && !isRestSpot) || (wantsSeat && e.home && t!==e.home && !/reuni/i.test(p.task||""))){
        if(t.occ===e.id) t.occ = null;
      }
    });
    list.forEach(function(p){
      var e = ents[p.id], t = chooseTarget(e, e.home);
      if(t!==e.target || !e.placed){ if(t.occ && t.occ!==e.id && ents[t.occ] && ents[t.occ].target===t) ents[t.occ].target = null; goTo(e, t, instant); }
      else t.occ = e.id;
    });
    if(cardId && ents[cardId]) fillCard(ents[cardId]);
    updateA11y();
  }

  // =====================================================================================
  // 5. DESENHO
  // =====================================================================================
  var screen = $("office"), sctx = screen.getContext("2d");
  var world = document.createElement("canvas"); world.width = WW; world.height = WH;
  var wctx = world.getContext("2d"); wctx.imageSmoothingEnabled = false;
  var hover = null, cardId = null;

  function entFrame(e){
    var lk = e.lk, pose = "idle", step = 0;
    if(e.mode==="walk"){ pose = "walk"; step = e.step; }
    else if(e.mode==="sit"){ pose = (e.p.status==="work" && !e.pauseTyping && !REDUCE) ? "sit-type" : (e.p.status==="work" ? "sit-type" : "sit"); step = e.p.status==="work" ? e.typeStep : 0; }
    else { pose = "idle"; step = REDUCE ? 0 : e.step; }
    return CH.frame({ dir:e.dir, pose:pose, step:step, skin:lk.skin, hair:lk.hair, hairStyle:lk.hairStyle, shirt:lk.shirt,
                      pants:lk.pants, jacket:lk.jacket, skirt:lk.skirt, badge:null });
  }
  function drawWorld(t){
    wctx.drawImage(bgCanvas, 0, 0);
    var items = W.objs.slice();
    Object.keys(ents).forEach(function(id){
      var e = ents[id]; if(!e.placed) return;
      items.push({ ent:e, sortY:e.mode==="sit" && e.at ? e.at.sortY : e.y, ord:1e6 });
    });
    items.sort(function(a, b){ return a.sortY - b.sortY || a.ord - b.ord; });
    for(var i=0; i<items.length; i++){
      var it = items[i];
      if(it.ent){
        var e = it.ent, f = entFrame(e);
        wctx.drawImage(f, Math.round(e.x) - CH.OX, Math.round(e.y) - CH.OY);
      } else if(it.draw) it.draw(wctx, t);
      else PX.draw(wctx, it.name, it.x, it.y);
    }
    // camada de cima: selos, balões, "z"
    Object.keys(ents).forEach(function(id){
      var e = ents[id]; if(!e.placed || !e.lk.badge) return;
      if(e.mode==="sit" && e.at && e.at.badge) CH.drawBadge(wctx, e.lk.badge, e.at.badge.x, e.at.badge.y);
      else CH.drawBadge(wctx, e.lk.badge, e.x, e.y);
    });
    Object.keys(ents).forEach(function(id){
      var e = ents[id]; if(!e.placed) return;
      var head = Math.round(e.y) - 22;
      if(e.p.status==="work" && e.mode!=="walk"){
        if(e.mode==="sit" && e.at && e.at.bubble==="side") drawBubbleSide(wctx, e.x + 9, head + 2, e.icon);
        else drawBubble(wctx, e.x, e.mode==="sit" && e.at && e.at.bubbleTip ? e.at.bubbleTip : head - 1, e.icon);
      }
      else if(e.zOn && !REDUCE){
        var ph = (clock*0.8 + e.phase) % 1;
        drawZ(wctx, e.x + 4 + ph*3, head - 4 - ph*6, false);
        if(ph>0.45) drawZ(wctx, e.x + 9, head - 9 - ph*4, true);
      }
    });
    if(hover && ents[hover] && ents[hover].placed){
      var he = ents[hover], hx = Math.round(he.x), hy = Math.round(he.y) + (he.mode==="sit" ? 0 : 1);
      wctx.fillStyle = "rgba(124,151,240,0.9)";
      if(he.mode!=="sit"){ wctx.fillRect(hx-5, hy, 11, 1); wctx.fillRect(hx-6, hy-1, 1, 1); wctx.fillRect(hx+6, hy-1, 1, 1); }
    }
  }

  // ---------- câmera ----------
  var cam = { cx:WW/2, cy:WH/2, z:1 }, camT = { cx:WW/2, cy:WH/2, z:1 }, camMode = { kind:"area", id:"tudo" };
  var dpr = 1, VW = 1, VH = 1;
  function fitZoomFor(r, pad){
    pad = pad==null ? 0 : pad;
    var s = Math.min(VW/(r.w + pad*2), VH/(r.h + pad*2));
    if(s>=1){ var k = Math.floor(s); return k/s>=0.92 ? k : s; }
    return s;
  }
  function zoomLimits(){ var f = fitZoomFor(W.areas.tudo, 0); return { min:Math.min(f, 1), max:Math.max(6*dpr, f) }; }
  function clampCam(c){
    var halfW = VW/(2*c.z), halfH = VH/(2*c.z);
    c.cx = WW<=2*halfW ? WW/2 : Math.max(halfW, Math.min(WW - halfW, c.cx));
    c.cy = WH<=2*halfH ? WH/2 : Math.max(halfH, Math.min(WH - halfH, c.cy));
  }
  function setTarget(cx, cy, z, instant){
    var lim = zoomLimits();
    camT.z = Math.max(lim.min, Math.min(lim.max, z)); camT.cx = cx; camT.cy = cy; clampCam(camT);
    if(instant || REDUCE){ cam.cx = camT.cx; cam.cy = camT.cy; cam.z = camT.z; }
  }
  function focusArea(id, instant){
    var r = W.areas[id] || W.areas.tudo;
    var z = id==="tudo" ? fitZoomFor(r, 0) : Math.min(fitZoomFor(r, 12), 5*dpr);
    if(id!=="tudo" && z<fitZoomFor(W.areas.tudo, 0)) z = fitZoomFor(W.areas.tudo, 0);
    camMode = { kind:"area", id:id };
    setTarget(r.x + r.w/2, r.y + r.h/2, z, instant);
  }
  function stepCam(dt){
    if(REDUCE){ cam.cx = camT.cx; cam.cy = camT.cy; cam.z = camT.z; return; }
    var k = 1 - Math.exp(-dt*9);
    cam.z += (camT.z - cam.z)*k; cam.cx += (camT.cx - cam.cx)*k; cam.cy += (camT.cy - cam.cy)*k;
    if(Math.abs(cam.z - camT.z)<0.002) cam.z = camT.z;
    if(Math.abs(cam.cx - camT.cx)<0.05) cam.cx = camT.cx;
    if(Math.abs(cam.cy - camT.cy)<0.05) cam.cy = camT.cy;
  }
  function origin(){ return { x:Math.round(VW/2 - cam.cx*cam.z), y:Math.round(VH/2 - cam.cy*cam.z) }; }
  // escala inteira = pixel puro; escala quebrada > 1 = "sharp bilinear" (amplia inteiro e reduz suave: sem pixels tortos);
  // escala < 1 = redução suave
  var mid = document.createElement("canvas"), mctx = mid.getContext("2d");
  function blitScreen(){
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = LETTERBOX; sctx.fillRect(0, 0, VW, VH);
    var o = origin(), z = cam.z, zi = Math.round(z), dw = Math.round(WW*z), dh = Math.round(WH*z);
    if(zi>=1 && Math.abs(z - zi)<0.001){ sctx.imageSmoothingEnabled = false; sctx.drawImage(world, 0, 0, WW, WH, o.x, o.y, WW*zi, WH*zi); return; }
    if(z<1 || z>=4){ sctx.imageSmoothingEnabled = z<1; if(z<1) sctx.imageSmoothingQuality = "high"; sctx.drawImage(world, 0, 0, WW, WH, o.x, o.y, dw, dh); return; }
    var k = Math.ceil(z);
    if(mid.width!==WW*k){ mid.width = WW*k; mid.height = WH*k; }
    mctx.imageSmoothingEnabled = false; mctx.drawImage(world, 0, 0, WW*k, WH*k);
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = "high";
    sctx.drawImage(mid, 0, 0, WW*k, WH*k, o.x, o.y, dw, dh);
  }
  function resize(){
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    var cw = window.innerWidth, ch = window.innerHeight;
    VW = Math.max(1, Math.round(cw*dpr)); VH = Math.max(1, Math.round(ch*dpr));
    screen.width = VW; screen.height = VH;
    if(camMode.kind==="area") focusArea(camMode.id, true); else { clampCam(camT); clampCam(cam); }
    var portrait = ch>cw && cw<760;
    var hint = $("hint"); if(hint) hint.hidden = !portrait || hintClosed;
  }
  function toWorld(clientX, clientY){
    var o = origin();
    return { x:(clientX*dpr - o.x)/cam.z, y:(clientY*dpr - o.y)/cam.z };
  }
  function hitTest(clientX, clientY){
    var p = toWorld(clientX, clientY), best = null, bestY = -1;
    Object.keys(ents).forEach(function(id){
      var e = ents[id]; if(!e.placed) return;
      var top = e.y - 23 - (e.p.status==="work" && e.mode!=="walk" ? 15 : 0), bottom = e.mode==="sit" ? e.y - 4 : e.y + 1;
      if(p.x>=e.x-7 && p.x<=e.x+7 && p.y>=top && p.y<=bottom){
        var sy = e.mode==="sit" && e.at ? e.at.sortY : e.y;
        if(sy>bestY){ bestY = sy; best = e; }
      }
    });
    return best;
  }

  // =====================================================================================
  // 6. DADOS: equipe, robôs, ao vivo, demonstração
  // =====================================================================================
  var roster = R.load();
  var metrics = null, metricsOnce = false, robotsList = R.robots(null);
  var liveConfigured = false; try{ liveConfigured = !!(LIVE && LIVE.isConfigured && LIVE.isConfigured()); }catch(e){}
  var liveMap = {}, liveMode = liveConfigured ? "connecting" : "off", liveOnce = false;
  var demoOn = true, demoMap = {}, demoTimer = 0;
  try{ var dv = localStorage.getItem(DEMO_KEY); if(dv==="0") demoOn = false; }catch(e){}
  function demoActive(){ return demoOn && liveMode==="off"; }

  var TASKS = {
    pencil:["escrevendo artigo", "revisando texto", "escrevendo roteiro do vídeo", "ajustando os títulos", "escrevendo a newsletter", "reunião de pauta"],
    search:["pesquisando fontes", "lendo estudos", "checando dados", "levantando referências", "conferindo citações", "reunião de pauta"],
    star:["aprovando a pauta da semana", "revisando os números", "planejando o mês", "reunião de pauta"],
    clip:["organizando pedidos", "respondendo mensagens", "atualizando a planilha", "reunião de pauta"]
  };
  function demoTask(p){ return pick(TASKS[R.roleIcon(p)] || TASKS.clip); }
  function demoCandidates(){ return R.routines().concat(roster).filter(function(p){ return p.kind!=="robo"; }); }
  function demoStart(){
    demoMap = {};
    demoCandidates().forEach(function(p){
      var work = Math.random()<0.55;
      demoMap[p.id] = { status:work ? "work" : "rest", task:work ? demoTask(p) : "" };
    });
    scheduleDemo();
  }
  function scheduleDemo(){
    clearTimeout(demoTimer);
    demoTimer = setTimeout(function(){
      if(!demoActive()) return;
      var c = demoCandidates();
      if(c.length){
        var p = pick(c), cur = demoMap[p.id] || { status:p.status };
        var work = cur.status!=="work";
        demoMap[p.id] = { status:work ? "work" : "rest", task:work ? demoTask(p) : "" };
        syncPeople(false);
      }
      scheduleDemo();
    }, rnd(2500, 3500));
  }
  function demoStop(){ clearTimeout(demoTimer); demoMap = {}; }
  function setDemo(on, user){
    demoOn = !!on;
    if(user){ try{ localStorage.setItem(DEMO_KEY, demoOn ? "1" : "0"); }catch(e){} }
    if(demoActive()) demoStart(); else demoStop();
    syncPeople(false); updateChip(); updateDemoSwitch();
  }

  function loadMetrics(){
    var url = "../data/metrics.json?t="+Date.now();
    var done = function(m){ var first = !metricsOnce; metricsOnce = true; metrics = m; robotsList = R.robots(metrics); syncPeople(first); };
    try{
      fetch(url, { cache:"no-store" }).then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
        .then(function(j){ done(j && typeof j==="object" ? j : null); })
        .catch(function(){ robotsList = R.robots(metrics); syncPeople(false); });
    }catch(e){}
  }

  // =====================================================================================
  // 7. INTERFACE (menu, chip, dica, cartão, lista acessível)
  // =====================================================================================
  var drawer = $("drawer"), menuBtn = $("menuBtn"), chip = $("chip"), tip = $("tip"), card = $("card"), srList = $("srList");
  var hintClosed = false;
  var AREA_LABEL = { tudo:"Ver tudo", chefia:"Diretoria", central:"Central de dados", copa:"Copa" };

  function el(tag, cls, text){ var n = document.createElement(tag); if(cls) n.className = cls; if(text!=null) n.textContent = text; return n; }
  function buildDrawer(){
    var list = $("areaList"); if(!list) return;
    list.textContent = "";
    var items = [["tudo", "Ver tudo"], ["chefia", "Diretoria"]];
    R.companies().forEach(function(c){
      if(!/^f[1-9]$/.test(c.id)) return;
      items.push([c.id, c.label]);
      if(c.id==="f9") R.BLOGS.forEach(function(b){ items.push(["f9-"+b.key, b.name, true]); });
    });
    items.push(["central", "Central de dados"], ["copa", "Copa"]);
    items.forEach(function(it){
      AREA_LABEL[it[0]] = it[1];
      var li = el("li"), b = el("button", "area-btn"+(it[2] ? " sub" : ""), it[1]);
      b.type = "button"; b.setAttribute("data-area", it[0]);
      b.addEventListener("click", function(){ goArea(it[0], false); closeDrawer(true); });
      li.appendChild(b); list.appendChild(li);
    });
    markArea();
  }
  function markArea(){
    var cur = camMode.kind==="area" ? camMode.id : null;
    Array.prototype.forEach.call(document.querySelectorAll(".area-btn"), function(b){
      if(b.getAttribute("data-area")===cur) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
  }
  function goArea(id, instant){
    if(!W.areas[id]) id = "tudo";
    focusArea(id, instant);
    try{ history.replaceState(null, "", location.pathname + location.search + "#empresa=" + id); }catch(e){ location.hash = "empresa="+id; }
    markArea();
  }
  function areaFromHash(){
    var m = /(?:^#|&)empresa=([a-z0-9-]+)/.exec(location.hash || "");
    return m && W.areas[m[1]] ? m[1] : null;
  }
  var lastFocus = null;
  function openDrawer(){
    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(function(){ drawer.classList.add("open"); });
    menuBtn.setAttribute("aria-expanded", "true"); menuBtn.setAttribute("aria-label", "Fechar menu");
    var first = drawer.querySelector("button, a"); if(first) first.focus();
  }
  function closeDrawer(restore){
    if(drawer.hidden) return;
    drawer.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false"); menuBtn.setAttribute("aria-label", "Abrir menu");
    setTimeout(function(){ if(!drawer.classList.contains("open")) drawer.hidden = true; }, REDUCE ? 0 : 220);
    if(restore!==false) menuBtn.focus();
  }
  function updateDemoSwitch(){
    var sw = $("demoSw"), note = $("demoNote"); if(!sw) return;
    sw.setAttribute("aria-checked", demoOn ? "true" : "false");
    sw.disabled = liveMode!=="off";
    if(note) note.textContent = liveMode!=="off" ? "Desligado: o escritório está ao vivo." : (demoOn ? "Simulação local; nada é salvo." : "Mostra a equipe como está salva.");
  }
  function updateChip(){
    if(!chip) return;
    var dot = chip.querySelector(".dot"), txt = chip.querySelector(".txt"), tag = chip.querySelector(".tag");
    var state, text, tagText = "";
    if(liveMode==="live"){ state = "live"; text = "Ao vivo"; }
    else if(liveMode==="connecting"){ state = "connecting"; text = "Conectando…"; }
    else if(liveMode==="offline"){ state = "offline"; text = "Sem conexão — tentando de novo"; }
    else if(demoOn){ state = "demo"; text = "Demo Mode"; tagText = "DEMO"; }
    else { state = "off"; text = "Ao vivo desligado"; }
    chip.setAttribute("data-state", state);
    txt.textContent = text;
    tag.textContent = tagText; tag.hidden = !tagText;
    chip.setAttribute("aria-label", state==="demo" ? "Modo demonstração ligado" : text);
    if(dot) dot.setAttribute("aria-hidden", "true");
  }
  function stateText(p){ return p.status==="work" ? "trabalhando" : "descansando"; }
  function placeName(p){ var b = p.blog ? R.blogName(p.blog) : ""; return R.company(p.company).name + (b ? " · " + b : ""); }
  function teamText(p){
    if(p.kind==="ajudante") return "Aparece só enquanto a rotina trabalha";
    var t = p.team; if(!t) return "";
    return (t.perRun===1 ? "1 agente por execução" : t.perRun + " agentes por execução") +
           (t.helpers ? " · até " + (t.helpers + 1) + " ao mesmo tempo" : "") + " (" + t.how + ")";
  }
  function updateA11y(){
    var work = people.filter(function(p){ return p.status==="work"; }).length;
    var label = "Escritório do Grupo Lisieux em pixel art: " + people.length + " pessoas, " + work + " trabalhando e " + (people.length - work) + " descansando." +
                (demoActive() ? " Modo demonstração ligado." : (liveMode==="live" ? " Ao vivo." : ""));
    screen.setAttribute("aria-label", label);
    if(!srList) return;
    srList.textContent = "";
    people.forEach(function(p){
      var li = el("li", null, p.name + " — " + (p.role || R.kindLabel(p.kind)) + ", " + placeName(p) + ": " + stateText(p) + (p.status==="work" && p.task ? " (" + p.task + ")" : "") + ".");
      srList.appendChild(li);
    });
  }
  function originText(p){
    if(p.live) return "ao vivo";
    var o = p.origin || "agente IA";
    return p.demo ? o + " · demonstração" : o;
  }
  function showTip(e, clientX, clientY){
    if(!tip) return;
    tip.textContent = "";
    tip.appendChild(el("b", null, e.p.name));
    tip.appendChild(el("span", "tip-role", (e.p.role || R.kindLabel(e.p.kind)) + " · " + placeName(e.p)));
    tip.appendChild(el("span", "tip-task", e.p.status==="work" ? cap1(e.p.task || "trabalhando") : "Descansando" + (e.p.task ? " · " + e.p.task : "")));
    tip.hidden = false;
    var r = tip.getBoundingClientRect(), x = clientX + 14, y = clientY + 14;
    if(x + r.width > window.innerWidth - 8) x = clientX - r.width - 12;
    if(y + r.height > window.innerHeight - 8) y = clientY - r.height - 12;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }
  function hideTip(){ if(tip) tip.hidden = true; }
  function fillCard(e){
    var p = e.p;
    $("cardName").textContent = p.name;
    $("cardRole").textContent = p.role || R.kindLabel(p.kind);
    $("cardCompany").textContent = placeName(p);
    var tm = teamText(p), tr = $("cardTeamRow");
    if(tr){ tr.hidden = !tm; $("cardTeam").textContent = tm; }
    var st = $("cardState"); st.textContent = cap1(stateText(p)) + (p.stale ? " (sem aviso recente)" : ""); st.setAttribute("data-state", p.status);
    $("cardTask").textContent = p.task ? cap1(p.task) : "—";
    $("cardOrigin").textContent = cap1(originText(p));
  }
  function openCard(e){
    cardId = e.id; fillCard(e); card.hidden = false; hideTip();
    var x = $("cardClose"); if(x) x.focus({ preventScroll:true });
  }
  function closeCard(){ if(!card || card.hidden) return; card.hidden = true; cardId = null; }

  // ---------- entrada: arrastar, pinça, roda, teclado ----------
  var ptrs = {}, drag = null, pinch = null, wheelAcc = 0;
  function zoomLevels(){
    var lim = zoomLimits(), out = [lim.min];
    [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18].forEach(function(z){ if(z>lim.min*1.02 && z<=lim.max) out.push(z); });
    return out;
  }
  function zoomStep(dir, cx, cy){
    var lv = zoomLevels(), z = camT.z, next = z;
    if(dir>0){ for(var i=0; i<lv.length; i++) if(lv[i]>z*1.01){ next = lv[i]; break; } }
    else { for(var j=lv.length-1; j>=0; j--) if(lv[j]<z*0.99){ next = lv[j]; break; } }
    zoomAt(next, cx, cy);
  }
  function zoomAt(z, clientX, clientY){
    var lim = zoomLimits(); z = Math.max(lim.min, Math.min(lim.max, z));
    var mx = clientX==null ? VW/2 : clientX*dpr, my = clientY==null ? VH/2 : clientY*dpr;
    var o = { x:VW/2 - camT.cx*camT.z, y:VH/2 - camT.cy*camT.z };
    var wx = (mx - o.x)/camT.z, wy = (my - o.y)/camT.z;
    camMode = { kind:"free" }; markArea();
    setTarget(wx - (mx - VW/2)/z, wy - (my - VH/2)/z, z, false);
  }
  function panBy(dxWorld, dyWorld){ camMode = { kind:"free" }; markArea(); setTarget(camT.cx + dxWorld, camT.cy + dyWorld, camT.z, false); }

  screen.addEventListener("pointerdown", function(ev){
    try{ screen.setPointerCapture(ev.pointerId); }catch(e){}
    ptrs[ev.pointerId] = { x:ev.clientX, y:ev.clientY };
    var ids = Object.keys(ptrs);
    if(ids.length===1){ drag = { x0:ev.clientX, y0:ev.clientY, cx:camT.cx, cy:camT.cy, moved:false }; pinch = null; }
    else if(ids.length===2){
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      pinch = { d0:Math.hypot(a.x-b.x, a.y-b.y) || 1, z0:camT.z, mx:(a.x+b.x)/2, my:(a.y+b.y)/2 }; drag = null;
    }
    screen.classList.add("grabbing");
  });
  screen.addEventListener("pointermove", function(ev){
    if(ptrs[ev.pointerId]){ ptrs[ev.pointerId] = { x:ev.clientX, y:ev.clientY }; }
    var ids = Object.keys(ptrs);
    if(pinch && ids.length>=2){
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      var lim = zoomLimits(), z = Math.max(lim.min, Math.min(lim.max, pinch.z0*d/pinch.d0));
      zoomAt(z, pinch.mx, pinch.my); cam.z = camT.z; cam.cx = camT.cx; cam.cy = camT.cy;
      return;
    }
    if(drag && ids.length===1){
      var dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if(!drag.moved && Math.abs(dx) + Math.abs(dy) > 5){ drag.moved = true; hideTip(); }
      if(drag.moved){
        camMode = { kind:"free" };
        camT.cx = drag.cx - dx*dpr/camT.z; camT.cy = drag.cy - dy*dpr/camT.z; clampCam(camT);
        cam.cx = camT.cx; cam.cy = camT.cy; cam.z = camT.z;
      }
      return;
    }
    if(ev.pointerType==="mouse"){
      var e = hitTest(ev.clientX, ev.clientY);
      hover = e ? e.id : null;
      screen.style.cursor = e ? "pointer" : "";
      if(e) showTip(e, ev.clientX, ev.clientY); else hideTip();
    }
  });
  function endPtr(ev){
    var wasDrag = drag && drag.moved, single = Object.keys(ptrs).length===1;
    delete ptrs[ev.pointerId];
    if(pinch && Object.keys(ptrs).length<2){
      var lv = zoomLevels(), z = camT.z, best = lv[0];
      lv.forEach(function(l){ if(Math.abs(l - z)<Math.abs(best - z)) best = l; });
      zoomAt(best, pinch.mx, pinch.my); pinch = null; drag = null;
    }
    if(ev.type==="pointerup" && drag && !wasDrag && single){
      var e = hitTest(ev.clientX, ev.clientY);
      if(e) openCard(e); else closeCard();
    }
    if(!Object.keys(ptrs).length){ drag = null; screen.classList.remove("grabbing"); }
    if(wasDrag) markArea();
  }
  screen.addEventListener("pointerup", endPtr);
  screen.addEventListener("pointercancel", endPtr);
  screen.addEventListener("pointerleave", function(ev){ if(ev.pointerType==="mouse" && !drag){ hover = null; hideTip(); } });
  screen.addEventListener("wheel", function(ev){
    ev.preventDefault();
    wheelAcc += ev.deltaY * (ev.deltaMode===1 ? 30 : 1);
    if(Math.abs(wheelAcc)>=60){ zoomStep(wheelAcc<0 ? 1 : -1, ev.clientX, ev.clientY); wheelAcc = 0; }
  }, { passive:false });

  document.addEventListener("keydown", function(ev){
    var tg = ev.target, typing = tg && (tg.tagName==="INPUT" || tg.tagName==="TEXTAREA" || tg.isContentEditable);
    if(ev.key==="Escape"){
      if(!drawer.hidden){ closeDrawer(true); ev.preventDefault(); return; }
      if(card && !card.hidden){ closeCard(); screen.focus({ preventScroll:true }); ev.preventDefault(); return; }
      hideTip(); return;
    }
    if(typing || ev.altKey || ev.ctrlKey || ev.metaKey || !drawer.hidden) return;
    var step = 32;
    switch(ev.key){
      case "ArrowLeft": panBy(-step, 0); break;
      case "ArrowRight": panBy(step, 0); break;
      case "ArrowUp": panBy(0, -step); break;
      case "ArrowDown": panBy(0, step); break;
      case "+": case "=": zoomStep(1); break;
      case "-": case "_": zoomStep(-1); break;
      case "0": goArea("tudo", false); break;
      default: return;
    }
    ev.preventDefault();
  });

  menuBtn.addEventListener("click", function(){ if(drawer.hidden) openDrawer(); else closeDrawer(true); });
  drawer.addEventListener("keydown", function(ev){
    if(ev.key!=="Tab") return;
    var f = drawer.querySelectorAll("button:not([disabled]), a[href]"); if(!f.length) return;
    var first = f[0], last = f[f.length-1];
    if(ev.shiftKey && document.activeElement===first){ ev.preventDefault(); menuBtn.focus(); }
    else if(!ev.shiftKey && document.activeElement===last){ ev.preventDefault(); menuBtn.focus(); }
  });
  document.addEventListener("pointerdown", function(ev){
    if(!drawer.hidden && !drawer.contains(ev.target) && ev.target!==menuBtn && !menuBtn.contains(ev.target)) closeDrawer(false);
  });
  var demoSw = $("demoSw");
  if(demoSw) demoSw.addEventListener("click", function(){ if(!demoSw.disabled) setDemo(!demoOn, true); });
  var cc = $("cardClose"); if(cc) cc.addEventListener("click", function(){ closeCard(); screen.focus({ preventScroll:true }); });
  var hintEl = $("hint"); if(hintEl) hintEl.addEventListener("click", function(){ hintClosed = true; hintEl.hidden = true; });

  var fsBtn = $("fsBtn"), panelLink = $("panelLink");
  var fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if(EMBED){ if(panelLink) panelLink.hidden = true; if(fsBtn) fsBtn.hidden = true; document.documentElement.classList.add("embed"); }
  else if(fsBtn){
    if(!fsOk) fsBtn.hidden = true;
    fsBtn.addEventListener("click", function(){
      var d = document, on = d.fullscreenElement || d.webkitFullscreenElement;
      try{
        if(on) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else { var de = d.documentElement; (de.requestFullscreen || de.webkitRequestFullscreen).call(de); }
      }catch(e){}
    });
    var fsChange = function(){ var on = !!(document.fullscreenElement || document.webkitFullscreenElement); fsBtn.setAttribute("aria-label", on ? "Sair da tela cheia" : "Tela cheia"); fsBtn.classList.toggle("is-on", on); };
    document.addEventListener("fullscreenchange", fsChange); document.addEventListener("webkitfullscreenchange", fsChange);
  }

  window.addEventListener("storage", function(ev){
    if(ev.key===R.KEY || ev.key===null){ roster = R.load(); if(demoActive()){ var keep = {}; roster.forEach(function(p){ if(demoMap[p.id]) keep[p.id] = demoMap[p.id]; }); demoMap = keep; } syncPeople(false); }
    if(ev.key===R.STATE_KEY || ev.key===null){ renderBackground(); buildDrawer(); syncPeople(false); }
  });
  window.addEventListener("hashchange", function(){ var a = areaFromHash(); if(a){ focusArea(a, false); markArea(); } });
  window.addEventListener("resize", resize);
  if(mqReduce){
    var onReduce = function(){ REDUCE = mqReduce.matches; };
    if(mqReduce.addEventListener) mqReduce.addEventListener("change", onReduce); else if(mqReduce.addListener) mqReduce.addListener(onReduce);
  }

  // =====================================================================================
  // 8. PARTIDA
  // =====================================================================================
  W = buildWorld();
  renderBackground();
  buildDrawer();
  if(demoActive()) demoStart();
  syncPeople(true);
  resize();
  var startArea = areaFromHash();
  if(startArea){ focusArea(startArea, true); markArea(); } else focusArea("tudo", true);
  updateChip(); updateDemoSwitch();
  loadMetrics();
  setInterval(loadMetrics, 60000);
  if(LIVE && LIVE.start){
    try{
      LIVE.start(function(map, meta){
        var prev = liveMode;
        liveMap = map && typeof map==="object" ? map : {};
        liveMode = meta && meta.mode ? meta.mode : "off";
        if(prev==="off" && liveMode!=="off") demoStop();
        if(prev!=="off" && liveMode==="off" && demoOn) demoStart();
        var first = liveMode==="live" && !liveOnce && Object.keys(liveMap).length>0;   // 1ª foto ao vivo com dados: cada um já aparece no lugar
        if(first) liveOnce = true;
        syncPeople(first); updateChip(); updateDemoSwitch();
      });
    }catch(e){ liveMode = "off"; }
  }

  var lastT = 0;
  function loop(now){
    requestAnimationFrame(loop);
    var t = now/1000, dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t;
    clock += dt;
    Object.keys(ents).forEach(function(id){ updateEnt(ents[id], dt); });
    stepCam(dt);
    drawWorld(clock);
    blitScreen();
  }
  requestAnimationFrame(loop);

  // gancho de teste/depuração (somente leitura)
  window.LisieuxOffice = {
    people:function(){ return people.map(function(p){ var e = ents[p.id]; return { id:p.id, name:p.name, status:p.status, task:p.task, mode:e ? e.mode : null, x:e ? Math.round(e.x) : null, y:e ? Math.round(e.y) : null, seat:e && e.target ? e.target.id : null }; }); },
    camera:function(){ return { cx:cam.cx, cy:cam.cy, z:cam.z, dpr:dpr, mode:camMode }; },
    liveMode:function(){ return liveMode; },
    demo:function(){ return demoActive(); },
    grid:function(){ return Array.prototype.slice.call(W.grid); },
    size:{ w:WW, h:WH, tiles:[TW, TH] }
  };
})();
