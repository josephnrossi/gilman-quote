/* Gilman Quote test suite – Playwright WebKit (iPhone 15, iPhone SE) + Chromium. Run: node tests/run.js */
const pw = require('/workspace/tools/node_modules/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8811/';
const SHOTS = process.env.SHOTS || '/workspace/gilman/shots';
const jsQR = require('/tmp/qrg/jsqr/package/dist/jsQR.js');
const CAT = JSON.parse(fs.readFileSync(__dirname + '/../catalog.json', 'utf8'));
// Pencil Notes Quote Board parser (copied verbatim from quotes.js) to prove the RFQ body parses into line items
const qsrc = fs.readFileSync('/workspace/pencil-notes-site/quotes.js', 'utf8');
const chunk = qsrc.slice(qsrc.indexOf('const UNIT ='), qsrc.indexOf('const SPEC_RE'));
const itemsFrom = new Function(chunk + '; return itemsFrom;')();
const COMPANY_RE = /^\s*(?:company|customer|organi[sz]ation|account|client)\s*(?:name)?\s*[:\-]\s*(.{2,80})$/im;
const RFQNUM_RE = /\bRFQ\s*(?:#|no\.?|number|num\.?|ref\.?|id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-_/.]*\d[A-Z0-9\-_/]*)(?!\s*(?:pcs|pc|pieces|ea|each|units?|sets?)\b)/i;
const RFQ_RE = /\bRFQs?\b|\brequest(?:ing)?\s+(?:for|a)\s+(?:a\s+)?(?:quote|quotation)s?\b|\bquote\s+request(?:s|ed)?\b|\bquotations?\b|\bpricing\s+request(?:s)?\b/i;

let pass = 0, fail = 0; const results = [];
function ok(name, cond, extra) { if (cond) { pass++; results.push('PASS ' + name); } else { fail++; results.push('FAIL ' + name + (extra ? ' :: ' + extra : '')); } }

async function noOverflow(p) { return p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }
async function smallTargets(p) {
  return p.evaluate(() => {
    const bad = [];
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
    for (const el of document.querySelectorAll('button, a.btn, .links a, select, input:not([type=checkbox]):not([type=hidden]), textarea, label.check')) {
      if (!vis(el)) continue; const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) bad.push((el.id || el.tagName + '.' + el.className + ' ' + (el.textContent || '').trim().slice(0, 30)) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
  });
}
async function block(p) { // stop mailto/tel navigation but keep app handlers running
  await p.evaluate(() => document.addEventListener('click', e => { const a = e.target.closest('a'); if (a && /^(mailto|tel):/.test(a.getAttribute('href') || '')) e.preventDefault(); }));
}
async function sel(p, path, val) { await p.selectOption(`[data-path="${path}"]`, val); }

async function suite(browserType, deviceName, tag) {
  const b = await pw[browserType].launch();
  const ctxOpts = deviceName ? { ...pw.devices[deviceName] } : { viewport: { width: 1280, height: 900 } };
  if (browserType === 'webkit' || !deviceName) delete ctxOpts.defaultBrowserType;
  if (browserType === 'chromium' && ctxOpts.isMobile === undefined) {}
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const T = n => `[${tag}] ${n}`, shot = async n => (await p.evaluate(() => { const t = document.querySelector('#toast'); if (t) t.hidden = true; }), p.screenshot({ path: `${SHOTS}/${tag}-${n}.png`, fullPage: false }));
  await p.goto(BASE, { waitUntil: 'networkidle' }); await block(p);
  ok(T('loads with noindex + Demo tag'), await p.evaluate(() => /noindex/.test(document.querySelector('meta[name=robots]').content) && /demo/i.test(document.querySelector('.demo').textContent)));
  ok(T('deal badge shows 3 unseen (expired hidden)'), (await p.textContent('#dealBadge')) === '3' && !(await p.isHidden('#dealBadge')));
  ok(T('quote view no horizontal overflow'), await noOverflow(p));
  await shot('01-quote');
  // catalog-driven dropdowns for every product
  let ddOK = true, ddMsg = '';
  for (const prod of CAT.products) {
    await p.evaluate(() => { const b = document.querySelector('#toggleAll'); });
    await p.evaluate(id => { const btn = [...document.querySelectorAll('.pbtn[data-pick]')].find(b => b.dataset.pick === id); if (!btn) { document.querySelector('[data-app]').click(); } }, prod.id);
    // show all boards so every product is pickable
    if (await p.$(`.pbtn[data-pick="${prod.id}"]`) == null) { if (await p.$('#toggleAll')) await p.click('#toggleAll'); }
    await p.click(`#plist .pbtn[data-pick="${prod.id}"]`);
    const g = await p.$$eval('[data-path="ed.gauge"] option', os => os.map(o => o.value).filter(Boolean));
    const s = await p.$$eval('[data-path="ed.size"] option', os => os.map(o => o.value).filter(Boolean));
    const c = await p.$$eval('[data-path="ed.color"] option', os => os.map(o => o.value).filter(Boolean));
    const expG = prod.gauges.listed.concat(prod.gauges.otherAllowed ? ['__other'] : []), expS = prod.sizes.listed.concat(prod.sizes.customAllowed ? ['__custom'] : []);
    if (JSON.stringify(g) !== JSON.stringify(expG) || JSON.stringify(s) !== JSON.stringify(expS) || JSON.stringify(c) !== JSON.stringify(prod.colors)) { ddOK = false; ddMsg += `${prod.id}: g=${g} s=${s} c=${c}; `; }
    for (const v of prod.variants || []) { const vo = await p.$$eval(`[data-path="ed.v.${v.key}"] option`, os => os.map(o => o.value).filter(Boolean)); if (JSON.stringify(vo) !== JSON.stringify(v.options)) { ddOK = false; ddMsg += `${prod.id} variant ${v.key}; `; } }
    const units = await p.$$eval('[data-path="ed.unit"] option', os => os.map(o => o.value).filter(Boolean));
    if (JSON.stringify(units) !== JSON.stringify(prod.units)) { ddOK = false; ddMsg += `${prod.id} units; `; }
  }
  ok(T('dropdowns match catalog for all 16 products (gauge/size/color/variants/units)'), ddOK, ddMsg);
  // INFINITY 3mm constraint
  await p.click('#plist .pbtn[data-pick="infinity"]'); await sel(p, 'ed.gauge', '3mm');
  const c3 = await p.$$eval('[data-path="ed.color"] option', os => os.map(o => o.value).filter(Boolean));
  ok(T('INFINITY 3mm limits color to White only'), c3.length === 1 && /White core \/ White faces/.test(c3[0]));
  // reset & app filter
  await p.click('#resetDraft'); await p.waitForTimeout(100);
  await p.click('[data-app="mount-frame"]');
  const recs = await p.$$eval('#plist .pbtn', bs => bs.map(b => b.dataset.pick));
  const mf = CAT.applications.find(a => a.id === 'mount-frame');
  ok(T('application filter shows site products + also-fits'), JSON.stringify(recs) === JSON.stringify(mf.products.concat(mf.alsoFits)), recs.join(','));
  // validation: add incomplete item
  await p.click('#plist .pbtn[data-pick="insite-psa"]');
  ok(T('single-option fields auto-selected (InSite PSA gauge 3/16")'), (await p.inputValue('[data-path="ed.gauge"]')) === '3/16"');
  await p.click('#addItem');
  const edErrs = await p.$$eval('#c-spec .err', es => es.map(e => e.textContent).filter(Boolean));
  ok(T('incomplete line item is blocked with field errors'), edErrs.length >= 3, edErrs.join('|'));
  await sel(p, 'ed.size', '48" x 96"'); await sel(p, 'ed.color', 'Black'); await sel(p, 'ed.v.tack', 'High-Tack'); await p.fill('[data-path="ed.qty"]', '250');
  await shot('02-specs');
  await p.click('#addItem');
  ok(T('line 1 added'), (await p.$$('#items .item')).length === 1);
  // second line: INFINITY with "other" gauge and custom size out of range
  await p.click('#toggleAll'); await p.click('#plist .pbtn[data-pick="infinity"]');
  await sel(p, 'ed.gauge', '__other'); await p.fill('[data-path="ed.gaugeOther"]', '3/8"');
  await sel(p, 'ed.size', '__custom'); await p.fill('[data-path="ed.sizeW"]', '70'); await p.fill('[data-path="ed.sizeL"]', '100');
  ok(T('custom size outside range shows warning'), /Outside the published range/.test(await p.textContent('#sizeChk')));
  await p.fill('[data-path="ed.sizeW"]', '48'); await p.fill('[data-path="ed.sizeL"]', '96');
  ok(T('custom size inside range shows OK'), /Within the published range/.test(await p.textContent('#sizeChk')));
  await sel(p, 'ed.color', 'Black core / Black faces'); await p.fill('[data-path="ed.qty"]', '40'); await sel(p, 'ed.unit', 'skids'); await p.fill('[data-path="ed.note"]', 'print side up');
  await p.click('#addItem');
  // third line: EAGLECELL then duplicate + edit
  await p.click('#plist .pbtn[data-pick="eaglecell"]'); await sel(p, 'ed.gauge', '1/2"'); await sel(p, 'ed.size', '60" x 144"'); await sel(p, 'ed.color', 'White/Kraft/White'); await p.fill('[data-path="ed.qty"]', '1200');
  ok(T('sq ft estimate shown for sheets'), /≈ 72,000 sq\. ft\./.test(await p.textContent('#sqft')), await p.textContent('#sqft'));
  await p.click('#addItem');
  await p.click('#items [data-dup="2"]'); await p.click('#items [data-edit="3"]'); await p.fill('[data-path="ed.qty"]', '600'); await p.click('#addItem');
  const itemsTxt = await p.$$eval('#items .item', is => is.map(i => i.textContent));
  ok(T('multiple line items with duplicate + edit'), itemsTxt.length === 4 && /600 sheets/.test(itemsTxt[3]) && /1,200 sheets/.test(itemsTxt[2]), itemsTxt.length + '');
  await p.click('#items [data-del="3"]');
  ok(T('remove line item'), (await p.$$('#items .item')).length === 3);
  await p.evaluate(() => document.querySelector('#c-items').scrollIntoView()); await shot('03-items');
  // validation on review
  await p.click('#review'); await p.waitForTimeout(200);
  const reqErr = await p.$$eval('#v-quote .err', es => es.filter(e => e.textContent).map(e => e.dataset.err));
  ok(T('review blocks missing required fields'), ['delivery.date', 'delivery.state', 'customer.company', 'customer.city', 'customer.state', 'customer.contact', 'customer.email', 'customer.type'].every(k => reqErr.includes(k)), reqErr.join(','));
  ok(T('sheet not opened when invalid'), await p.isHidden('#sheet'));
  await shot('04-validation');
  const fut = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10), past = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  await p.fill('[data-path="delivery.date"]', past); await sel(p, 'delivery.state', 'CT');
  await p.fill('[data-path="customer.company"]', 'Acme Sign & Display Co.'); await p.fill('[data-path="customer.city"]', 'Hartford'); await sel(p, 'customer.state', 'CT');
  await p.fill('[data-path="customer.contact"]', 'Jane Doe'); await p.fill('[data-path="customer.email"]', 'jane@acme'); await sel(p, 'customer.type', 'Sign shop');
  await p.click('#review'); await p.waitForTimeout(150);
  const e2 = await p.$$eval('#v-quote .err', es => es.filter(e => e.textContent).map(e => e.dataset.err));
  ok(T('past date and bad email rejected'), e2.includes('delivery.date') && e2.includes('customer.email') && e2.length === 2, e2.join(','));
  await p.fill('[data-path="delivery.date"]', fut); await p.fill('[data-path="customer.email"]', 'jane@acme-signs.com'); await p.fill('[data-path="customer.phone"]', '(860) 555-0123');
  await p.fill('[data-path="customer.distributor"]', 'Kelly Spicers'); await p.check('[data-path="delivery.rush"]');
  await sel(p, 'jobUse', 'POP & retail displays'); await sel(p, 'heard', 'Trade show (PRINTING United, GlobalShop, etc.)');
  await p.fill('[data-path="notes"]', 'Need pricing for "A" & B options; 50/50 split.'); await p.check('[data-path="attach"]'); await p.fill('[data-path="attachNote"]', 'dieline PDF'); await p.check('[data-path="newsletter"]');
  await p.click('#review'); await p.waitForSelector('#sheet:not([hidden])');
  const href = await p.getAttribute('#openMail', 'href');
  const u = new URL(href), subj = u.searchParams.get('subject'), body = u.searchParams.get('body');
  ok(T('mailto goes to quotes@gilmanbrothers.com'), href.startsWith('mailto:quotes@gilmanbrothers.com?'));
  ok(T('subject format RUSH RFQ – Company – Product +N more'), subj === 'RUSH RFQ – Acme Sign & Display Co. – InSite® Self-Adhesive +2 more', subj);
  ok(T('mailto encodes CRLF, ®, quotes, &, #'), /%0D%0A/.test(href) && /%C2%AE/.test(href) && !/[\s"&<>]/.test(href.split('?')[1].replace(/&body=/, '').replace(/^subject=/, '')) && /%26/.test(href), '');
  ok(T('body has all labeled fields'), ['RFQ #: GQ-', 'Company: Acme Sign & Display Co.', 'Contact: Jane Doe', 'Email: jane@acme-signs.com', 'Phone: (860) 555-0123', 'Customer type: Sign shop', 'City/State: Hartford, CT', 'Preferred distributor: Kelly Spicers', 'Delivery required by:', 'Delivery state: CT', 'Rush: YES', 'Job / end use: POP & retail displays', 'Heard about Gilman via: Trade show', 'Attachments: customer will attach', 'Newsletter opt-in: Yes', 'Need pricing for "A" & B options'].every(s => body.includes(s)), body);
  ok(T('line 1 text exact'), body.includes('1. Qty 250 sheets – InSite® Self-Adhesive – Gauge 3/16" – Size 48" x 96" – Color Black – Adhesive High-Tack'));
  ok(T('line 2 other gauge + custom size'), body.includes('2. Qty 40 skids – INFINITY® – Gauge 3/8" (requested) – Size 48" x 96" (custom) – Color Black core / Black faces') && body.includes('Item note: print side up'));
  ok(T('mailto length under limit'), href.length < 7000, href.length + '');
  // Pencil Notes Quote Board parse
  const parsed = itemsFrom(body.replace(/\r\n/g, '\n'));
  ok(T('Quote Board parser: RFQ detected'), RFQ_RE.test(subj));
  ok(T('Quote Board parser: company'), (body.match(COMPANY_RE) || [])[1] === 'Acme Sign & Display Co.');
  ok(T('Quote Board parser: RFQ number from body'), /^GQ-\d{6}-[A-Z0-9]{4}$/.test(((subj + '\n' + body).match(RFQNUM_RE) || [])[1] || ''), ((subj + '\n' + body).match(RFQNUM_RE) || [])[1]);
  ok(T('Quote Board parser: 3 line items with qty'), parsed.length === 3 && parsed[0].qty === 250 && parsed[0].unit === 'sheets' && parsed[1].qty === 40 && parsed[2].qty === 1200 && /^InSite/.test(parsed[0].desc), JSON.stringify(parsed));
  await shot('05-review');
  ok(T('review sheet no overflow'), await noOverflow(p));
  // tap Open in Mail -> saved profile + recent
  await p.click('#openMail'); await p.waitForTimeout(200);
  const prof = await p.evaluate(() => JSON.parse(localStorage.getItem('gq.profile')));
  ok(T('profile saved on send'), prof && prof.company === 'Acme Sign & Display Co.' && prof.email === 'jane@acme-signs.com' && prof.distributor === 'Kelly Spicers');
  await p.click('#sheet [data-close]');
  await p.click('#resetDraft'); await p.waitForTimeout(100);
  ok(T('new request prefilled from profile'), (await p.inputValue('[data-path="customer.company"]')) === 'Acme Sign & Display Co.' && (await p.inputValue('[data-path="customer.state"]')) === 'CT' && (await p.inputValue('[data-path="delivery.state"]')) === 'CT');
  await p.reload({ waitUntil: 'networkidle' }); await block(p);
  ok(T('draft persists after reload'), (await p.inputValue('[data-path="customer.contact"]')) === 'Jane Doe');
  await p.click('.tabs [data-tab=me]');
  ok(T('recent request listed'), (await p.$$('[data-reorder]')).length === 1);
  await shot('06-me');
  ok(T('me view no overflow'), await noOverflow(p));
  await p.click('[data-reorder="0"]'); await p.waitForTimeout(150);
  ok(T('reorder loads 3 line items'), (await p.$$('#items .item')).length === 3);
  // deals
  await p.click('.tabs [data-tab=deals]'); await p.waitForTimeout(150);
  const dealIds = await p.$$eval('.deal', ds => ds.map(d => d.dataset.deal));
  ok(T('feed shows active deals pinned first, expired hidden'), dealIds.length === 3 && dealIds[0] === 'demo-infinity-3mm-tl' && !dealIds.includes('demo-expired'), dealIds.join(','));
  await shot('07-deals');
  await p.waitForTimeout(500);
  ok(T('badge clears after viewing'), await p.isHidden('#dealBadge'));
  ok(T('deals view no overflow'), await noOverflow(p));
  await p.click('[data-dealcta="demo-infinity-3mm-tl"]'); await p.waitForTimeout(200);
  ok(T('deal CTA pre-fills INFINITY 3mm / truckload'), (await p.inputValue('[data-path="ed.gauge"]')) === '3mm' && (await p.inputValue('[data-path="ed.unit"]')) === 'truckload' && (await p.inputValue('[data-path="ed.color"]')) === 'White core / White faces' && /Quoting hot deal/.test(await p.textContent('#dealNote')));
  await p.click('.tabs [data-tab=deals]'); await p.click('[data-dealcta="demo-eaglecell-pop"]'); await p.waitForTimeout(150);
  ok(T('deal CTA with unlisted size becomes custom W x L'), (await p.inputValue('[data-path="ed.size"]')) === '__custom' && (await p.inputValue('[data-path="ed.sizeW"]')) === '48');
  // explore + product sheet + sample
  await p.click('.tabs [data-tab=explore]'); await shot('08-explore');
  ok(T('explore no overflow'), await noOverflow(p));
  await p.click('details.acc summary'); await p.click('details.acc[open] .pbtn[data-detail]'); await p.waitForSelector('#sheet:not([hidden])');
  await shot('09-product');
  ok(T('product sheet lists data sheet links'), (await p.$$('#sheet .links a')).length >= 3);
  ok(T('product sheet no overflow'), await noOverflow(p));
  await p.click('#sheet [data-sample]'); await p.click('#sampleF button[type=submit]');
  ok(T('sample form validates'), (await p.$$eval('#sheet .err', es => es.filter(e => e.textContent).length)) >= 2);
  await p.fill('#sampleF [name=street]', '1 Main St'); await p.fill('#sampleF [name=zip]', '06103');
  await p.click('#sampleF button[type=submit]'); await p.waitForSelector('#openMail');
  const sh = await p.getAttribute('#openMail', 'href'); const su = new URL(sh);
  ok(T('sample request → sales@ labeled SAMPLE REQUEST'), sh.startsWith('mailto:sales@gilmanbrothers.com?') && /^SAMPLE REQUEST – Acme Sign & Display Co\./.test(su.searchParams.get('subject')) && /Ship to:/.test(su.searchParams.get('body')), su.searchParams.get('subject'));
  await shot('10-sample');
  await p.click('#sheet [data-close]');
  await p.click('#findDist'); await p.fill('#distF [name=need]', 'INFINITY 3/16 white 48x96, 200 sheets/month'); await p.click('#distF button[type=submit]'); await p.waitForSelector('#openMail');
  ok(T('distributor referral email builds'), /^mailto:sales@gilmanbrothers\.com\?subject=DISTRIBUTOR%20REFERRAL/.test(await p.getAttribute('#openMail', 'href')));
  await p.click('#sheet [data-close]');
  // share / QR
  await p.click('.tabs [data-tab=share]'); await p.fill('#qrTag', 'PU2026-booth'); await p.waitForTimeout(100);
  const qr = await p.evaluate(() => { const c = document.querySelector('#qrBox canvas'); const g = c.getContext('2d'); return { w: c.width, h: c.height, d: Array.from(g.getImageData(0, 0, c.width, c.height).data) }; });
  const dec = jsQR(Uint8ClampedArray.from(qr.d), qr.w, qr.h);
  ok(T('QR decodes to app URL with ref tag'), dec && dec.data === 'https://josephnrossi.github.io/gilman-quote/?ref=PU2026-booth', dec && dec.data);
  await shot('11-share');
  ok(T('share no overflow'), await noOverflow(p));
  // ref attribution
  await p.goto(BASE + '?ref=PU2026-booth', { waitUntil: 'networkidle' }); await block(p);
  const body2 = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(GQ.draft)); return GQ.buildRFQ(Object.assign(d, { items: d.items.length ? d.items : [{ productId: 'ryno-board', gauge: '1/4"', size: '24" x 36"', color: 'White', variants: { adhesive: 'Standard (no adhesive)' }, qty: '10', unit: 'sheets', note: '' }] }), 'GQ-TEST').body; });
  ok(T('?ref= tag included in RFQ for attribution'), /App link ref: PU2026-booth/.test(body2));
  // long body fallback
  await p.evaluate(() => { const d = GQ.draft; const it = { productId: 'ryno-board', gauge: '1/4"', size: '24" x 36"', color: 'White', variants: { adhesive: 'Standard (no adhesive)' }, qty: '10', unit: 'sheets', note: 'x'.repeat(100) }; d.items = Array.from({ length: 40 }, () => JSON.parse(JSON.stringify(it))); localStorage.setItem('gq.draft', JSON.stringify(d)); });
  await p.reload({ waitUntil: 'networkidle' }); await block(p);
  await p.fill('[data-path="delivery.date"]', fut);
  await p.click('#review'); await p.waitForSelector('#sheet:not([hidden])');
  ok(T('very long RFQ falls back to Copy & open Mail'), !!(await p.$('#copyOpen')) && !(await p.$('#openMail')));
  await p.click('#sheet [data-close]');
  // deep link
  await p.goto(BASE + '#p=mountcor', { waitUntil: 'networkidle' }); await p.waitForTimeout(200);
  ok(T('#p= deep link opens product sheet'), /MountCor®/.test(await p.textContent('#sheet h2')) && !(await p.isHidden('#sheet')));
  await p.click('#sheet [data-close]');
  // touch targets across views
  let small = [];
  for (const t of ['quote', 'deals', 'explore', 'share', 'me']) { await p.click(`.tabs [data-tab=${t}]`); await p.evaluate(() => document.querySelectorAll('details.acc').forEach(d => d.open = true)); small = small.concat((await smallTargets(p)).map(s => t + ':' + s)); if (!(await noOverflow(p))) small.push(t + ': OVERFLOW'); }
  await p.click('.tabs [data-tab=quote]'); await p.click('[data-app="print-fab"]'); await p.click('#plist .pbtn[data-pick="infinity"]'); small = small.concat((await smallTargets(p)).map(s => 'editor:' + s));
  ok(T('all tap targets ≥ 44pt and no overflow on every tab'), small.length === 0, small.slice(0, 12).join(' | '));
  // push config off
  ok(T('push disabled by default (config flag)'), await p.evaluate(() => GQPush.status().enabled === false && GQ_PUSH.enabled === false));
  // admin
  await p.goto(BASE + 'admin.html', { waitUntil: 'networkidle' });
  await p.fill('#title', 'Test truckload special'); await p.fill('#details', 'Testing admin'); await p.fill('#expires', fut); await p.selectOption('#cp', 'ryno-board'); await p.selectOption('#cg', '1/2"');
  await p.click('#save');
  const out = JSON.parse(await p.inputValue('#out'));
  const added = out.items.find(i => i.title === 'Test truckload special');
  ok(T('admin generates deals.json with new item + CTA'), added && added.cta.productId === 'ryno-board' && added.cta.gauge === '1/2"' && added.products.includes('ryno-board') && out.items.length === 5);
  ok(T('admin noindex'), await p.evaluate(() => /noindex/.test(document.querySelector('meta[name=robots]').content)));
  await shot('12-admin');
  ok(T('admin no overflow'), await noOverflow(p));
  ok(T('no JS errors'), errs.length === 0, errs.join(' | '));
  await b.close();
}
(async () => {
  const which = (process.argv[2] || 'all');
  if (which === 'all' || which === 'webkit') { await suite('webkit', 'iPhone 15', 'iphone15'); await suite('webkit', 'iPhone SE (3rd gen)', 'iphoneSE'); }
  if (which === 'all' || which === 'chromium') { await suite('chromium', null, 'desktop'); await suite('chromium', 'iPhone SE', 'chromium-320'); }
  console.log(results.join('\n')); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(results.join('\n')); process.exit(2); });
