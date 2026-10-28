import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../src/assets/js/article-audio.js", import.meta.url), "utf8");
const source = "https://democraticjustice.org/media/narration/story-v1.mp3";
const key = `dj-audio-state:${source}`;

class Element {
  constructor() {
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = new Map();
    this.hidden = true;
    this.value = "0";
  }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  async emit(name) {
    await Promise.all((this.listeners.get(name) || []).map((callback) => callback()));
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  focus() {}
  scrollIntoView() {}
}

function setup({ stored = new Map(), session = new Map(), url = source, blocked = false, pending = false } = {}) {
  const root = new Element();
  const audio = new Element();
  Object.assign(audio, { src: url, paused: true, ended: false, duration: NaN, currentTime: 0, playbackRate: 1, readyState: 0, plays: 0 });
  let resolvePlay;
  audio.play = () => {
    audio.plays += 1;
    audio.paused = false;
    audio.playPromise = (async () => {
      await audio.emit("play");
      if (pending) return new Promise((resolve) => { resolvePlay = resolve; });
      audio.duration = 120;
      audio.readyState = 4;
      await audio.emit("loadedmetadata");
      await audio.emit("playing");
    })();
    return audio.playPromise;
  };
  audio.pause = () => {
    audio.paused = true;
    audio.emit("pause");
  };
  const nodes = Object.fromEntries([
    "controls", "play", "seek", "speed", "current", "duration", "status", "resume", "resume-time",
    "mini", "mini-play", "mini-time", "mini-return", "mini-dismiss"
  ].map((name) => [name, new Element()]));
  root.dataset = { audioTitle: "Story headline", audioAuthor: "Seth Sturm", audioPublication: "Democratic Justice", audioArtwork: "/assets/images/uploads/default-social-card.png" };
  root.querySelector = (selector) => selector === "[data-audio-media]" ? audio : nodes[selector.slice(12, -1)];
  const skips = [-15, 15].map((offset) => Object.assign(new Element(), { dataset: { audioSkip: String(offset) } }));
  root.querySelectorAll = () => skips;
  const bodyClasses = new Set();
  const document = Object.assign(new Element(), {
    querySelectorAll: () => [root],
    querySelector: () => nodes.mini.hidden ? null : nodes.mini,
    body: { classList: { toggle: (name, enabled) => enabled ? bodyClasses.add(name) : bodyClasses.delete(name) } }
  });
  const actions = new Map();
  const mediaSession = { setActionHandler: (name, callback) => actions.set(name, callback), setPositionState: (state) => { mediaSession.position = state; } };
  let intersection;
  const storage = (map) => ({
    getItem: (name) => { if (blocked) throw new Error("Storage blocked"); return map.get(name) ?? null; },
    setItem: (name, value) => { if (blocked) throw new Error("Storage blocked"); map.set(name, value); }
  });
  const window = Object.assign(new Element(), {
    location: { href: "https://democraticjustice.org/articles/politics/story/" },
    MediaMetadata: class { constructor(values) { Object.assign(this, values); } },
    matchMedia: () => ({ matches: true })
  });
  vm.runInNewContext(script, {
    document, window, navigator: { mediaSession }, URL, Date,
    localStorage: storage(stored), sessionStorage: storage(session),
    IntersectionObserver: class {
      constructor(callback) { intersection = callback; }
      observe() {}
    }
  });
  return {
    nodes, audio, stored, session, mediaSession, actions, bodyClasses,
    intersect: (visible) => intersection([{ isIntersecting: visible }]),
    resolvePlay: () => resolvePlay?.()
  };
}

test("restores per-recording position and speed only after an explicit play", async () => {
  const fixture = setup({ stored: new Map([[key, JSON.stringify({ version: 1, position: 34, rate: 1.5 })]]) });
  assert.equal(fixture.nodes.resume.hidden, false);
  assert.equal(fixture.nodes["resume-time"].textContent, "0:34");
  assert.equal(fixture.nodes.speed.value, "1.5");
  assert.equal(fixture.audio.plays, 0);
  assert.equal(fixture.audio.currentTime, 0);
  await fixture.nodes.play.emit("click");
  await fixture.audio.playPromise;
  assert.equal(fixture.audio.currentTime, 34);
  assert.equal(fixture.audio.playbackRate, 1.5);
  assert.equal(fixture.nodes.resume.hidden, true);
  fixture.audio.currentTime = 117;
  fixture.audio.ended = true;
  await fixture.audio.emit("ended");
  assert.equal(JSON.parse(fixture.stored.get(key)).position, 0);
});

test("replacement recordings, corrupt state and blocked storage remain playable", async () => {
  const saved = new Map([[key, JSON.stringify({ version: 1, position: 30, rate: 2 })]]);
  const replacement = setup({ stored: saved, url: source.replace("v1", "v2") });
  assert.equal(replacement.nodes.resume.hidden, true);
  assert.equal(replacement.audio.playbackRate, 1);
  const corrupt = setup({ stored: new Map([[key, "not JSON"]]) });
  assert.equal(corrupt.nodes.resume.hidden, true);
  const blocked = setup({ blocked: true });
  await blocked.nodes.play.emit("click");
  await blocked.audio.playPromise;
  assert.equal(blocked.audio.paused, false);
  assert.equal(blocked.audio.plays, 1);
});

test("the compact player requires started audio offscreen and respects session dismissal", async () => {
  const fixture = setup();
  fixture.intersect(false);
  assert.equal(fixture.nodes.mini.hidden, true);
  await fixture.nodes.play.emit("click");
  await fixture.audio.playPromise;
  assert.equal(fixture.nodes.mini.hidden, false);
  assert.equal(fixture.bodyClasses.has("has-audio-mini"), true);
  await fixture.nodes["mini-play"].emit("click");
  assert.equal(fixture.audio.paused, true);
  assert.equal(fixture.nodes.mini.hidden, false);
  fixture.intersect(true);
  assert.equal(fixture.nodes.mini.hidden, true);
  fixture.intersect(false);
  await fixture.nodes["mini-dismiss"].emit("click");
  assert.equal(fixture.nodes.mini.hidden, true);
  assert.equal(fixture.bodyClasses.has("has-audio-mini"), false);
  const sameSession = setup({ session: fixture.session });
  sameSession.intersect(false);
  await sameSession.nodes.play.emit("click");
  await sameSession.audio.playPromise;
  assert.equal(sameSession.nodes.mini.hidden, true);
});

test("Media Session metadata and transport handlers follow real playback state", async () => {
  const fixture = setup();
  assert.equal(fixture.mediaSession.metadata, undefined);
  await fixture.nodes.play.emit("click");
  await fixture.audio.playPromise;
  assert.equal(fixture.mediaSession.metadata.title, "Story headline");
  assert.equal(fixture.mediaSession.metadata.artist, "Seth Sturm");
  assert.equal(fixture.mediaSession.metadata.artwork[0].src, "https://democraticjustice.org/assets/images/uploads/default-social-card.png");
  fixture.actions.get("seekto")({ seekTime: 40 });
  assert.equal(fixture.audio.currentTime, 40);
  fixture.actions.get("seekbackward")({ seekOffset: 15 });
  assert.equal(fixture.audio.currentTime, 25);
  fixture.actions.get("seekforward")({ seekOffset: 200 });
  assert.equal(fixture.audio.currentTime, 120);
  fixture.actions.get("pause")();
  assert.equal(fixture.audio.paused, true);
  assert.equal(fixture.mediaSession.playbackState, "paused");
});

test("pausing a pending play request prevents a later async resume", async () => {
  const fixture = setup({ pending: true, stored: new Map([[key, JSON.stringify({ version: 1, position: 34, rate: 1 })]]) });
  const playing = fixture.nodes.play.emit("click");
  await Promise.resolve();
  await Promise.resolve();
  await fixture.nodes.play.emit("click");
  fixture.audio.duration = 120;
  fixture.audio.readyState = 4;
  await fixture.audio.emit("loadedmetadata");
  fixture.resolvePlay();
  await fixture.audio.playPromise;
  await playing;
  assert.equal(fixture.audio.paused, true);
  assert.equal(fixture.audio.currentTime, 0);
  assert.equal(fixture.audio.plays, 1);
});
