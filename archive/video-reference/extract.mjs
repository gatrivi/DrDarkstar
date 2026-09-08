import { chromium } from 'file:///C:/Users/DevTrivi/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/DevTrivi/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
const page = await browser.newPage();
await page.goto('http://localhost:8080');
const names = ['VID-20220203-WA0004', 'VID-20220203-WA0035', 'VID-20220203-WA0037', 'VID-20220203-WA0040'];
try {
  for (const name of names) {
    const result = await page.evaluate(async name => {
      const video = document.createElement('video');
      video.muted = true; video.preload = 'auto';
      video.src = '/' + name + '.mp4';
      await new Promise((resolve,reject) => {
        video.onloadeddata = resolve; video.onerror = () => reject(new Error('Video decode failed'));
        setTimeout(() => reject(new Error('Video load timeout')), 20000);
      });
      const w = 480, h = Math.round(w * video.videoHeight / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = w * 3; canvas.height = (h + 28) * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#121212'; ctx.fillRect(0,0,canvas.width,canvas.height);
      const times = [0.05,0.2,0.4,0.6,0.8,0.95].map(f => f * video.duration);
      for (let i=0; i<times.length; i++) {
        await new Promise(resolve => { video.onseeked = resolve; video.currentTime = times[i]; });
        const x = (i % 3) * w, y = Math.floor(i / 3) * (h + 28);
        ctx.drawImage(video,x,y,w,h);
        ctx.fillStyle = '#ffffff'; ctx.font = '15px monospace'; ctx.fillText(times[i].toFixed(2) + ' s', x+10,y+h+20);
      }
      const metadata = { name, duration:video.duration, width:video.videoWidth, height:video.videoHeight, times };
      video.removeAttribute('src'); video.load();
      return { metadata, data:canvas.toDataURL('image/png').split(',')[1] };
    }, name);
    await writeFile('archive/video-reference/' + name + '.png', Buffer.from(result.data, 'base64'));
    await writeFile('archive/video-reference/' + name + '.json', JSON.stringify(result.metadata,null,2));
    console.log(JSON.stringify(result.metadata));
  }
} finally { await browser.close(); }


