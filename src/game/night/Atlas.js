// Reuse the generated clip's sixteen cels. Normalize their irregular crops to
// one center and one boot baseline, so physics and rain sample the same pixels.
const CROPS = [
  [[20,40,308,269,139,304],[325,0,247,310,451,304],[573,73,376,239,775,304],[947,124,298,186,1090,304]],
  [[38,365,205,240,138,599],[330,337,245,269,447,599],[632,337,286,269,755,599],[997,342,243,264,1113,599]],
  [[23,634,249,291,140,913],[281,651,358,274,451,913],[674,630,251,295,789,913],[981,614,269,315,1110,913]],
  [[48,946,240,291,159,1227],[365,946,230,291,468,1227],[669,934,270,303,775,1227],[984,1027,257,210,1114,1227]],
];
const EXTRA_CROPS = [
  [[36,64,351,342,209,405],[434,74,355,334,617,405],[903,80,338,327,1070,405]],
  [[41,432,330,400,207,826],[469,428,322,404,629,826],[893,421,345,410,1061,826]],
  [[45,888,320,326,213,1207],[460,877,320,337,615,1207],[877,877,360,337,1044,1207]],
];
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error(`Image load timed out: ${url}`)), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error(`Image unavailable: ${url}`)); };
    image.src = url;
  });
}
export async function loadAtlas() {
  const [image, city, extras] = await Promise.all([
    loadImage(new URL('../../../assets/night-hunters/sprites.png', import.meta.url)),
    loadImage(new URL('../../../assets/night-hunters/city.png', import.meta.url)),
    loadImage(new URL('../../../assets/night-hunters/throw-guard-v2.png', import.meta.url)),
  ]);
  const sheets = CROPS.map((row, index) => {
    const sheet = document.createElement('canvas');
    const pw = 116, ph = 80;
    sheet.width = pw * 12; sheet.height = ph;
    const ctx = sheet.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    row.forEach(([sx, sy, sw, sh, anchor, baseline], cel) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(cel * pw, 0, pw, ph); ctx.clip();
      ctx.translate(cel * pw + pw / 2, 0);
      // Enemies in the source atlas face left; normalize all cels to right.
      if (index >= 2) ctx.scale(-1, 1);
      ctx.drawImage(image, sx, sy, sw, sh, Math.round((sx-anchor)*.205), Math.round(79-(baseline-sy)*.205), Math.round(sw*.205), Math.round(sh*.205));
      ctx.restore();
    });
    // Two restrained stepping cels use the existing legs; every pose's mask is
    // generated from its actual drawing, including these shifted pixel bands.
    for (let step = 0; step < 2; step++) {
      const ox = (4 + step) * pw;
      ctx.drawImage(sheet, 0, 0, pw, 62, ox, step, pw, 62);
      ctx.drawImage(sheet, 0, 62, pw / 2, 18, ox + (step ? 1 : -1), 62, pw / 2, 18);
      ctx.drawImage(sheet, pw / 2, 62, pw / 2, 18, ox + pw / 2 + (step ? -1 : 1), 62, pw / 2, 18);
    }
    const extraFrame = (crop, frame) => {
      const [sx,sy,sw,sh,anchor,baseline] = crop;
      ctx.save();ctx.beginPath();ctx.rect(frame*pw,0,pw,ph);ctx.clip();
      ctx.drawImage(extras,sx,sy,sw,sh,frame*pw+pw/2+Math.round((sx-anchor)*.175),Math.round(79-(baseline-sy)*.175),Math.round(sw*.175),Math.round(sh*.175));
      ctx.restore();
    };
    if(index===0) EXTRA_CROPS[0].forEach((crop,i)=>extraFrame(crop,6+i));
    if(index<2) EXTRA_CROPS[index===0?1:2].forEach((crop,i)=>extraFrame(crop,9+i));
    return { sheet, pw, ph, frames: index<2 ? 12 : 6 };
  });
  const shuriken = document.createElement('canvas');shuriken.width=shuriken.height=20;
  const weaponCtx=shuriken.getContext('2d');weaponCtx.imageSmoothingEnabled=false;
  weaponCtx.drawImage(extras,838,132,53,55,0,0,20,20);
  const pixels=weaponCtx.getImageData(0,0,20,20).data;
  const shurikenSamples=Array.from({length:400},(_,i)=>{
    const k=i*4,[r,g,b,a]=pixels.subarray(k,k+4);
    return a>24?{r,g,b,alpha:a/255,brightness:Math.sqrt(.299*r*r+.587*g*g+.114*b*b)/255}:null;
  });
  return { sheets, city, shuriken, shurikenSamples };
}
