# Gilman Quote (demo)

A phone-first web app (PWA) for sending The Gilman Brothers Company a complete RFQ in a few taps. It also has a Hot Deals feed, samples, distributor referral, resources and a QR code for sharing. **Demo build, not an official Gilman Brothers app.**

- `catalog.json`: products, applications and options, scraped only from gilmanbrothers.com and its PDFs (Oct 21, 2026).
- `deals.json`: the Hot Deals feed. Edit it with `admin.html`, then commit.
- Requests open in the user's own Mail app via `mailto:` (to quotes@ / sales@gilmanbrothers.com). Nothing is sent automatically.
- Push alerts: see `push-setup.md` (off by default in `push-config.js`).
- Tests: `node tests/run.js` (Playwright WebKit iPhone 15 / iPhone SE + Chromium).
