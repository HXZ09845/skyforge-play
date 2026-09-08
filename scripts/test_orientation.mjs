// Regression checks for the shell when a phone/browser cannot rotate.
// Run with Node.js; no browser or third-party dependencies required.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(process.argv[2] || new URL('../web/shell.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(value => value.includes('const query ='))
  .replace('$GODOT_CONFIG', '{}');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };

function phone({ touch = true, nested = false, search = '', width = 390, height = 844 } = {}) {
  const size = { width, height };
  const elements = new Map();
  const events = new Map();
  const calls = { engines: 0, starts: 0, pauses: 0 };
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
    hidden: false, documentElement: {}, body: make('body'),
    getElementById(id) { return elements.get(id); },
    createElement: make,
    addEventListener(name, fn) { events.set(name, fn); },
  };
  class Engine {
    static getMissingFeatures() { return []; }
    constructor(config) { calls.engines++; calls.config = config; }
    startGame() { calls.starts++; return Promise.resolve(); }
  }
  const context = vm.createContext({ document, Engine, URL, URLSearchParams,
    navigator: { maxTouchPoints: touch ? 5 : 0 },
    location: new URL('https://example.com/skyforge-play/' + search),
    screen: {}, console, setTimeout, clearTimeout,
    addEventListener(name, fn) { events.set(name, fn); },
  });
  context.window = context;
  context.parent = nested ? {} : context;
  vm.runInContext(script, context);
  return { context, document, elements, events, calls, size };
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
const desktop = phone({ touch: false, width: 1280, height: 720 });
check(desktop.calls.starts === 1 && !desktop.elements.has('game-frame'), 'Desktop keeps its direct canvas');
const sharedChildURL = phone({ search: '?touch=1&skyforge-frame=1' });
check(sharedChildURL.elements.has('game-frame'), 'Opening an embedded URL as a top-level page still gets the mobile fallback');
console.log(`PASS: ${checks} web orientation regression checks`);
