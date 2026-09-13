import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE || 'C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = process.env.NIGHT_CDP
  ? await chromium.connectOverCDP(process.env.NIGHT_CDP)
  : await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const context = browser.contexts()[0] || await browser.newContext();
const page = context.pages()[0] || await context.newPage();
const errors = [], failedResources = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)failedResources.push(`${response.status()} ${response.url()}`);});
await mkdir('output/night-hunters',{recursive:true});
try {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:8080'}/games.html`);
  await page.getByRole('link',{name:/003.*NIGHT SHIFT/}).click();
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.screenshot({path:'output/night-hunters/briefing.png',fullPage:true});
  await page.evaluate(async()=>{ window.nightTest = await import('/src/night.js'); });
  await page.locator('#start').click();
  const startX = await page.evaluate(()=>window.nightTest.stage.player.x);
  await page.keyboard.down('d'); await page.waitForTimeout(230); await page.keyboard.up('d');
  assert.ok(await page.evaluate(x=>window.nightTest.stage.player.x>x+25,startX),'real keyboard moves Blade');
  const standingY = await page.evaluate(()=>window.nightTest.stage.player.y);
  await page.keyboard.press('Space');await page.waitForTimeout(130);
  assert.ok(await page.evaluate(y=>window.nightTest.stage.player.y<y-20,standingY),'real keyboard jumps');

  const result = await page.evaluate(async()=>{
    const { stage, input, loop } = window.nightTest;
    const { NIGHT_MOVES } = await import('/src/game/night/Combat.js');
    const results = [];
    function check(value,name){if(!value)throw new Error(name);results.push(name);}
    const driveEnemy = stage.driveEnemy;
    const silent={bass:0,mid:0,treble:0,effect:0};
    loop.stop();
    function key(code,down=true){window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));}
    function tick(n=1){for(let i=0;i<n;i++)loop.update(1/60);}
    function reset(kind='blade'){
      stage.kind=kind;stage.reset();input.down.clear();input.pressed.clear();
      stage.driveEnemy=()=>{};stage.enemies.forEach(e=>{e.cooldown=999;e.vx=0;});
      document.querySelector('#night-game').focus();tick();
    }
    reset();
    const y=stage.player.y;
    key('Space');tick();key('Space',false);tick(9);key('Space');tick();key('Space',false);
    check(stage.player.y<y && stage.player.jumpsLeft===0,'double-jump uses both jumps');
    const beforeThird=stage.player.vy;key('Space');tick();key('Space',false);
    check(stage.player.vy>beforeThird,'third jump is rejected');tick(100);
    check(stage.player.onGround && stage.player.jumpsLeft===2,'landing restores jumps');

    const rollX=stage.player.x;key('ShiftLeft');tick();
    check(stage.player.action?.name==='roll','roll starts from Shift');
    check(!stage.hit(stage.enemies[0],stage.player,NIGHT_MOVES.claw),'roll dodges damage');
    key('ShiftLeft',false);tick(25);
    check(stage.player.x>rollX+90,'roll moves the hunter');

    reset();let enemy=stage.enemies[0];enemy.x=stage.player.x+70;
    key('KeyK');tick(45);const charge=stage.player.action?.charge;
    check(charge>.65,'holding K charges the attack');key('KeyK',false);tick();
    check(stage.player.action?.name==='golfswing','releasing K starts the heavy attack');tick(9);
    check(enemy.percent>33,'charged sword connects');
    const damage=enemy.percent;
    enemy.x=stage.player.x+70;enemy.vx=0;enemy.invulnerable=0;tick(4);
    check(enemy.percent===damage,'one swing cannot repeatedly damage the same target');

    // Duck under a bolt: hold S, the crouched hurtbox drops below the bolt line.
    reset();enemy=stage.enemies[0];enemy.x=stage.player.x+260;enemy.facing=-1;
    key('KeyS');tick(3);
    check(stage.player.crouching===true,'holding S crouches on the ground');
    const standTop=stage.player.feet-99,duckTop=stage.player.feet-57;
    check(duckTop>standTop,'crouched hunter ducks under the standing chest line');
    const boltY=standTop+20;
    stage.projectiles.push({x:enemy.x,y:boltY,vx:-330,vy:0,owner:enemy,direction:-1,
      move:NIGHT_MOVES.enemyShot,charge:0,kind:'bolt',angle:0,cos:1,sin:0,life:1.2,color:'#ff727b'});
    tick(30);
    check(stage.player.percent===0,'angled bolt at chest height misses the duck');key('KeyS',false);

    // Rooftop demo: toggling the layout and landing on a one-way ledge.
    reset();stage.setLayout('rooftops');
    check(stage.layout==='rooftops' && stage.ledges.length>=4,'rooftop layout activates');
    const ledge=stage.ledges.find(l=>l.y===366);
    stage.player.x=(ledge.x0+ledge.x1)/2;stage.player.y=ledge.y-stage.player.renderHeight/2-120;
    stage.player.vx=0;stage.player.vy=0;stage.player.onGround=false;tick(40);
    check(stage.player.onGround && Math.abs(stage.player.feet-ledge.y)<1,'hunter lands on a rooftop ledge');
    // Jumping from below passes through the one-way slab.
    stage.player.y=ledge.y+80;stage.player.vy=-700;stage.player.onGround=false;tick(2);
    check(stage.player.y<ledge.y+80,'jumping up through the ledge is not blocked');
    stage.setLayout('street');
    check(stage.layout==='street' && stage.ledges.length===0,'street layout clears ledges');

    reset();enemy=stage.enemies[0];enemy.x=stage.player.x+65;
    key('KeyJ');tick(12);key('KeyJ',false);
    check(enemy.percent===15,'Blade primary is a melee sword hit');
    check(stage.rains[0].hits>0 && stage.rains[0].drops.some(d=>d.pixel),'rain samples actual character pixels');

    reset();enemy=stage.enemies[0];enemy.x=stage.player.x+190;
    key('KeyL');tick();check(stage.player.frame===6,'throw starts with the shuriken windup sprite');
    tick(9);check(stage.player.frame===7,'throw shows its release sprite');
    check(stage.projectiles[0]?.kind==='shuriken' && stage.projectiles[0].angle!==0,'Blade throws a spinning shuriken');
    check(stage.projectiles[0].rain.drops.some(d=>d.pixel),'flying shuriken has its own rotating rain silhouette');
    tick(8);check(stage.player.frame===8,'throw follows through');tick(12);key('KeyL',false);
    check(enemy.percent===14,'Blade ranged shuriken connects');

    reset();enemy=stage.enemies[0];enemy.x=stage.player.x+65;enemy.facing=-1;
    key('KeyE');tick();check(stage.player.frame===9,'Blade raises his guard');tick(8);
    check(stage.player.frame===10 && stage.player.action?.name==='block','holding E maintains the sword guard');
    stage.hit(enemy,stage.player,NIGHT_MOVES.claw);tick();
    check(stage.player.percent===0 && stage.stats.blocks===1 && stage.player.frame===11,'front attack triggers the block impact sprite');
    const guardAfterHit=stage.player.guard;
    key('KeyE',false);tick(80);
    check(stage.player.action===null && stage.player.guard>guardAfterHit,'releasing block recovers guard');
    key('KeyE');tick(9);stage.player.guard=8;stage.hit(enemy,stage.player,NIGHT_MOVES.claw);tick();
    check(stage.player.guardBroken>0 && stage.player.action===null,'depleted guard breaks');key('KeyE',false);
    reset('deckard');key('KeyE');tick(9);
    check(stage.player.frame===10 && stage.player.action?.name==='block','Deckard has his own shield animation');
    stage.enemies[0].facing=1;stage.hit(stage.enemies[0],stage.player,NIGHT_MOVES.claw);tick();
    check(stage.player.percent>0,'guard is vulnerable from behind');key('KeyE',false);

    reset();stage.render(document.querySelector('#night-game').getContext('2d'));
    check(stage.worldRainEnabled && stage.worldRain.rain.hits>10000,'full-scene rain samples the rendered city');
    const guardBeforeToggle=stage.player.guard,positionBeforeToggle=stage.player.x;
    document.querySelector('#particles').click();
    check(!stage.worldRainEnabled && stage.player.guard===guardBeforeToggle && stage.player.x===positionBeforeToggle,'World Rain comparison preserves gameplay');
    document.querySelector('#particles').click();
    check(stage.worldRainEnabled,'World Rain toggles back on');

    reset();stage.player.percent=37;stage.player.stocks=2;const swapX=stage.player.x;
    document.querySelector('.hunter-tabs [data-hunter="deckard"]').click();
    check(stage.player.kind==='deckard' && stage.player.x===swapX && stage.player.percent===37 && stage.player.stocks===2,'switch keeps position, damage and lives');
    enemy=stage.enemies[0];enemy.x=stage.player.x+200;
    key('KeyJ');tick(32);key('KeyJ',false);
    check(enemy.percent===14 && stage.stats.shots===1,'Deckard primary fires a working blaster');
    reset('deckard');stage.player.x=470;stage.player.facing=-1;enemy=stage.enemies[0];enemy.x=270;
    key('KeyJ');tick(32);key('KeyJ',false);
    check(enemy.percent===14,'blaster fires left after facing changes');
    reset('deckard');enemy=stage.enemies[0];enemy.x=stage.player.x+220;
    key('KeyK');tick(55);key('KeyK',false);tick(38);
    check(enemy.percent>38,'Deckard charged blaster connects at range');

    reset();key('KeyP');tick();key('KeyP',false);const pausedAt=stage.time;tick(25);
    check(stage.state==='paused' && stage.time===pausedAt,'pause freezes simulation');
    key('KeyP');tick();key('KeyP',false);
    check(stage.state==='playing','P resumes');
    document.querySelector('#pause').click();key('KeyP');tick();key('KeyP',false);
    check(stage.state==='playing','keyboard can resume after clicking Pause');

    reset();stage.driveEnemy=driveEnemy;stage.enemies.forEach(e=>{e.cooldown=.3;});
    tick(340);
    check(stage.player.percent>0 || stage.player.stocks<3,'enemy AI attacks and damages the player');
    check(stage.stats.shots>0,'replicant AI fires projectiles');

    reset('deckard');
    // Complete the actual encounter through primary-fire inputs. Enemy movement
    // is frozen for a deterministic aim fixture; damage and wave logic are live.
    for(let wave=0;wave<2;wave++){
      for(const target of [...stage.enemies]){
        stage.player.x=target.x-150;stage.player.y=stage.platform.y-stage.player.renderHeight/2;
        stage.player.facing=1;stage.player.vx=stage.player.vy=0;stage.player.onGround=true;
        for(let attempt=0;attempt<8&&!target.dead;attempt++){
          stage.player.x=target.x-150;target.vx=0;target.vy=0;target.y=stage.platform.y-target.renderHeight/2;
          key('KeyJ');tick(40);key('KeyJ',false);tick();
        }
        check(target.dead,`primary fire defeats ${target.kind} in wave ${wave+1}`);
      }
      if(wave===0){
        tick(5);
        check(stage.state==='bounty' && !document.querySelector('#bounty-choose').hidden,'clearing wave one opens the bounty pick');
        check(stage.stats.score>0,'hits bank score before the bounty');
        document.querySelector('#bounty-choose [data-bounty="nightowl"]').click();tick(5);
        check(stage.wave===2 && stage.state==='playing' && stage.stats.bounty==='nightowl' && stage.enemies.every(e=>!e.dead),'bounty pick reloads wave two');
      }
    }
    check(stage.state==='won' && stage.stats.kills===6 && !document.querySelector('#overlay').hidden,'six eliminations finish the mission');
    document.querySelector('#start').click();loop.stop();stage.driveEnemy=()=>{};
    check(stage.player.stocks===3 && stage.stats.kills===0 && stage.wave===1,'hunt again resets the whole encounter');
    stage.player.stocks=1;stage.player.percent=149;stage.player.invulnerable=0;
    stage.hit(stage.enemies[0],stage.player,NIGHT_MOVES.claw);tick();
    check(stage.state==='lost' && document.querySelector('#start').textContent==='TRY AGAIN','last life produces the retry screen');
    document.querySelector('#choose [data-hunter="blade"]').click();
    check(stage.kind==='blade','retry screen can select a different hunter');
    document.querySelector('#start').click();loop.stop();
    check(stage.state==='playing' && stage.player.stocks===3,'retry is playable');
    stage.driveEnemy=driveEnemy;
    reset('blade');stage.player.x=350;stage.enemies[0].x=430;
    key('KeyK');tick(35);key('KeyK',false);tick(9);stage.render(document.querySelector('#night-game').getContext('2d'));
    return { checks:results, rainHits:stage.rains[0].hits };
  });
  await page.screenshot({path:'output/night-hunters/combat.png',fullPage:true});
  await writeFile('output/night-hunters/verification.json',JSON.stringify(result,null,2));

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const {stage,input,loop}=window.nightTest;stage.reset();input.down.clear();input.pressed.clear();loop.update(.016);stage.render(document.querySelector('canvas').getContext('2d'));});
  const mobileX=await page.evaluate(()=>window.nightTest.stage.player.x);
  const moveButton=await page.locator('[data-key="KeyD"]').boundingBox();
  await page.mouse.move(moveButton.x+moveButton.width/2,moveButton.y+moveButton.height/2);await page.mouse.down();
  await page.evaluate(()=>{for(let i=0;i<20;i++)window.nightTest.loop.update(1/60);});
  await page.mouse.up();
  assert.ok(await page.evaluate(x=>window.nightTest.stage.player.x>x+40,mobileX),'touch direction moves player');
  assert.ok(await page.evaluate(()=>!window.nightTest.input.down.has('KeyD')),'touch release clears movement');
  await page.screenshot({path:'output/night-hunters/mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal overflow');

  await page.setViewportSize({width:1280,height:720});
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  const enterBox=await page.locator('#start').boundingBox();
  assert.ok(enterBox.y>=0 && enterBox.y+enterBox.height<720,'laptop start button fits the screen');
  await page.screenshot({path:'output/night-hunters/laptop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const mobileStart=await page.locator('#start').boundingBox();
  assert.ok(mobileStart.y>=0 && mobileStart.y+mobileStart.height<844 && mobileStart.x>=0 && mobileStart.x+mobileStart.width<=390,'mobile briefing start button is fully visible');
  await page.screenshot({path:'output/night-hunters/mobile-briefing.png',fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(failedResources.length,0,failedResources.join('\n'));
  console.log(JSON.stringify({checks:result.checks.length+7,rainHits:result.rainHits,errors,failedResources},null,2));
} finally {
  await browser.close();
}
