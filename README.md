# Software Tools

**Small, useful tools, each in its own folder with its own README and tests.** Most of them check the output of something you can't fully trust, whether that's a parser or a language model, before it reaches a person.

| Tool | What it does | Built with |
| --- | --- | --- |
| [ats-check](ats-check/)<br>[![ats-check](https://github.com/nurah-kamal/software-tools/actions/workflows/ats-check.yml/badge.svg?branch=main&event=push)](https://github.com/nurah-kamal/software-tools/actions/workflows/ats-check.yml) 30 tests | Shows what an applicant tracking system reads from a CV PDF: text in reading order, columns that interleave, headings it won't recognise, text hidden in pictures, and a score with every cost listed. Six invented sample CVs, one problem each. | Python, pdfplumber |
| [prompt-regression](prompt-regression/)<br>[![prompt-regression](https://github.com/nurah-kamal/software-tools/actions/workflows/prompt-regression.yml/badge.svg?branch=main&event=push)](https://github.com/nurah-kamal/software-tools/actions/workflows/prompt-regression.yml) 16 tests | Tests for language model output. A suite pins what a reply must satisfy, and CI fails when a prompt or model change breaks it. In the example, tidying a prompt broke 9 of 12 cases, including one where the model obeyed an instruction hidden in an invoice. | Node, Gemini API |
| [doc-freshness](doc-freshness/)<br>[![doc-freshness](https://github.com/nurah-kamal/software-tools/actions/workflows/doc-freshness.yml/badge.svg?branch=main&event=push)](https://github.com/nurah-kamal/software-tools/actions/workflows/doc-freshness.yml) 14 tests | Checks a document set before it is indexed for search or a chatbot: old versions never taken out, versions that disagree, and exact copies, with every differing fact side by side. | Node |

More tools are on the way: a cost and latency comparison across models, and injection-probe, a defensive check for prompt injection on endpoints you own.

## How this repo is organised

- **One folder per tool.** Each stands on its own: you can read, run and test it without the others.
- **Each tool has its own checks.** `.github/workflows/<tool>.yml` runs only when that tool's folder changes. `secrets.yml` scans the whole history.
- **Saved replies, not live calls, on every push.** The tools that call a model save each reply, and CI replays them, so the published figures are checked without a key.

## Data

Every sample here is invented: the CVs, invoices, documents and messages, and every name, number and email address in them. Where a tool comes from work I do professionally, it was rebuilt from scratch, and no work code or data is in this repository.

## Licence

MIT.
