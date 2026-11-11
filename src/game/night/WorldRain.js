import { CollisionRain } from '../../effects/CollisionRain.js';

// Adapt the entire rendered world to the same color/brightness sampler used by
// Dr Darkstar's invisible sprites. A shared palette avoids recomputing color
// and brightness for thousands of moving samples on every capture.
export class SceneField {
  constructor(width, height) {
    this.x=width/2;this.y=height/2;this.renderWidth=width;this.renderHeight=height;
    this.canvas=document.createElement('canvas');
    this.canvas.width=width/2;this.canvas.height=height/2;
    this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});
    this.ctx.imageSmoothingEnabled=false;
    this.palette=new Array(65536);this.frame=0;
    this.gamma=Uint8Array.from({length:256},(_,v)=>Math.round(255*(v/255)**.78));
  }
  capture(source) {
    // Read the software-rendered source directly when its dimensions match.
    // This avoids a GPU readback plus an extra canvas copy every frame.
    if(source.width===this.canvas.width && source.height===this.canvas.height){
      this.surface=source;
      this.data=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
    }else{
      this.ctx.drawImage(source,0,0,this.canvas.width,this.canvas.height);
      this.data=this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data;
      this.surface=this.canvas;
    }
    this.frame++;
  }
  sampleWorld(x,y) {
    if(!this.data||x<0||y<0||x>=this.renderWidth||y>=this.renderHeight)return null;
    const k=((y>>1)*this.canvas.width+(x>>1))*4,data=this.data;
    if(data[k+3]<24)return null;
    const key=((data[k+3]>>4)<<12)|((data[k]>>4)<<8)|((data[k+1]>>4)<<4)|(data[k+2]>>4);
    let pixel=this.palette[key];
    if(!pixel){
      const r=this.gamma[((key>>8)&15)*17],g=this.gamma[((key>>4)&15)*17],b=this.gamma[(key&15)*17];
      pixel=this.palette[key]={r,g,b,alpha:(key>>12)/15,brightness:Math.sqrt(.299*r*r+.587*g*g+.114*b*b)/255};
    }
    return pixel;
  }
}

export class WorldRain {
  constructor(width,height,count=12000,settings={}) {
    this.width=width;this.height=height;
    this.field=new SceneField(width,height);
    this.rain=new CollisionRain({width,height,actor:this.field,count,settings:{size:1.5,reveal:3.4,smoothing:12,drift:.8,...settings}});
    this.layer=document.createElement('canvas');this.layer.width=width/2;this.layer.height=height/2;
    this.ctx=this.layer.getContext('2d');
    this.image=this.ctx.createImageData(this.layer.width,this.layer.height);
    this.pixels=this.image.data;
    this.reset();
  }
  reset(){this.lastFrame=-1;this.warm=true;this.pixels.fill(0);this.ctx.clearRect(0,0,this.layer.width,this.layer.height);}
  step(source,delta,audio,frame) {
    if(this.lastFrame===frame)return;
    this.lastFrame=frame;this.field.capture(source);
    const passes=this.warm?5:1;this.warm=false;
    for(let pass=0;pass<passes;pass++){
      const dt=passes>1?1/30:delta;
      this.rain.update(dt,audio);
      const pixels=this.pixels,decay=Math.exp(-dt*9),width=this.layer.width,height=this.layer.height;
      for(let k=3;k<pixels.length;k+=4)pixels[k]=Math.floor(pixels[k]*decay);
      // Rasterize into one reusable RGBA buffer. A single putImageData replaces
      // tens of thousands of per-frame Canvas fillStyle/fillRect calls.
      for(const drop of this.rain.drops){
        const p=drop.pixel;if(!p)continue;
        const light=Math.min(1,(.17+p.brightness*.75)*drop.intensity*p.alpha);
        const a=Math.min(15,Math.round(light*15));if(a===0)continue;
        const r=Math.min(255,Math.round(p.r/17)*17),g=Math.min(255,Math.round(p.g/17)*17),b=Math.min(255,Math.round(p.b/17)*17);
        const alpha=a*17,remaining=1-a/15;
        const size=Math.max(1,Math.round(drop.size*1.1));
        const x=Math.floor(drop.x/2),y=Math.floor(drop.y/2),bottom=Math.min(height,y+Math.min(4,size+Math.round(drop.vy*dt*.15)));
        for(let yy=Math.max(0,y);yy<bottom;yy++)for(let xx=Math.max(0,x);xx<Math.min(width,x+size);xx++){
          const k=(yy*width+xx)*4,outAlpha=alpha+pixels[k+3]*remaining,weight=alpha/outAlpha;
          pixels[k]+=(r-pixels[k])*weight;pixels[k+1]+=(g-pixels[k+1])*weight;pixels[k+2]+=(b-pixels[k+2])*weight;
          pixels[k+3]=outAlpha;
        }
      }
    }
    this.ctx.putImageData(this.image,0,0);
  }
  draw(ctx) {
    ctx.fillStyle='#030811';ctx.fillRect(0,0,this.width,this.height);
    // A faint reference retains the street's silhouette between passing drops.
    ctx.globalAlpha=.16;ctx.drawImage(this.field.surface,0,0,this.width,this.height);
    ctx.globalAlpha=1;ctx.drawImage(this.layer,0,0,this.width,this.height);
  }
}
