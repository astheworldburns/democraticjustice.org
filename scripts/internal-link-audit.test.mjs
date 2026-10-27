import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditInternalLinks } from "./internal-link-audit.mjs";

async function createSite(t, files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internal-link-audit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  for (const [filename, contents] of Object.entries(files)) {
    const target = path.join(directory, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  return directory;
}

test("decodes HTML entities once before interpreting URLs", async (t) => {
  const directory = await createSite(t, {
    "index.html": `
      <a href="/documents/PETITIONER&#39;S.pdf">Decimal apostrophe</a>
      <a href="/documents/PETITIONER&#x27;S.pdf">Hex apostrophe</a>
      <a href="/documents/PETITIONER&apos;S.pdf">Named apostrophe</a>
      <img src="/documents/A&amp;B.png" alt="Named ampersand">
      <img src="/documents/A&#38;B.png" alt="Decimal ampersand">
      <img src="/documents/A&#x26;B.png" alt="Hex ampersand">
      <a href="/documents/literal&amp;amp;entity.pdf">One decoding pass</a>
      <a href="/documents/literal&#38;amp;entity.pdf">One numeric decoding pass</a>
    `,
    "documents/PETITIONER'S.pdf": "PDF fixture",
    "documents/A&B.png": "Image fixture",
    "documents/literal&amp;entity.pdf": "Literal entity in filename"
  });

  const result = await auditInternalLinks(directory);
  assert.deepEqual(result.htmlFiles, ["index.html"]);
  assert.deepEqual(result.missingLinks, []);
});

test("resolves relative links and literal apostrophes in double-quoted attributes", async (t) => {
  const directory = await createSite(t, {
    "articles/index.html": `
      <a href="../documents/PETITIONER'S%20RESPONSE.pdf">Source</a>
      <img src="../images/editor's-photo.png" alt="Editor">
      <a href='./next/'>Next article</a>
      <a href='../about'>About</a>
    `,
    "articles/next/index.html": "Next article",
    "about.html": "About page",
    "documents/PETITIONER'S RESPONSE.pdf": "PDF fixture",
    "images/editor's-photo.png": "Image fixture"
  });

  const result = await auditInternalLinks(directory);
  assert.deepEqual(result.htmlFiles.slice().sort(), [
    "about.html", "articles/index.html", "articles/next/index.html"
  ]);
  assert.deepEqual(result.missingLinks, []);
});

test("ignores query strings and fragments while retaining encoded filename punctuation", async (t) => {
  const directory = await createSite(t, {
    "index.html": `
      <a href="/documents/source.pdf?download=1&amp;view=full#page=2">Source</a>
      <a href="/documents/source.pdf&#63;download=1&#35;page=2">Entity delimiters</a>
      <a href="/documents/part%23one%3Ffinal.pdf?download=1#page=2">Encoded punctuation</a>
      <a href="documents/part%23one%3Ffinal.pdf">Relative encoded punctuation</a>
      <a href="#section">Same-page fragment</a>
    `,
    "documents/source.pdf": "PDF fixture",
    "documents/part#one?final.pdf": "PDF with punctuation in its filename"
  });

  const result = await auditInternalLinks(directory);
  assert.deepEqual(result.missingLinks, []);
});

test("reports genuinely missing files after decoding the link", async (t) => {
  const directory = await createSite(t, {
    "articles/index.html": `
      <a href="../documents/missing&#39;s.pdf?download=1#page=2">Missing</a>
      <a href="../documents/present.pdf">Present</a>
    `,
    "documents/present.pdf": "PDF fixture"
  });

  const result = await auditInternalLinks(directory);
  assert.deepEqual(result.missingLinks, [{
    source: "articles/index.html",
    target: "../documents/missing&#39;s.pdf?download=1#page=2",
    resolved: "/documents/missing's.pdf"
  }]);
});
