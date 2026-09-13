import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const bundled = join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe');
const ffmpeg = process.env.FFMPEG || (existsSync(bundled) ? bundled : 'ffmpeg');
const W = 320, H = 224, FPS = 30, FRAMES = 90;
function run(args, input) {
  const p = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 160 * 1024 * 1024, windowsHide: true });
  if (p.error || p.status !== 0) throw new Error(p.error?.message || p.stderr.toString());
  return p.stdout;
}
function decode(name, width, height) {
  return run(['-i', join(dir, name), '-vf', `scale=${width}:${height}:flags=neighbor`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
}
const bg = decode('city.png', W + 4, H);
const sheet = decode('sprites.png', 1254, 1254);
const crops = [
  // Source rectangle, pelvis anchor, common boot baseline. The generated atlas has irregular cels.
  [[20,40,308,269,139,304],[325,0,247,310,451,304],[573,73,376,239,775,304],[947,124,298,186,1090,304]],
  [[38,365,205,240,138,599],[330,337,245,269,447,599],[632,337,286,269,755,599],[997,342,243,264,1113,599]],
  [[23,634,249,291,140,913],[281,651,358,274,451,913],[674,630,251,295,789,913],[981,614,269,315,1110,913]],
  [[48,946,240,291,159,1227],[365,946,230,291,468,1227],[669,934,270,303,775,1227],[984,1027,257,210,1114,1227]],
];
const sprites = crops.map(row => row.map(([sx,sy,sw,sh,ax,by]) => {
  const scale = .205, w = Math.ceil(sw*scale), h = Math.ceil(sh*scale);
  const data = Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const si = ((sy+Math.min(sh-1,Math.floor(y/scale)))*1254+sx+Math.min(sw-1,Math.floor(x/scale)))*4;
    sheet.copy(data,(y*w+x)*4,si,si+4);
  }
  return {w,h,data,ax:Math.round((ax-sx)*scale),by:Math.round((by-sy)*scale)};
}));
let state = 81273;
function rand(){ state=(Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; }
const rain = Array.from({length:145},()=>({x:rand()*360,y:rand()*260,z:.3+rand()*.7}));
const sparks = Array.from({length:55},()=>({a:rand()*Math.PI*2,v:10+rand()*46,l:.25+rand()*.7}));
const fog = Array.from({length:70},()=>({x:rand()*320,y:rand()*12,p:rand()*6.28}));
let frame;
function px(x,y,c,a=1){ x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H||a<=0)return;const i=(y*W+x)*3;for(let k=0;k<3;k++)frame[i+k]=Math.round(frame[i+k]*(1-a)+c[k]*a); }
function rect(x,y,w,h,c,a=1){for(let yy=Math.floor(y);yy<y+h;yy++)for(let xx=Math.floor(x);xx<x+w;xx++)px(xx,yy,c,a);}
function line(x1,y1,x2,y2,c,a=1){const n=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1)));for(let i=0;i<=n;i++)px(x1+(x2-x1)*i/(n||1),y1+(y2-y1)*i/(n||1),c,a);}
function glow(x,y,r,c,strength){for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){const d=Math.sqrt(xx*xx+yy*yy)/r;if(d<1)px(x+xx,y+yy,c,(1-d)**2*strength);}}
function sprite(row,cel,x,y,alpha=1,reflection=false){
  const s=sprites[row][cel],left=Math.round(x-s.ax),top=Math.round(y-s.by);
  for(let yy=0;yy<s.h;yy++)for(let xx=0;xx<s.w;xx++){
    const i=(yy*s.w+xx)*4,a=s.data[i+3]/255*alpha;
    if(a<.025)continue;
    if(reflection){const ry=Math.round(y+(s.by-yy)*.25);if(ry<y||ry>y+13||ry%3===0)continue;px(left+xx+(ry%3),ry,[s.data[i]*.45,s.data[i+1]*.6,s.data[i+2]*.7],a*.22);}
    else px(left+xx,top+yy,[s.data[i],s.data[i+1],s.data[i+2]],a);
  }
}
const font={
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['111','010','010','010','010','010','111'],L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['010','110','010','010','010','010','111'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],'9':['01110','10001','10001','01111','00001','00001','01110'],
 '/':['00001','00010','00010','00100','01000','01000','10000'],'-':['000','000','000','111','000','000','000'],
 ':':['0','1','0','0','1','0','0'],'.':['0','0','0','0','0','0','1'],
};
function text(s,x,y,color=[151,205,214]){for(const ch of s){if(ch===' '){x+=4;continue;}const g=font[ch];if(!g){x+=6;continue;}g.forEach((r,dy)=>[...r].forEach((v,dx)=>{if(v==='1'){px(x+dx+1,y+dy+1,[0,2,7],.85);px(x+dx,y+dy,color);}}));x+=g[0].length+1;}}
function progress(t,a,b){return Math.max(0,Math.min(1,(t-a)/(b-a)));}
function particles(t,start,x,y,color){const age=t-start;if(age<0||age>.9)return;sparks.forEach(s=>{if(age>s.l)return;const xx=x+Math.cos(s.a)*s.v*age,yy=y+Math.sin(s.a)*s.v*age+age*age*28;line(xx,yy,xx-Math.cos(s.a)*2,yy-Math.sin(s.a)*2,color,(1-age/s.l)*.95);});}
const raw = Buffer.alloc(W*H*3*FRAMES);
for(let f=0;f<FRAMES;f++){
  const t=f/FPS;
  frame=raw.subarray(f*W*H*3,(f+1)*W*H*3);
  const hit=Math.max(0,1-Math.abs(t-1.28)/.10),shot=Math.max(0,1-Math.abs(t-1.86)/.08);
  const shake=hit>.1 ? (f%2?1:-1) : 0;
  const camera=Math.round(t/3*3)+shake;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const bi=(y*(W+4)+Math.max(0,Math.min(W+3,x+camera)))*4,i=(y*W+x)*3;for(let k=0;k<3;k++)frame[i+k]=bg[bi+k];}
  // Moving distant spinner, dithered searchlight, and animated neon.
  const ship=260-t*33, sy=78+Math.sin(t*2)*2;
  for(let yy=0;yy<47;yy++)for(let xx=-yy*.18;xx<yy*.18;xx++)if((Math.round(xx)+yy+f)%3===0)px(ship+xx,sy+yy,[73,122,144],.11);
  rect(ship-8,sy,16,2,[7,18,26]);rect(ship-4,sy-2,8,2,[18,36,47]);px(ship-6,sy+1,[237,98,44]);px(ship+6,sy+1,[107,226,233]);
  glow(62,61,26,[224,70,25],.05+.03*Math.sin(t*12));
  if((f>17&&f<20)||(f>64&&f<67))rect(239-camera,44,30,86,[4,11,17],.43);
  rain.filter(r=>r.z<.6).forEach(r=>{const y=(r.y+t*(60+80*r.z))%195;const x=(r.x-t*21+360)%360-20;line(x,y,x-1,y+3,[75,121,149],.33);});
  const heroX=116+progress(t,.45,1.23)*34;
  const heroCel=t<.8?0:t<1.17?1:t<1.43?2:t<1.78?3:0;
  const vampX=212-progress(t,0,1.19)*25+progress(t,1.28,1.60)*13;
  const vampCel=t<.82?0:t<1.28?1:t<1.57?2:3;
  const vampAlpha=t<1.85?1:1-progress(t,1.85,2.3);
  const hunterX=60+progress(t,0,.65)*7;
  const hunterCel=t<.58?0:t<1.83?1:t<1.96?2:t<2.14?3:1;
  const replX=282-progress(t,.25,1.79)*17+progress(t,1.87,2.05)*5;
  const replCel=t<.5?0:t<1.87?1:t<2.2?2:3;
  const characters=[[1,hunterCel,hunterX,171,1],[3,replCel,replX,171,1],[2,vampCel,vampX,175,vampAlpha],[0,heroCel,heroX,175,1]];
  characters.forEach(a=>sprite(...a,true));
  // Rain splashes catch the wet horizontal platform.
  for(let i=0;i<19;i++){const x=(i*47+f*7)%320,y=171+(i%5);if((i+f)%3===0){line(x-2,y,x,y-1,[85,144,161],.35);line(x,y-1,x+2,y,[85,144,161],.35);}}
  characters.forEach(a=>{rect(a[2]-13,a[3]-1,27,2,[1,5,9],.45);sprite(...a);});
  if(hit>0){glow(190,145,28,[131,237,255],hit*.8);line(177,151,201,132,[223,254,255],hit);}
  if(shot>0){line(95,133,259,132,[250,219,116],shot);glow(96,133,18,[255,165,53],shot*.9);glow(264,138,21,[73,214,255],shot*.75);}
  particles(t,1.28,192,145,[255,149,58]);particles(t,1.87,264,140,[99,221,255]);
  if(t>1.6&&t<2.65){sparks.slice(0,24).forEach(s=>{const age=t-1.6;px(199+Math.sin(s.a)*s.v*age,170-s.v*age,[243,92,27],Math.max(0,(1-age)*.7));});}
  fog.forEach(p=>{const x=(p.x+t*8)%320,y=177-p.y+Math.sin(t*2+p.p)*2;line(x,y,x+4,y,[91,129,148],.075);});
  rain.filter(r=>r.z>=.6).forEach(r=>{const y=(r.y+t*(95+95*r.z))%240-10,x=(r.x-t*29+360)%360-20;line(x,y,x-2,y+5,[118,175,198],.22+r.z*.23);});
  if(hit>.55||shot>.65)rect(0,0,W,H,[111,189,218],.04);
  // Small game HUD; scene remains visible for all three seconds.
  rect(0,0,W,23,[3,8,17],.82);line(0,22,319,22,[32,61,76],.8);
  text('BLADE',8,5,[216,231,231]);for(let i=0;i<12;i++)rect(8+i*4,15,3,3,[178,35,61]);
  text('SECTOR 09',119,8,[111,170,182]);text('HUNTER',259,5,[216,231,231]);for(let i=0;i<12;i++)rect(263+i*4,15,3,3,[52,137,161]);
  rect(0,210,W,14,[3,8,17],.85);text('VAMPIRE',8,214,[230,113,83]);text(t<1.65?'01':'00',56,214,[240,173,127]);
  text('REPLICANT',213,214,[118,175,199]);text(t<2.20?'01':'00',275,214,[171,222,231]);
  // Subtle edge shading; no blur or interpolation of the pixel artwork.
  for(let y=24;y<210;y++)for(let x=0;x<W;x++){const edge=Math.max(Math.abs(x-160)/160,Math.abs(y-118)/118);if(edge>.76)px(x,y,[0,3,9],(edge-.76)*.35);}
}
writeFileSync(join(dir,'frames.rgb'),raw);

// Original synthesized FM-like drone, rainfall, bass pulse, sword and blaster effects.
const SR=48000,N=SR*3,wav=Buffer.alloc(44+N*4);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(N*4,40);
let filtered=0;
for(let i=0;i<N;i++){
  const t=i/SR,noise=rand()*2-1;filtered=filtered*.94+noise*.06;
  const envelope=Math.min(1,t/.08)*Math.min(1,(3-t)/.10);
  const chord=[55,82.4069,110,130.8128,164.8138].reduce((sum,h,j)=>sum+Math.sin(2*Math.PI*h*t+Math.sin(2*Math.PI*h*1.002*t)*(.2+j*.045))/(1+j*.9),0)*.105;
  const pulse=Math.exp(-(t%.5)*18)*Math.sin(2*Math.PI*55*t)*.15;
  const slashAge=t-1.16,shotAge=t-1.84;
  const slash=slashAge>0&&slashAge<.28 ? (noise*.26+Math.sin(2*Math.PI*(1400*slashAge-1800*slashAge*slashAge))*.13)*Math.sin(slashAge/.28*Math.PI):0;
  const blast=shotAge>0&&shotAge<.40 ? (noise*.34+Math.sin(2*Math.PI*(145*shotAge-95*shotAge*shotAge))*.33)*Math.exp(-shotAge*16):0;
  const impact=t>1.28&&t<1.5?filtered*.9*Math.exp(-(t-1.28)*16):0;
  const common=(chord+pulse+slash+blast+impact+filtered*.14)*envelope;
  for(let c=0;c<2;c++){
    const stereo=common+Math.sin(2*Math.PI*(220+c*.7)*t)*.018*envelope+noise*.012;
    wav.writeInt16LE(Math.round(Math.tanh(stereo*1.2)*26000),44+i*4+c*2);
  }
}
writeFileSync(join(dir,'soundtrack.wav'),wav);
const output=join(dir,'blade-runner-genesis-3s.mp4');
run(['-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${W}x${H}`,'-r',String(FPS),'-i',join(dir,'frames.rgb'),'-i',join(dir,'soundtrack.wav'),'-vf','scale=1280:896:flags=neighbor','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','3','-movflags','+faststart',output]);
run(['-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${W}x${H}`,'-r',String(FPS),'-i',join(dir,'frames.rgb'),'-vf',"select='eq(n,3)+eq(n,35)+eq(n,40)+eq(n,57)+eq(n,68)+eq(n,84)',scale=640:448:flags=neighbor,tile=3x2",'-frames:v','1',join(dir,'contact-sheet.png')]);
run(['-y','-ss','1.3','-i',output,'-frames:v','1',join(dir,'poster.png')]);
unlinkSync(join(dir,'frames.rgb'));
console.log(JSON.stringify({output,duration:3,fps:FPS,frames:FRAMES,width:1280,height:896,bytes:readFileSync(output).length}));
