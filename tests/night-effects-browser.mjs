import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:8080/night.html');
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.locator('#start').click();
  await page.evaluate(async()=>{window.nightEffects=await import('/src/night.js');window.nightEffects.loop.stop();});
  for(const pose of ['throw','blade-block','deckard-block']){
    const result=await page.evaluate(async pose=>{
      const {stage,input,loop}=window.nightEffects;
      const {NIGHT_MOVES}=await import('/src/game/night/Combat.js');
      stage.kind=pose==='deckard-block'?'deckard':'blade';stage.reset();stage.player.x=360;
      stage.enemies.forEach((e,i)=>{e.x=710+i*90;e.cooldown=999;});stage.driveEnemy=()=>{};
      input.down.clear();input.pressed.clear();
      const ctx=document.querySelector('#night-game').getContext('2d');
      const tick=()=>{loop.update(1/60);stage.render(ctx);};
      for(let i=0;i<12;i++)tick();
      const code=pose==='throw'?'KeyL':'KeyE';input.down.add(code);input.pressed.add(code);
      for(let i=0;i<11;i++)tick();
      if(pose!=='throw'){
        stage.enemies[0].facing=-1;stage.hit(stage.enemies[0],stage.player,NIGHT_MOVES.claw);tick();
      }
      const expectedFrame=pose==='throw'?7:11;
      const frame=stage.player.frame;
      const pixels=stage.atlas.shuriken.getContext('2d').getImageData(0,0,20,20).data;
      let opaque=0,transparent=0;
      for(let i=3;i<pixels.length;i+=4){if(pixels[i]>24)opaque++;else transparent++;}
      const sourceFrame=stage.worldRain.field.frame,rainTime=stage.worldRain.rain.time;
      stage.state='paused';for(let i=0;i<5;i++)tick();
      const paused=stage.worldRain.field.frame===sourceFrame && stage.worldRain.rain.time===rainTime;
      stage.state='playing';loop.update(0);stage.render(ctx);
      return {frame,expectedFrame,opaque,transparent,paused,guard:stage.player.guard,blocks:stage.stats.blocks,projectile:stage.projectiles[0]?.kind,rainSamples:stage.worldRain.rain.hits};
    },pose);
    assert.equal(result.frame,result.expectedFrame,`${pose} correct generated frame`);
    assert.ok(result.opaque>20 && result.transparent>80,'weapon sprite has an actual transparent silhouette');
    assert.ok(result.paused,'pause also freezes full-scene rain');
    if(pose==='throw')assert.equal(result.projectile,'shuriken');else assert.equal(result.blocks,1);
    await page.locator('#night-game').screenshot({path:`output/night-hunters/${pose}.png`});
  }
  const metrics={};
  for(const mode of ['world','classic']){
    metrics[mode]=await page.evaluate(async mode=>{
      const {stage,input,loop}=window.nightEffects;
      stage.reset();stage.worldRainEnabled=mode==='world';stage.driveEnemy=()=>{};
      input.down.clear();input.pressed.clear();
      await new Promise(resolve=>setTimeout(resolve,100));loop.start();
      const times=[];
      await new Promise(resolve=>{
        let warmup=10;
        const frame=t=>{if(warmup>0)warmup--;else times.push(t);if(times.length<46)requestAnimationFrame(frame);else resolve();};
        requestAnimationFrame(frame);
      });
      loop.stop();
      const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
      return {fps:Math.round((times.length-1)*1000/(times.at(-1)-times[0])),medianFrameMs:Math.round(intervals[Math.floor(intervals.length/2)]*10)/10};
    },mode);
  }
  assert.deepEqual(errors,[]);
  await writeFile('output/night-hunters/effects-verification.json',JSON.stringify({metrics,errors},null,2));
  console.log(JSON.stringify({metrics,errors},null,2));
}finally{await browser.close();}
