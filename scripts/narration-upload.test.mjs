import assert from "node:assert/strict";
import test from "node:test";
import yaml from "js-yaml";

import gateway from "../workers/proof-desk-gateway/src/index.js";
import { MAX_NARRATION_BYTES, narrationMetadata, validateNarrationUpload } from "../workers/proof-desk-gateway/src/narration.js";

const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Array(200).fill(0)]);
const upload = { file_name: "My Article Reading.MP3", mime_type: "audio/mpeg", file_base64: mp3.toString("base64") };
const audioPath = "/media/narration/my-article.mp3";
const env = {
  INTERNAL_SECRET: "test-internal-secret",
  GITHUB_SERVER_TOKEN: "test-repo-token",
  GITHUB_REPO_OWNER: "example",
  GITHUB_REPO_NAME: "newsroom",
  GITHUB_BRANCH: "test-branch",
  ALLOWED_ORIGINS: "https://newsroom.example",
  EDITOR_SESSIONS: { get: async () => JSON.stringify({ email: "writer@example.test", role: "writer", active: true }) }
};

function request(path, body, { internal = true, origin = "https://newsroom.example", authenticated = true } = {}) {
  return new Request(`https://gateway.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(internal && authenticated ? { "X-Internal-Secret": env.INTERNAL_SECRET, "X-User-Email": "writer@example.test", "X-User-Roles": '["writer"]' } : {}),
      ...(!internal && authenticated ? { Cookie: "__Host-dj_editor_session=test-session" } : {})
    },
    body: JSON.stringify(body)
  });
}

test("validates actual MP3 headers and produces safe, distinct upload paths", () => {
  const first = validateNarrationUpload(upload);
  const second = validateNarrationUpload({ ...upload, file_name: "../../Read this.MP3" });
  assert.deepEqual(Buffer.from(first.file_base64, "base64"), mp3);
  assert.match(first.audio_file, /^\/media\/narration\/my-article-reading-[a-f0-9-]+\.mp3$/);
  assert.match(second.audio_file, /^\/media\/narration\/read-this-[a-f0-9-]+\.mp3$/);
  assert.notEqual(first.audio_file, second.audio_file);
  assert.equal(first.repoPath, `static${first.audio_file}`);
  assert.equal(first.file_base64, upload.file_base64);
  const id3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]), mp3]);
  assert.doesNotThrow(() => validateNarrationUpload({ ...upload, file_base64: id3.toString("base64") }));
  const tagged = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 127]), Buffer.alloc(127), mp3]);
  assert.doesNotThrow(() => validateNarrationUpload({ ...upload, file_base64: tagged.toString("base64") }));
});

test("rejects renamed non-audio, malformed data, other formats and oversized uploads", () => {
  for (const payload of [
    { ...upload, file_name: "recording.wav" },
    { ...upload, mime_type: "image/jpeg" },
    { ...upload, file_base64: Buffer.from("ID3 is only text, not audio").toString("base64") },
    { ...upload, file_base64: "not base64!" },
    { ...upload, file_base64: "" }
  ]) {
    assert.throws(() => validateNarrationUpload(payload), (error) => error.status === 400);
  }
  const oversized = "A".repeat(Math.ceil(MAX_NARRATION_BYTES / 3) * 4 + 4);
  assert.throws(() => validateNarrationUpload({ ...upload, file_base64: oversized }), /20 MiB/);
  // MAX+1 bytes has the same padded base64 length as MAX; check decoded size too.
  const decodedOversized = "A".repeat(Math.ceil(MAX_NARRATION_BYTES / 3) * 4);
  assert.throws(() => validateNarrationUpload({ ...upload, file_base64: decodedOversized }), /20 MiB/);
});

test("keeps omitted narration metadata and supports explicit attachment removal", () => {
  const current = { audio_file: audioPath, audio_narrator: "Seth Sturm" };
  assert.deepEqual(narrationMetadata({}, current), current);
  assert.deepEqual(narrationMetadata({ audio_file: "", audio_narrator: "" }, current), { audio_file: "", audio_narrator: "" });
  assert.deepEqual(narrationMetadata({ audio_narrator: "  Seth   Sturm " }, current), current);
  for (const audio_file of ["https://other.example/audio.mp3", "/media/narration/../audio.mp3", "javascript:alert(1)", "/media/narration/reading.wav", "/media/narration/subfolder/audio.mp3", "/media/narration/..%2Faudio.mp3", "/media/narration/sub%5Cfile.mp3", "/media/narration/sub%252Ffile.mp3", "/media/narration/sub\\file.mp3", "/media/narration/audio.mp3?download=1", "/media/narration/audio.mp3#part1", "/media/narration/audio%3Fquery.mp3", "/media/narration/audio%23part.mp3", "/media/narration/file%00.mp3"]) {
    assert.throws(() => narrationMetadata({ audio_file }), /uploaded to/);
  }
});

test("preserves safe CMS narration filenames, including their original spacing and encoding", () => {
  for (const audio_file of [
    "/media/narration/Read  This.MP3",
    "/media/narration/Sturm_reading.mp3",
    "/media/narration/École – 你好.MP3",
    "/media/narration/Reader's Article.mp3",
    "/media/narration/Read%20%20This.MP3",
    "/media/narration/%C3%89cole%20%E2%80%93%20%E4%BD%A0%E5%A5%BD.MP3"
  ]) {
    assert.equal(narrationMetadata({ audio_file }).audio_file, audio_file);
    assert.equal(narrationMetadata({ audio_file: ` ${audio_file} ` }).audio_file, audio_file);
    assert.equal(narrationMetadata({}, { audio_file }).audio_file, audio_file);
  }
});

test("uploads through both authenticated Worker routes without creating source documents", async (t) => {
  const writes = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "PUT");
    assert.match(String(url), /\/contents\/static\/media\/narration\/my-article-reading-[a-f0-9-]+\.mp3$/);
    writes.push(JSON.parse(options.body));
    return Response.json({ content: { sha: "test-sha" } });
  });
  for (const internal of [true, false]) {
    const response = await gateway.fetch(request("/api/editor/upload-narration", upload, { internal }), env);
    assert.equal(response.status, 200);
    assert.match((await response.json()).audio_file, /^\/media\/narration\//);
  }
  assert.equal(writes.length, 2);
  assert.equal(writes[0].content, upload.file_base64);
  assert.equal(writes[0].branch, "test-branch");
});

test("upload endpoint denies unauthenticated or foreign-origin writes before GitHub access", async (t) => {
  const remote = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected remote call"); });
  for (const [options, status] of [[{ authenticated: false }, 401], [{ origin: "https://foreign.example" }, 403]]) {
    const response = await gateway.fetch(request("/api/editor/upload-narration", upload, options), env);
    assert.equal(response.status, status);
  }
  const invalid = await gateway.fetch(request("/api/editor/upload-narration", { ...upload, file_base64: "invalid" }), env);
  assert.equal(invalid.status, 400);
  assert.equal(remote.mock.callCount(), 0);
});

test("article save/load round trips narration and preserves it for legacy clients", async (t) => {
  let data = { title: "A reported story", description: "Lede", author: "seth-sturm", date: "2026-01-01", tags: ["article"], audio_file: audioPath, audio_narrator: "Seth Sturm", unrelated: "keep me" };
  t.mock.method(globalThis, "fetch", async (_url, options = {}) => {
    if (options.method === "PUT") {
      const content = Buffer.from(JSON.parse(options.body).content, "base64").toString("utf8");
      data = yaml.load(content.match(/^---\n([\s\S]*?)\n---/)[1]);
      return Response.json({ content: { sha: "test-sha" } });
    }
    const content = `---\n${yaml.dump(data)}---\nThe article body.\n`;
    return Response.json({ sha: "test-sha", content: Buffer.from(content).toString("base64") });
  });
  async function save(metadata) {
    const article = { slug: "story", title: "A reported story", description: "Lede", author: "seth-sturm", date: "2026-01-01", body: "The article body.", ...metadata };
    const response = await gateway.fetch(request("/api/editor/article/save", { article, repo_path: "src/content/articles/story.md" }), env);
    assert.equal(response.status, 200);
    return (await response.json()).article;
  }
  assert.equal((await save({})).audio_file, audioPath);
  assert.equal(data.unrelated, "keep me");
  const cmsPath = "/media/narration/Reader's  Article_Édition.MP3";
  assert.equal((await save({ audio_file: cmsPath, audio_narrator: "Reader" })).audio_narrator, "Reader");
  assert.equal(data.audio_file, cmsPath);
  const readRequest = request("/api/editor/article?slug=story", {});
  const loaded = await gateway.fetch(new Request(readRequest.url, { method: "GET", headers: readRequest.headers }), env);
  assert.equal((await loaded.json()).article.audio_file, cmsPath);
  assert.equal((await save({ audio_file: "", audio_narrator: "" })).audio_file, "");
  assert.equal(data.audio_file, "");
});
