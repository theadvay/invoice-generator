# Invoice Generator

A free, private, no-signup invoice generator that runs entirely in your browser.
Fill the form on the left, watch the A4 invoice build itself on the right, hit
**Download PDF**, and you're done.

**Live site:** https://theadvay.github.io/invoice-generator/

---

## Why it exists

Most free invoice tools want an account, put your client data on their server, and
watermark the PDF. This one is three files of plain HTML, CSS and JavaScript. There
is no backend, no analytics, no tracking, and no network request after the page
loads. Your invoice never leaves your device — it is saved to your own browser's
`localStorage` and nowhere else.

## Features

- **Live A4 preview** — the sheet you see is exactly what prints.
- **GST-ready** — per-item tax rates with CGST + SGST (intra-state) or IGST
  (inter-state) breakdown, plus GSTIN fields for both parties.
- **Any currency** — INR, USD, EUR, GBP, AED, SGD, AUD, CAD, with correct Indian
  (lakh/crore) or international digit grouping.
- **Amount in words** — generated automatically, in the right convention for the
  currency (e.g. *One Lakh Two Thousand Eleven Rupees only*).
- **Discounts** — percentage or flat, applied before tax so the tax lines stay
  correct.
- **Part payments** — record an amount paid and the invoice shows the balance due
  and a Paid / Partially paid / Unpaid / Overdue badge.
- **Logo upload** — automatically downscaled and stored locally.
- **Auto-save** — every keystroke is saved in your browser; close the tab and come
  back later.
- **Auto invoice numbers** — sequential `INV-2026-001` style, incrementing per year.
- **Print-perfect output** — dedicated `@page` A4 rules, no browser headers, no
  page-break inside table rows.
- **Works offline** — save the page and it still runs. No fonts or scripts fetched
  from a CDN.
- **Responsive** — the editor stacks above the preview on a phone.

## Usage

1. Open the site.
2. Fill in your business details once (they're remembered), then the client and
   the line items.
3. Click **Download PDF** and pick **Save as PDF** as the print destination.
   Chrome, Edge, Safari and Firefox all offer it.

**Sample data** fills in a complete example invoice so you can see the layout
immediately. **New invoice** starts fresh and bumps the invoice number, keeping
your business profile.

## Run locally

No build step, no dependencies.

```bash
git clone https://github.com/theadvay/invoice-generator.git
cd invoice-generator
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly with `file://` works too.

## Project structure

```
index.html   markup for the editor + preview shell
style.css    UI styling and the A4 print rules
app.js       state, totals, number-to-words, rendering, PDF printing
```

## How the totals are computed

For each line, `base = qty × rate`. The discount is spread proportionally across
all lines, and tax is charged on the discounted value of each line — which is the
correct GST treatment:

```
factor    = (subtotal − discount) / subtotal
taxable_i = base_i × factor
tax_i     = taxable_i × rate_i / 100
total     = subtotal − discount + Σ tax_i
```

## Privacy

Everything is client-side. Nothing is transmitted, no cookies, no third-party
requests. Clearing your browser's site data deletes the saved invoice.

## License

MIT — see [LICENSE](LICENSE).
