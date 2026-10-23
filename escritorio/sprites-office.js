// Escritório Lisieux: móveis, paredes e piso (sprites com prefixo "of_").
// Arte própria, desenhada pixel a pixel no estilo da referência (ver style-guide.md): vista 3/4 de cima,
// contorno #303142 de 1 px, luz de cima/esquerda, sombra projetada só embaixo. Nada foi decalcado.
//
// Formato de cada sprite: ver pixel.js ({ w, h, ox, oy, pal, rows } ou frames:[rows, ...]).
// Âncoras (ox, oy):
//  - móveis e objetos de piso: centro da base da pegada no piso (o "pé" do objeto), para ordenar por y;
//  - itens de mesa (monitor, papéis, luminária...): centro da base do item, no ponto em que ele toca o tampo;
//  - itens de parede (quadros, lousas, placa): centro da base do item, na parede;
//  - tiles de piso e de parede (of_floor*, of_wall*): canto superior esquerdo (0, 0).
// Medidas e ordem de montagem dos conjuntos (cubículos, estação de 6 monitores, mesa de reunião, chefia):
// ver window.LISIEUX_OF (fim do arquivo) e as notas em escritorio-notes.md.
(function(){
  "use strict";
  var SP = window.LISIEUX_SPRITES = window.LISIEUX_SPRITES || {};

  // ---------- tokens de cor (subconjunto da paleta do guia de estilo) ----------
  var T = {
    contorno:"#303142", contornoSuave:"#44465a", branco:"#fcfcfc", sombraPiso:"#909090", sombraMadeira:"#a8906f",
    piso:"#a6a6a6", pisoLinha:"#c1c1c1", pisoLinhaFade:"#b5b5b5", pisoSeam:"#a3a3a3",
    paredeTopo:"#fcfcfc", paredeClara:"#ded9e0", paredeMedia:"#d7d1de", paredeEscura:"#d3ccdb",
    tijolo:"#a6a0c2", tijoloClaro:"#cec8d7", tijoloMedio:"#bcb4cf", tijoloRealce:"#f2f2f1", tijoloRealce2:"#e5def1", tijoloSombra:"#8b92b7",
    madeira:"#c8b490", madeira2:"#c6ae90", madeiraLinha:"#a2866c", madeiraJunta:"#ae9377",
    mesa:"#c8b490", mesaRealce:"#d8c8a6", mesaXadrez:"#b69274", mesaBorda:"#916a5e", perna:"#9ea3b0", pernaSombra:"#757a8a",
    mesaBranca:"#cfc9db", mesaBranca2:"#c9c3d6", mesaBrancaBorda:"#a49ec0",
    divisoria:"#a6b0bd", divisoriaClara:"#d0c9d9", divisoriaTopo:"#aeb8cd", poste:"#c8d4de",
    cadeira:"#5e617a", cadeiraEscura:"#4a4d66", cadeiraClara:"#7d809a", cadeiraTela:"#a1a2a2",
    cadeiraLaranja:"#bf7044", cadeiraLaranjaEscura:"#a24731", cadeiraLaranjaClara:"#d98a56",
    monitorCorpo:"#51546c", monitorCorpoClaro:"#c4c3d1", monitorTras:"#5e617a", monitorTrasPainel:"#7d7d9d",
    tela:"#3874d7", telaEscura:"#1847af", telaClara:"#439ae0", telaPonto:"#dfe5ea", telaVermelho:"#d72f2b", telaAmarelo:"#f2c833",
    laptop:"#b3bbca", laptopClaro:"#d1dae4", laptopEscuro:"#626477", teclado:"#9e9fa6",
    papel:"#edf0f1", papelSombra:"#c4c6d8", papelLilas:"#b2abc9", telefone:"#afb9ce", ledVerde:"#57a252", ledVermelho:"#d72f2b", impressora:"#dfe0ea",
    folha:"#4a7e56", folhaClara:"#57a252", folhaEscura:"#436355", vaso:"#c5c1cc", vasoSombra:"#8587a9",
    copo:"#ebe9f1", cafeteira:"#575a71", cafeteiraClara:"#9f9dbf",
    moldura:"#b2abc9", molduraMadeira:"#af9176", molduraMadeiraEscura:"#865a55", cortica:"#be814e",
    artVermelho:"#d72f2b", artAzul:"#408edd", artLaranja:"#e9901e", artVerde:"#4a7e56",
    lousa:"#f1f3f6", lousaMoldura:"#dad6e4", lousaSombra:"#bcb6d2", grafVermelho:"#f2695a", grafAzul:"#7388f0", grafBarra:"#a1acda", apagador:"#4d5065",
    estante:"#d3cddc", estanteSombra:"#9799a5", livroMarrom:"#ae724a", livroOcre:"#d4aa62", livroAzul:"#3973d6", livroAmarelo:"#efb829", livroEscuro:"#5b422c",
    pele1:"#fbc2a6", pele1Sombra:"#f19c8b", cabeloRuivo:"#a46533", cabeloRuivoClaro:"#bc8148", cabeloCastanho:"#815d44", camisaVerde:"#4a7e54", camisaAzul:"#4563c2", olho:"#2a2433",
    balcao:"#c8a165", balcaoEscuro:"#a16342"
  };
  // monta uma paleta { caractere: "#hex" } a partir de { caractere: "nomeDoToken" }
  function pal(map){ var o = {}; for(var ch in map) if(map.hasOwnProperty(ch)) o[ch] = T[map[ch]]; return o; }

  // ---------- utilitários de montagem (as linhas continuam sendo a arte; isto só copia/combina) ----------
  function blank(w, h){ var s = new Array(w+1).join("."), r = []; for(var i=0;i<h;i++) r.push(s); return r; }
  // carimba "part" sobre "rows" na posição (x, y); "." é transparente
  function stamp(rows, part, x, y){
    var out = rows.slice();
    for(var j=0;j<part.length;j++){
      var yy = y+j; if(yy<0 || yy>=out.length) continue;
      var line = out[yy].split(""), src = part[j];
      for(var i=0;i<src.length;i++){ var xx = x+i, ch = src.charAt(i); if(ch!=="." && xx>=0 && xx<line.length) line[xx] = ch; }
      out[yy] = line.join("");
    }
    return out;
  }
  function sub(rows, map){ return rows.map(function(r){ return r.replace(/./g, function(c){ return map.hasOwnProperty(c) ? map[c] : c; }); }); }
  function flip(rows){ return rows.map(function(r){ return r.split("").reverse().join(""); }); }
  function rep(str, n){ var o = ""; for(var i=0;i<n;i++) o += str; return o; }
  // registra: rowsOrFrames = [linhas] ou [[linhas], [linhas], ...]
  function def(name, p, rowsOrFrames, ox, oy){
    var multi = Array.isArray(rowsOrFrames[0]);
    var rows = multi ? rowsOrFrames[0] : rowsOrFrames;
    var sp = { w: rows[0].length, h: rows.length, ox: ox, oy: oy, pal: p, rows: rows };
    if(multi && rowsOrFrames.length > 1) sp.frames = rowsOrFrames;
    SP[name] = sp; return sp;
  }

  // =====================================================================================
  // 1. PISO E PAREDES (tiles de 16 px; âncora no canto superior esquerdo)
  // =====================================================================================
  var PT = pal({
    k:"contorno", K:"contornoSuave", w:"branco", s:"sombraPiso",
    f:"piso", g:"pisoLinha", h:"pisoLinhaFade", j:"pisoSeam",
    "1":"paredeClara", "2":"paredeMedia", "3":"paredeEscura",
    b:"tijolo", B:"tijoloClaro", n:"tijoloMedio", N:"tijoloRealce", m:"tijoloRealce2", M:"tijoloSombra", V:"divisoriaClara",
    o:"madeira", O:"madeira2", l:"madeiraLinha", L:"madeiraJunta",
    J:"moldura", d:"molduraMadeira", D:"molduraMadeiraEscura", e:"mesaBorda", p:"perna", P:"pernaSombra"
  });

  // piso do escritório: cinza neutro, linha clara vertical na coluna 15 e um "+" curto no cruzamento (linha 15)
  def("of_floor", PT, [
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffh",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffh",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "gghfffffffffhggg"
  ], 0, 0);
  // variante (falhas da linha em outras alturas) para quebrar a repetição
  def("of_floor_b", PT, [
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffh",
    "ffffffffffffffff",
    "fffffffffffffffh",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "fffffffffffffffg",
    "gghfffffffffhggg"
  ], 0, 0);
  // fileira logo abaixo da parede norte: 1 linha de sombra (pisoSeam) no topo
  def("of_floor_top", PT, ["jjjjjjjjjjjjjjjh"].concat(SP.of_floor.rows.slice(1)), 0, 0);

  // piso de madeira (copa/chefia): tábuas verticais de 4 px (3 + linha), pares madeira/madeira2, emendas desencontradas
  def("of_floor_wood", PT, [
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolLLLlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "LLLlooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlLLLl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolLLLlOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl"
  ], 0, 0);
  def("of_floor_wood_b", PT, [
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolLLLlOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlLLLl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "LLLlooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolLLLlOOOl",
    "ooolooolOOOlOOOl",
    "ooolooolOOOlOOOl"
  ], 0, 0);

  // parede norte: contorno, cap branco de 4 px, contorno, face lavanda listrada (ciclo de 3 linhas), rodapé (contorno)
  var WA = "1111111111111111", WB = "2222222222222222", WC1 = "3322332233223322", WC2 = "2233223322332233";
  function wallRows(h){
    var r = ["kkkkkkkkkkkkkkkk","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","kkkkkkkkkkkkkkkk"];
    var face = h - 7;                       // linhas 6 .. h-2
    for(var i=0;i<face-1;i++){ var c = i%3; r.push(c===0 ? WA : c===1 ? WB : ((Math.floor(i/3)%2) ? WC2 : WC1)); }
    r.push(WA);                            // última linha da face: paredeClara
    r.push("kkkkkkkkkkkkkkkk");            // rodapé
    return r;
  }
  def("of_wall", PT, wallRows(32), 0, 0);        // 16×32: o piso começa em y=32 (medida da referência)
  def("of_wall_tall", PT, wallRows(48), 0, 0);   // 16×48: mesma parede com face mais alta (se o motor quiser 3 tiles)

  // parede de pedra/tijolo da copa (e da sala da chefia): mesmas 32 linhas, pedras lavanda com brilho no topo
  def("of_wall_brick", PT, [
    "kkkkkkkkkkkkkkkk",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    "kkkkkkkkkkkkkkkk",
    "NNNNNBnnnnbmmmmn",
    "BBBBBBbbbbbnnnnn",
    "BBBBBBbbbbbnnnnn",
    "bBBBBbbbbbbnnnnb",
    "nnbNNNNNNBmmmnnn",
    "bbbBBBBBBBnnnnbb",
    "bbbBBBBBBBnnnnbb",
    "bbbbBBBBBbnnnbbb",
    "mmmmnNNNBnnnnnnb",
    "nnnnnBBBBbbbbbbb",
    "nnnnnBBBBbbbbbbb",
    "nnnnbbBBbbbbbbbb",
    "nnnbmmmnNNNNNNNB",
    "bbbbnnnnBBBBBBBB",
    "MbbbnnnnBBBBBBBB",
    "bbbbnnnbbBBBBBBb",
    "NBmmmmmnnnnbNNNN",
    "BBnnnnnnbbbbBBBB",
    "BBMnnnnnbbbbBBBB",
    "BbnnnnnbbbbbbBBB",
    "nnnnnbNNNNNNBmmn",
    "bbbbbbBBBBBBBnnn",
    "bbbbbbBBBBBBBnnn",
    "bbbbbbbBBBBBbnnb",
    "MMMMMMMMMMMMMMMM",
    "kkkkkkkkkkkkkkkk"
  ], 0, 0);

  // pontas da parede norte: a parede lateral aparece só como faixa branca (cap) com contorno dos dois lados.
  // Desenhe por cima da ponta esquerda/direita da parede; abaixo dela continue com of_wall_side.
  function endRows(h, left){
    var r = [left ? "kkkkkk" : "kkkkkk"];
    for(var i=1;i<5;i++) r.push(left ? "kwwwww" : "wwwwwk");
    for(i=5;i<h;i++) r.push("kwwwwk");
    return r;
  }
  def("of_wall_end_l", PT, endRows(32, true), 0, 0);
  def("of_wall_end_r", PT, endRows(32, false), 0, 0);
  def("of_wall_end_l48", PT, endRows(48, true), 0, 0);
  def("of_wall_end_r48", PT, endRows(48, false), 0, 0);
  // parede lateral (vertical na planta): faixa de 6 px, repete na vertical; ponta norte fechada
  def("of_wall_side", PT, ["kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk","kwwwwk"], 0, 0);
  def("of_wall_side_top", PT, ["kkkkkk","kwwwwk","kwwwwk","kwwwwk"], 0, 0);
  // borda simples (1 px) para fechar a ponta de uma parede sem parede lateral (como a ponta esquerda da copa)
  def("of_wall_edge", PT, (function(){ var r=[]; for(var i=0;i<32;i++) r.push("k"); return r; })(), 0, 0);

  // porta na parede norte (16×32, ocupa o lugar de um segmento de parede): batente lavanda, folha de madeira com 2 almofadas
  var doorTop = ["kkkkkkkkkkkkkkkk","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","wwwwwwwwwwwwwwww","kkkkkkkkkkkkkkkk"];
  def("of_door", PT, doorTop.concat([
    "kJJJJJJJJJJJJJJk",
    "kJkkkkkkkkkkkkJk",
    "kJkoooooooooDkJk",
    "kJkoddddddddDkJk",
    "kJkodDDDDDDdDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodoooooodDkJk",
    "kJkoddddddddDkJk",
    "kJkoddddddpdDkJk",
    "kJkoddddddPdDkJk",
    "kJkodDDDDDDdDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodDddddodDkJk",
    "kJkodoooooodDkJk",
    "kJkoddddddddDkJk",
    "kJkDDDDDDDDDDkJk",
    "kkkkkkkkkkkkkkkk"
  ]), 8, 31);
  // porta aberta: vão escuro com a folha vista de lado
  def("of_door_open", PT, doorTop.concat([
    "kJJJJJJJJJJJJJJk",
    "kJkkkkkkkkkkkkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkopKKKKKKKKkJk",
    "kJkoPKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkodKKKKKKKKkJk",
    "kJkDDKKKKKKKKkJk",
    "kkkkkkkkkkkkkkkk"
  ]), 8, 31);


  // =====================================================================================
  // 2. CUBÍCULOS, CADEIRAS, MONITORES E OBJETOS DE MESA
  // =====================================================================================
  var PD = pal({
    k:"contorno", K:"contornoSuave", w:"branco", s:"sombraPiso",
    d:"mesa", D:"mesaRealce", x:"mesaXadrez", e:"mesaBorda", p:"perna", P:"pernaSombra",
    q:"mesaBranca", Q:"mesaBranca2", r:"mesaBrancaBorda",
    v:"divisoria", V:"divisoriaClara", u:"divisoriaTopo", U:"poste",
    c:"cadeira", C:"cadeiraEscura", a:"cadeiraClara", t:"cadeiraTela",
    z:"cadeiraLaranja", Z:"cadeiraLaranjaEscura", y:"cadeiraLaranjaClara",
    m:"monitorCorpo", M:"monitorCorpoClaro", N:"monitorTrasPainel",
    b:"tela", B:"telaEscura", i:"telaClara", I:"telaPonto", R:"telaVermelho", Y:"telaAmarelo",
    A:"laptop", E:"laptopClaro", F:"laptopEscuro", G:"teclado",
    "0":"papel", "1":"papelSombra", "2":"papelLilas",
    T:"telefone", g:"ledVerde", W:"impressora",
    o:"copo", h:"molduraMadeira", H:"molduraMadeiraEscura",
    f:"pele1", "3":"cabeloRuivo", "4":"camisaVerde",
    "5":"folha", "6":"folhaClara", "7":"folhaEscura", "8":"vaso", "9":"vasoSombra",
    L:"livroEscuro", X:"livroOcre", j:"livroAmarelo"
  });

  // --- peças do cubículo (módulo de 48 px: poste + divisória + mesa de trás + mesa da frente) ---
  // poste de divisória: 3×43, parte de cima clara, de baixo cinza, pontas fechadas
  def("of_cub_post", PD, [
    "kkk",
    "kwk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kUk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kpk",
    "kkk"
  ], 1, 42);
  // tampo da mesa de trás (a pessoa senta ACIMA dela, olhando para baixo/sul): faixa em xadrez de 41×8; a divisória cobre o resto
  def("of_cub_desk_back", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kDdDddxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdk",
    "kdDdDxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxk",
    "kDdDddxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdk",
    "kdDdDxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxk",
    "kDdDddxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdk",
    "kdDdDxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxk",
    "kDdDddxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdxdk"
  ], 20, 7);
  // divisória (espinha) entre as fileiras: 45×22
  def("of_cub_spine", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk"
  ], 22, 21);
  // mesa da frente (a pessoa senta ABAIXO dela, de costas para nós, olhando para cima/norte): 41×23 com pés e sombra
  def("of_cub_desk", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kDDDDDDDDdddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDDdddddddddddddddddddddddddddddddddddddk",
    "kDddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kdddddddddddddddddddddddddddddddddddddddk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeek",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    ".kpPkssssssssssssssssssssssssssssssskpPk.",
    ".kpPkssssssssssssssssssssssssssssssskpPk.",
    ".kkkk...............................kkkk."
  ], 20, 22);

  // --- cadeiras (nome = para onde olha quem senta) ---
  // de costas para nós (quem senta olha para cima/norte). Desenhe DEPOIS da pessoa: o encosto cobre o corpo.
  def("of_chair_up", PD, [
    "....kkkkkkkkkk....",
    "...kaaaaaaaaaak...",
    "..kCcmcmcmcmcmCk..",
    "..kCmcmcmcmcmcCk..",
    "..kCcmcmcmcmcmCk..",
    "..kCmcmcmcmcmcCk..",
    "..kCcmcmcmcmcmCk..",
    "..kCmcmcmcmcmcCk..",
    "..kCcmcmcmcmcmCk..",
    "kkkCmcmcmcmcmcCkkk",
    "kakCcmcmcmcmcmCkak",
    "kCkCmcmcmcmcmcCkCk",
    "kCkCCCCCCCCCCCCkCk",
    "kCkCmcmcmcmcmcCkCk",
    "kCkCcmcmcmcmcmCkCk",
    "kCkCmcmcmcmcmcCkCk",
    "kkkCCCCCCCCCCCCkkk",
    "..kkkkkkkkkkkkkk..",
    "...kCk......kCk...",
    "...kkk......kkk..."
  ], 9, 19);
  // de frente (quem senta olha para baixo/sul). Desenhe ANTES da pessoa.
  def("of_chair_down", PD, [
    "....kkkkkkkkkk....",
    "...kaaaaaaaaaak...",
    "..kCccccccccccCk..",
    "..kCccccccccccCk..",
    "..kCcKKKKKKKKcCk..",
    "..kCcKtCtCtCKcCk..",
    "..kCcKCtCtCtKcCk..",
    "..kCcKtCtCtCKcCk..",
    "..kCcKKKKKKKKcCk..",
    "..kCccccccccccCk..",
    "kkkCccccccccccCkkk",
    "kakCccccccccccCkak",
    "kCkCCCCCCCCCCCCkCk",
    "kCkaaaaaaaaaaaakCk",
    "kCkcccccccccccckCk",
    "kCkCCCCCCCCCCCCkCk",
    "kkkkkkkkkkkkkkkkkk",
    ".......kCCk.......",
    "...kkkkkkkkkkkk...",
    "..kCk........kCk..",
    "..kkk........kkk.."
  ], 9, 20);
  // de perfil: olhando para a esquerda / para a direita
  def("of_chair_left", PD, [
    "........kkk.",
    ".......kaak.",
    ".......kcCk.",
    ".......kcCk.",
    ".......kcCk.",
    ".......kcCk.",
    ".kkkkk.kcCk.",
    ".kaaak.kcCk.",
    ".kkCkk.kcCk.",
    "..kCk..kcCk.",
    "kkkkkkkkkCkk",
    "kaaaaaaaaaak",
    "kcccccccccck",
    "kCCCCCCCCCCk",
    ".kkkkkkkkkk.",
    ".....kCk....",
    ".....kCk....",
    ".kkkkkkkkkk.",
    "kCk......kCk",
    "kkk......kkk"
  ], 6, 19);
  def("of_chair_right", PD, flip(SP.of_chair_left.rows), 5, 19);
  // cadeira laranja da estação de 6 monitores (de costas)
  def("of_chair_orange_up", PD, [
    "....kkkkkkkkkk....",
    "...kyyyyyyyyyyk...",
    "..kZzyzyzyzyzyZk..",
    "..kZyzyzyzyzyzZk..",
    "..kZzyzyzyzyzyZk..",
    "..kZyzyzyzyzyzZk..",
    "..kZzyzyzyzyzyZk..",
    "..kZyzyzyzyzyzZk..",
    "..kZzyzyzyzyzyZk..",
    "kkkZyzyzyzyzyzZkkk",
    "kykZzyzyzyzyzyZkyk",
    "kZkZyzyzyzyzyzZkZk",
    "kZkZZZZZZZZZZZZkZk",
    "kZkZyzyzyzyzyzZkZk",
    "kZkZzyzyzyzyzyZkZk",
    "kZkZyzyzyzyzyzZkZk",
    "kkkZZZZZZZZZZZZkkk",
    "..kkkkkkkkkkkkkk..",
    "...kCk......kCk...",
    "...kkk......kkk..."
  ], 9, 19);

  // --- monitores ---
  // de frente (tela para o sul). Âncora: centro da base do pé (onde toca o tampo).
  def("of_mon", PD, [[
    ".kkkkkkkkkkkkk.",
    "kmmmmmmmmmmmmmk",
    "kmibbbbbbbbbbmk",
    "kmiRbIIIbIIbbmk",
    "kmibbbbbbbbbbmk",
    "kmiYbIIbIIIbbmk",
    "kmibbbbbbbbbbmk",
    "kmibbIIIIbIbbmk",
    "kmBBBBBBBBBBBmk",
    "kmmmmmmmmmmmmmk",
    ".kkkkkkkkkkkkk.",
    "......kmk......",
    "....kkkkkkk...."
  ], [
    ".kkkkkkkkkkkkk.",
    "kmmmmmmmmmmmmmk",
    "kmibbbbbbbbbbmk",
    "kmiRbIIIbIIIbmk",
    "kmibbbbbbbbbbmk",
    "kmiYbIIbIbbbbmk",
    "kmibbbbbbbbbbmk",
    "kmibbIIIIbIIbmk",
    "kmBBBBBBBBBBBmk",
    "kmmmmmmmmmmmmmk",
    ".kkkkkkkkkkkkk.",
    "......kmk......",
    "....kkkkkkk...."
  ]], 7, 12);          // ligado, 2 quadros (digitando: linhas de código mudam)
  def("of_mon_idle", PD, [[
    ".kkkkkkkkkkkkk.",
    "kmmmmmmmmmmmmmk",
    "kmibbbbbbbbbbmk",
    "kmibbbbbbbbbbmk",
    "kmibbbIIIbbbbmk",
    "kmibbIbbbIbbbmk",
    "kmibbbIIIbbbbmk",
    "kmibbbbbbbbbbmk",
    "kmBBBBBBBBBBBmk",
    "kmmmmmmmmmmmmmk",
    ".kkkkkkkkkkkkk.",
    "......kmk......",
    "....kkkkkkk...."
  ], [
    ".kkkkkkkkkkkkk.",
    "kmmmmmmmmmmmmmk",
    "kmibbbbbbbbbbmk",
    "kmibbbbbbbbbbmk",
    "kmibbbIIIbbbbmk",
    "kmibbIbbbIbbbmk",
    "kmibbbIIIbbbbmk",
    "kmibbbbbbbIbbmk",
    "kmBBBBBBBBBBBmk",
    "kmmmmmmmmmmmmmk",
    ".kkkkkkkkkkkkk.",
    "......kmk......",
    "....kkkkkkk...."
  ]], 7, 12);   // ligado sem uso (cursor piscando)
  def("of_mon_off", PD, [
    ".kkkkkkkkkkkkk.",
    "kmmmmmmmmmmmmmk",
    "kmKKKKKKKmKKKmk",
    "kmKKKKKKmKKKKmk",
    "kmKKKKKmKKKmKmk",
    "kmKKKKmKKKmKKmk",
    "kmKKKmKKKmKKKmk",
    "kmKKKKKKmKKKKmk",
    "kmKKKKKKKKKKKmk",
    "kmmmmmmmmmmmmmk",
    ".kkkkkkkkkkkkk.",
    "......kmk......",
    "....kkkkkkk...."
  ], 7, 12);               // desligado
  // de costas (na mesa de trás, quem senta fica atrás dele)
  def("of_mon_back", PD, [
    ".kkkkkkkkkkk.",
    "kaaaaaaaaaaak",
    "kccccccccccck",
    "kcNNNNNNNNNck",
    "kcNNNNNNNNNck",
    "kcNNNKKKNNNck",
    "kcNNNNNNNNNck",
    "kccccccccccck",
    ".kkkkkkkkkkk.",
    "....kccck....",
    "...kkkkkkk..."
  ], 6, 10);
  // angulados: of_mon_l fica à esquerda e vira a tela para a direita; of_mon_r é o espelho
  def("of_mon_l", PD, [[
    "............kk",
    "........kkkkmk",
    "....kkkkmmmmmk",
    "kkkkmmmmbbbbmk",
    "kmmmbbbbbIIbmk",
    "kmibbIIIbbbbmk",
    "kmiRbbbbIIIbmk",
    "kmibbIIbbbbbmk",
    "kmiYbbbbbIbbmk",
    "kmibIIIIBBBBmk",
    "kmibBBBBmmmmkk",
    "kmBBmmmmkkkk..",
    "kmmmkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ], [
    "............kk",
    "........kkkkmk",
    "....kkkkmmmmmk",
    "kkkkmmmmbbbbmk",
    "kmmmbbbbbIIImk",
    "kmibbIIIbbbbmk",
    "kmiRbbbbIbbbmk",
    "kmibbIIbbbbbmk",
    "kmiYbbbbbIIbmk",
    "kmibIIIIBBBBmk",
    "kmibBBBBmmmmkk",
    "kmBBmmmmkkkk..",
    "kmmmkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ]], 7, 14);
  def("of_mon_l_off", PD, [
    "............kk",
    "........kkkkmk",
    "....kkkkmmmmmk",
    "kkkkmmmmmmKKmk",
    "kmmmKKKKmKKKmk",
    "kmKKKKKmKKKKmk",
    "kmKKKKmmKKKKmk",
    "kmKKKmmKKKKKmk",
    "kmKKmmKKKKKKmk",
    "kmKKKKKKKKKKmk",
    "kmKKKKKKmmmmkk",
    "kmKKmmmmkkkk..",
    "kmmmkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ], 7, 14);
  def("of_mon_r", PD, [flip(SP.of_mon_l.frames[0]), flip(SP.of_mon_l.frames[1])], 6, 14);
  def("of_mon_r_off", PD, flip(SP.of_mon_l_off.rows), 6, 14);
  // versões de moldura clara (fileira da frente da estação de 6 monitores)
  def("of_monc_l", PD, [[
    "............kk",
    "........kkkkMk",
    "....kkkkwwwwMk",
    "kkkkwwwwbbbbMk",
    "kMwwbbbbbIIbMk",
    "kMibbIIIbbbbMk",
    "kMiRbbbbIIIbMk",
    "kMibbIIbbbbbMk",
    "kMiYbbbbbIbbMk",
    "kMibIIIIBBBBMk",
    "kMibBBBBMMMMkk",
    "kMBBMMMMkkkk..",
    "kMMMkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ], [
    "............kk",
    "........kkkkMk",
    "....kkkkwwwwMk",
    "kkkkwwwwbbbbMk",
    "kMwwbbbbbIIIMk",
    "kMibbIIIbbbbMk",
    "kMiRbbbbIbbbMk",
    "kMibbIIbbbbbMk",
    "kMiYbbbbbIIbMk",
    "kMibIIIIBBBBMk",
    "kMibBBBBMMMMkk",
    "kMBBMMMMkkkk..",
    "kMMMkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ]], 7, 14);
  def("of_monc_l_off", PD, [
    "............kk",
    "........kkkkMk",
    "....kkkkwwwwMk",
    "kkkkwwwwmmKKMk",
    "kMwwKKKKmKKKMk",
    "kMKKKKKmKKKKMk",
    "kMKKKKmmKKKKMk",
    "kMKKKmmKKKKKMk",
    "kMKKmmKKKKKKMk",
    "kMKKKKKKKKKKMk",
    "kMKKKKKKMMMMkk",
    "kMKKMMMMkkkk..",
    "kMMMkkkkk.....",
    "kkkk..kmk.....",
    "....kkkkkkk..."
  ], 7, 14);
  def("of_monc_r", PD, [flip(SP.of_monc_l.frames[0]), flip(SP.of_monc_l.frames[1])], 6, 14);
  def("of_monc_r_off", PD, flip(SP.of_monc_l_off.rows), 6, 14);
  // moldura clara: mesma tela, moldura monitorCorpoClaro com brilho branco no topo
  function lightFrame(rows){ var r = sub(rows, { m:"M" }); r[1] = "kwwwwwwwwwwwwwk"; r[r.length-2] = "......kmk......"; return r; }
  def("of_monc", PD, [lightFrame(SP.of_mon.frames[0]), lightFrame(SP.of_mon.frames[1])], 7, 12);
  def("of_monc_off", PD, lightFrame(SP.of_mon_off.rows), 7, 12);

  // --- objetos de mesa (âncora: centro da base) ---
  def("of_lamp", PD, [
    ".......kkkk..",
    "......kwwwEk.",
    ".....kwEEEEEk",
    "....k0kEEEEk.",
    "...k0k0kkkk..",
    "..k0k0k......",
    ".k0k0k.......",
    ".kk0k........",
    "kkkkkk.......",
    "kFFFFk.......",
    ".kkkk........"
  ], 2, 10);                       // luminária: base à esquerda, cúpula à direita
  def("of_lamp_r", PD, flip(SP.of_lamp.rows), 10, 10);      // espelhada
  def("of_papers", PD, [
    "....kkk......",
    "..kk000kk....",
    ".k1100000kk..",
    "k0000110000k.",
    "k0110000110k.",
    ".k000110000kk",
    ".kkk000011k2k",
    "..k2kk110k22k",
    "...kk2k0k22k.",
    ".....kkk22k..",
    ".......k2k...",
    "........k...."
  ], 6, 11);
  def("of_phone", PD, [
    "kkkkkkkkk",
    "kEEkTTTgk",
    "kEEkTKTRk",
    "kEEkTTTTk",
    "kEEkTKTKk",
    "k11kTTTTk",
    "kkkkkkkkk",
    "kKKKKKKKk",
    "kkkkkkkkk"
  ], 4, 8);
  def("of_keyboard", PD, [
    "kkkkkkkkkkkk",
    "kGGGGGGGGGGk",
    "kGFGFGFGFGGk",
    "kFFFFFFFFFFk",
    "kkkkkkkkkkkk"
  ], 6, 4);
  def("of_mouse", PD, [
    "kkk",
    "kak",
    "kck",
    "kkk"
  ], 1, 3);
  def("of_mug", PD, [
    "kkkk.",
    "kHHkk",
    "kookk",
    "kook.",
    "kkkk."
  ], 2, 4);
  def("of_photo", PD, [
    ".kkkkkkkkk.",
    "kwwwwwwwwMk",
    "kwkkkkkkkMk",
    "kwkiiiiikMk",
    "kwki333ikMk",
    "kwk3fff3kMk",
    "kwk3KfK3kMk",
    "kwki444ikMk",
    "kwk44444kMk",
    "kwkkkkkkkMk",
    "kMMMMMMMMMk",
    ".kkkkkkkkk."
  ], 5, 11);
  def("of_printer", PD, [
    "....kkkkk....",
    "...k00000k...",
    "...k01110k...",
    "...k00000k...",
    "...k01100k...",
    ".kkkkkkkkkkk.",
    "kWWWWWWWWWWWk",
    "kWWWWWWWWWWWk",
    "kWkkkkkkkkkWk",
    "kWk0000000kWk",
    "kWWWWWWWWWWWk",
    "k11111111111k",
    "k1i1R1Y11g11k",
    "k11111111111k",
    "kkkkkkkkkkkkk"
  ], 6, 14);

  // --- módulos prontos de cubículo (48×43, costas com costas) ---
  // Origem do módulo = canto superior esquerdo do poste. Âncora (ox,oy) = (25, 42): centro da mesa, base dos pés.
  // Contém: poste esquerdo, mesa de trás + objetos, divisória, mesa da frente + objetos (sem o monitor da frente).
  // O motor desenha: [cadeira/pessoa da fileira de trás] -> módulo -> monitor da frente -> pessoa da frente -> of_chair_up.
  // Feche a fileira com um of_cub_post a 48 px do último módulo.
  function at(rows, name, ax, ay){ var sp = SP[name]; return stamp(rows, sp.rows, ax - sp.ox, ay - sp.oy); }
  function cubModule(backItems, frontItems){
    var r = blank(48, 43);
    r = stamp(r, SP.of_cub_desk_back.rows, 5, 3);
    (backItems||[]).forEach(function(it){ r = at(r, it[0], it[1], it[2]); });
    r = stamp(r, SP.of_cub_spine.rows, 3, 11);
    r = stamp(r, SP.of_cub_post.rows, 0, 0);
    r = stamp(r, SP.of_cub_desk.rows, 5, 20);
    (frontItems||[]).forEach(function(it){ r = at(r, it[0], it[1], it[2]); });
    return r;
  }
  def("of_cub", PD, cubModule([["of_mon_back",25,11]], []), 25, 42);
  def("of_cub_a", PD, cubModule([["of_lamp",10,10],["of_mon_back",25,11],["of_papers",38,10]],
                                [["of_phone",12,32],["of_mug",19,35],["of_papers",38,35]]), 25, 42);
  def("of_cub_b", PD, cubModule([["of_mon_back",25,11],["of_phone",39,10]],
                                [["of_papers",11,33],["of_keyboard",25,33],["of_mouse",34,32],["of_photo",39,32]]), 25, 42);
  def("of_cub_c", PD, cubModule([["of_papers",12,10],["of_mon_back",25,11],["of_lamp_r",40,10]],
                                [["of_printer",12,32],["of_keyboard",25,33],["of_photo",36,31],["of_phone",41,33]]), 25, 42);


  // =====================================================================================
  // 3. MÓVEIS GRANDES: notebooks, mesa de reunião, estação de 6 monitores, mesa da chefia
  // =====================================================================================
  // notebooks (âncora: centro da base)
  def("of_laptop", PD, [[
    ".kkkkkkkkkkk.",
    "kFFFFFFFFFFFk",
    "kFibbbbbbbbFk",
    "kFiRbIIbIbbFk",
    "kFibbbbbbbbFk",
    "kFiYbIbIIbbFk",
    "kFBBBBBBBBBFk",
    "kFFFFFFFFFFFk",
    "kkkkkkkkkkkkk",
    "kEEEEEEEEEEEk",
    "kAGEGEGEGEGAk",
    "kAEGEGEGEGEAk",
    "kAGEGEGEGEGAk",
    "kAAAAGGGAAAAk",
    "kAAAAAAAAAAAk",
    "kkkkkkkkkkkkk"
  ], [
    ".kkkkkkkkkkk.",
    "kFFFFFFFFFFFk",
    "kFibbbbbbbbFk",
    "kFiRbIIbIIbFk",
    "kFibbbbbbbbFk",
    "kFiYbIIbbbbFk",
    "kFBBBBBBBBBFk",
    "kFFFFFFFFFFFk",
    "kkkkkkkkkkkkk",
    "kEEEEEEEEEEEk",
    "kAGEGEGEGEGAk",
    "kAEGEGEGEGEAk",
    "kAGEGEGEGEGAk",
    "kAAAAGGGAAAAk",
    "kAAAAAAAAAAAk",
    "kkkkkkkkkkkkk"
  ]], 6, 15);              // de frente (tela para o sul), 2 quadros
  def("of_laptop_off", PD, [
    ".kkkkkkkkkkk.",
    "kFFFFFFFFFFFk",
    "kFKKKKKKmKKFk",
    "kFKKKKKmKKKFk",
    "kFKKKKmKKKmFk",
    "kFKKKmKKKmKFk",
    "kFKKKKKKKKKFk",
    "kFFFFFFFFFFFk",
    "kkkkkkkkkkkkk",
    "kEEEEEEEEEEEk",
    "kAGEGEGEGEGAk",
    "kAEGEGEGEGEAk",
    "kAGEGEGEGEGAk",
    "kAAAAGGGAAAAk",
    "kAAAAAAAAAAAk",
    "kkkkkkkkkkkkk"
  ], 6, 15);
  def("of_laptop_back", PD, [
    ".kkkkkkkkkkk.",
    "kEEEEEEEEEEEk",
    "kAAAAAAAAAAAk",
    "kAAAAAAAAAAAk",
    "kAAAAEEEAAAAk",
    "kAAAEEEEEAAAk",
    "kAAAAEEEAAAAk",
    "kAAAAAAAAAAAk",
    "kGGGGGGGGGGGk",
    "kkkkkkkkkkkkk",
    "kFFFFFFFFFFFk",
    "kkkkkkkkkkkkk"
  ], 6, 11);                   // tampa vista de trás (quem usa fica atrás dele)
  def("of_laptop_diag_r", PD, [[
    ".......kk.......",
    ".....kkFk.......",
    "...kkFFbk.......",
    ".kkFFibbk.......",
    "kFFibbbbk.......",
    "kFibbIIbk.k.....",
    "kFiRbbbbkkEk....",
    "kFibIIbbkGEGk...",
    "kFibbbbBkEGEGk..",
    "kFiBBBBkGEGEGEk.",
    "kFBkkkkEGEGEGEGk",
    "kkk..kkGEGEGEGk.",
    "......kkEGEGEk..",
    "........kEGEk...",
    ".........kkk...."
  ], [
    ".......kk.......",
    ".....kkFk.......",
    "...kkFFbk.......",
    ".kkFFibbk.......",
    "kFFibbbbk.......",
    "kFibIIbbk.k.....",
    "kFiRbbbbkkEk....",
    "kFibbIIIkGEGk...",
    "kFibbbbBkEGEGk..",
    "kFiBBBBkGEGEGEk.",
    "kFBkkkkEGEGEGEGk",
    "kkk..kkGEGEGEGk.",
    "......kkEGEGEk..",
    "........kEGEk...",
    ".........kkk...."
  ]], 8, 14);        // girado 45°: teclado para baixo-direita (usuário à direita)
  def("of_laptop_diag_l", PD, [flip(SP.of_laptop_diag_r.frames[0]), flip(SP.of_laptop_diag_r.frames[1])], 7, 14);

  // mesa de reunião (47×42): tampo bege, frente marrom, 2 pés e sombra
  def("of_meeting", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kDDDDDDDDDDdddddddddddddddddddddddddddddddddddk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kDDddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kddddddddddddddddddddddddddddddddddddddddddddxk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeek",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    ".kpPkssssssssssssssssssssssssssssssssssssskpPk.",
    ".kpPkssssssssssssssssssssssssssssssssssssskpPk.",
    ".kkkk.....................................kkkk."
  ], 23, 41);
  // mesa de reunião arrumada (notebooks, papéis, caneca); 4 linhas extras em cima para as tampas que passam da borda
  function meetingSet(frame){
    var r = stamp(blank(47, 46), SP.of_meeting.rows, 0, 4);
    var f = function(n){ var sp = SP[n]; return sp.frames ? sp.frames[frame % sp.frames.length] : sp.rows; };
    var put = function(n, ax, ay){ var sp = SP[n]; r = stamp(r, f(n), ax - sp.ox, ay - sp.oy); };
    put("of_laptop_back", 14, 12); put("of_papers", 34, 15); put("of_mug", 26, 11);
    put("of_laptop_diag_l", 8, 33); put("of_laptop_diag_r", 38, 33); put("of_laptop", 23, 38); put("of_mug", 34, 35);
    return r;
  }
  def("of_meeting_set", PD, [meetingSet(0), meetingSet(1)], 23, 45);

  // estação de pesquisa com 6 monitores (49×47): mesa branca, fileira de trás escura, fileira da frente clara.
  // A pessoa senta embaixo, no centro, na of_chair_orange_up (ver LISIEUX_OF.station6).
  def("of_desk_white", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kwwwwwwqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kwqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kwQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kwqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kwQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kqqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kqqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kqqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kqqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kqqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQk",
    "kqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    ".kpPkssssssssssssssssssssssssssssssskpPk.",
    ".kpPkssssssssssssssssssssssssssssssskpPk.",
    ".kkkk...............................kkkk."
  ], 20, 21);
  function station(frame, off){
    var r = stamp(blank(49, 47), SP.of_desk_white.rows, 4, 25);
    var f = function(n){ var sp = SP[n]; return sp.frames ? sp.frames[frame % sp.frames.length] : sp.rows; };
    var put = function(n, ax, ay){ var sp = SP[n]; r = stamp(r, f(n), ax - sp.ox, ay - sp.oy); };
    var o = off ? "_off" : "";
    put("of_mon_l"+o, 9, 14); put("of_mon"+(off?"_off":""), 24, 13); put("of_mon_r"+o, 39, 14);
    put("of_monc_l"+o, 9, 30); put("of_monc"+(off?"_off":""), 24, 29); put("of_monc_r"+o, 39, 30);
    return r;
  }
  def("of_station6", PD, [station(0), station(1)], 24, 46);
  def("of_station6_off", PD, station(0, true), 24, 46);

  // mesa da chefia (64×26): madeira escura, tampo com realce, frente com 3 painéis (vai até o chão)
  def("of_exec_desk", PD, [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kDDDDDDDxxxxxxxxxxxxxxxxxxxxxxxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhk",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhxxxxxxhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxxxxxxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhxxxxxhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhheeeeehhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhxxxxxxhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhheeeeeehhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhxxxxxxxhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhheeeeehhhhhhhhek",
    "kxhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhek",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kxxxxxxxxxxeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeek",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kHKKKKKKKKKKKKKKKKKKeHKKKKKKKKKKKKKKKKKKKeHKKKKKKKKKKKKKKKKKKeHk",
    "kHKHHHHHHHHHHHHHHHHHeHKHHHHHHHHHHHHHHHHHHeHKHHHHHHHHHHHHHHHHHeHk",
    "kHKHHHHHHHHHHHHHHHHHeHKHHHHHHHHHHHHHHHHHHeHKHHHHHHHHHHHHHHHHHeHk",
    "kHKeeeeeeeeeeeeeeeeeeHKeeeeeeeeeeeeeeeeeeeHKeeeeeeeeeeeeeeeeeeHk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk"
  ], 32, 26);


  // cadeiras de couro da chefia (de frente: quem senta olha para o sul; de costas: olha para o norte)
  def("of_chair_exec_down", PD, [
    "....kkkkkkkkkk....",
    "...kxxxxxxxxxxk...",
    "..kxeeeeeeeeeeLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "..kxHHHLHHLHHHLk..",
    "kkkLLLLLLLLLLLLkkk",
    "kxkxxxxxxxxxxxxkek",
    "kekeeeeeeeeeeeekLk",
    "kHkHHHHHHHHHHHHkLk",
    "kHkLLLLLLLLLLLLkLk",
    "kkkkkkkkkkkkkkkkkk",
    ".......kCCk.......",
    "...kkkkkkkkkkkk...",
    "..kCk........kCk..",
    "..kkk........kkk.."
  ], 9, 21);
  def("of_chair_exec_up", PD, [
    "....kkkkkkkkkk....",
    "...kxxxxxxxxxxk...",
    "..kxeeeeeeeeeeLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "..kxHHHHeHHHHHLk..",
    "kkkxHHHHeHHHHHLkkk",
    "kxkxHHHHeHHHHHLkek",
    "kekxHHHHHHHHHHLkLk",
    "kHkLLLLLLLLLLLLkLk",
    "kkkkkkkkkkkkkkkkkk",
    "...kCk......kCk...",
    "...kkk......kkk..."
  ], 9, 18);
  // plaquinha de mesa (dourada, virada para o visitante)
  def("of_nameplate", PD, [
    ".kkkkkkkkkk.",
    "kjXXXXXXXXXk",
    "kXLXLLXLXLXk",
    "kHHHHHHHHHHk",
    "kkkkkkkkkkkk"
  ], 6, 4);
  // mata-borrão (descanso de couro verde) para a mesa da chefia
  def("of_desk_pad", PD, [
    "KKKKKKKKKKKKKKKKKKKKK",
    "K6655555555555555555K",
    "K5777777777777777777K",
    "K7777777777777777777K",
    "K7777777777777777777K",
    "K7777777777777777777K",
    "KKKKKKKKKKKKKKKKKKKKK"
  ], 10, 6);
  // mesa da chefia arrumada para 2 lugares (Bruno e esposa sentam ATRÁS dela, olhando para o sul):
  // monitor de costas e plaquinha para cada lugar; luminária, telefone, caneca e papéis.
  // Lugares: centros x = 17 e x = 46 (em relação ao canto esquerdo da mesa).
  function execSet(){
    var r = stamp(blank(64, 30), SP.of_exec_desk.rows, 0, 3);
    var put = function(n, ax, ay){ var sp = SP[n]; r = stamp(r, sp.rows, ax - sp.ox, ay - sp.oy); };
    put("of_lamp", 4, 13); put("of_mug", 29, 9); put("of_papers", 57, 14);
    put("of_mon_back", 17, 15); put("of_mon_back", 46, 15);
    put("of_phone", 33, 17); put("of_nameplate", 17, 20); put("of_nameplate", 46, 20);
    return r;
  }
  def("of_exec_set", PD, execSet(), 32, 29);

})();
