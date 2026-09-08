// Regression checks for the shell when a phone/browser cannot rotate.
// Run with Node.js; no browser or third-party dependencies required.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(process.argv[2] || new URL('../web/shell.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(value => value.includes('const query ='))
  .replace('$GODOT_CONFIG', '{"executable":"index","fileSizes":{"index.pck":234688}}');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };

function phone({ touch = true, nested = false, search = '', width = 390, height = 844, noEngine = false, missingFeatures = [], constructorFailure = false, pendingGame = false } = {}) {
  const size = { width, height };
  const elements = new Map();
  const events = new Map();
  const calls = { engines: 0, starts: 0, pauses: 0 };
  const timers = new Map();
  let nextTimer = 0;
  const make = id => {
    const element = {
      id, style: {}, hidden: false, disabled: true, children: [],
      get clientWidth() { return size.width; },
      get clientHeight() { return size.height; },
      appendChild(child) { this.children.push(child); elements.set(child.id, child); },
      remove() { this.removed = true; },
      focus() { this.focused = true; },
    };
    if (id === 'iframe') element.contentWindow = { skyforgePause() { calls.pauses++; } };
    return element;
  };
  for (const id of ['canvas', 'loading', 'tools', 'rotate', 'rotate-play', 'rotate-fullscreen', 'start', 'status', 'progress', 'retry', 'error', 'controls', 'fullscreen', 'share', 'copied']) elements.set(id, make(id));
  const document = {
    hidden: false, documentElement: {}, body: make('body'), head: make('head'),
    getElementById(id) { return elements.get(id); },
    createElement: make,
    addEventListener(name, fn) { events.set(name, fn); },
  };
  class Engine {
    static getMissingFeatures() { return missingFeatures; }
    constructor(config) {
      if (constructorFailure) throw new Error('Simulated initialization failure');
      calls.engines++; calls.config = config;
    }
    startGame(options) {
      calls.starts++; calls.startOptions = options;
      return pendingGame ? new Promise((resolve, reject) => { calls.resolve = resolve; calls.reject = reject; }) : Promise.resolve();
    }
  }
  const context = vm.createContext({ document, Engine, URL, URLSearchParams,
    navigator: { maxTouchPoints: touch ? 5 : 0 },
    location: new URL('https://example.com/skyforge-play/' + search),
    screen: {}, console: { error(error) { calls.error = error; } },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { events.set(name, fn); },
  });
  context.window = context;
  context.parent = nested ? {} : context;
  if (noEngine) delete context.Engine;
  vm.runInContext(script, context);
  return { context, document, elements, events, calls, size, timers };
}

const locked = phone();
check(locked.calls.engines === 0, 'Mobile host must not start a duplicate engine');
check(locked.elements.get('rotate').style.display === 'flex', 'Portrait entry offers a visible choice');
const frame = locked.elements.get('game-frame');
check(frame.style.width === '844px' && frame.style.height === '390px', 'Locked phone gives the game a landscape viewport');
check(frame.style.transform.includes('rotate(90deg)'), 'Locked phone rotates the whole embedded game');
const originalSrc = frame.src;
locked.elements.get('rotate-play').onclick();
check(locked.elements.get('rotate').style.display === 'none', 'Play works with both system APIs absent');
check(frame.focused, 'Input focus enters the game');
await locked.context.skyforgeFullscreen();
check(locked.elements.get('rotate').style.display === 'none', 'Unsupported fullscreen cannot re-block play');

for (const failAt of ['fullscreen', 'orientation']) {
  const denied = phone();
  denied.document.documentElement.requestFullscreen = () => failAt === 'fullscreen' ? Promise.reject(new Error('Denied')) : Promise.resolve();
  denied.context.screen.orientation = { lock: () => Promise.reject(new Error('Not supported')) };
  await denied.elements.get('rotate-fullscreen').onclick();
  check(denied.elements.get('rotate').style.display === 'none', `${failAt} rejection still reveals the game`);
}
const pending = phone();
pending.document.documentElement.requestFullscreen = () => new Promise(() => {});
pending.elements.get('rotate-fullscreen').onclick();
check(pending.elements.get('rotate').style.display === 'none', 'A hung fullscreen request does not trap the player');

locked.size.width = 844; locked.size.height = 390;
locked.events.get('resize')();
check(!frame.style.transform.includes('rotate'), 'Physical landscape removes the extra rotation');
check(locked.calls.pauses === 1, 'Changing orientation pauses active play');
locked.events.get('resize')();
check(locked.calls.pauses === 1, 'Same-orientation resizes do not repeatedly pause');
locked.size.width = 390; locked.size.height = 760;
locked.events.get('resize')();
check(frame.style.width === '760px' && frame.style.height === '390px', 'Browser toolbar/viewport dimensions are respected');
check(locked.elements.get('rotate').style.display === 'none', 'Returning to portrait preserves the chosen fallback');
check(frame.src === originalSrc, 'Rotation preserves the iframe and current game session');
locked.document.hidden = true;
locked.events.get('visibilitychange')();
check(locked.calls.pauses === 3, 'Backgrounding the page pauses the game');

const child = phone({ nested: true, search: '?touch=1&skyforge-frame=1' });
check(child.calls.starts === 1 && !child.elements.has('game-frame'), 'Embedded page starts exactly one game without recursion');
check(child.calls.config.args.includes('--touch'), 'Embedded game retains mobile controls');
check(child.calls.config.mainPack.startsWith('index.pck?v=') && child.calls.config.fileSizes[child.calls.config.mainPack] === child.calls.config.fileSizes['index.pck'], 'Game updates use a versioned pack URL with matching download progress size');
child.context.skyforgeSetPlaying(true);
check(child.elements.get('tools').style.display === 'none', 'Browser utilities cannot cover the mobile skill button during combat');
child.context.skyforgeSetPlaying(false);
check(child.elements.get('tools').style.display === 'flex', 'Pausing or opening a menu restores mobile share/fullscreen tools');
const desktop = phone({ touch: false, width: 1280, height: 720 });
check(desktop.calls.starts === 1 && !desktop.elements.has('game-frame'), 'Desktop keeps its direct canvas');
desktop.context.skyforgeSetPlaying(true);
check(desktop.elements.get('tools').style.display === 'flex', 'Desktop utilities remain available');
const sharedChildURL = phone({ search: '?touch=1&skyforge-frame=1' });
check(sharedChildURL.elements.has('game-frame'), 'Opening an embedded URL as a top-level page still gets the mobile fallback');

// Failed, stalled and late network responses must leave a usable recovery path.
const runSlowTimers = test => {
  for (const [id, timer] of [...test.timers]) {
    if (timer.delay === 20000) { test.timers.delete(id); timer.fn(); }
  }
};
const engineDownload = phone({ touch: false, noEngine: true });
check(engineDownload.document.head.children.length === 1, 'Engine download starts asynchronously after the loading UI is installed');
runSlowTimers(engineDownload);
check(engineDownload.elements.get('retry').style.display === 'inline-block', 'Stalled engine download exposes a retry action');
engineDownload.document.head.children[0].onerror();
check(engineDownload.elements.get('error').textContent.includes('网络') && engineDownload.elements.get('start').hidden, 'Failed engine script shows a network explanation and removes the dead start button');
check(engineDownload.elements.get('retry').style.display === 'inline-block' && engineDownload.timers.size === 0, 'Failure keeps retry available and stops the loading timer');
const invalidEngine = phone({ touch: false, noEngine: true });
invalidEngine.document.head.children[0].onload();
check(invalidEngine.elements.get('retry').style.display === 'inline-block', 'Invalid engine script is also recoverable');
const initFailure = phone({ touch: false, constructorFailure: true });
check(initFailure.elements.get('retry').style.display === 'inline-block', 'Synchronous engine initialization errors get a recovery screen');
const unsupported = phone({ touch: false, missingFeatures: ['WebGL2'] });
check(unsupported.elements.get('error').textContent.includes('3D 功能') && unsupported.calls.starts === 0, 'Unsupported graphics are explained separately from a network failure');

const pack = phone({ touch: false, pendingGame: true });
pack.calls.startOptions.onProgress(10, 100);
runSlowTimers(pack);
pack.calls.startOptions.onProgress(10, 100);
check(pack.elements.get('retry').style.display === 'inline-block' && pack.elements.get('status').textContent.includes('加载较慢'), 'Repeated unchanged counters cannot mask a stalled download');
pack.calls.startOptions.onProgress(20, 100);
check(pack.elements.get('retry').style.display === 'none' && pack.elements.get('progress').value === 20, 'New download progress restores the progress display');
pack.calls.reject(new Error('Simulated resource download failure'));
await Promise.resolve(); await Promise.resolve();
check(pack.elements.get('retry').style.display === 'inline-block' && pack.elements.get('status').textContent === '暂时无法进入游戏', 'Failed game resource download shows recovery');
pack.calls.startOptions.onProgress(30, 100);
check(pack.elements.get('status').textContent === '暂时无法进入游戏', 'Late progress cannot overwrite a failure screen');

const delayed = phone({ touch: false, pendingGame: true });
runSlowTimers(delayed);
delayed.calls.resolve();
await Promise.resolve();
check(delayed.elements.get('start').disabled === false && delayed.elements.get('retry').style.display === 'none' && delayed.timers.size === 0, 'A slow but successful download enables play and clears retry/timers');
delayed.elements.get('start').onclick();
check(delayed.elements.get('loading').hidden && delayed.elements.get('canvas').focused, 'Successful start focuses the game canvas');
delayed.calls.startOptions.onExit(1);
check(!delayed.elements.get('loading').hidden && delayed.elements.get('retry').style.display === 'inline-block', 'Runtime exit returns to a usable recovery screen');
const exitedEarly = phone({ touch: false, pendingGame: true });
exitedEarly.calls.startOptions.onExit(1);
exitedEarly.calls.resolve();
await Promise.resolve();
check(exitedEarly.elements.get('start').hidden && exitedEarly.elements.get('status').textContent === '暂时无法进入游戏', 'Late startup completion cannot resurrect an exited game');
await desktop.elements.get('fullscreen').onclick();
check(desktop.elements.get('copied').textContent.includes('不支持全屏'), 'Unsupported desktop fullscreen provides feedback');
console.log(`PASS: ${checks} web shell regression checks`);
