const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const cases = [
  { id: 'em-sines', midi: [52, 55, 59], expected: 'Em' },
  { id: 'g-sines', midi: [55, 59, 62], expected: 'G' },
  { id: 'c-sines', midi: [60, 64, 67], expected: 'C' },
  { id: 'em-open-voicing-sines', midi: [40, 47, 52, 55, 59, 64], expected: 'Em' },
  { id: 'g-open-voicing-sines', midi: [43, 47, 50, 55, 59, 67], expected: 'G' },
  { id: 'c-open-voicing-sines', midi: [48, 52, 55, 60, 64], expected: 'C' },
  { id: 'shared-tones', midi: [55, 59], expected: null },
  { id: 'single-note', midi: [60], expected: null },
  { id: 'unsupported-f', midi: [53, 57, 60], expected: null },
  { id: 'silence', midi: [], expected: null },
];
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
      let failures = 0;
      for (const sampleRate of [44100, 48000]) {
        for (const fixture of cases) {
          const result = await page.evaluate(async ({ sampleRate, fixture }) => {
            const NativeContext = window.AudioContext;
            const originalAcquire = navigator.mediaDevices.getUserMedia;
            window.AudioContext = class extends NativeContext { constructor() { super({ sampleRate }); } };
            const source = new NativeContext({ sampleRate });
            const target = source.createMediaStreamDestination();
            const oscillators = fixture.midi.map((note) => {
              const oscillator = source.createOscillator();
              oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
              const gain = source.createGain(); gain.gain.value = 0.1;
              oscillator.connect(gain).connect(target); oscillator.start();
              return oscillator;
            });
            navigator.mediaDevices.getUserMedia = async () => target.stream;
            const { mic, content } = await import('/src/lib.js');
            const { analyzeChord } = await import('/src/chordRecognition.js');
            try {
              await source.resume();
              if (!(await mic.start())) throw new Error('synthetic stream could not start');
              await new Promise((resolve) => setTimeout(resolve, 600));
              return { ...analyzeChord(mic.chroma(), content.chordNotes), level: mic.level() };
            } finally {
              mic.stop(); oscillators.forEach((oscillator) => oscillator.stop());
              target.stream.getTracks().forEach((track) => track.stop());
              await source.close();
              navigator.mediaDevices.getUserMedia = originalAcquire;
              window.AudioContext = NativeContext;
            }
          }, { sampleRate, fixture });
          const pass = result.chord === fixture.expected;
          console.log(`${pass ? 'PASS' : 'FAIL'} ${sampleRate}Hz ${fixture.id}: ${result.chord}, ${result.reason}, support=${result.support.toFixed(3)}, margin=${result.margin.toFixed(3)}`);
          if (!pass) failures += 1;
        }
      }
      assert.equal(failures, 0, 'synthetic oscillator → MediaStream → app FFT → classifier');
      console.log(`PASS ${cases.length * 2} generated-audio pipeline cases; not guitar recordings or device accuracy evidence`);
      await page.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
