// Personagens do Escritório Lisieux: pixel art chibi 16×24 na vista 3/4 de cima.
// Arte própria, desenhada à mão em linhas indexadas por paleta, no estilo do guia
// (escritorio-ref/style-guide.md, seção 5). Nenhuma imagem externa.
//
// API: window.LISIEUX_CHARS
//   W = 16, H = 24, OX = 8, OY = 23   quadro 16×24; âncora = ponto dos pés (x=8, y=23)
//   hairStyles                          ids dos penteados
//   frame(opts)  → canvas em cache. 16×24; com badge vira 16×32 (a âncora continua em 8,23)
//   badge(tipo)  → canvas 11×9 do selo ("A" ou "chefe") para a camada de UI
//   preview()    → folha com todas as direções × poses × passos para 4 visuais
//   validate()   → lista de erros dos moldes (vazia = ok)
(function(){
  "use strict";
  var W = 16, H = 24, OX = 8, OY = 23;
  var BADGE_W = 11, BADGE_H = 9, BADGE_X = 3, BADGE_Y = 23, H_BADGE = BADGE_Y + BADGE_H; // 32

  // ---------- paleta (tokens do guia) ----------
  var T = {
    contorno:"#303142", contornoSuave:"#44465a", branco:"#fcfcfc", olho:"#2a2433",
    pele1:"#fbc2a6", pele1Sombra:"#f19c8b", bochecha:"#e09d8d",
    pele2:"#f0b29a", pele2Sombra:"#d9907c",
    pele3:"#a77264", pele3Sombra:"#85574d",
    cabeloCastanho:"#815d44", cabeloCastanhoClaro:"#9b7052", cabeloEscuro:"#5a4340",
    cabeloPreto:"#403f4d", cabeloPretoClaro:"#535058", cabeloAzulado:"#4f5d75", cabeloAzuladoClaro:"#677377",
    cabeloRuivo:"#a46533", cabeloRuivoClaro:"#bc8148", cabeloGrisalho:"#58545b", cabeloGrisalhoClaro:"#77727d",
    camisaVermelha:"#ba3335", camisaVermelhaClara:"#d93a3a", camisaVinho:"#863c3d",
    camisaVerde:"#4a7e54", camisaVerdeClara:"#7fae5a", camisaAzul:"#4563c2", camisaMarinho:"#3c4878",
    camisaMagenta:"#a4466a", camisaBranca:"#dfe0ea", calca:"#393647", sapato:"#ac6e4a",
    paleto:"#333545",
    badgeAzul:"#3f63d8", badgeBorda:"#7c97f0", badgeCirculo:"#172061", badgeLetra:"#e8eeff",
    ouro:"#efb829", ouroClaro:"#f2c833", ouroEscuro:"#5b422c"
  };

  // ---------- cores ----------
  function rgb(h){ h = String(h).replace("#",""); if(h.length===3) h = h.replace(/./g,"$&$&"); var n = parseInt(h,16)||0; return [n>>16&255, n>>8&255, n&255]; }
  function hex(c){ return "#"+c.map(function(v){ v = Math.max(0, Math.min(255, Math.round(v))); return (v<16?"0":"")+v.toString(16); }).join(""); }
  function mix(a, b, t){ var A = rgb(a), B = rgb(b); return hex([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t]); }
  function norm(h){ return hex(rgb(h)); }
  // tons conhecidos do guia: base → [claro, escuro]; o que faltar é calculado
  var TONES = {};
  function tone(base, light, dark){ TONES[norm(base)] = [light||null, dark||null]; }
  tone(T.cabeloCastanho, T.cabeloCastanhoClaro); tone(T.cabeloPreto, T.cabeloPretoClaro); tone(T.cabeloAzulado, T.cabeloAzuladoClaro);
  tone(T.cabeloRuivo, T.cabeloRuivoClaro); tone(T.cabeloGrisalho, T.cabeloGrisalhoClaro); tone(T.cabeloEscuro, T.cabeloCastanho);
  tone(T.camisaVermelha, T.camisaVermelhaClara, T.camisaVinho); tone(T.camisaVerde, T.camisaVerdeClara);
  var SKINS = {}; // base → [sombra, bochecha]
  SKINS[norm(T.pele1)] = [T.pele1Sombra, T.bochecha];
  SKINS[norm(T.pele2)] = [T.pele2Sombra, mix(T.pele2, T.pele2Sombra, 0.6)];
  SKINS[norm(T.pele3)] = [T.pele3Sombra, mix(T.pele3, "#b4525a", 0.3)];
  function lightOf(c){ var t = TONES[norm(c)]; return (t && t[0]) || mix(c, T.branco, 0.22); }
  function darkOf(c){ var t = TONES[norm(c)]; return (t && t[1]) || mix(c, T.contorno, 0.34); }

  function makePal(o){
    var skin = norm(o.skin||T.pele1), sk = SKINS[skin];
    var hair = norm(o.hair||T.cabeloCastanho), shirt = norm(o.shirt||T.camisaAzul), pants = norm(o.pants||T.calca);
    var jacket = o.jacket ? norm(o.jacket) : null, shoes = norm(o.shoes||T.sapato);
    return {
      o:T.contorno, e:T.olho,
      s:skin, S:sk ? sk[0] : mix(skin, "#8a4a4a", 0.25), b:sk ? sk[1] : mix(skin, "#c8505a", 0.25), K:mix(skin, T.branco, 0.35),
      h:hair, H:lightOf(hair), d:darkOf(hair),
      c:shirt, C:darkOf(shirt), L:lightOf(shirt),
      j:jacket||shirt, J:jacket ? darkOf(jacket) : darkOf(shirt), k:jacket ? lightOf(jacket) : lightOf(shirt),
      p:pants, P:mix(pants, T.contorno, 0.45),
      f:shoes, F:darkOf(shoes)
    };
  }

  // ---------- cabeça: crânio e rosto ----------
  // linhas 0..15; crânio de 13 px (colunas 2..14), centro na coluna 8; olhos 1×2 nas colunas 5 e 11.
  // s pele, K brilho da pele, e olho, b bochecha, o contorno
  var FACE = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooKKsssssoo..",
      "..oKsssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossesssssesso.",
      "..ossesssssesso.",
      "...obbsssssbbo..",
      "....ooooooooo..."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooKKsssssoo..",
      "..oKsssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "...ossssssssso..",
      "....ooooooooo..."
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooKKsssssoo..",
      "..oKsssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssssso.",
      "..ossssssssseso.",
      "..ossssssssseso.",
      "...osssssssbbo..",
      "....ooooooooo..."
    ]
  };

  // ---------- penteados (camada por cima do rosto) ----------
  // h cabelo, H brilho, d sombra, o contorno, "." deixa ver o rosto/corpo.
  // Cada penteado tem down (frente), up (costas) e side (olhando para a direita; a esquerda é o espelho).
  var HAIR = {};
  HAIR["short"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHhhhhhhdo.",
      "..oHHhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..ohh.hhh...hdo.",
      "..oh...h.....do.",
      "..oh.........do."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHHHHhhhdo.",
      "..oHHHHHHhhhhdo.",
      "..oHHHHhhhhhhdo.",
      "..ohHhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..odhhhhhhhhddo.",
      "..oddhhhhhhdddo.",
      "..odddhhhhddddo.",
      "...odddddddddo.."
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHhhhhhhho.",
      "..oHHhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhd.hdo.",
      "..odhhhhhd....o.",
      "..odhhhhd.....o.",
      "..odhhhd......o.",
      "..oddhhd......o.",
      "...oddd........."
    ]
  };
  HAIR["side-part"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHhhhhdhdo.",
      "..oHHhhhhhhdhdo.",
      "..ohhhhhhhdhhdo.",
      "..ohhhhhhhdhhdo.",
      "..ohhhhhhd..hdo.",
      "..ohhhhhd....do.",
      "..ohhhd......do.",
      "..ohd........do."
    ],
    up: HAIR["short"].up,
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHhhhhhhho.",
      "..oHHhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..odhhhhhd.hhdo.",
      "..odhhhhd...hdo.",
      "..odhhhd......o.",
      "..oddhhd......o.",
      "...oddd........."
    ]
  };
  HAIR["spiky"] = {
    down: [
      "...o.........o..",
      "..oHo.ooooo.oho.",
      "..oHHoHHHhhohdo.",
      "..oHHHhhhhhhhdo.",
      "..oHhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..ohh.hhh.hhhdo.",
      "..oh..h...h..do.",
      "..oh.........do."
    ],
    up: [
      "...o.........o..",
      "..oHo.ooooo.oho.",
      "..oHHoHHHHhohdo.",
      "..oHHHHHHHhhhdo.",
      "..oHHHHHHhhhhdo.",
      "..oHHHHHhhhhhdo.",
      "..ohHHhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..odhhhhhhhhddo.",
      "..oddhdhhdhdddo.",
      "..odddhddhddddo.",
      "...odddddddddo.."
    ],
    side: [
      "...o.......o....",
      "..oHo.....oho...",
      "..oHHooooohhdo..",
      "..oHHHhhhhhhhdo.",
      "..oHhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhd.hdo.",
      "..odhhhhhd.h..o.",
      "..odhhhhd.....o.",
      "..odhhhd......o.",
      "..oddhhd......o.",
      "...oddd........."
    ]
  };
  HAIR["messy"] = {
    down: [
      "................",
      "......ooo.oo....",
      "....ooHHHohhoo..",
      "...oHHHhhhhhhdo.",
      "..oHHhhhhhhhhdo.",
      "..oHhhhhhhhhhdo.",
      ".ohhhhhhhhhhhdo.",
      "..ohhhhhhhhhhhdo",
      "..ohhhhhhhhhhdo.",
      "..ohhh.hhh.hhdo.",
      "..ohh...h..h.do.",
      "..oh.........do."
    ],
    up: [
      "................",
      "......ooo.oo....",
      "....ooHHHohhoo..",
      "...oHHHHHhhhhdo.",
      "..oHHHHHHhhhhdo.",
      "..oHHHHHhhhhhdo.",
      ".ohHHHhhhhhhhdo.",
      "..ohhhhhhhhhhhdo",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..odhhhhhhhhddo.",
      "..oddhhhhhhdddo.",
      "..oddhdhhdhdddo.",
      "...oddoddoddoo.."
    ],
    side: [
      "................",
      "......ooo.oo....",
      "....ooHHHohhoo..",
      "...oHHHhhhhhhho.",
      "..oHHhhhhhhhhho.",
      ".ooHhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      "..ohhhhhhhhhhhoo",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhd.hdo.",
      "..odhhhhhd.h..o.",
      ".oodhhhhd.....o.",
      "..odhhhd......o.",
      "..oddhhd......o.",
      "...oddd........."
    ]
  };
  HAIR["buzz"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHhhhhoo..",
      "..oHHhhhhhhhhdo.",
      "..oHhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..odhhhhhhhhddo.",
      "..od.........do.",
      "..od.........do.",
      "..od.........do."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHHHHhhhhdo.",
      "..oHHHHHhhhhhdo.",
      "..ohHHhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhddo.",
      "..odhhhhhhhhddo.",
      "..odddddddddddo."
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHhhhhoo..",
      "..oHHhhhhhhhhho.",
      "..oHhhhhhhhhhho.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhd.o.",
      "..ohhhhhhhd...o.",
      "..ohhhhhhd....o.",
      "..odhhhhd.....o.",
      "..odhhhd......o.",
      "..oddhd.......o.",
      "..odd.........o."
    ]
  };
  HAIR["bald"] = {
    down: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "..od.........do.",
      "..ohd.......dho.",
      "..ohd.......dho.",
      "..oh.........ho.",
      "..od.........do."
    ],
    up: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "..oHHhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhhdo.",
      "..odhhhhhhhhddo.",
      "..odhhhhhhhdddo.",
      "..odddddddddddo."
    ],
    side: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "..oHh.........o.",
      "..ohhd........o.",
      "..ohhhd.......o.",
      "..ohhhd.......o.",
      "..odhhd.......o.",
      "..oddd........o.",
      "..odd.........o."
    ]
  };
  HAIR["long"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHhhhhhhdo.",
      "..oHHhhhhhhhhdo.",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhh.......hhdo",
      ".ohh.........hdo",
      ".ohh.........hdo",
      ".ohh.........hdo",
      ".ohh.........hdo",
      ".ohhh.......hhdo",
      ".ohhho.....ohhdo",
      "..ohho.....ohdo.",
      "...oo.......oo.."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHHHHhhhdo.",
      "..oHHHHHHhhhhdo.",
      ".ohHHHHHhhhhhhdo",
      ".ohhHHHhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhdhhhhhhhdo",
      ".ohhhhdhhhhdhhdo",
      ".ohhhhhdhhhdhhdo",
      ".ohhhhhdhhhdhddo",
      ".odhhhhhhhhhhddo",
      ".oddhhhhhhhhdddo",
      "..odddddddddddo.",
      "...ooooooooooo.."
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHhhhhhhhho.",
      "..oHhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      ".ohhhhhhhhhhhdo.",
      ".ohhhhhhhd.hhdo.",
      ".ohhhhhhd....do.",
      ".ohhhhhd......o.",
      ".ohhhhhd......o.",
      ".ohhhhhd........",
      ".ohhhhho........",
      ".odhhho.........",
      "..oooo.........."
    ]
  };
  HAIR["bob"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHhhhhhhhdo.",
      ".oHHhhhhhhhhhhdo",
      ".oHhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhh.......hhdo",
      ".ohh.........hdo",
      ".ohh.........hdo",
      ".ohh.........hdo",
      ".ohhh.......hhdo",
      "..ohhh.....hhdo.",
      "...ooo.....ooo.."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHHHHhhhdo.",
      ".oHHHHHHHhhhhhdo",
      ".ohHHHHHhhhhhhdo",
      ".ohhHHHhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".ohhhhhhhhhhhddo",
      ".odhhhhhhhhhhddo",
      ".oddhhhhhhhhdddo",
      "..odddddddddddo.",
      "...ooooooooooo.."
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHhhhhhhhho.",
      ".oHHhhhhhhhhhho.",
      ".oHhhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      ".ohhhhhhhhhhhho.",
      ".ohhhhhhhhhhhdo.",
      ".ohhhhhhhhd..do.",
      ".ohhhhhhd.....o.",
      ".ohhhhhhd.....o.",
      ".ohhhhhhd.....o.",
      ".odhhhhhho......",
      "..oddhhho.......",
      "...ooooo........"
    ]
  };
  HAIR["bun"] = {
    down: [
      "......ooooo.....",
      ".....oHHhhdo....",
      ".....oHhhhdo....",
      "...oodddddddoo..",
      "..oHHhhhhhhhhdo.",
      "..oHhhhhhhhhhdo.",
      "..ohhhhhdhhhhdo.",
      "..ohhhhd.dhhhdo.",
      "..ohhhd...dhhdo.",
      "..ohhd.....dhdo.",
      "..ohd.......ddo.",
      "..od.........do.",
      "..od.........do."
    ],
    up: [
      "......ooooo.....",
      ".....oHHhhdo....",
      ".....oHhhhdo....",
      "...oodddddddoo..",
      "..oHHHHHHhhhhdo.",
      "..oHHHHHhhhhhdo.",
      "..ohHHhhhhhhhdo.",
      "..ohhhdhhhdhhdo.",
      "..ohhhdhhhdhhdo.",
      "..ohhdhhhhhdhdo.",
      "..ohhdhhhhhdhdo.",
      "..ohhhhhhhhhddo.",
      "..odhhhhhhhhddo.",
      "..odddddddddddo."
    ],
    side: [
      "...ooooo........",
      "..oHHhhdo.......",
      "..oHhhhdooooo...",
      "...oddddhhhhoo..",
      "..oHhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhho.",
      "..ohhhhhhhhhhdo.",
      "..ohhhhhhhhhd.o.",
      "..ohhhhhhhhd..o.",
      "..ohhhhhhhd...o.",
      "..ohhhhhhd....o.",
      "..odhhhhd.....o.",
      "..oddhhhd.....o.",
      "...oddd........."
    ]
  };
  HAIR["ponytail"] = {
    down: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHhhhhhhhdo.",
      ".ooHhhhhhhhhhdo.",
      "ohohhhhhhhhhhdo.",
      "ohohhhhhhhhhhdo.",
      "ohohhhhhhhhhhdo.",
      "ohohhhhhhhhhddo.",
      "ohohhhhh.....do.",
      "ohohh........do.",
      "odod.........do.",
      ".oo............."
    ],
    up: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHHhhoo..",
      "..oHHHHHHHhhhdo.",
      "..oHHHHHHhhhhdo.",
      "..ohHHHhhhhhhdo.",
      "..ohhhhooohhhdo.",
      "..ohhhohHhohhdo.",
      "..ohhhohHhohhdo.",
      "..ohhhohHhohddo.",
      "..odhhohhhohddo.",
      "..odhhohhhoddoo.",
      "..oddhohhhodddo.",
      "...oddohhdoddo..",
      "......ohhdo.....",
      "......ohhdo.....",
      ".......ohdo.....",
      "........oo......"
    ],
    side: [
      "................",
      "................",
      ".....ooooooo....",
      "...ooHHHHhhhoo..",
      "..oHHHhhhhhhhho.",
      ".ooHhhhhhhhhhho.",
      ".ohohhhhhhhhhho.",
      ".ohohhhhhhhhhho.",
      ".ohohhhhhhhhhdo.",
      ".ohohhhhhhd.hdo.",
      ".ohodhhhhd....o.",
      ".ohodhhhd.....o.",
      ".ohodhhd......o.",
      ".ohoddhd......o.",
      ".odhoddo........",
      ".ohdo...........",
      "..oo............"
    ]
  };
  HAIR["curly"] = {
    down: [
      "................",
      "....ooo...ooo...",
      "...oHHho.oHHho..",
      "..oHhhhdoHhhhdo.",
      ".oHhdHhhhhdHhhdo",
      ".ohdHhhdHhhhdhdo",
      ".ohHhhdHhhdHhhdo",
      "..ohhdHhhdHhhdo.",
      ".oHhdhhdHhhhdhdo",
      ".ohhhHhhhhdHhhdo",
      ".ohhd.hhhh.dhhdo",
      ".ohd.......dhhdo",
      ".ohh.........hdo",
      "..oh.........ho.",
      ".oHd.........Hdo",
      ".ohhh.......hhdo",
      "..ohdo.....ohdo.",
      ".oHhdo.....oHhdo",
      "..ooo.......ooo."
    ],
    up: [
      "................",
      "....ooo...ooo...",
      "...oHHho.oHHho..",
      "..oHhhhdoHhhhdo.",
      ".oHhdHhhhhdHhhdo",
      ".ohdHhhdHhhhdhdo",
      ".ohHhhdHhhdHhhdo",
      "..ohhdHhhdHhhdo.",
      ".oHhdhhdHhhhdhdo",
      ".ohhhHhhdhhHhhdo",
      "..ohdhhdHhhdhdo.",
      ".oHhhdHhhhdHhhdo",
      ".ohhdhhhdHhhdhdo",
      "..ohhdHhhdhhddo.",
      ".ohdhhhdhhhdhddo",
      ".oddhdhhdhdhdddo",
      "..odddodddoddo..",
      "...ooo.ooo.ooo.."
    ],
    side: [
      "................",
      "....ooo..ooo....",
      "...oHHhooHHho...",
      "..oHhhhdHhhhdo..",
      ".oHhdHhhhhdHhoo.",
      ".ohdHhhdHhhhdhho",
      ".ohHhhdHhhdHhhdo",
      "..ohhdHhhdHhhdo.",
      ".oHhdhhdHhhhdhdo",
      ".ohhhHhhhhdHhhdo",
      ".ohhdhhhhd.hhhdo",
      ".oHhhdhhd....do.",
      "..ohdhhd......o.",
      ".oHhhdhd......o.",
      ".ohdhhd.........",
      "..ohhdo.........",
      ".oHhdo..........",
      "..ooo..........."
    ]
  };
  HAIR["afro"] = {
    down: [
      ".....ooooooo....",
      "...ooHHHhhhhoo..",
      "..oHHHhhdhhhhdo.",
      ".oHHhdhhhhhdhhdo",
      ".oHhhhhhdhhhhhdo",
      ".ohdhhhhhhhhdhdo",
      ".ohhhhdhhhdhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".odhhhhdhhhhhddo",
      ".ohhhhhhhhhdhhdo",
      ".ohhhd.....dhhdo",
      ".ohhd.......dhdo",
      ".ohd.........hdo",
      "..od.........do."
    ],
    up: [
      ".....ooooooo....",
      "...ooHHHhhhhoo..",
      "..oHHHhhdhhhhdo.",
      ".oHHhdhhhhhdhhdo",
      ".oHhhhhhdhhhhhdo",
      ".ohdhhhhhhhhdhdo",
      ".ohhhhdhhhdhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".odhhhhdhhhhhddo",
      ".ohhhhhhhhhdhhdo",
      ".ohhdhhhhhhhhddo",
      ".odhhhhhdhhhdddo",
      ".oddhhhhhhhhdddo",
      "..oddddddddddo..",
      "...oooooooooo..."
    ],
    side: [
      ".....ooooooo....",
      "...ooHHHhhhhoo..",
      "..oHHHhhdhhhhho.",
      ".oHHhdhhhhhdhhho",
      ".oHhhhhhdhhhhhho",
      ".ohdhhhhhhhhdhho",
      ".ohhhhdhhhdhhhdo",
      ".ohhhhhhhhhhhhdo",
      ".odhhhhdhhhhhddo",
      ".ohhhhhhhhd.hhdo",
      ".ohhhhhhhd...hdo",
      ".odhhhhhd.....o.",
      ".oddhhhd......o.",
      "..odddd.......o."
    ]
  };
  var HAIR_IDS = ["short","side-part","spiky","messy","buzz","bald","curly","afro","long","bob","bun","ponytail"];

  // ---------- corpo ----------
  // c camisa, C sombra, L brilho; j/J/k paletó (sem paletó viram a camisa); p calça, P sombra; f sapato, F sombra; s pele
  // pose = { rows (24 linhas), head = deslocamento vertical da cabeça, over = mãos desenhadas por cima do cabelo }
  var E16 = "................";
  function body(lines, head, over){
    var rows = [], ov = null, y;
    for(y=0; y<H; y++) rows.push(lines[y] || E16);
    if(over){ ov = []; for(y=0; y<H; y++) ov.push(over[y] || E16); }
    return { rows:rows, head:head||0, over:ov };
  }
  var BODY = {
    down: {
      idle0: body({
        16:"...okjjcscjjJo..",
        17:"...oJjjcccjjJo..",
        18:"..osJjjcccjjJso.",
        19:"..osJJJCCCJJJso.",
        20:"...ooppppppPoo..",
        21:"....opppoppPo...",
        22:"....offfoffFo...",
        23:".....ooo.ooo...."
      }, 0),
      walk1: body({
        16:"...okjjcscjjJo..",
        17:"...oJjjcccjjJo..",
        18:"...oJjjcccjjJso.",
        19:"...oJJJCCCJJJso.",
        20:"....oppppppPoo..",
        21:"....opppofffo...",
        22:"....offfoooo....",
        23:".....ooo........"
      }, 1),
      walk3: body({
        16:"...okjjcscjjJo..",
        17:"...oJjjcccjjJo..",
        18:"..osJjjcccjjJo..",
        19:"..osJJJCCCJJJo..",
        20:"..oopppppppPo...",
        21:"....offfoppPo...",
        22:"....oooooffFo...",
        23:".........ooo...."
      }, 1),
      sit: body({
        18:"...okjjcscjjJo..",
        19:"...oJjjcccjjJo..",
        20:"..osJjjcccjjJso.",
        21:"..osJJJCCCJJJso.",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2),
      type0: body({
        18:"...okjjcscjjJo..",
        19:"...oJjjcccjjJo..",
        20:"...oJjjcccjjJo..",
        21:"...oJJJCCCJJJo..",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2, {
        18:"..o.............",
        19:".os...........o.",
        20:"..o...........so",
        21:"..............o."
      }),
      type1: body({
        18:"...okjjcscjjJo..",
        19:"...oJjjcccjjJo..",
        20:"...oJjjcccjjJo..",
        21:"...oJJJCCCJJJo..",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2, {
        18:"..............o.",
        19:"..o...........so",
        20:".os...........o.",
        21:"..o............."
      })
    },
    up: {
      idle0: body({
        16:"...okjjjjjjjJo..",
        17:"...oJjjjjjjjJo..",
        18:"..osJjjjjjjjJso.",
        19:"..osJJJJJJJJJso.",
        20:"...ooppppppPoo..",
        21:"....opppoppPo...",
        22:"....offfoffFo...",
        23:".....ooo.ooo...."
      }, 0),
      walk1: body({
        16:"...okjjjjjjjJo..",
        17:"...oJjjjjjjjJo..",
        18:"...oJjjjjjjjJso.",
        19:"...oJJJJJJJJJso.",
        20:"....oppppppPoo..",
        21:"....opppofffo...",
        22:"....offfoooo....",
        23:".....ooo........"
      }, 1),
      walk3: body({
        16:"...okjjjjjjjJo..",
        17:"...oJjjjjjjjJo..",
        18:"..osJjjjjjjjJo..",
        19:"..osJJJJJJJJJo..",
        20:"..oopppppppPo...",
        21:"....offfoppPo...",
        22:"....oooooffFo...",
        23:".........ooo...."
      }, 1),
      sit: body({
        18:"...okjjjjjjjJo..",
        19:"...oJjjjjjjjJo..",
        20:"..osJjjjjjjjJso.",
        21:"..osJJJJJJJJJso.",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2),
      type0: body({
        18:"...okjjjjjjjJo..",
        19:"...oJjjjjjjjJo..",
        20:"...oJjjjjjjjJo..",
        21:"...oJJJJJJJJJo..",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2, {
        15:"..o.............",
        16:".os...........o.",
        17:".oJ...........so",
        18:"..o...........Jo",
        19:"..............o."
      }),
      type1: body({
        18:"...okjjjjjjjJo..",
        19:"...oJjjjjjjjJo..",
        20:"...oJjjjjjjjJo..",
        21:"...oJJJJJJJJJo..",
        22:"...opppppppPPo..",
        23:"....ooooooooo..."
      }, 2, {
        15:"..............o.",
        16:"..o...........so",
        17:".os...........Jo",
        18:".oJ...........o.",
        19:"..o............."
      })
    },
    side: {
      idle0: body({
        16:"....okjjjjcco...",
        17:"....ojjJJjcco...",
        18:"....ojjJJjcco...",
        19:"....oJJssJCCo...",
        20:"....oppppppPo...",
        21:".....opppPPo....",
        22:".....offfffFo...",
        23:"......oooooo...."
      }, 0),
      walk1: body({
        16:"....okjjjjcco...",
        17:"....ojjjJJcco...",
        18:"....ojjjJJcco...",
        19:"....oJJJssCCo...",
        20:"....oppppppPo...",
        21:"...oPPo..oppo...",
        22:"..oFFo....offfo.",
        23:"...oo......ooo.."
      }, 1),
      walk3: body({
        16:"....okjjjjcco...",
        17:"....ojJJjjcco...",
        18:"....ojJJjjcco...",
        19:"....oJssJJCCo...",
        20:"....oppppppPo...",
        21:"...oppo..oPPo...",
        22:"..offo....oFFFo.",
        23:"...oo......ooo.."
      }, 1),
      sit: body({
        18:"....okjjjjcco...",
        19:"....ojjJJjcco...",
        20:"....ojjJJjcco...",
        21:"....oJJssJCCoo..",
        22:"....oppppppppPo.",
        23:".....oooooooooo."
      }, 2),
      type0: body({
        18:"....okjjjjccooo.",
        19:"....ojjjJJJJsso.",
        20:"....ojjJooooooo.",
        21:"....oJJJJJCCo...",
        22:"....oppppppppPo.",
        23:".....oooooooooo."
      }, 2),
      type1: body({
        17:".............oo.",
        18:"....okjjjjccosso",
        19:"....ojjjJJJJJoo.",
        20:"....ojjJooooo...",
        21:"....oJJJJJCCo...",
        22:"....oppppppppPo.",
        23:".....oooooooooo."
      }, 2)
    }
  };

  // ---------- saia longa (opts.skirt): substitui as linhas 20..23 das poses em pé ----------
  // a cor da saia é opts.pants; os sapatos aparecem embaixo da barra
  var SKIRT_DOWN = {
    idle0: { 20:"...ooppppppPoo..", 21:"...oppppppppPo..", 22:"...oofffofffoo..", 23:".....ooo.ooo...." },
    walk1: { 20:"....oppppppPoo..", 21:"...oppppppppPo..", 22:"...oofffooooo...", 23:".....ooo........" },
    walk3: { 20:"..oopppppppPo...", 21:"...oppppppppPo..", 22:"...ooooooffFoo..", 23:".........ooo...." }
  };
  var SKIRT = {
    down: SKIRT_DOWN, up: SKIRT_DOWN,
    side: {
      idle0: { 20:"....oppppppPo...", 21:"...opppppppPPo..", 22:"...ooofffffFoo..", 23:"......oooooo...." },
      walk1: { 20:"....oppppppPo...", 21:"...opppppppPPo..", 22:"..oFFoooooofffo.", 23:"...oo......ooo.." },
      walk3: { 20:"....oppppppPo...", 21:"...opppppppPPo..", 22:"..offoooooooFFo.", 23:"...oo.......oo.." }
    }
  };

  // ---------- selos (badge) 11×9 ----------
  var BADGE = {
    A: { pal:{ k:T.badgeBorda, B:T.badgeAzul, n:T.badgeCirculo, w:T.badgeLetra }, rows:[
      ".kkkkkkkkk.",
      "kBBBnnnBBBk",
      "kBBnnwnnBBk",
      "kBnnwnwnnBk",
      "kBnnwwwnnBk",
      "kBnnwnwnnBk",
      "kBBnnnnnBBk",
      "kBBBnnnBBBk",
      ".kkkkkkkkk."
    ]},
    chefe: { pal:{ k:T.ouroClaro, B:T.ouro, n:T.ouroEscuro, w:T.ouroClaro }, rows:[
      ".kkkkkkkkk.",
      "kBBBnnnBBBk",
      "kBBnnwnnBBk",
      "kBnwwwwwnBk",
      "kBnnwwwnnBk",
      "kBnnwnwnnBk",
      "kBBnnnnnBBk",
      "kBBBnnnBBBk",
      ".kkkkkkkkk."
    ]}
  };

  // ---------- composição ----------
  function newBuf(h){ var b = [], y, x, r; for(y=0; y<h; y++){ r = []; for(x=0; x<W; x++) r.push(null); b.push(r); } return b; }
  function stamp(buf, rows, dy, pal, mirror, x0){
    x0 = x0||0;
    for(var r=0; r<rows.length; r++){
      var y = r + dy; if(y<0 || y>=buf.length) continue;
      var row = rows[r];
      for(var x=0; x<row.length; x++){
        var ch = row.charAt(x); if(ch==="." || ch===" ") continue;
        var col = pal[ch]; if(!col) continue;
        var X = mirror ? (W - (x + x0)) : (x + x0);
        if(X<0 || X>=W) continue;
        buf[y][X] = col;
      }
    }
  }
  function toCanvas(buf){
    var c = document.createElement("canvas"); c.width = W; c.height = buf.length;
    var ctx = c.getContext("2d");
    for(var y=0; y<buf.length; y++) for(var x=0; x<W; x++){ var col = buf[y][x]; if(!col) continue; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    return c;
  }
  function poseKey(pose, step){
    step = (step|0) & 3;
    if(pose==="walk") return step===1 ? "walk1" : step===3 ? "walk3" : "idle0";
    if(pose==="sit") return "sit";
    if(pose==="sit-type") return (step & 1) ? "type1" : "type0";
    return "idle0"; // idle; o passo 1 é a respiração (cabeça desce 1 px)
  }
  var cache = {};
  function frame(opts){
    opts = opts || {};
    var dir = opts.dir || "down"; if(dir!=="down" && dir!=="up" && dir!=="left" && dir!=="right") dir = "down";
    var pose = opts.pose || "idle", step = (opts.step|0) & 3;
    var style = HAIR[opts.hairStyle] ? opts.hairStyle : "short";
    var badge = opts.badge==="A" || opts.badge==="chefe" ? opts.badge : null;
    var key = [dir,pose,step,opts.skin,opts.hair,style,opts.shirt,opts.pants,opts.jacket,opts.shoes,badge,opts.skirt?1:0].join("|");
    if(cache[key]) return cache[key];
    var view = (dir==="left" || dir==="right") ? "side" : dir, mirror = dir==="left";
    var pal = makePal(opts);
    var pk = poseKey(pose, step), bp = BODY[view][pk];
    var headDy = bp.head + (pose==="idle" && step===1 ? 1 : 0);
    var buf = newBuf(badge ? H_BADGE : H);
    var rows = bp.rows, sk = opts.skirt && SKIRT[view][pk];
    if(sk){ rows = rows.slice(); for(var y in sk) rows[+y] = sk[y]; }
    stamp(buf, rows, 0, pal, mirror);
    stamp(buf, FACE[view], headDy, pal, mirror);
    stamp(buf, HAIR[style][view], headDy, pal, mirror);
    if(bp.over) stamp(buf, bp.over, 0, pal, mirror);
    if(badge) stamp(buf, BADGE[badge].rows, BADGE_Y, BADGE[badge].pal, false, BADGE_X);
    var c = toCanvas(buf);
    cache[key] = c;
    return c;
  }
  var badgeCache = {};
  function badgeCanvas(kind){
    kind = kind==="chefe" ? "chefe" : "A";
    if(badgeCache[kind]) return badgeCache[kind];
    var b = BADGE[kind], c = document.createElement("canvas"); c.width = BADGE_W; c.height = BADGE_H;
    var ctx = c.getContext("2d");
    b.rows.forEach(function(r, y){ for(var x=0; x<r.length; x++){ var col = b.pal[r.charAt(x)]; if(col){ ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } });
    return (badgeCache[kind] = c);
  }

  // desenha o selo centrado em x, com o topo em y (pessoa em pé na posição (x, y): topo = y, sobre os pés)
  function drawBadge(ctx, kind, x, y){ var b = badgeCanvas(kind); ctx.drawImage(b, Math.round(x) - 5, Math.round(y)); }

  // Onde sentar nas cadeiras de sprites-office.js: âncora da pessoa = âncora da cadeira + (dx, dy).
  // "before": desenhe a cadeira ANTES da pessoa (true) ou DEPOIS (false: o encosto cobre o corpo).
  // badgeDy: topo do selo em relação à âncora da cadeira (para agentes sentados, desenhe o selo à parte).
  var SEAT = {
    up:    { chair:"of_chair_up",    dx:0,  dy:-16, before:false, badgeDy:-2 },
    down:  { chair:"of_chair_down",  dx:0,  dy:-7,  before:true,  badgeDy:-1 },
    left:  { chair:"of_chair_left",  dx:-3, dy:-7,  before:true,  badgeDy:-1 },
    right: { chair:"of_chair_right", dx:3,  dy:-7,  before:true,  badgeDy:-1 }
  };
  // atalho para uma cadeira avulsa (sem mesa no meio): desenha cadeira + pessoa na ordem certa e o selo (se houver)
  function drawSeated(ctx, opts, chairX, chairY, chairName){
    var dir = opts.dir==="up" || opts.dir==="left" || opts.dir==="right" ? opts.dir : "down", st = SEAT[dir];
    var o = {}, k; for(k in opts) o[k] = opts[k]; o.dir = dir; o.badge = null;
    if(o.pose!=="sit" && o.pose!=="sit-type") o.pose = "sit";
    var f = frame(o), name = chairName || st.chair, P = window.LisieuxPixel;
    var hasChair = P && window.LISIEUX_SPRITES && window.LISIEUX_SPRITES[name];
    if(hasChair && st.before) P.draw(ctx, name, chairX, chairY);
    ctx.drawImage(f, Math.round(chairX + st.dx - OX), Math.round(chairY + st.dy - OY));
    if(hasChair && !st.before) P.draw(ctx, name, chairX, chairY);
    if(opts.badge==="A" || opts.badge==="chefe") drawBadge(ctx, opts.badge, chairX + st.dx, chairY + st.badgeDy);
  }

  // ---------- validação dos moldes ----------
  function validate(){
    var errs = [], known = "oewsSbKhHdcCLjJkpPfF";
    function chk(name, rows, w, hMax){
      if(!rows){ errs.push(name+": vazio"); return; }
      if(hMax && rows.length>hMax) errs.push(name+": "+rows.length+" linhas (máx. "+hMax+")");
      rows.forEach(function(r, i){
        if(r.length!==w) errs.push(name+" linha "+i+": largura "+r.length+" (esperado "+w+")");
        for(var x=0; x<r.length; x++){ var ch = r.charAt(x); if(ch!=="." && known.indexOf(ch)<0) errs.push(name+" linha "+i+": cor desconhecida '"+ch+"'"); }
      });
    }
    ["down","up","side"].forEach(function(v){
      chk("FACE."+v, FACE[v], W, 16);
      HAIR_IDS.forEach(function(id){ chk("HAIR."+id+"."+v, HAIR[id][v], W, 20); });
      Object.keys(BODY[v]).forEach(function(k){ chk("BODY."+v+"."+k, BODY[v][k].rows, W, H); if(BODY[v][k].over) chk("BODY."+v+"."+k+".over", BODY[v][k].over, W, H); });
    });
    HAIR_IDS.forEach(function(id){ ["down","up","side"].forEach(function(v){ var r = HAIR[id][v]; if(r) r.forEach(function(row, i){ if(v==="side" && row.charAt(0)!==".") errs.push("HAIR."+id+".side linha "+i+": coluna 0 precisa ficar vazia (espelho)"); }); }); });
    Object.keys(BODY.side).forEach(function(k){ BODY.side[k].rows.forEach(function(row, i){ if(row.charAt(0)!==".") errs.push("BODY.side."+k+" linha "+i+": coluna 0 precisa ficar vazia (espelho)"); }); });
    ["down","side"].forEach(function(v){ Object.keys(SKIRT[v]).forEach(function(k){ var o = SKIRT[v][k]; chk("SKIRT."+v+"."+k, Object.keys(o).map(function(y){ return o[y]; }), W, 4); }); });
    Object.keys(BADGE).forEach(function(k){ var b = BADGE[k]; b.rows.forEach(function(r, i){ if(r.length!==BADGE_W) errs.push("BADGE."+k+" linha "+i+": largura "+r.length); }); if(b.rows.length!==BADGE_H) errs.push("BADGE."+k+": "+b.rows.length+" linhas"); });
    return errs;
  }

  // ---------- folha de prévia ----------
  var LOOKS = [
    { nome:"agente", skin:T.pele1, hair:T.cabeloAzulado, hairStyle:"spiky", shirt:T.camisaVerde, jacket:T.paleto, pants:T.calca, badge:"A" },
    { nome:"Bruno", skin:T.pele2, hair:T.cabeloCastanho, hairStyle:"side-part", shirt:T.camisaBranca, jacket:T.camisaMarinho, pants:T.calca, badge:"chefe" },
    { nome:"esposa", skin:T.pele1, hair:T.cabeloRuivo, hairStyle:"long", shirt:T.camisaBranca, pants:T.camisaMagenta, skirt:true, badge:"chefe" },
    { nome:"funcionária", skin:T.pele3, hair:T.cabeloPreto, hairStyle:"bun", shirt:T.camisaVermelha, pants:"#4b5a7a", badge:null }
  ];
  function preview(){
    var S = 2, cellW = 20, cellH = 34, labelW = 44;
    var cols = [["idle",0],["idle",1],["walk",0],["walk",1],["walk",2],["walk",3],["sit",0],["sit-type",0],["sit-type",1]];
    var heads = ["idle 0","idle 1","walk 0","walk 1","walk 2","walk 3","sit","type 0","type 1"];
    var dirs = ["down","up","left","right"];
    var perRow = 2, styleRows = Math.ceil(HAIR_IDS.length/perRow);
    var w = (labelW + cols.length*cellW) * S;
    var h = (12 + LOOKS.length*dirs.length*cellH + 14 + styleRows*(cellH+2) + 4) * S;
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#a6a6a6"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#303142"; ctx.font = (5*S)+"px monospace";
    heads.forEach(function(t, i){ ctx.fillText(t, (labelW + i*cellW)*S, 8*S); });
    var y = 12;
    LOOKS.forEach(function(look){
      dirs.forEach(function(d){
        ctx.fillStyle = "#303142"; ctx.fillText(look.nome, 2*S, (y+12)*S); ctx.fillText(d, 2*S, (y+20)*S);
        cols.forEach(function(cl, i){
          var o = {}, k; for(k in look) o[k] = look[k]; o.dir = d; o.pose = cl[0]; o.step = cl[1];
          var f = frame(o);
          ctx.drawImage(f, (labelW + i*cellW + 2)*S, (y+1)*S, f.width*S, f.height*S);
        });
        y += cellH;
      });
    });
    ctx.fillStyle = "#303142"; ctx.fillText("penteados: frente, costas, esq., dir.", 2*S, (y+9)*S); y += 14;
    HAIR_IDS.forEach(function(id, n){
      var gx = 2 + (n % perRow) * (4*18 + 40), gy = y + Math.floor(n/perRow)*(cellH+2);
      ctx.fillStyle = "#303142"; ctx.fillText(id, (gx)*S, (gy+14)*S);
      dirs.forEach(function(d, i){
        var f = frame({ dir:d, pose:"idle", skin:[T.pele1,T.pele2,T.pele3][n%3], hair:[T.cabeloCastanho,T.cabeloPreto,T.cabeloRuivo,T.cabeloGrisalho,T.cabeloAzulado,T.cabeloEscuro][n%6], hairStyle:id, shirt:[T.camisaAzul,T.camisaVermelha,T.camisaVerde,T.camisaMagenta][n%4], pants:T.calca });
        ctx.drawImage(f, (gx + 36 + i*18)*S, gy*S, f.width*S, f.height*S);
      });
    });
    return c;
  }

  // registra (ou troca) um penteado: views = { down:[linhas], up:[linhas], side:[linhas] } com 16 colunas
  function defineHairStyle(id, views){
    if(!id || !views || !views.down || !views.up || !views.side) return false;
    HAIR[id] = { down:views.down, up:views.up, side:views.side };
    if(HAIR_IDS.indexOf(id)<0){ HAIR_IDS.push(id); api.hairStyles.push(id); }
    cache = {};
    return true;
  }

  var api = window.LISIEUX_CHARS = {
    W:W, H:H, OX:OX, OY:OY, H_BADGE:H_BADGE,
    hairStyles: HAIR_IDS.slice(),
    palette: T,
    frame: frame,
    badge: badgeCanvas,
    drawBadge: drawBadge,
    SEAT: SEAT,
    drawSeated: drawSeated,
    preview: preview,
    validate: validate,
    defineHairStyle: defineHairStyle,
    clearCache: function(){ cache = {}; badgeCache = {}; }
  };
})();
