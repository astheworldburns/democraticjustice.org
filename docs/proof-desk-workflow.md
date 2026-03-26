# Proof Desk Workflow

`/admin/` now splits the editorial workflow into two desks:

- `Content Desk`: article body, metadata, authors, and standalone source-document records
- `Proof Desk`: issue, axioms, inferences, linked source documents, and inline source creation

## Writer flow

1. Draft the article body in `Content Desk`.
2. Open the same article in `Proof Desk`.
3. State the issue under proof.
4. Build the axioms.
5. For each axiom:
   - link one or more source documents, or
   - mark `No source needed`
6. Write the inferences.
7. Write the conclusion.
8. Save the proof.

## Source creation inside Proof Desk

When a needed document is not already in the source archive:

1. Open the axiom.
2. Expand `Create a new source document`.
3. Fill in:
   - title
   - file
   - description
   - obtained date
   - source method
4. Create the source.
5. The Proof Desk uploads the file, creates the source-document record, and attaches it to the axiom immediately.

## Validation rules

The Proof Desk and proof normalization both enforce the same rule:

- an axiom must have one or more linked source documents, or
- `no_source_needed: true`

It may never have both, and it may never have neither.

## Authentication

The Proof Desk tries to reuse a GitHub token already present in the browser from the CMS session.

If that token is not available, the desk accepts a manual GitHub token fallback and stores it locally in the browser under `dj-proof-desk-token`.

## Public result

Published proof cards now support:

- multiple linked source documents per axiom
- source-free axioms with no public warning text
- a deduped proof-level source count
- a deduped proof-level source bibliography
- a public `/documents/` archive for source-document records
