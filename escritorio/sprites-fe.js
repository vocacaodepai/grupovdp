// Escritório Lisieux: fé, família e lazer ("dc_" na parede, "lg_" no piso).
// Mesmo estilo de sprites-lounge.js: vista 3/4 de cima, contorno #303142 de 1 px, luz de cima/esquerda,
// sombra projetada só embaixo. Arte própria, desenhada pixel a pixel.
//   dc_flag_br     bandeira do Brasil (parede)
//   dc_aparecida   Nossa Senhora Aparecida num oratório de moldura dourada (parede)
//   dc_crucifix    crucifixo de madeira (parede)
//   dc_sagrado     quadro do Sagrado Coração de Jesus (parede)
//   lg_pool        mesa de sinuca com bolas e taco (piso)
//   lg_crib        berço de madeira (piso)
//   lg_stroller    carrinho de bebê (piso)
//   lg_sofa_v_e    sofá vertical de 3 lugares virado para o leste (espelho de lg_sofa_v)
//   dc_flag_br_big / dc_flag_va   bandeiras grandes do Brasil e do Vaticano (parede da recepção)
//   of_reception   balcão da recepção com 2 monitores e 2 telefones (as recepcionistas sentam atrás)
//   of_conf_table  mesa de reunião comprida (Grupo Lisieux), com notebooks, papéis e xícaras
//   lg_mop / lg_bucket   rodo e balde do pessoal da limpeza
// Âncoras como em sprites-lounge.js: piso = centro da base; parede = centro da base, com o y em LISIEUX_LOUNGE.wallY.
(function(){
  "use strict";
  var SP = window.LISIEUX_SPRITES = window.LISIEUX_SPRITES || {};
  var PAL = {
    k:"#303142", m:"#bcb6d2", "6":"#a8906f", w:"#fcfcfc", W:"#edf0f1",
    // madeira
    d:"#af9176", D:"#865a55", e:"#c8a165", E:"#a16342", q:"#5b422c",
    // dourado
    o:"#efb829", O:"#c8902c", y:"#f6d36b",
    // bandeira
    G:"#2f9a4f", Y:"#f2cc2e", B:"#2a4ea6", b:"#3f6fd0",
    // Aparecida: manto azul, rosto e mãos, fundo do nicho
    n:"#24357e", N:"#3a52a8", F:"#5a3a2c", f:"#7a5040", L:"#dfe6f6",
    // Sagrado Coração e chamas
    r:"#d72f2b", R:"#f2695a", a:"#e9901e", h:"#436355", c:"#f0b29a",
    // sinuca
    g:"#2f6e45", v:"#3e8a57", V:"#55a56c", s:"#d72f2b", u:"#408edd", z:"#efb829",
    // berço e carrinho
    p:"#e8a3b5", l:"#9cc2ee", P:"#9ea3b0", j:"#757a8a", x:"#3c4878", X:"#5d6fa8",
    // Vaticano (prata das chaves), balcão e mesa de reunião
    A:"#b8bcc8", H:"#c8b490", I:"#d8c8a6", J:"#916a5e", K:"#b3bbca", S:"#3874d7", T:"#cfc9db", U:"#a49ec0",
    M:"#5e617a", Q:"#7d7d9d", "7":"#909090", t:"#afb9ce", C:"#f6f2e6"
  };
  function grid(w, h){ var a = []; for(var y=0;y<h;y++){ var r = []; for(var x=0;x<w;x++) r.push("."); a.push(r); } return a; }
  function px(g, x, y, c){ if(y>=0 && y<g.length && x>=0 && x<g[0].length) g[y][x] = c; }
  function rect(g, x, y, w, h, c){ for(var j=0;j<h;j++) for(var i=0;i<w;i++) px(g, x+i, y+j, c); }
  function out(g){ return g.map(function(r){ return r.join(""); }); }
  function def(name, rows, ox, oy){ SP[name] = { w:rows[0].length, h:rows.length, ox:ox, oy:oy, pal:PAL, rows:rows }; }
  function stamp(g, rows, x, y){ for(var j=0;j<rows.length;j++) for(var i=0;i<rows[j].length;i++){ var ch = rows[j].charAt(i); if(ch!=="." && ch!==" ") px(g, x+i, y+j, ch); } }

  // ---------- bandeira do Brasil (24×17): haste dourada em cima, losango amarelo, círculo azul com a faixa branca ----------
  (function(){
    var g = grid(24, 17);
    rect(g, 0, 0, 24, 17, "k");
    rect(g, 1, 1, 22, 1, "o"); px(g, 0, 1, "O"); px(g, 23, 1, "O");
    rect(g, 1, 2, 22, 13, "G");
    for(var y=3; y<=13; y++){
      var half = Math.round(9.5*(1 - Math.abs(y - 8)/5.6));
      for(var x=12-half; x<12+half; x++) px(g, x, y, "Y");
    }
    for(var cy=4; cy<=12; cy++) for(var cx=7; cx<=16; cx++){
      var dx = cx - 11.5, dy = cy - 8; if(dx*dx + dy*dy <= 15) px(g, cx, cy, (cy<8 ? "B" : "B"));
    }
    // faixa branca levemente curva e três estrelinhas
    px(g, 8, 8, "w"); px(g, 9, 7, "w"); px(g, 10, 7, "w"); px(g, 11, 7, "w"); px(g, 12, 7, "w"); px(g, 13, 7, "w"); px(g, 14, 8, "w"); px(g, 15, 8, "w");
    px(g, 10, 10, "w"); px(g, 13, 10, "w"); px(g, 12, 11, "w");
    rect(g, 1, 15, 22, 1, "m");
    def("dc_flag_br", out(g), 12, 16);
  })();

  // ---------- Nossa Senhora Aparecida (17×24): oratório em arco, coroa dourada, rosto escuro, manto azul em triângulo ----------
  def("dc_aparecida", [
    "......kkkkk......",
    "....kkoooookk....",
    "...koooyyyoook...",
    "..koookkkkkoook..",
    ".kook.LLLLL.kook.",
    ".kok.LLyoyLL.kOk.",
    "kook.LLoooLL.kOOk",
    "kok.LLLLFLLLL.kOk",
    "kok.LLLnFnLLL.kOk",
    "kok.LLnNfNnLL.kOk",
    "kok.LLnoNonLL.kOk",
    "kok.LnNNfNNnL.kOk",
    "kok.LnoNNNonL.kOk",
    "kok.nNNNNNNNn.kOk",
    "kok.noNNNNNon.kOk",
    "kok.nNNoNoNNn.kOk",
    "kok.noNNNNNon.kOk",
    "kok.nnooooonn.kOk",
    "kok..yOOOOOy..kOk",
    "kok.LLLLLLLLL.kOk",
    "kokkkkkkkkkkkkkOk",
    "koooooooooooooOOk",
    "kOOOOOOOOOOOOOOOk",
    "kkkkkkkkkkkkkkkkk"
  ], 8, 23);

  // ---------- crucifixo de madeira (13×20): placa INRI, braços sobre a trave, perizônio branco ----------
  def("dc_crucifix", [
    ".....kkk.....",
    "....kWWWk....",
    ".....kdk.....",
    ".kkkkkFkkkkk.",
    "kdcccdcdcccdk",
    "kDDDDcccDDDDk",
    ".kkkkkckkkkk.",
    ".....kck.....",
    ".....kck.....",
    ".....kwk.....",
    ".....kwk.....",
    ".....kck.....",
    ".....kck.....",
    ".....kck.....",
    ".....kdk.....",
    ".....kdk.....",
    ".....kDk.....",
    ".....kDk.....",
    ".....kDk.....",
    ".....kkk....."
  ], 6, 19);

  // ---------- Sagrado Coração de Jesus (14×17): moldura de madeira, coração com chama, cruz e coroa de espinhos ----------
  def("dc_sagrado", [
    "kkkkkkkkkkkkkk",
    "kddddddddddddk",
    "kdkkkkkkkkkkDk",
    "kdkWWWWDWWWkDk",
    "kdkWWWDDDWWkDk",
    "kdkWWWWDWWWkDk",
    "kdkWWWaoaWWkDk",
    "kdkWyWWoWWykDk",
    "kdkWrrWWrrWkDk",
    "kdkrRrrrrrrkDk",
    "kdkhrhrhrhrkDk",
    "kdkWrrrrrrWkDk",
    "kdkWWrrrrWWkDk",
    "kdkWWWrrWWWkDk",
    "kdkkkkkkkkkkDk",
    "kDDDDDDDDDDDDk",
    "kkkkkkkkkkkkkk"
  ], 7, 16);

  // ---------- mesa de sinuca (52×32): tampo verde com caçapas, bolas no triângulo, bola branca e taco ----------
  (function(){
    var g = grid(52, 32);
    rect(g, 0, 0, 52, 27, "k");
    rect(g, 1, 1, 50, 21, "d");               // borda de madeira (tabela)
    rect(g, 1, 1, 50, 1, "e");                // luz de cima
    rect(g, 4, 3, 44, 16, "v");               // pano
    rect(g, 4, 3, 44, 1, "g");                // sombra da tabela no pano
    rect(g, 4, 3, 1, 16, "g");
    [[3, 2], [25, 2], [47, 2], [3, 18], [25, 18], [47, 18]].forEach(function(p){ rect(g, p[0], p[1], 2, 2, "k"); });
    rect(g, 1, 22, 50, 4, "D");               // saia da frente
    rect(g, 1, 22, 50, 1, "E");
    // pés e sombra no piso de madeira
    rect(g, 3, 27, 3, 4, "k"); rect(g, 4, 27, 1, 3, "D");
    rect(g, 46, 27, 3, 4, "k"); rect(g, 47, 27, 1, 3, "D");
    rect(g, 7, 30, 38, 1, "6");
    // marca do centro e bolas arrumadas no triângulo (à direita)
    px(g, 15, 10, "V");
    stamp(g, [
      "s....",
      "zu...",
      "skz..",
      "uzsu.",
      "szuzs"
    ].map(function(r){ return r; }), 34, 7);
    // a ordem acima desenha o triângulo deitado (ápice à esquerda): vira para o eixo da mesa
    // bola branca e taco em diagonal
    px(g, 17, 10, "w"); px(g, 17, 11, "W");
    [[16, 11], [15, 12], [14, 12], [13, 13], [12, 13], [11, 14], [10, 14], [9, 15], [8, 15]].forEach(function(p, i){ px(g, p[0], p[1], i<2 ? "w" : "e"); });
    px(g, 7, 16, "E"); px(g, 6, 16, "q");
    def("lg_pool", out(g), 26, 31);
  })();

  // ---------- berço (30×27): grade de madeira clara, colchão branco, travesseiro rosa e mantinha azul ----------
  (function(){
    var g = grid(30, 27);
    rect(g, 0, 0, 30, 24, "k");
    rect(g, 1, 1, 28, 15, "e");               // moldura de cima
    rect(g, 1, 1, 28, 1, "y");
    rect(g, 3, 3, 24, 11, "W");               // colchão
    rect(g, 3, 3, 24, 1, "w");
    rect(g, 5, 4, 7, 3, "p");                 // travesseiro
    rect(g, 5, 4, 7, 1, "w");
    rect(g, 3, 8, 24, 6, "l");                // mantinha
    rect(g, 3, 8, 24, 1, "w");
    for(var x=14; x<26; x+=3) px(g, x, 11, "w");
    // frente: grade (ripas e vãos)
    for(var gx=1; gx<29; gx++) for(var gy=16; gy<22; gy++) px(g, gx, gy, (gx%3===1) ? "e" : "E");
    rect(g, 1, 16, 28, 1, "y");
    rect(g, 1, 22, 28, 1, "E");
    // pés e sombra
    rect(g, 1, 24, 2, 2, "k"); rect(g, 27, 24, 2, 2, "k");
    rect(g, 4, 25, 22, 1, "6");
    def("lg_crib", out(g), 15, 26);
  })();

  // ---------- carrinho de bebê (20×23): capota azul-marinho, cesto, alça e rodas ----------
  def("lg_stroller", [
    "..............kk....",
    "...kkkkk.....kPk....",
    "..kXXXXXk....kPk....",
    ".kXXXXXXXk..kPk.....",
    "kxXXXXXXXXk.kPk.....",
    "kxxXXXXXXXkkkPk.....",
    "kxxxXXXXXkwwkPk.....",
    "kxxxxxxxxkppppk.....",
    "kkkkkkkkkkkkkkk.....",
    "kxxxxxxxxxxxxxk.....",
    "kwwwwwwwwwwwwwk.....",
    "kxxxxxxxxxxxxxk.....",
    ".kXXXXXXXXXXXk......",
    "..kkkkkkkkkkk.......",
    "...kPk...kPk........",
    "..kkPkk.kkPkk.......",
    ".kkPPPkkkPPPkk......",
    "kkPjjjPkkPjjjPkk....",
    "kPjkkkjPkPjkkkjPk...",
    "kPjkkkjPkPjkkkjPk...",
    "kkPjjjPkkkPjjjPkk...",
    ".kkPPPkk.kkPPPkk....",
    "..66666666666666...."
  ], 8, 22);

  // ---------- bandeiras grandes (44×27) ----------
  function bigFrame(){
    var g = grid(44, 27);
    rect(g, 0, 0, 44, 27, "k");
    rect(g, 1, 1, 42, 1, "o"); px(g, 0, 1, "O"); px(g, 43, 1, "O");
    rect(g, 1, 25, 42, 1, "m");
    return g;
  }
  (function(){                                   // Brasil
    var g = bigFrame();
    rect(g, 1, 2, 42, 23, "G");
    for(var y=3; y<=23; y++){
      var half = Math.round(18.5*(1 - Math.abs(y - 13)/10.6));
      for(var x=22-half; x<22+half; x++) px(g, x, y, "Y");
    }
    for(var cy=6; cy<=20; cy++) for(var cx=13; cx<=30; cx++){ var dx = cx - 21.5, dy = cy - 13; if(dx*dx + dy*dy <= 52) px(g, cx, cy, "B"); }
    for(var bx=15; bx<=28; bx++){ var by = 12 + Math.round(Math.pow((bx - 21.5)/6.5, 2)*1.6); px(g, bx, by, "w"); if(bx%3===0) px(g, bx, by, "G"); }
    [[17, 16], [20, 17], [23, 16], [26, 17], [19, 19], [22, 19], [25, 19], [21, 15]].forEach(function(p){ px(g, p[0], p[1], "w"); });
    def("dc_flag_br_big", out(g), 22, 26);
  })();
  (function(){                                   // Vaticano: metade amarela, metade branca com as chaves e a tiara
    var g = bigFrame();
    rect(g, 1, 2, 21, 23, "Y"); rect(g, 22, 2, 21, 23, "w");
    stamp(g, [                                   // tiara papal
      "...O...",
      "..OoO..",
      ".OoyoO.",
      ".OyyyO.",
      "OooooOO",
      ".OyyyO.",
      "OOOOOOO"
    ], 29, 4);
    for(var i=0; i<11; i++){ px(g, 27 + i, 22 - i, "o"); px(g, 37 - i, 22 - i, "A"); }   // chaves cruzadas (ouro e prata)
    rect(g, 26, 21, 3, 3, "o"); px(g, 27, 22, "w");                                      // argolas
    rect(g, 36, 21, 3, 3, "A"); px(g, 37, 22, "w");
    rect(g, 37, 11, 2, 2, "o"); rect(g, 26, 11, 2, 2, "A");                               // dentes das chaves
    def("dc_flag_va", out(g), 22, 26);
  })();

  // ---------- balcão da recepção (96×34): tampo claro com 2 monitores (de costas) e 2 telefones; frente de madeira ----------
  (function(){
    var g = grid(96, 34);
    rect(g, 0, 8, 96, 24, "k");
    rect(g, 1, 9, 94, 6, "T"); rect(g, 1, 9, 94, 1, "w"); rect(g, 1, 14, 94, 1, "U");      // tampo
    function monitor(x){ rect(g, x, 0, 16, 11, "k"); rect(g, x+1, 1, 14, 8, "M"); rect(g, x+3, 3, 10, 4, "Q"); rect(g, x+6, 11, 4, 2, "k"); px(g, x+7, 11, "M"); px(g, x+8, 11, "M"); }
    monitor(16); monitor(64);
    function phone(x){ rect(g, x, 10, 9, 4, "k"); rect(g, x+1, 11, 7, 2, "t"); px(g, x+7, 11, "r"); rect(g, x+1, 10, 3, 1, "k"); }
    phone(36); phone(51);
    rect(g, 6, 10, 6, 3, "W"); rect(g, 84, 11, 6, 2, "W");                                  // papéis
    rect(g, 1, 15, 94, 15, "e");                                                           // frente de madeira
    rect(g, 1, 15, 94, 1, "y"); rect(g, 1, 29, 94, 1, "E");
    rect(g, 1, 19, 94, 2, "o"); rect(g, 1, 21, 94, 1, "O");                                // friso dourado
    rect(g, 45, 22, 6, 6, "k"); rect(g, 46, 23, 4, 4, "o");                                // brasão: cruz
    px(g, 48, 23, "w"); px(g, 48, 24, "w"); px(g, 47, 24, "w"); px(g, 49, 24, "w"); px(g, 48, 25, "w");
    rect(g, 4, 32, 88, 1, "6");
    def("of_reception", out(g), 48, 32);
  })();

  // ---------- mesa de reunião comprida (76×32) ----------
  (function(){
    var g = grid(76, 32);
    rect(g, 0, 0, 76, 22, "k");
    rect(g, 1, 1, 74, 16, "H"); rect(g, 1, 1, 74, 1, "I");                                  // tampo
    rect(g, 1, 17, 74, 4, "J");                                                            // borda da frente
    function laptop(x, y, up){ rect(g, x, y, 11, 6, "k"); if(up){ rect(g, x+1, y+1, 9, 2, "S"); rect(g, x+1, y+3, 9, 2, "K"); } else { rect(g, x+1, y+1, 9, 2, "K"); rect(g, x+1, y+3, 9, 2, "S"); } }
    laptop(10, 2, true); laptop(32, 2, true); laptop(54, 2, true);
    laptop(10, 10, false); laptop(32, 10, false); laptop(54, 10, false);
    rect(g, 24, 4, 5, 4, "W"); rect(g, 47, 11, 5, 4, "W");                                  // papéis
    rect(g, 3, 7, 3, 3, "k"); px(g, 4, 8, "C"); rect(g, 70, 7, 3, 3, "k"); px(g, 71, 8, "C");  // xícaras nas pontas
    rect(g, 3, 22, 3, 7, "k"); rect(g, 4, 22, 1, 6, "P");                                    // pés
    rect(g, 70, 22, 3, 7, "k"); rect(g, 71, 22, 1, 6, "P");
    rect(g, 7, 29, 62, 1, "7");
    def("of_conf_table", out(g), 38, 30);
  })();

  // ---------- rodo e balde da limpeza ----------
  def("lg_mop", [
    "..k..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    "..d..",
    ".kdk.",
    "kPPPk",
    "kWPWk",
    "kWkWk",
    ".k.k."
  ], 2, 15);
  def("lg_bucket", [
    ".kkkkkkk.",
    "kAlllllAk",
    "kooooooOk",
    "kooooooOk",
    ".kooooOk.",
    ".kkkkkkk.",
    "..66666.."
  ], 4, 6);

  // ---------- sofá vertical virado para o leste (espelho do lg_sofa_v de sprites-lounge.js) ----------
  if(SP.lg_sofa_v){
    var v = SP.lg_sofa_v;
    SP.lg_sofa_v_e = { w:v.w, h:v.h, ox:v.w - 1 - v.ox, oy:v.oy, pal:v.pal, rows:v.rows.map(function(r){ return r.split("").reverse().join(""); }) };
  }

  // altura da base dos itens de parede (0 = topo do cap da parede; rodapé em y=31)
  var LG = window.LISIEUX_LOUNGE;
  if(LG && LG.wallY){ LG.wallY.dc_flag_br = 25; LG.wallY.dc_aparecida = 29; LG.wallY.dc_crucifix = 26; LG.wallY.dc_sagrado = 24;
                      LG.wallY.dc_flag_br_big = 29; LG.wallY.dc_flag_va = 29; }
})();
