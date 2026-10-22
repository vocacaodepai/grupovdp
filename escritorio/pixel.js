// Renderizador de sprites pixel art do Escritório Lisieux.
// Um sprite é { w, h, ox, oy, pal:{ "a":"#rrggbb", ... }, rows:[ "....aa....", ... ] }
//  - cada caractere de rows é um pixel; "." (ou espaço) é transparente;
//  - ox/oy = âncora (o pixel do sprite que fica sobre a posição no mundo; para móveis e pessoas, o centro da base);
//  - frames opcionais: { frames:[ rows, rows, ... ] } para animação (rows vira frames[0]).
// Sprites se registram em window.LISIEUX_SPRITES[nome]. Personagens ficam em window.LISIEUX_CHARS (ver sprites-chars.js).
(function(){
  var SPRITES = window.LISIEUX_SPRITES = window.LISIEUX_SPRITES || {};
  var cache = {};
  function rowsOf(sp, frame){ return (sp.frames && sp.frames.length) ? sp.frames[(frame||0) % sp.frames.length] : sp.rows; }
  function toCanvas(sp, palOverride, frame, cacheKey){
    var key = cacheKey ? cacheKey+"|"+(frame||0) : null;
    if(key && cache[key]) return cache[key];
    var rows = rowsOf(sp, frame), c = document.createElement("canvas");
    c.width = sp.w; c.height = sp.h;
    var ctx = c.getContext("2d");
    for(var y=0; y<rows.length && y<sp.h; y++){
      var r = rows[y];
      for(var x=0; x<r.length && x<sp.w; x++){
        var ch = r.charAt(x);
        if(ch==="." || ch===" ") continue;
        var col = (palOverride && palOverride[ch]) || sp.pal[ch];
        if(!col) continue;
        ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
      }
    }
    if(key) cache[key] = c;
    return c;
  }
  function draw(ctx, name, x, y, opts){
    var sp = SPRITES[name]; if(!sp) return false;
    opts = opts || {};
    var img = toCanvas(sp, opts.pal, opts.frame, opts.pal ? null : name);
    ctx.drawImage(img, Math.round(x-(sp.ox||0)), Math.round(y-(sp.oy||0)));
    return true;
  }
  function validate(name){
    var sp = SPRITES[name], errs = [];
    if(!sp) return ["não existe: "+name];
    var all = sp.frames && sp.frames.length ? sp.frames : [sp.rows];
    all.forEach(function(rows, fi){
      if(!rows || rows.length!==sp.h) errs.push(name+" frame "+fi+": "+(rows ? rows.length : 0)+" linhas, esperado "+sp.h);
      (rows||[]).forEach(function(r, i){ if(r.length!==sp.w) errs.push(name+" frame "+fi+" linha "+i+": largura "+r.length+", esperado "+sp.w); });
      (rows||[]).join("").split("").forEach(function(ch){ if(ch!=="." && ch!==" " && !sp.pal[ch]) errs.push(name+": cor sem paleta '"+ch+"'"); });
    });
    return errs.filter(function(e, i, a){ return a.indexOf(e)===i; }).slice(0, 12);
  }
  window.LisieuxPixel = { toCanvas:toCanvas, draw:draw, validate:validate, clearCache:function(){ cache = {}; } };
})();
