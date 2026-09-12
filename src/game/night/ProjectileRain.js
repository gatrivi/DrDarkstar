import { CollisionRain } from '../../effects/CollisionRain.js';

// A compact focused stream preserves the throwing star's four points while it
// crosses the coarser world field. It samples the same rotating sprite mask.
export function shurikenRain(shot, samples, width, height) {
  const actor={
    get x(){return shot.x;},get y(){return shot.y;},renderWidth:34,renderHeight:34,
    sampleWorld(x,y){
      const dx=(x-shot.x)/1.2,dy=(y-shot.y)/1.2;
      const u=Math.floor(10+dx*shot.cos+dy*shot.sin),v=Math.floor(10-dx*shot.sin+dy*shot.cos);
      return u>=0&&v>=0&&u<20&&v<20 ? samples[v*20+u] : null;
    },
  };
  const rain=new CollisionRain({width,height,actor,count:550,focused:true,settings:{size:.9,reveal:3,smoothing:22,drift:.2}});
  rain.drops.forEach(drop=>{drop.intensity=1.5;});
  return rain;
}
