# Generated data

This directory is written by `scripts/crawl.mjs`.

- `current/{market}/pages.jsonl` — latest normalized page records
- `current/{market}/products.jsonl` — latest structured products
- `current/{market}/meta.json` — crawl metadata
- `history/products/{market}.jsonl` — product versions appended only when the product fingerprint changes

No images are stored.

A failed crawl does not intentionally delete the previous successful market snapshot.
