const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
class Element {
  constructor() { this.handlers = {}; this.value = '1'; this.clientWidth = 320; this.clientHeight = 80; this.attributes = {}; this.classList = { toggle() {} }; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() {}
  getContext() { return new Proxy({}, { get: () => () => {} }); }
}
class Audio extends Element {
  constructor() { super(); this.paused = true; }
  load() {}
  pause() { this.paused = true; }
  async play() { this.paused = false; }
}
function buffer(samples, channels = 1, rate = 4) {
  const data = Array.from({length: channels}, () => Float32Array.from(samples));
  return { numberOfChannels: channels, length: samples.length, sampleRate: rate, duration: samples.length / rate, getChannelData: c => data[c] };
}
class AudioContext {
  createBuffer(ch, len, rate) { return buffer(Array(len).fill(0), ch, rate); }
  decodeAudioData(bytes, resolve) { if (decodeFails) return Promise.reject(Error('invalid audio')); const b = decoded; resolve(b); return Promise.resolve(b); }
}
let decoded, decodeFails = false;
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
const steps = Array.from({length:4}, () => new Element());
const sandbox = vm.createContext({ console, Blob, URL, Float32Array, ArrayBuffer, DataView, Audio, window: { AudioContext, devicePixelRatio: 1 }, document: { getElementById: id => elements[id], querySelectorAll: () => steps }, navigator: {}, getComputedStyle: () => ({getPropertyValue: () => '#000'}), addEventListener() {}, matchMedia: () => ({addEventListener() {}}), cancelAnimationFrame() {}, requestAnimationFrame: () => 1 });
vm.runInContext(html.split('<script>')[1].split('</script>')[0], sandbox);
const run = code => vm.runInContext(code, sandbox);
const click = id => elements[id].handlers.click();
const load = async samples => { decoded = buffer(samples); await run('load(new Blob(["audio"]))'); };
(async () => {
  assert.equal(run('game.active'), true);
  assert.equal(elements.trackA.hidden, true);
  await load([0.1, 0.2, 0.3, 0.4]);
  assert.equal(run('game.step'), 1);
  assert.equal(elements.gameNext.disabled, true);
  assert.deepEqual(Array.from(run('reversed.getChannelData(0)')), Array.from(Float32Array.from([0.4,0.3,0.2,0.1])));
  click('gameNext'); assert.equal(run('game.step'), 1, 'cannot skip listening');
  run('players.B.handlers.ended()');
  assert.equal(elements.gameNext.disabled, false);
  const source = run('game.source'); const sourceUrl = run('players.C.src');
  click('gameNext'); assert.equal(run('game.step'), 2);
  assert.equal(elements.recorderPanel.hidden, false);
  decodeFails = true; await load([]); decodeFails = false;
  assert.equal(run('game.step'), 2, 'invalid audio must not advance');
  assert.equal(run('busy'), false);
  await load([0.8, 0.6, 0.4, 0.2]);
  assert.equal(run('game.step'), 3);
  assert.equal(run('game.source'), source, 'imitation preserves source buffer');
  assert.equal(run('players.C.src'), sourceUrl, 'comparison retains first recording');
  assert.equal(elements.trackB.hidden, true, 'result stays hidden until reveal');
  click('gameReveal'); assert.equal(elements.trackB.hidden, false);
  assert.equal(elements.compareSource.hidden, false);
  click('compareSource'); await Promise.resolve();
  assert.equal(run('players.B.paused'), true, 'comparison stops result playback');
  decoded = source; click('gameRetry'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(run('game.step'), 1);
  assert.equal(run('game.source'), source);
  assert.equal(elements.status.textContent.includes('Ses işleniyor'), false);
  click('gameReset'); assert.equal(run('game.step'), 0);
  assert.equal(run('game.source'), null);
  click('freeMode'); assert.equal(elements.gamePanel.hidden, true);
  await load([0.2,0.4]); assert.equal(elements.trackA.hidden, false);
  click('gameMode'); assert.equal(run('game.active'), true);
  assert.equal(elements.trackB.hidden, true);
  console.log('PASS: reversal, listening gate, separate recordings, reveal, comparison, retry, reset, invalid audio and free mode');
})().catch(error => { console.error(error); process.exitCode = 1; });
