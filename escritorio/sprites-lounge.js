// Escritório Lisieux: decoração de parede ("dc_") e copa/lounge ("lg_").
// Arte própria, desenhada pixel a pixel no estilo da referência (ver style-guide.md, seções 1, 2, 4 e 7):
// vista 3/4 de cima, contorno #303142 de 1 px, luz de cima/esquerda, sombra projetada só embaixo. Nada foi decalcado.
//
// Formato: ver pixel.js ({ w, h, ox, oy, pal, rows }). Tokens de cor = os mesmos hex de sprites-office.js.
// Âncoras (ox, oy):
//  - objetos de piso (plantas, estante, bebedouro, balcão, vending, sofás, mesa, banquetas, tapete):
//    centro da base da pegada no piso (oy = última linha) — ordenar por y;
//  - itens de parede (quadros, lousas, TV, placa): centro da base do item; o motor põe a base na linha da parede
//    (y recomendado, em coordenadas da parede norte com y=0 no topo do cap: ver window.LISIEUX_LOUNGE.wallY);
//  - fatias da placa (dc_sign_l / _m / _r): canto inferior ESQUERDO (ox=0, oy=h-1), para emendar lado a lado;
//  - tapetes: desenhar logo depois do piso (camada de chão), antes de qualquer móvel.
(function(){
  "use strict";
  var SP = window.LISIEUX_SPRITES = window.LISIEUX_SPRITES || {};

  // ---------- tokens de cor (mesmos hex do guia / sprites-office.js) ----------
  var T = {
    contorno:"#303142", contornoSuave:"#44465a", branco:"#fcfcfc", sombraPiso:"#909090", sombraMadeira:"#a8906f",
    mesa:"#c8b490", mesaRealce:"#d8c8a6", mesaBorda:"#916a5e", perna:"#9ea3b0", pernaSombra:"#757a8a",
    tela:"#3874d7", telaEscura:"#1847af", telaClara:"#439ae0", telaVermelho:"#d72f2b",
    papel:"#edf0f1", ledVerde:"#57a252",
    sofa:"#545770", sofaClaro:"#7e7d9e", sofaTrama:"#5b5e76",
    folha:"#4a7e56", folhaClara:"#57a252", folhaEscura:"#436355", vaso:"#c5c1cc", vasoSombra:"#8587a9",
    galao:"#bec9d9", galaoBrilho:"#e4eef0", galaoSombra:"#8b92b5", bebedouro:"#555870",
    vending:"#494e65", vendingTopo:"#686e80", vendingPainel:"#919aac", vendingVidro:"#c4c6d8", vendingVidro2:"#a6b3c5",
    lata:"#c56e6e", lataClara:"#d6a2a7", balcao:"#c8a165", balcaoEscuro:"#a16342",
    cafeteira:"#575a71", cafeteiraClara:"#9f9dbf", copo:"#ebe9f1",
    moldura:"#b2abc9", molduraMadeira:"#af9176", molduraMadeiraEscura:"#865a55", cortica:"#be814e",
    artVermelho:"#d72f2b", artAzul:"#408edd", artLaranja:"#e9901e", artVerde:"#4a7e56",
    lousa:"#f1f3f6", lousaMoldura:"#dad6e4", lousaSombra:"#bcb6d2", grafVermelho:"#f2695a", grafAzul:"#7388f0", grafBarra:"#a1acda", apagador:"#4d5065",
    estante:"#d3cddc", estanteSombra:"#9799a5", livroMarrom:"#ae724a", livroOcre:"#d4aa62", livroAzul:"#3973d6", livroAmarelo:"#efb829", livroEscuro:"#5b422c",
    cadeiraLaranja:"#bf7044", cadeiraLaranjaEscura:"#a24731", cadeiraLaranjaClara:"#d98a56",
    tijolo:"#a6a0c2", tijoloClaro:"#cec8d7", tijoloSombra:"#8b92b7"
  };
  function pal(map){ var o = {}; for(var ch in map) if(map.hasOwnProperty(ch)) o[ch] = T[map[ch]]; return o; }

  // paleta única deste arquivo: { caractere: token }
  var LP = pal({
    k:"contorno", K:"contornoSuave", w:"branco", "7":"sombraPiso", "6":"sombraMadeira",
    L:"lousa", l:"lousaMoldura", m:"lousaSombra", J:"moldura", d:"molduraMadeira", D:"molduraMadeiraEscura", c:"cortica",
    r:"artVermelho", a:"artAzul", o:"artLaranja", g:"artVerde",
    R:"grafVermelho", A:"grafAzul", b:"grafBarra", e:"apagador",
    E:"estante", S:"estanteSombra", "1":"livroMarrom", "2":"livroOcre", "3":"livroAzul", "4":"livroAmarelo", "5":"livroEscuro",
    f:"folha", F:"folhaClara", h:"folhaEscura", v:"vaso", V:"vasoSombra",
    G:"galao", H:"galaoBrilho", I:"galaoSombra", B:"bebedouro",
    n:"vending", N:"vendingTopo", p:"vendingPainel", x:"vendingVidro", X:"vendingVidro2", t:"lata", T:"lataClara",
    y:"balcao", Y:"balcaoEscuro", q:"cafeteira", Q:"cafeteiraClara", u:"copo",
    s:"sofa", z:"sofaClaro", Z:"sofaTrama",
    "8":"tela", "9":"telaClara", "0":"telaEscura", O:"telaVermelho", W:"papel", U:"ledVerde",
    i:"mesa", M:"mesaRealce", C:"mesaBorda", P:"perna", j:"pernaSombra",
    "#":"cadeiraLaranjaEscura", "@":"cadeiraLaranja", "&":"cadeiraLaranjaClara"
  });

  // ---------- utilitários (só montam/copiam; a arte está nas linhas e nos retângulos abaixo) ----------
  function def(name, rows, ox, oy, p){
    var sp = { w: rows[0].length, h: rows.length, ox: ox, oy: oy, pal: p || LP, rows: rows };
    SP[name] = sp; return sp;
  }
  function grid(w, h){ var a = []; for(var y=0;y<h;y++){ var r = []; for(var x=0;x<w;x++) r.push("."); a.push(r); } return a; }
  function px(g, x, y, c){ if(y>=0 && y<g.length && x>=0 && x<g[0].length) g[y][x] = c; }
  function rect(g, x, y, w, h, c){ for(var j=0;j<h;j++) for(var i=0;i<w;i++) px(g, x+i, y+j, c); }
  function outline(g, x, y, w, h, c){ rect(g,x,y,w,1,c); rect(g,x,y+h-1,w,1,c); rect(g,x,y,1,h,c); rect(g,x+w-1,y,1,h,c); }
  function checker(g, x, y, w, h, c1, c2){ for(var j=0;j<h;j++) for(var i=0;i<w;i++) px(g, x+i, y+j, ((x+i+y+j)%2) ? c2 : c1); }
  function stamp(g, rows, x, y){ for(var j=0;j<rows.length;j++) for(var i=0;i<rows[j].length;i++){ var ch = rows[j].charAt(i); if(ch!=="." && ch!==" ") px(g, x+i, y+j, ch); } }
  function out(g){ return g.map(function(r){ return r.join(""); }); }
  function cols(rows, x0, w){ return rows.map(function(r){ return r.substr(x0, w); }); }
  function flip(rows){ return rows.map(function(r){ return r.split("").reverse().join(""); }); }

  // =====================================================================================
  // 1. DECORAÇÃO DE PAREDE (dc_)
  // =====================================================================================

  // pintura 1 (14×17): moldura lavanda, tela branca com blocos vermelho/azul/laranja e um ponto verde
  def("dc_paint_a", [
    "kkkkkkkkkkkkkk",
    "kJJJJJJJJJJJJk",
    "kJkkkkkkkkkkmk",
    "kJkWWWWWWaWkmk",
    "kJkWrrrWWWWkmk",
    "kJkWrrrrWWWkmk",
    "kJkWWrrWWWWkmk",
    "kJkWWWWWaaakmk",
    "kJkWgWWWaaakmk",
    "kJkWWWWWWWWkmk",
    "kJkooWWWWrWkmk",
    "kJkoooWWWWWkmk",
    "kJkoooWWaWWkmk",
    "kJkWWWWWWWWkmk",
    "kJkkkkkkkkkkmk",
    "kmmmmmmmmmmmmk",
    "kkkkkkkkkkkkkk"
  ], 7, 16);

  // pintura 2 (14×17): moldura de madeira, fundo de cortiça com recados e blocos de cor
  def("dc_paint_b", [
    "kkkkkkkkkkkkkk",
    "kddddddddddddk",
    "kdkkkkkkkkkkDk",
    "kdkcc2ccccckDk",
    "kdkcrrrc2cckDk",
    "kdkcrrrcccckDk",
    "kdkcc2ccaackDk",
    "kdkc2cccaackDk",
    "kdkccccc2cckDk",
    "kdkcWWccccckDk",
    "kdkcWWc2cookDk",
    "kdkc2ccccookDk",
    "kdkccccgcc2kDk",
    "kdkc2cccccckDk",
    "kdkkkkkkkkkkDk",
    "kDDDDDDDDDDDDk",
    "kkkkkkkkkkkkkk"
  ], 7, 16);

  // --- lousa/quadro de apresentação: moldura lavanda + bandeja com apagador e pincéis ---
  function frame(g, x, y, w, h){
    rect(g, x, y, w, h, "k");
    rect(g, x+1, y+1, w-2, h-2, "l");
    rect(g, x+w-2, y+2, 1, h-3, "m"); rect(g, x+1, y+h-2, w-2, 1, "m");
    px(g, x+1, y+1, "w");
    rect(g, x+2, y+2, w-4, h-4, "k");
    rect(g, x+3, y+3, w-6, h-6, "L");
  }
  function tray(g, x, y, w){ rect(g, x, y, w, 3, "k"); rect(g, x+1, y, w-2, 1, "l"); rect(g, x+1, y+1, w-2, 1, "m"); }
  function eraser(g, x, y){ rect(g, x, y, 6, 4, "k"); rect(g, x+1, y+1, 4, 1, "e"); rect(g, x+1, y+2, 4, 1, "P"); }
  // pincéis em pé: y = linha da ponta; corpo branco, tampa colorida, apoiados na bandeja (y+4)
  function markers(g, x, y, caps){
    for(var i=0;i<caps.length;i++){
      var mx = x + 1 + i*2;
      rect(g, mx-1, y+1, 1, 3, "k"); rect(g, mx+1, y+1, 1, 3, "k");
      px(g, mx, y, "k"); px(g, mx, y+1, caps[i]); px(g, mx, y+2, "w"); px(g, mx, y+3, "w");
    }
  }
  function clips(g, xs){ xs.forEach(function(x){ px(g, x, 0, "k"); px(g, x+1, 0, "k"); }); }

  // gráfico de linha vermelho com barras (28×13), "." = fundo da lousa
  var CHART_LINE = [
    "............................",
    ".m......................RR..",
    ".m.....................R....",
    ".m....................R.....",
    ".m..............R....R......",
    ".m.............R.R..R.......",
    ".m......R.....R...RR..bb....",
    ".m.....R.R...R........bb....",
    ".m....R...RRR....bb...bb....",
    ".m..RR.bb........bb...bb....",
    ".m.R...bb...bb...bb...bb....",
    ".mmmmmmmmmmmmmmmmmmmmmmmmmm.",
    "............................"
  ];
  // pizza 8×8 (vermelho, azul, verde-acinzentado)
  var PIE = [
    "..RRAA..",
    ".RRRAAA.",
    "RRRRAAAA",
    "RRRRAAAA",
    "RRRRhhhh",
    "RRRRhhhh",
    ".RRRhhh.",
    "..RRhh.."
  ];
  // gráfico de linhas cruzadas com eixos (14×9)
  var CHART_LINES2 = [
    "S..........AA.",
    "S.........A..A",
    "S..RR....A....",
    "S.R..R..A.....",
    "SR....RA......",
    "SA...AAR......",
    "S.A.A...RR..R.",
    "S..A......RR..",
    "SSSSSSSSSSSSSS"
  ];

  // quadro de apresentação com gráfico de linha vermelho (36×23)
  (function(){
    var g = grid(36, 23);
    clips(g, [6, 28]);
    frame(g, 1, 1, 34, 19);
    stamp(g, CHART_LINE, 4, 4);
    tray(g, 3, 20, 30);
    eraser(g, 6, 17);
    markers(g, 24, 16, ["O", "a", "U"]);
    def("dc_board", out(g), 18, 22);
  })();

  // quadro lavanda com pizza + linhas (32×23), irmão do dc_board
  (function(){
    var g = grid(32, 23);
    clips(g, [5, 25]);
    frame(g, 1, 1, 30, 19);
    stamp(g, PIE, 5, 6);
    stamp(g, CHART_LINES2, 14, 5);
    tray(g, 3, 20, 26);
    eraser(g, 5, 17);
    markers(g, 20, 16, ["O", "a", "e"]);
    def("dc_board_pie", out(g), 16, 22);
  })();

  // TV de parede (32×21): moldura escura, tela clara com pizza + linhas, LED verde
  (function(){
    var g = grid(32, 21);
    rect(g, 0, 0, 32, 21, "k");
    rect(g, 1, 1, 30, 19, "e");
    rect(g, 1, 1, 30, 1, "N"); rect(g, 1, 1, 1, 18, "N");
    rect(g, 2, 2, 28, 15, "k");
    rect(g, 3, 3, 26, 13, "L");
    rect(g, 4, 4, 7, 1, "b"); px(g, 25, 4, "R"); px(g, 27, 4, "A");
    stamp(g, PIE, 4, 7);
    stamp(g, CHART_LINES2, 14, 6);
    px(g, 27, 3, "w"); px(g, 28, 3, "w"); px(g, 28, 4, "w");
    rect(g, 14, 18, 4, 1, "K"); px(g, 27, 18, "U");
    def("dc_tv", out(g), 16, 20);
  })();

  // placa larga (texto escrito pelo motor). Interior liso `lousa`: x de 4 até W-5, y de 4 até 16 (13 linhas).
  function signRows(W){
    var g = grid(W, 23);
    clips(g, [6, W-8]);
    frame(g, 1, 1, W-2, 19);
    tray(g, 3, 20, W-6);
    eraser(g, 6, 17);
    markers(g, W-11, 16, ["O", "a", "e"]);
    return out(g);
  }
  (function(){
    var full = signRows(36);                       // 14 (esq.) + 8 (meio) + 14 (dir.)
    def("dc_sign_l", cols(full, 0, 14), 0, 22);
    def("dc_sign_m", cols(full, 14, 8), 0, 22);    // repete na horizontal
    def("dc_sign_r", cols(full, 22, 14), 0, 22);
    def("dc_sign", signRows(88), 44, 22);          // pronta: 88×23, interior 80×13 (cabe "GRUPO LISIEUX" em 5×7)
  })();

  // plantinha pequena (9×8) para cima de estantes e mesas
  var PLANT_XS = [
    "...k.k...",
    "..kFkFk..",
    ".kFfFfFk.",
    "kfFhfFhfk",
    ".khfhfhk.",
    "..kkkkk..",
    "..kvvVk..",
    "...kkk..."
  ];
  def("dc_plant_xs", PLANT_XS, 4, 7);

  // estante (31×34): 2 vãos (15 e 7 px), 3 prateleiras, postes de 3 px; aquário, livros, caixa ocre e plantinha no topo
  (function(){
    var g = grid(31, 34);
    rect(g, 3, 10, 15, 8, "S"); rect(g, 21, 10, 7, 8, "S");
    rect(g, 3, 21, 15, 8, "S"); rect(g, 21, 21, 7, 8, "S");
    [7, 18, 29].forEach(function(by){ rect(g, 0, by, 31, 3, "k"); rect(g, 1, by+1, 29, 1, "E"); });
    [0, 18, 28].forEach(function(x0, i){ rect(g, x0, 7, 3, 27, "k"); rect(g, x0+1, 8, 1, 25, i===2 ? "S" : "E"); });
    [7, 18, 29].forEach(function(by){ rect(g, 1, by+1, 29, 1, "E"); px(g, 29, by+1, "S"); });
    px(g, 1, 8, "w");
    // aquário / quadro azul-acinzentado
    stamp(g, [
      "kkkkkkkkkk",
      "kHXXXXXXXk",
      "kXXXaXXXXk",
      "kXXXXXXoXk",
      "kXFXXXXXXk",
      "kFhFXXXXFk",
      "kkkkkkkkkk"
    ], 5, 11);
    stamp(g, [
      "kkkk...",
      "k33kkkk",
      "k33k44k",
      "k33k44k",
      "k33k44k",
      "k33k44k"
    ], 21, 12);
    stamp(g, [
      "kkkk......",
      "k11kkkk...",
      "k11k55kkkk",
      "k11k55k22k",
      "k11k55k22k",
      "k11k55k22k",
      "k11k55k22k",
      "k11k55k22k"
    ], 3, 21);
    stamp(g, [
      "kkkkk",
      "kMMMk",
      "k222k",
      "k2Y2k",
      "k222k"
    ], 13, 24);
    stamp(g, [
      "kkkk...",
      "k44kkkk",
      "k44k33k",
      "k44k33k",
      "k44k33k",
      "k44k33k",
      "k44k33k"
    ], 21, 22);
    stamp(g, PLANT_XS, 6, 0);
    def("dc_shelf", out(g), 15, 33);
  })();

  // vaso lavanda (10×7), compartilhado pelas plantas de piso
  var POT = [
    ".kkkkkkkk.",
    "kwvvvvvvVk",
    "kVVVVVVVVk",
    ".kvvvvvVk.",
    ".kvvvvvVk.",
    ".kVvvvVVk.",
    "..kkkkkk.."
  ];
  function plant(leaves, w, potX){
    var g = grid(w, leaves.length + POT.length - 1);
    stamp(g, leaves, 0, 0);
    stamp(g, POT, potX, leaves.length - 1);
    return out(g);
  }

  // planta pequena de vaso (12×17): folhas espetadas que se abrem
  def("dc_plant_s", plant([
    "....k..k....",
    "...kFkkFk...",
    ".k.kFfkFfk..",
    "kFkkfFkfFk.k",
    "kfFkkfFfkkFk",
    ".kfFkfFhkFfk",
    "..khfFfFhfk.",
    ".kFfhfhFfhFk",
    "kFfhkhfhkhfk",
    ".kkhfhfhfhk.",
    "............"
  ], 12, 1), 6, 16);

  // planta alta de folhas em espada (14×26)
  def("dc_plant_tall", plant([
    "......k.......",
    ".....kFk......",
    ".....kFk......",
    ".....kFk......",
    ".....kFk..k...",
    "..k..kFk.kFk..",
    ".kFk.kFfkkFk..",
    ".kFk.kFfkFfk..",
    ".kFfkkFfkFfk..",
    ".kfFkkfFkFhk..",
    "..kfkFfhkfhk..",
    "k.kfkFfhkfhk.k",
    "kFkfhkfhkfhkFk",
    "kFfkfhfhkhkFfk",
    ".kfFkfhfhkkfhk",
    ".kfhfkfhfhkfk.",
    "..kfhfkhfkfhk.",
    "..khfhfhfhfhk.",
    "...khfhfhfhk..",
    ".............."
  ], 14, 2), 7, 25);

  // planta grande e cheia (16×27): copa redonda, blocos de folhas em 3 verdes (fica ao lado do bebedouro)
  def("dc_plant_bush", plant([
    "......kk.kkk....",
    "...kkkFFkFFFk...",
    "..kFFfFFfFfhkk..",
    ".kkFfhfFFfhFFfk.",
    "kFFfhkfFfhhfFhk.",
    "kfFhfFFhhfFFfhkk",
    ".kfFFffhFFfhhfFk",
    "kFFfhFFfhfFffhhk",
    "kfhhfFfhhFFfhfk.",
    ".kFFfhhfFfhhFFk.",
    "kFffhFFhffhFfhhk",
    "kfhFFfhhfFFfhhk.",
    ".kfhfFfhhfhFfhfk",
    "kFfhhfFfhFFfhhk.",
    "kfhFFhffhfhhffhk",
    ".kfhhfFhhfFhhfk.",
    "..kffhhfhhfhhk..",
    ".khhfkhhfhkfhhk.",
    "..kkkhhkhhkkkk..",
    "....khhhhhhk....",
    "................"
  ], 16, 3), 8, 26);

  // planta de folhas espetadas e largas (16×19): a que fica ao lado da máquina de bebidas
  def("dc_plant_spiky", plant([
    "......k.........",
    ".k...kFk..k.....",
    ".kFk.kFk.kFk..k.",
    "..kFkkfFkkFk.kFk",
    "k..kfFkfFkfkkFfk",
    "kFk.kfFhfFfkfhk.",
    ".kFfkkhfFhkfhk..",
    "..khfFkhfhfFhkk.",
    ".kkFfhfhhFfhfFFk",
    "kFFfhkhfhfhkfhk.",
    ".kkhfhfhfhhfhk..",
    "...kkhfhfhfkk...",
    "................"
  ], 16, 3), 8, 18);

  // =====================================================================================
  // 2. COPA / LOUNGE (lg_)
  // =====================================================================================

  // bebedouro (13×32): galão azulado em cima, gabinete escuro com painel de torneiras e porta
  def("lg_cooler", [
    "....kkkkk....",
    "..kkHHGGGkk..",
    ".kHHHGGGGGIk.",
    ".kHHG9GGGGIk.",
    "kHHGG9GGGGGIk",
    "kHGGG9GGGGGIk",
    "kHGGGGGGGGGIk",
    "kGGGGGGGGGGIk",
    "kGGGGGGGGGIIk",
    ".kXGGGGGGXIk.",
    ".kIXXXXXXIIk.",
    "..kkIIIIIkk..",
    "....kIIIk....",
    "kkkkkkkkkkkkk",
    "kNNNNNNNNNNNk",
    "kNNNNNNNNNNNk",
    "kkkkkkkkkkkkk",
    "kNBBBBBBBBBBk",
    "kNkkkkkkkkkBk",
    "kNkpprpappkBk",
    "kNkpKpppKpkBk",
    "kNkpppppppkBk",
    "kNkKKKKKKKkBk",
    "kNkkkkkkkkkBk",
    "kNBBBBBBBBBBk",
    "kNkkkkkkkkkBk",
    "kNkKKKKKKpkBk",
    "kNkKKKKKKpkBk",
    "kNkKKKKKKKkBk",
    "kNkkkkkkkkkBk",
    "kkkkkkkkkkkkk",
    ".kk.......kk."
  ], 6, 31);

  // balcão de café (26×28): mesinha de madeira com cafeteira (display azul), xícaras, garrafa d'água e mancha de café
  (function(){
    var g = grid(26, 28);
    rect(g, 0, 11, 26, 12, "k");
    rect(g, 1, 12, 24, 7, "y");
    rect(g, 1, 12, 7, 1, "M"); px(g, 1, 13, "M"); px(g, 2, 13, "M");
    rect(g, 1, 20, 24, 1, "Y"); rect(g, 1, 21, 24, 1, "C");
    rect(g, 1, 23, 4, 5, "k"); rect(g, 2, 23, 1, 4, "P"); rect(g, 3, 23, 1, 4, "j");
    rect(g, 21, 23, 4, 5, "k"); rect(g, 22, 23, 1, 4, "P"); rect(g, 23, 23, 1, 4, "j");
    rect(g, 5, 23, 16, 2, "6");
    // mancha de café no tampo
    stamp(g, [".YY", "YYY", ".Y."], 13, 15);
    // cafeteira
    stamp(g, [
      "..kkkkk..",
      ".kQQqqqk.",
      "kQqqqqqqk",
      "kQ99998qk",
      "kQ88880qk",
      "kQqqqqqqk",
      "kQkkkkkqk",
      "kQkKqKkqk",
      "kQkKKKkqk",
      "kQkuuukqk",
      "kQkuuukqk",
      "kQkkkkkqk",
      "kQqqqqqqk",
      "kQqqqOqqk",
      "kqqqqqqqk",
      "kkkkkkkkk"
    ], 2, 0);
    // xícaras
    var cup = ["kkkk", "k55k", "kuuk", "kuuk", "kkkk"];
    stamp(g, cup, 12, 11); stamp(g, cup, 16, 13);
    // garrafa de vidro
    stamp(g, [
      ".kkk.",
      ".kak.",
      ".kHk.",
      "kHXXk",
      "kH9Xk",
      "kX9Xk",
      "kX9Xk",
      "kXXIk",
      "kkkkk"
    ], 19, 7);
    def("lg_coffee", out(g), 13, 27);
  })();

  // máquina de bebidas (22×35): topo claro, vitrine com 3 prateleiras de latas, painel com teclado, LED e fenda; boca embaixo
  (function(){
    var g = grid(22, 35);
    rect(g, 0, 0, 22, 34, "k");
    rect(g, 1, 1, 20, 32, "n");
    rect(g, 1, 1, 20, 5, "N"); rect(g, 1, 1, 20, 1, "p");
    rect(g, 1, 6, 1, 26, "N");
    rect(g, 0, 6, 22, 1, "k");
    // vitrine
    rect(g, 2, 7, 14, 20, "k");
    rect(g, 3, 8, 12, 18, "x");
    [9, 14, 19].forEach(function(sy){
      for(var c=0;c<4;c++){
        var cx = 4 + c*3;
        rect(g, cx, sy, 2, 4, "t"); rect(g, cx, sy, 2, 1, "T"); rect(g, cx, sy+2, 2, 1, "T");
      }
      rect(g, 3, sy+4, 12, 1, "X");
    });
    px(g, 3, 8, "H"); px(g, 4, 8, "H"); px(g, 3, 9, "H");
    rect(g, 3, 24, 12, 2, "X"); px(g, 14, 25, "H");
    // painel da direita
    rect(g, 17, 8, 3, 14, "K");
    rect(g, 17, 9, 3, 1, "9"); px(g, 19, 9, "8");
    checker(g, 17, 11, 3, 5, "p", "K");
    px(g, 18, 17, "O");
    rect(g, 18, 19, 1, 2, "k");
    // boca de saída
    rect(g, 3, 28, 12, 3, "k"); rect(g, 4, 29, 10, 1, "K");
    rect(g, 1, 32, 20, 1, "K");
    rect(g, 1, 34, 2, 1, "k"); rect(g, 19, 34, 2, 1, "k");
    def("lg_vending", out(g), 11, 34);
  })();

  // --- sofás (grafite-azulado, almofadas em xadrez 1 px) ---
  function cushion(g, x, y, w, h){ checker(g, x, y, w, h, "z", "Z"); rect(g, x, y+h-1, w, 1, "s"); }
  function foot(g, x, y){ rect(g, x, y, 3, 2, "k"); px(g, x+1, y, "j"); }

  // sofá em L (44×39): encosto em cima e à direita, braço à esquerda, 2×2 almofadas + chaise descendo à direita
  function sofaL(){
    var g = grid(44, 39);
    rect(g, 0, 0, 44, 22, "k"); rect(g, 27, 0, 17, 37, "k");
    // encosto de cima
    rect(g, 1, 1, 42, 1, "z"); rect(g, 1, 2, 42, 2, "s");
    // encosto da direita
    rect(g, 40, 4, 1, 32, "z"); rect(g, 41, 4, 2, 32, "s");
    // braço esquerdo
    rect(g, 1, 4, 1, 17, "z"); rect(g, 2, 4, 1, 17, "s");
    // almofadas
    cushion(g, 4, 5, 11, 6); cushion(g, 16, 5, 11, 6); cushion(g, 28, 5, 11, 6);
    cushion(g, 4, 12, 11, 6); cushion(g, 16, 12, 11, 6);
    cushion(g, 28, 12, 11, 21);
    // frente (2 px) da parte principal e da chaise
    rect(g, 1, 19, 26, 2, "s"); rect(g, 28, 34, 15, 2, "s");
    // pezinhos e sombra no piso de madeira
    rect(g, 4, 22, 20, 1, "6"); rect(g, 31, 37, 9, 1, "6");
    foot(g, 1, 22); foot(g, 23, 22); foot(g, 28, 37); foot(g, 40, 37);
    return out(g);
  }
  def("lg_sofa_l", sofaL(), 22, 38);
  def("lg_sofa_l_flip", flip(sofaL()), 21, 38);   // chaise à esquerda

  // sofá reto de 3 lugares (40×22), virado para o sul
  (function(){
    var g = grid(40, 22);
    rect(g, 0, 0, 40, 20, "k");
    rect(g, 1, 1, 38, 1, "z"); rect(g, 1, 2, 38, 2, "s");
    rect(g, 1, 4, 1, 12, "z"); rect(g, 2, 4, 1, 12, "s");
    rect(g, 37, 4, 2, 12, "s");
    cushion(g, 4, 5, 10, 5); cushion(g, 15, 5, 10, 5); cushion(g, 26, 5, 10, 5);
    cushion(g, 4, 11, 10, 5); cushion(g, 15, 11, 10, 5); cushion(g, 26, 11, 10, 5);
    rect(g, 1, 17, 38, 2, "s");
    rect(g, 4, 20, 32, 1, "6");
    foot(g, 1, 20); foot(g, 36, 20);
    def("lg_sofa_h", out(g), 20, 21);
  })();

  // sofá vertical de 3 lugares (14×38): encosto à direita, assentos virados para o oeste
  (function(){
    var g = grid(14, 38);
    rect(g, 0, 0, 14, 36, "k");
    rect(g, 1, 1, 12, 1, "z"); rect(g, 1, 2, 12, 1, "s");
    rect(g, 10, 4, 1, 27, "z"); rect(g, 11, 4, 2, 27, "s");
    cushion(g, 1, 4, 8, 8); cushion(g, 1, 13, 8, 8); cushion(g, 1, 22, 8, 8);
    rect(g, 1, 32, 12, 1, "z"); rect(g, 1, 33, 12, 2, "s");
    rect(g, 3, 36, 8, 1, "6");
    foot(g, 0, 36); foot(g, 11, 36);
    def("lg_sofa_v", out(g), 7, 37);
  })();

  // mesinha redonda (16×17) e banqueta (10×11)
  def("lg_table_round", [
    "....kkkkkkkk....",
    "..kkMMMiiiiikk..",
    ".kMMiiiiiiiiiik.",
    "kMiiiiiiiiiiiiik",
    "kiiiiiiiiiiiiiik",
    "kiiiiiiiiiiiiiik",
    "kCiiiiiiiiiiiiCk",
    ".kCCiiiiiiiiCCk.",
    "..kkCCCCCCCCkk..",
    "....kkkkkkkk....",
    "......kPjk......",
    "......kPjk......",
    "......kPjk......",
    "....kkPPjjkk....",
    "...kPPPPjjjjk...",
    "...kkkkkkkkkk...",
    "....66666666...."
  ], 8, 16);
  def("lg_stool", [
    "..kkkkkk..",
    ".kzzzzzZk.",
    "kzzzzZZZZk",
    "ksZZZZZZsk",
    ".kssssssk.",
    "..kkkkkk..",
    "..kPk.kjk.",
    "..kPk.kjk.",
    "..kPk.kjk.",
    "..kkk.kkk.",
    "...6666..."
  ], 5, 10);
  // conjunto: mesinha com uma banqueta de cada lado (38×17)
  (function(){
    var g = grid(38, 17);
    stamp(g, SP.lg_stool.rows, 0, 6);
    stamp(g, SP.lg_stool.rows, 28, 6);
    stamp(g, SP.lg_table_round.rows, 11, 0);
    def("lg_table_set", out(g), 19, 16);
  })();

  // tapete (40×22): terracota com borda dupla, losango central e franjas nas pontas
  function rugRows(){
    var g = grid(40, 22);
    rect(g, 1, 0, 38, 22, "#");
    outline(g, 2, 1, 36, 20, "&");
    for(var i=3;i<37;i+=2){ px(g, i, 1, "@"); px(g, i, 20, "@"); }
    outline(g, 3, 2, 34, 18, "#");
    rect(g, 4, 3, 32, 16, "@");
    for(var y=3;y<19;y++) for(var x=4;x<36;x++){
      var d = Math.abs(x-19.5) + Math.abs(y-10.5);
      if(d <= 2) px(g, x, y, "#"); else if(d <= 3) px(g, x, y, "@"); else if(d <= 5) px(g, x, y, "&");
      var dl = Math.abs(x-9.5) + Math.abs(y-10.5), dr = Math.abs(x-29.5) + Math.abs(y-10.5);
      if(dl <= 1 || dr <= 1) px(g, x, y, "&");
    }
    for(var r=1;r<22;r+=2){ px(g, 0, r, "u"); px(g, 39, r, "u"); }
    return out(g);
  }
  def("lg_rug", rugRows(), 20, 21);
  var LP_LILAS = {}; for(var ch in LP) if(LP.hasOwnProperty(ch)) LP_LILAS[ch] = LP[ch];
  LP_LILAS["#"] = T.tijoloSombra; LP_LILAS["@"] = T.tijolo; LP_LILAS["&"] = T.tijoloClaro;
  def("lg_rug_lilac", rugRows(), 20, 21, LP_LILAS);

  // =====================================================================================
  // 3. METADADOS PARA O MOTOR
  // =====================================================================================
  window.LISIEUX_LOUNGE = {
    // y (na parede norte, 0 = topo do cap; rodapé em y=31) onde fica a ÂNCORA (base) de cada item de parede
    wallY: { dc_paint_a:24, dc_paint_b:24, dc_board:29, dc_board_pie:29, dc_tv:27, dc_sign:29, dc_sign_l:29, dc_sign_m:29, dc_sign_r:29 },
    // área lisa para texto dentro da placa (relativa ao canto superior esquerdo do sprite)
    signText: { x:4, y:4, h:13, color:T.contorno, rightPad:4 },
    // monta uma placa de largura total W (>= 28) e registra como "dc_sign_<W>"; interior de texto = W-8 px
    makeSign: function(W){ W = Math.max(28, W|0); var n = "dc_sign_" + W; if(!SP[n]) def(n, signRows(W), W>>1, 22); return n; }
  };
})();
