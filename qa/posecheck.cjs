// 자세 판정 모듈이 사진 속 사람을 실제로 찾는지 확인 (dist/_t/*.jpg)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const n = fs.readdirSync('dist/_t').length; const b = await chromium.launch(); const p = await b.newPage(); await p.goto('http://localhost:4173/');
  const res = await p.evaluate(async (n) => { await new Promise((r, j) => { const s = document.createElement('script'); s.src = '/pose/pose.js'; s.onload = r; s.onerror = j; document.head.appendChild(s); });
    const pose = new window.Pose({ locateFile: (f) => '/pose/' + f }); pose.setOptions({ modelComplexity: 0, staticImageMode: true }); let last = null; pose.onResults((r) => { last = r.poseLandmarks; }); await pose.initialize();
    const out = []; for (let i = 0; i < n; i++) { const im = new Image(); im.src = `/_t/${i}.jpg`; await im.decode(); last = null; await pose.send({ image: im });
      if (last) { const m = window.dingaPose.measure(last, 'left', im.naturalWidth, im.naturalHeight); out.push({ i, w: im.naturalWidth, h: im.naturalHeight, wrist: m.wrist && Math.round(m.wrist), tilt: m.tilt && Math.round(m.tilt), neck: m.neck && +m.neck.toFixed(2), bad: window.dingaPose.judge(m) }); } }
    return out; }, n);
  console.log(n, 'images;', res.length, 'with a body'); console.log(JSON.stringify(res)); await b.close(); })();
