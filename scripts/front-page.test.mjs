import assert from "node:assert/strict";
import test from "node:test";

import { leadSourceDocuments } from "../lib/front-page.js";

const record = (url, title = url) => ({ url, data: { title } });
const records = [
  record("/documents/first/"),
  record("/documents/second/"),
  record("/documents/petitioner's-réponse/"),
  record("/documents/a&b/"),
  record("/documents/literal&amp;entity/"),
  record("/documents/unrelated/")
];
const article = (templateContent, proofSources = null) => ({
  url: "/articles/investigations/lead-story/",
  data: { proofCard: proofSources ? { sourceDocuments: proofSources.map((documentUrl) => ({ documentUrl })) } : null },
  templateContent
});
const citedRecords = (entry, documents, siteUrl) => leadSourceDocuments(entry, documents, entry?.templateContent || "", siteUrl);

test("finds lead-story body citations without requiring a formal proof card", () => {
  const result = citedRecords(article(`
    <p>Reporting from <a href="/documents/second/">the second record</a>.</p>
    <p><a href="https://democraticjustice.org/documents/first/?download=1#page=2">First record</a></p>
    <a href="/documents/second/">Repeated citation</a>
  `), records);
  assert.deepEqual(result, [records[1], records[0]]);
});

test("decodes HTML attribute entities and encoded Unicode while matching exact records", () => {
  const result = citedRecords(article(`
    <a href="/documents/petitioner&#39;s-r%C3%A9ponse/">Apostrophe and Unicode</a>
    <a href='/documents/a&amp;b/'>Ampersand</a>
    <a href="/documents/literal&amp;amp;entity/">Decode entities once</a>
  `), records);
  assert.deepEqual(result, [records[2], records[3], records[4]]);
});

test("deduplicates proof and body citations without unrelated archive fallback", () => {
  const result = citedRecords(article(`
    <a href="../../../documents/second/">Relative source</a>
    <a href="/documents/first">Repeated proof source without trailing slash</a>
  `, ["/documents/first/", "/documents/second/", "https://elsewhere.example/documents/unrelated/"]), records);
  assert.deepEqual(result, [records[0], records[1]]);
  assert.deepEqual(citedRecords(article("No cited records."), records), []);
});

test("ignores foreign, missing and non-anchor URLs and href text inside other attributes", () => {
  const result = citedRecords(article(`
    <a href="https://elsewhere.example/documents/unrelated/">Foreign source</a>
    <a href="https://democraticjustice.org.evil.example/documents/unrelated/">Lookalike origin</a>
    <a href="/documents/missing/">Missing record</a>
    <a data-href="/documents/unrelated/" href="/documents/first/">Only the actual href</a>
    <a title='href="/documents/unrelated/"' href="/documents/second/">Attribute text</a>
    <img src="/documents/unrelated/" />
    <!-- <a href="/documents/unrelated/">Commented-out source</a> -->
    <script>const markup = '<a href="/documents/unrelated/">Unused markup</a>';</script>
  `), records);
  assert.deepEqual(result, [records[0], records[1]]);
});

test("handles empty inputs and malformed URLs without inventing source records", () => {
  assert.deepEqual(citedRecords(null, records), []);
  assert.deepEqual(citedRecords(article("<a href='/documents/%zz/'>Bad encoding</a>"), records), []);
  assert.deepEqual(citedRecords(article("<a href='/documents/first/'>Source</a>"), []), []);
  assert.deepEqual(citedRecords(article(""), records, "not a URL"), []);
});

test("accepts rendered content without accessing Eleventy's lazy templateContent getter", () => {
  const entry = article("");
  Object.defineProperty(entry, "templateContent", {
    get() { throw new Error("Content is not ready yet"); }
  });
  assert.deepEqual(leadSourceDocuments(entry, records, '<a href="/documents/first/">Source</a>'), [records[0]]);
});
