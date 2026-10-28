import assert from "node:assert/strict";
import test from "node:test";
import yaml from "js-yaml";

import { getArticleHistory, normalizeArticleHistory } from "../lib/article-history.js";
import gateway from "../workers/proof-desk-gateway/src/index.js";

const published = "2026-01-01T12:00:00-05:00";
const updated = "2026-01-02T12:00:00-05:00";
const emptyHistory = { updated: "", update_note: "", correction_note: "" };

test("normalizes only explicit reporting history without mutating publication dates", () => {
  const publicationDate = new Date(published);
  const updateDate = new Date(updated);
  const current = { date: publicationDate, updated: updateDate, update_note: "Original explanation." };
  const normalized = normalizeArticleHistory({ update_note: "  Added a source.\r\n\r\nClarified the timeline.  " }, current);
  assert.deepEqual(normalized, {
    updated: updateDate.toISOString(),
    update_note: "Added a source.\n\nClarified the timeline."
  });
  assert.equal(current.date, publicationDate);
  assert.equal(current.updated, updateDate);
  assert.equal(publicationDate.toISOString(), "2026-01-01T17:00:00.000Z");
  assert.deepEqual(normalizeArticleHistory({ date: published }), {});
  assert.deepEqual(normalizeArticleHistory({ ...emptyHistory }, current), emptyHistory);
});

test("requires a real, strictly later dated update and dated notes", () => {
  for (const value of [
    "not-a-date", "2026-02-30T12:00:00Z", "2026-13-01T00:00:00Z",
    "2026-01-02T24:00:00Z", "2026-01-02T12:00:00", "2026-01-02",
    "2026-01-02T12:00:00+24:00", "2026-01-01T17:00:00Z", "2025-12-31T17:00:00Z"
  ]) {
    assert.throws(() => normalizeArticleHistory({ date: published, updated: value }), (error) => error.status === 400, value);
  }
  assert.throws(() => normalizeArticleHistory({ date: published, update_note: "Updated reporting." }), /updated date/);
  assert.throws(() => normalizeArticleHistory({ date: published, correction_note: "A name was corrected." }), /updated date/);
  assert.throws(() => normalizeArticleHistory({ date: "invalid", updated }), /publication date/);
  assert.throws(() => normalizeArticleHistory({ updated: "" }, { date: published, updated, correction_note: "A correction." }), /updated date/);
  assert.doesNotThrow(() => normalizeArticleHistory({ date: "2024-02-28", updated: "2024-02-29T12:00:00Z" }));
});

test("public reporting history hides invalid or undated notices and preserves actual plain text", () => {
  for (const data of [
    { date: published },
    { date: published, updated: published },
    { date: published, updated: "2026-02-30T12:00:00Z" },
    { date: published, correction_note: "An undated correction." },
    { date: "invalid", updated, update_note: "A note." }
  ]) {
    assert.deepEqual(getArticleHistory(data), emptyHistory);
  }
  assert.deepEqual(getArticleHistory({ date: published, updated, update_note: "Added a record.\n\nExplained its context.", correction_note: "The name is <Smith>, not Jones." }), {
    updated: "2026-01-02T17:00:00.000Z",
    update_note: "Added a record.\n\nExplained its context.",
    correction_note: "The name is <Smith>, not Jones."
  });
});

test("Worker save/load preserves legacy history and unrelated fields, accepts edits and explicit clearing", async (t) => {
  let data = {
    date: published, updated, update_note: "An earlier update.", correction_note: "An earlier correction.",
    title: "A reported story", description: "Lede", author: "seth-sturm", tags: ["article"],
    audio_file: "/media/narration/reading.mp3", proof: { issue: "Original proof" }, unrelated: "Keep this"
  };
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (_url, options = {}) => {
    if (options.method === "PUT") {
      const contents = Buffer.from(JSON.parse(options.body).content, "base64").toString("utf8");
      data = yaml.load(contents.match(/^---\n([\s\S]*?)\n---/)[1]);
      writes += 1;
      return Response.json({ content: { sha: "test-sha" } });
    }
    const contents = `---\n${yaml.dump(data)}---\nThe article body.\n`;
    return Response.json({ sha: "test-sha", content: Buffer.from(contents).toString("base64") });
  });
  const env = {
    INTERNAL_SECRET: "test-internal-secret", GITHUB_SERVER_TOKEN: "test-repo-token",
    GITHUB_REPO_OWNER: "example", GITHUB_REPO_NAME: "newsroom", GITHUB_BRANCH: "test-branch",
    ALLOWED_ORIGINS: "https://newsroom.example"
  };
  const headers = {
    "Content-Type": "application/json", Origin: "https://newsroom.example",
    "X-Internal-Secret": env.INTERNAL_SECRET, "X-User-Email": "writer@example.test", "X-User-Roles": '["writer"]'
  };
  async function save(history) {
    const article = { slug: "story", title: "A reported story", description: "Lede", author: "seth-sturm", date: published, body: "The article body.", ...history };
    return gateway.fetch(new Request("https://gateway.example/api/editor/article/save", {
      method: "POST", headers,
      body: JSON.stringify({ article, repo_path: "src/content/articles/story.md" })
    }), env);
  }
  const legacy = await save({});
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).article.update_note, "An earlier update.");
  assert.equal(data.updated, updated);
  assert.equal(data.date, published);
  assert.equal(data.audio_file, "/media/narration/reading.mp3");
  assert.deepEqual(data.proof, { issue: "Original proof" });
  assert.equal(data.unrelated, "Keep this");

  const update = await save({ updated: "2026-01-03T12:00:00Z", update_note: "Added a record.\n\nAdded context.", correction_note: "" });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).article.update_note, "Added a record.\n\nAdded context.");
  const loaded = await gateway.fetch(new Request("https://gateway.example/api/editor/article?slug=story", { headers }), env);
  const loadedArticle = (await loaded.json()).article;
  assert.equal(loadedArticle.updated, "2026-01-03T12:00:00Z");
  assert.equal(loadedArticle.update_note, "Added a record.\n\nAdded context.");
  assert.equal(loadedArticle.correction_note, "");
  const writesBeforeInvalid = writes;
  assert.equal((await save({ updated: "2026-02-30T12:00:00Z" })).status, 400);
  assert.equal((await save({ updated: "" })).status, 400);
  assert.equal(writes, writesBeforeInvalid);
  assert.equal((await save(emptyHistory)).status, 200);
  assert.deepEqual({ updated: data.updated, update_note: data.update_note, correction_note: data.correction_note }, emptyHistory);
  assert.equal(data.date, published);
});
