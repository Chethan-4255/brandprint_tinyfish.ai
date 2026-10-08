# demo runs

these are real recorded outputs from `GET /api/brand` while i was testing Brandprint against the live web with TinyFish (October 2026). they are here only so you can see the exact JSON shape without spending API credits, the app never reads these files, every request goes to TinyFish Search / Fetch / Agent live.

| file | request | what it shows |
|---|---|---|
| `stripe-fast.json` | `?input=https://stripe.com&depth=fast` | URL input, inline SVG logo, 6 colour palette from 5 stylesheets, `sohne-var` font |
| `notion-fast.json` | `?input=notion.so&depth=fast` | bare domain input, redirect to notion.com, 10 stylesheets, `NotionInter` + `Lyon Text` |
| `linear-fast.json` | `?input=Linear&depth=fast` | company name input resolved through TinyFish Search, second stylesheet batch, `Inter Variable` |
| `stripe-full.json` | `?input=https://stripe.com&depth=full` | same as fast plus the TinyFish Agent browser observation merged in (`browser`, `verified` flags, `sources` entry) |

if you re-run these you will get slightly different numbers because the sites change and the Agent run is a real browser session.
