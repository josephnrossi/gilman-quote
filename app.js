/* Gilman Quote (demo) — RFQ builder for The Gilman Brothers Company product line.
   Static PWA: product data comes from catalog.json (scraped from gilmanbrothers.com), deals from deals.json.
   Requests go out through the user's own Mail app (mailto:), so nothing is ever sent silently. */
(() => {
'use strict';
const VERSION = '1.0.0';
const QUOTES_TO = 'quotes@gilmanbrothers.com';
const SALES_TO = 'sales@gilmanbrothers.com';
const APP_URL = 'https://josephnrossi.github.io/gilman-quote/';
const MAILTO_MAX = 7000; // longer mailto: URLs get truncated by some mail apps; above this we copy instead
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('gq.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('gq.' + k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem('gq.' + k); } catch (_) {} }
};
const STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['PR','Puerto Rico'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['AB','Alberta (Canada)'],['BC','British Columbia (Canada)'],['MB','Manitoba (Canada)'],['NB','New Brunswick (Canada)'],['NL','Newfoundland and Labrador (Canada)'],['NS','Nova Scotia (Canada)'],['ON','Ontario (Canada)'],['PE','Prince Edward Island (Canada)'],['QC','Quebec (Canada)'],['SK','Saskatchewan (Canada)'],['NT','Northwest Territories (Canada)'],['NU','Nunavut (Canada)'],['YT','Yukon (Canada)']];
const CUSTOMER_TYPES = ['Distributor', 'Distributor sales rep', 'Sign shop', 'Printer (wide-format / commercial)', 'Framer / frame shop', 'Photographer / photo lab', 'Display / exhibit fabricator', 'Packaging converter', 'Retail brand / end user', 'Other'];
const HEARD = ['Distributor rep', 'Gilman sales rep', 'Trade show (PRINTING United, GlobalShop, etc.)', 'Website / web search', 'LinkedIn', 'Instagram', 'Facebook', 'YouTube', 'Colleague / referral', 'Sample or swatch', 'Already a customer', 'Other'];
const SPOTLIGHT = [
  { title: 'Resilient® ALIGN® – slide-into-place photo mounting', text: 'Slidable non-tack, pressure-activated adhesive with air-release and spring-back foam. Gilman announced the launch as "highly anticipated".', product: 'resilient-align', url: 'https://gilmanbrothers.com/wp-content/uploads/2024/03/pr-gilman-brothers-announces-launch-of-resilient-align.pdf', label: 'Launch announcement' },
  { title: 'ADHERE™ removable wall fastener', text: 'Damage-free removable hanging tabs (2"x2", 3"x3", 4"x4", 1"x4"); holds up to ½ lb per sq. in. Attendees at Gilman\'s booth called it "magic".', product: 'adhere', url: 'https://gilmanbrothers.com/adhere/', label: 'ADHERE page' },
  { title: 'EAGLECELL® – the all-paper, recyclable graphics board', text: 'Honeycomb paper core, triple-thick clay-coated liners, Blue Bin qualified. A plastic-free option for POP, packaging and exhibits.', product: 'eaglecell', url: 'https://gilmanbrothers.com/sustainability/', label: 'Sustainability' },
  { title: 'Printer certifications', text: 'Gilman news: HP Latex R530 printer certification, and specialized InSite® Reveal® approved globally for the HP PageWide platform.', product: 'insite-reveal', url: 'https://gilmanbrothers.com/news/', label: 'Gilman news' }
];
let CAT = null, DEALS = { items: [] }, view = 'quote';
let draft = LS.get('draft', null) || newDraft();
let editor = draft.editor || blankItem();
let showAll = false;
const ref = (() => { try { const r = new URLSearchParams(location.search).get('ref'); if (r) { const v = r.replace(/[^\w.\- ]/g, '').slice(0, 40); LS.set('ref', v); return v; } } catch (_) {} return LS.get('ref', ''); })();

function newDraft(prof) {
  const p = prof || LS.get('profile', {});
  return { app: '', items: [], delivery: { date: '', state: p.state || '', city: '', rush: false, quoteBy: '' },
    customer: { company: p.company || '', city: p.city || '', state: p.state || '', contact: p.contact || '', phone: p.phone || '', email: p.email || '', type: p.type || '', distributor: p.distributor || '', referMe: false },
    jobUse: '', jobDetail: '', heard: p.heard || '', notes: '', attach: false, attachNote: '', newsletter: LS.get('prefs', {}).newsletter || false, deal: null };
}
function blankItem(productId) { return { productId: productId || '', gauge: '', gaugeOther: '', size: '', sizeW: '', sizeL: '', color: '', variants: {}, qty: '', unit: '', note: '' }; }
function save() { draft.editor = editor; LS.set('draft', draft); }
const P = id => CAT && CAT.products.find(p => p.id === id);
const appName = id => (CAT.applications.find(a => a.id === id) || {}).name || '';

/* ---------- toast & sheet ---------- */
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
function openSheet(html, onMount) { $('#toast').hidden = true; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('#sheetBg').hidden = false; $('#sheet').scrollTop = 0; document.body.style.overflow = 'hidden'; if (onMount) onMount($('#sheetBody')); }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; document.body.style.overflow = ''; }

/* ---------- product option helpers (only values stated on gilmanbrothers.com) ---------- */
const OTHER = '__other', CUSTOM = '__custom';
function colorsFor(p, gauge) { let c = p.colors.slice(); for (const k of p.constraints || []) if (k.if && k.if.gauge === gauge) c = k.colors.slice(); return c; }
function parseSize(s) { const m = String(s).match(/(\d+(?:\.\d+)?)\s*["″]?\s*[x×]\s*(\d+(?:\.\d+)?)/); return m ? [+m[1], +m[2]] : null; }
function itemSizeText(it) { return it.size === CUSTOM ? `${it.sizeW}" x ${it.sizeL}" (custom)` : it.size; }
function itemGaugeText(it) { return it.gauge === OTHER ? `${it.gaugeOther} (requested)` : it.gauge; }
function sizeCheck(p, w, l) {
  const s = p.sizes, a = Math.min(w, l), b = Math.max(w, l);
  if (s.maxW == null) return { ok: true, msg: 'Custom sizes available – Gilman will confirm.' };
  const inRange = a >= (s.minW || 0) && b >= (s.minL || 0) && a <= s.maxW && b <= s.maxL;
  return inRange ? { ok: true, msg: `Within the published range (${s.min} to ${s.max}).` } : { ok: false, msg: `Outside the published range (${s.min} to ${s.max}). It can still be requested as a custom size; Gilman's policy lists a 75,000 sq. ft. MOQ on custom orders.` };
}
function sqft(it) { const p = P(it.productId); if (!p || !/^sheets$/.test(it.unit)) return 0; const d = it.size === CUSTOM ? [+it.sizeW, +it.sizeL] : parseSize(it.size); if (!d || !d[0] || !d[1]) return 0; return Math.round(d[0] * d[1] / 144 * (+it.qty || 0)); }
function validateItem(it) {
  const e = {}, p = P(it.productId);
  if (!p) { e.productId = 'Pick a product'; return e; }
  if (!it.gauge) e.gauge = 'Pick a gauge'; else if (it.gauge === OTHER && !String(it.gaugeOther).trim()) e.gaugeOther = 'Type the gauge you need';
  if (!it.size) e.size = 'Pick a size'; else if (it.size === CUSTOM) { if (!(+it.sizeW > 0)) e.sizeW = 'Width'; if (!(+it.sizeL > 0)) e.sizeL = 'Length'; }
  if (!it.color) e.color = 'Pick a color'; else if (!colorsFor(p, it.gauge).includes(it.color)) e.color = 'Not available in this gauge';
  for (const v of p.variants || []) if (!it.variants[v.key]) e['v.' + v.key] = 'Pick ' + v.label.toLowerCase();
  if (!(Number.isInteger(+it.qty) && +it.qty > 0)) e.qty = 'Enter a quantity (whole number)';
  if (!it.unit) e.unit = 'Unit';
  return e;
}
function itemLine(it, i) {
  const p = P(it.productId), parts = [`${i + 1}. Qty ${(+it.qty).toLocaleString('en-US')} ${it.unit}`, p.name, `Gauge ${itemGaugeText(it)}`, `Size ${itemSizeText(it)}`, `Color ${it.color}`];
  for (const v of p.variants || []) if (it.variants[v.key]) parts.push(`${v.label} ${it.variants[v.key]}`);
  return parts.join(' – ');
}

/* ---------- RFQ email ---------- */
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${iso})`; }
function rfqId() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `GQ-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function buildRFQ(d, id) {
  const c = d.customer, first = P(d.items[0].productId), more = d.items.length > 1 ? ` +${d.items.length - 1} more` : '';
  const subject = `${d.delivery.rush ? 'RUSH ' : ''}RFQ – ${c.company.trim()} – ${first.name}${more}`;
  const L = [];
  L.push('RFQ REQUEST – sent from the Gilman Quote app (demo)');
  L.push(`RFQ #: ${id}`);
  if (d.delivery.rush) L.push('Rush: YES – please expedite');
  if (d.delivery.quoteBy) L.push(`Quote needed by: ${fmtDate(d.delivery.quoteBy)}`);
  L.push('');
  L.push(`Company: ${c.company.trim()}`);
  L.push(`Contact: ${c.contact.trim()}`);
  L.push(`Email: ${c.email.trim()}`);
  if (c.phone.trim()) L.push(`Phone: ${c.phone.trim()}`);
  L.push(`Customer type: ${c.type}`);
  L.push(`City/State: ${c.city.trim()}, ${c.state}`);
  L.push(`Preferred distributor: ${c.distributor.trim() || 'None given'}${c.referMe ? ' (please refer me to a stocking distributor)' : ''}`);
  L.push('');
  L.push('LINE ITEMS');
  d.items.forEach((it, i) => { L.push(itemLine(it, i)); if (it.note && it.note.trim()) L.push(`   Item note: ${it.note.trim()}`); });
  L.push('');
  L.push('DELIVERY');
  L.push(`Delivery required by: ${fmtDate(d.delivery.date)}`);
  L.push(`Delivery state: ${d.delivery.state}`);
  if (d.delivery.city.trim()) L.push(`Delivery city/ZIP: ${d.delivery.city.trim()}`);
  L.push('');
  L.push('PROJECT');
  if (d.app) L.push(`Application: ${appName(d.app)}`);
  if (d.jobUse || d.jobDetail.trim()) L.push(`Job / end use: ${[d.jobUse, d.jobDetail.trim()].filter(Boolean).join(' – ')}`);
  if (d.heard) L.push(`Heard about Gilman via: ${d.heard}`);
  if (ref) L.push(`App link ref: ${ref}`);
  if (d.deal) L.push(`Hot deal: ${d.deal.title} [${d.deal.id}]`);
  if (d.attach) L.push(`Attachments: customer will attach photos/drawings/artwork to this email${d.attachNote.trim() ? ' – ' + d.attachNote.trim() : ''}`);
  L.push(`Newsletter opt-in: ${d.newsletter ? 'Yes' : 'No'}`);
  if (d.notes.trim()) { L.push(''); L.push('Notes:'); L.push(d.notes.trim()); }
  L.push('');
  L.push('--');
  L.push(`Sent with Gilman Quote ${VERSION} (demo). Product options from gilmanbrothers.com.`);
  return { to: QUOTES_TO, subject, body: L.join('\r\n'), id };
}
function mailtoURL(to, subject, body) { return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validateDraft(d) {
  const e = {}, c = d.customer;
  if (!d.items.length) e.items = 'Add at least one line item';
  if (!d.delivery.date) e['delivery.date'] = 'Required'; else if (d.delivery.date < todayISO()) e['delivery.date'] = 'Pick today or a future date';
  if (!d.delivery.state) e['delivery.state'] = 'Required';
  if (!c.company.trim()) e['customer.company'] = 'Required';
  if (!c.city.trim()) e['customer.city'] = 'Required';
  if (!c.state) e['customer.state'] = 'Required';
  if (!c.contact.trim()) e['customer.contact'] = 'Required';
  if (!EMAIL_RE.test(c.email.trim())) e['customer.email'] = 'Enter a valid email';
  if (c.phone.trim() && c.phone.replace(/\D/g, '').length < 10) e['customer.phone'] = 'Enter a 10-digit phone';
  if (!c.type) e['customer.type'] = 'Required';
  return e;
}
function todayISO() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

/* ---------- form field helpers ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l ?? v)}</option>`;
function selectF(path, label, options, val, req, hint, placeholder) {
  return `<label class="f"><span>${esc(label)}${req ? ' <i>*</i>' : ''}</span><select data-path="${path}" aria-label="${esc(label)}">${opt('', placeholder || 'Select…', !val)}${options.map(o => Array.isArray(o) ? opt(o[0], o[1], o[0] === val) : opt(o, o, o === val)).join('')}</select>${hint ? `<div class="hint">${hint}</div>` : ''}<div class="err" data-err="${path}"></div></label>`;
}
function inputF(path, label, val, type = 'text', req, attrs = '', hint) {
  return `<label class="f"><span>${esc(label)}${req ? ' <i>*</i>' : ''}</span><input type="${type}" data-path="${path}" value="${esc(val)}" ${attrs} aria-label="${esc(label)}">${hint ? `<div class="hint">${hint}</div>` : ''}<div class="err" data-err="${path}"></div></label>`;
}
function areaF(path, label, val, ph) { return `<label class="f"><span>${esc(label)}</span><textarea data-path="${path}" placeholder="${esc(ph || '')}" aria-label="${esc(label)}">${esc(val)}</textarea></label>`; }
function setPath(obj, path, v) { const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((o, k) => (o[k] = o[k] || {}), obj); o[last] = v; }
function showErrors(root, errs, prefix = '') {
  $$('[data-err]', root).forEach(el => { el.textContent = ''; });
  $$('.invalid', root).forEach(el => el.classList.remove('invalid'));
  for (const [k, m] of Object.entries(errs)) {
    const el = $(`[data-err="${prefix}${k}"]`, root); if (el) el.textContent = m;
    const inp = $(`[data-path="${prefix}${k}"]`, root); if (inp) inp.classList.add('invalid');
  }
}

/* ---------- QUOTE VIEW ---------- */
function famColor(f) { return ({ 'Styrene-Faced Foam Board': '#0c80a1', 'All-Paper Board': '#a07a3c', 'Paper-Faced Foam Board': '#1d4b8f', 'Styrene Sheet': '#6b7b84', 'Mounting Board': '#cd243c', 'Soft Foam Board': '#1f2a30', 'Hanging System': '#b59b62' })[f] || '#0c80a1'; }
function pbtn(p, also) { return `<button class="pbtn" type="button" data-pick="${p.id}" aria-pressed="${editor.productId === p.id}"><span class="sw" style="background:${famColor(p.family)}"></span><span><b>${esc(p.name)}</b><small>${esc(p.tagline)}</small></span>${also ? '<span class="also">also fits</span>' : ''}</button>`; }
function productButtons() {
  const a = CAT.applications.find(x => x.id === draft.app);
  if (showAll || !a) return CAT.products.map(p => pbtn(p, false)).join('');
  return [...a.products.map(id => pbtn(P(id), false)), ...a.alsoFits.map(id => pbtn(P(id), true))].join('');
}
function editorHTML() {
  const p = P(editor.productId);
  if (!p) return `<div class="empty">Pick a product above to choose gauge, size and color.</div>`;
  const g = p.gauges, s = p.sizes;
  const gOpts = g.listed.map(x => [x, x]).concat(g.otherAllowed ? [[OTHER, `Other gauge (${g.min} – ${g.max})…`]] : []);
  const sOpts = s.listed.map(x => [x, x]).concat(s.customAllowed ? [[CUSTOM, 'Custom size (W x L)…']] : []);
  const cols = colorsFor(p, editor.gauge);
  let h = `<div class="meta" style="margin-bottom:4px">${esc(p.description)} <a href="#" data-detail="${p.id}">Specs &amp; data sheets</a></div>`;
  h += selectF('ed.gauge', 'Gauge / thickness', gOpts, editor.gauge, true, `Site range: ${esc(g.min)}${g.max !== g.min ? ' – ' + esc(g.max) : ''}`);
  if (editor.gauge === OTHER) h += inputF('ed.gaugeOther', 'Gauge you need', editor.gaugeOther, 'text', true, `placeholder="e.g. 3/8&quot;" maxlength="20"`);
  h += selectF('ed.size', 'Sheet size', sOpts, editor.size, true, `Site range: ${esc(s.min)}${s.max !== s.min ? ' to ' + esc(s.max) : ''}${s.note ? ' · ' + esc(s.note) : ''}`);
  if (editor.size === CUSTOM) {
    const chk = (+editor.sizeW > 0 && +editor.sizeL > 0) ? sizeCheck(p, +editor.sizeW, +editor.sizeL) : null;
    h += `<div class="row3"><label class="f"><span>Width (in) <i>*</i></span><input type="number" inputmode="decimal" min="1" step="0.125" data-path="ed.sizeW" value="${esc(editor.sizeW)}" aria-label="Width in inches"><div class="err" data-err="ed.sizeW"></div></label><span class="x">×</span><label class="f"><span>Length (in) <i>*</i></span><input type="number" inputmode="decimal" min="1" step="0.125" data-path="ed.sizeL" value="${esc(editor.sizeL)}" aria-label="Length in inches"><div class="err" data-err="ed.sizeL"></div></label></div>`;
    if (chk) h += `<div class="note ${chk.ok ? '' : 'warn'}" id="sizeChk">${esc(chk.msg)}</div>`;
  }
  h += selectF('ed.color', 'Color / configuration', cols, editor.color, true, esc(p.colorNote || ''));
  for (const v of p.variants || []) h += selectF('ed.v.' + v.key, v.label, v.options, editor.variants[v.key], true);
  h += `<div class="row"><label class="f"><span>Quantity <i>*</i></span><input type="number" inputmode="numeric" min="1" step="1" data-path="ed.qty" value="${esc(editor.qty)}" aria-label="Quantity"><div class="err" data-err="ed.qty"></div></label>${selectF('ed.unit', 'Unit', p.units, editor.unit || p.units[0], true)}</div>`;
  h += `<div class="hint" id="sqft">${sqftText()}</div>`;
  h += inputF('ed.note', 'Line note (optional)', editor.note, 'text', false, 'maxlength="140" placeholder="e.g. print side up, cut-to-size, PO #"');
  h += `<div class="btns"><button type="button" class="btn teal" id="addItem">${editor._editIndex != null ? '✓ Update line ' + (editor._editIndex + 1) : '＋ Add to request'}</button></div>`;
  return h;
}
function sqftText() { const v = sqft(editor); return v ? `≈ ${v.toLocaleString('en-US')} sq. ft.` : 'Pack counts per case/skid are not published on the site – your rep will confirm.'; }
function itemsHTML() {
  if (!draft.items.length) return `<div class="empty">No line items yet. Configure a product above, then tap “Add to request”. Add as many as you need.</div>`;
  return draft.items.map((it, i) => { const p = P(it.productId); return `<div class="item"><div class="t">${i + 1}. ${esc(p ? p.name : it.productId)}</div><div class="d">${esc(itemGaugeText(it))} · ${esc(itemSizeText(it))} · ${esc(it.color)}${Object.values(it.variants || {}).map(v => ' · ' + esc(v)).join('')}<br><b>${(+it.qty).toLocaleString('en-US')} ${esc(it.unit)}</b>${it.note ? ' · ' + esc(it.note) : ''}</div><div class="a"><button class="btn ghost sm" type="button" data-edit="${i}">Edit</button><button class="btn ghost sm" type="button" data-dup="${i}">Duplicate</button><button class="btn ghost sm" type="button" data-del="${i}" aria-label="Remove item ${i + 1}">Remove</button></div></div>`; }).join('');
}
function renderQuote() {
  const d = draft, c = d.customer, prof = LS.get('profile', null), app = CAT.applications.find(a => a.id === d.app);
  $('#v-quote').innerHTML = `
  <h1>Request a quote</h1>
  <p class="sub">Pick the job, the board and the specs. The app writes the RFQ email to <b>${QUOTES_TO}</b> – you just tap Send.</p>
  ${d.deal ? `<div class="note" id="dealNote">🔥 Quoting hot deal: <b>${esc(d.deal.title)}</b> <button class="btn ghost sm" type="button" id="clearDeal" style="margin-left:6px">Remove</button></div>` : ''}
  <div class="card" id="c-app"><div class="step"><span class="n">1</span><h2>What's the application?</h2></div>
    <div class="chips" style="flex-direction:column">${CAT.applications.map(a => `<button type="button" class="chip app-chip" data-app="${a.id}" aria-pressed="${d.app === a.id}">${esc(a.name)}<small>${esc(a.blurb)}</small></button>`).join('')}</div>
    <label class="f"><span>Or browse by end use</span><select id="endUse" aria-label="Browse by end use">${opt('', 'Choose an end use…', true)}${CAT.endUses.map((e, i) => opt(String(i), e.label)).join('')}</select></label>
    <div id="endUseOut"></div>
  </div>
  <div class="card" id="c-prod"><div class="step"><span class="n">2</span><h2>${app && !showAll ? 'Recommended boards' : 'All boards'}</h2></div>
    ${app ? `<div class="meta">${esc(app.name)}: boards Gilman lists for this application${app.alsoFits.length ? ', plus boards whose “ideal for” list fits' : ''}.</div>` : '<div class="meta">Pick an application to narrow the list.</div>'}
    <div class="plist" id="plist">${productButtons()}</div>
    ${app ? `<button type="button" class="btn ghost sm" id="toggleAll" style="margin-top:8px">${showAll ? 'Show recommended only' : `Show all ${CAT.products.length} boards`}</button>` : ''}
    <div class="err" data-err="ed.productId"></div>
  </div>
  <div class="card" id="c-spec"><div class="step"><span class="n">3</span><h2 id="specH">Specs${P(editor.productId) ? ' – ' + esc(P(editor.productId).name) : ''}</h2></div><div id="editor">${editorHTML()}</div></div>
  <div class="card" id="c-items"><div class="step"><span class="n">4</span><h2>Line items <span class="pill" id="itemCount">${d.items.length}</span></h2></div><div class="items" id="items">${itemsHTML()}</div><div class="err" data-err="items"></div></div>
  <div class="card" id="c-del"><div class="step"><span class="n">5</span><h2>Delivery</h2></div>
    <div class="row">${inputF('delivery.date', 'Delivery required by', d.delivery.date, 'date', true, `min="${todayISO()}"`)}${selectF('delivery.state', 'Delivery state', STATES, d.delivery.state, true)}</div>
    ${inputF('delivery.city', 'Delivery city / ZIP (optional)', d.delivery.city, 'text', false, 'maxlength="60"')}
    <label class="check"><input type="checkbox" data-path="delivery.rush" ${d.delivery.rush ? 'checked' : ''}> <span><b>Rush</b> – flag this RFQ as urgent</span></label>
    ${inputF('delivery.quoteBy', 'Quote needed by (optional)', d.delivery.quoteBy, 'date', false, `min="${todayISO()}"`)}
    <div class="hint">Gilman freight policy: orders under truckload ship FOB Gilman, CT; truckloads prepaid.</div>
  </div>
  <div class="card" id="c-cust"><div class="step"><span class="n">6</span><h2>Your company</h2></div>
    ${prof && prof.company ? `<div class="hint">Filled from your saved profile (edit it under Me).</div>` : ''}
    ${inputF('customer.company', 'Company name', c.company, 'text', true, 'autocomplete="organization" maxlength="80"')}
    <div class="row">${inputF('customer.city', 'City', c.city, 'text', true, 'autocomplete="address-level2" maxlength="60"')}${selectF('customer.state', 'State / province', STATES, c.state, true)}</div>
    ${inputF('customer.contact', 'Contact name', c.contact, 'text', true, 'autocomplete="name" maxlength="60"')}
    <div class="row">${inputF('customer.email', 'Email', c.email, 'email', true, 'autocomplete="email" inputmode="email" maxlength="80"')}${inputF('customer.phone', 'Phone', c.phone, 'tel', false, 'autocomplete="tel" inputmode="tel" maxlength="24"')}</div>
    ${selectF('customer.type', 'Customer type', CUSTOMER_TYPES, c.type, true)}
    <label class="f"><span>Preferred distributor</span><input type="text" data-path="customer.distributor" value="${esc(c.distributor)}" list="distList" maxlength="80" placeholder="Who you buy Gilman board from" aria-label="Preferred distributor"><datalist id="distList">${[...new Set(LS.get('recent', []).map(r => r.distributor).filter(Boolean))].map(x => opt(x)).join('')}</datalist><div class="hint">Gilman sells primarily through distribution. No distributor list is published on gilmanbrothers.com.</div></label>
    <label class="check"><input type="checkbox" data-path="customer.referMe" ${c.referMe ? 'checked' : ''}> <span>Please refer me to a stocking distributor</span></label>
  </div>
  <div class="card" id="c-more"><div class="step"><span class="n">7</span><h2>Project details</h2></div>
    ${selectF('jobUse', 'Job / end use', CAT.endUses.map(e => e.label).concat(['Other']), d.jobUse, false)}
    ${inputF('jobDetail', 'Describe the job (optional)', d.jobDetail, 'text', false, 'maxlength="140" placeholder="e.g. 40 floor displays for a retail chain"')}
    ${selectF('heard', 'How did you hear about Gilman?', HEARD, d.heard, false)}
    ${ref ? `<div class="hint">Opened from link ref “${esc(ref)}” – included for marketing attribution.</div>` : ''}
    ${areaF('notes', 'Notes', d.notes, 'Artwork, finishing, packaging, target price, the board you use today…')}
    <label class="check"><input type="checkbox" data-path="attach" ${d.attach ? 'checked' : ''}> <span>I'll attach photos, drawings or artwork in Mail</span></label>
    ${d.attach ? inputF('attachNote', 'What you will attach', d.attachNote, 'text', false, 'maxlength="100" placeholder="e.g. dieline PDF, photo of current display"') : ''}
    <label class="check"><input type="checkbox" data-path="newsletter" ${d.newsletter ? 'checked' : ''}> <span>Send me Gilman product news &amp; specials</span></label>
  </div>
  <button type="button" class="btn pri block" id="review" style="margin-bottom:8px">Review &amp; send RFQ</button>
  <button type="button" class="btn ghost block" id="resetDraft">Start a new request</button>
  <p class="foot">Demo app – not an official Gilman Brothers product. Options shown are limited to what gilmanbrothers.com publishes.</p>`;
}
function rerenderEditor() { $('#editor').innerHTML = editorHTML(); $('#specH').textContent = 'Specs' + (P(editor.productId) ? ' – ' + P(editor.productId).name : ''); }
function rerenderItems() { $('#items').innerHTML = itemsHTML(); $('#itemCount').textContent = draft.items.length; }
function pickProduct(id, keep) {
  const p = P(id); if (!p) return;
  if (!keep || editor.productId !== id) editor = blankItem(id);
  editor.unit = editor.unit || p.units[0];
  if (p.gauges.listed.length === 1 && !p.gauges.otherAllowed) editor.gauge = p.gauges.listed[0];
  if (p.sizes.listed.length === 1 && !p.sizes.customAllowed) editor.size = p.sizes.listed[0];
  const cols = colorsFor(p, editor.gauge); if (cols.length === 1) editor.color = cols[0];
  for (const v of p.variants || []) if (v.options.length === 1) editor.variants[v.key] = v.options[0];
  $$('.pbtn[data-pick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pick === id));
  if ($('#editor')) rerenderEditor();
  save();
}
function clearErr(t, path) { t.classList.remove('invalid'); const er = $(`[data-err="${path}"]`); if (er) er.textContent = ''; }
function onQuoteInput(e) {
  const t = e.target, path = t.dataset && t.dataset.path; if (!path) return;
  const val = t.type === 'checkbox' ? t.checked : t.value;
  if (path.startsWith('ed.')) {
    const k = path.slice(3), p = P(editor.productId);
    if (k.startsWith('v.')) editor.variants[k.slice(2)] = val; else editor[k] = val;
    if (k === 'gauge') { const cols = colorsFor(p, val); if (!cols.includes(editor.color)) editor.color = cols.length === 1 ? cols[0] : ''; }
    if (e.type === 'change' && (k === 'gauge' || k === 'size')) { rerenderEditor(); const el = $(`[data-path="${path}"]`); if (el) el.focus(); }
    else if (k === 'sizeW' || k === 'sizeL') {
      const chk = (+editor.sizeW > 0 && +editor.sizeL > 0) ? sizeCheck(p, +editor.sizeW, +editor.sizeL) : null; let n = $('#sizeChk');
      if (chk) { if (!n) { n = document.createElement('div'); n.id = 'sizeChk'; t.closest('.row3').after(n); } n.className = 'note ' + (chk.ok ? '' : 'warn'); n.textContent = chk.msg; } else if (n) n.remove();
    }
    const sf = $('#sqft'); if (sf) sf.textContent = sqftText();
    clearErr(t, path);
  } else {
    setPath(draft, path, val); clearErr(t, path);
    if (path === 'attach' && e.type === 'change') { renderQuote(); $('[data-path="attach"]').scrollIntoView({ block: 'center' }); }
  }
  save();
}
function addItem() {
  const errs = validateItem(editor);
  if (Object.keys(errs).length) { showErrors($('#c-spec'), errs, 'ed.'); if (errs.productId) { const er = $('[data-err="ed.productId"]'); if (er) er.textContent = errs.productId; } const f = $('#c-spec .invalid') || $('#c-prod'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Finish the highlighted specs first'); return false; }
  const it = JSON.parse(JSON.stringify(editor)), idx = it._editIndex; delete it._editIndex;
  if (it.size !== CUSTOM) { it.sizeW = ''; it.sizeL = ''; } if (it.gauge !== OTHER) it.gaugeOther = '';
  if (idx != null) { draft.items[idx] = it; toast(`Line ${idx + 1} updated`); } else { draft.items.push(it); toast(`Added line ${draft.items.length}`); }
  editor = blankItem(it.productId); pickProduct(it.productId, true); rerenderItems(); save();
  const ie = $('[data-err="items"]'); if (ie) ie.textContent = '';
  return true;
}
function review() {
  // a fully configured but not-yet-added line is added automatically
  if (P(editor.productId) && !Object.keys(validateItem(editor)).length) addItem();
  const errs = validateDraft(draft), n = Object.keys(errs).length;
  if (n) { showErrors($('#v-quote'), errs); const f = $('#v-quote .invalid') || $('#c-items'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast(`Please fix ${n} highlighted field${n > 1 ? 's' : ''}`); return; }
  const id = draft.pendingId || (draft.pendingId = rfqId()); save();
  sendSheet(buildRFQ(draft, id), 'rfq');
}
function sendSheet(m, kind) {
  const url = mailtoURL(m.to, m.subject, m.body), tooLong = url.length > MAILTO_MAX;
  const title = { rfq: 'Your RFQ is ready', sample: 'Sample request ready', dist: 'Referral request ready', resend: 'Saved request' }[kind] || 'Request ready';
  openSheet(`<h2>${title}</h2>
   <dl class="kv"><dt>To</dt><dd>${esc(m.to)}</dd><dt>Subject</dt><dd id="pvSubj">${esc(m.subject)}</dd></dl>
   <div class="preview" id="pv">${esc(m.body.replace(/\r\n/g, '\n'))}</div>
   ${tooLong ? `<div class="note warn">This request is long (${url.length.toLocaleString()} characters), and some mail apps cut long pre-filled emails. Tap <b>Copy &amp; open Mail</b>, then paste into the email body.</div>` : ''}
   <div class="btns">${tooLong ? `<button class="btn pri" type="button" id="copyOpen">Copy &amp; open Mail</button>` : `<a class="btn pri" id="openMail" href="${esc(url)}">Open in Mail</a>`}
   <button class="btn" type="button" id="copyTxt">Copy text</button>${navigator.share ? '<button class="btn" type="button" id="shareTxt">Share…</button>' : ''}</div>
   <div class="note">Nothing is sent until you tap Send in your Mail app.${kind === 'rfq' ? ' Your company details and this request are saved on this device for next time.' : ''}</div>
   <button class="btn ghost block" type="button" data-close style="margin-top:10px">${kind === 'rfq' ? 'Back to edit' : 'Close'}</button>`, root => {
    const done = how => {
      if (kind === 'rfq') recordSent(m, how);
      else if (kind === 'sample' || kind === 'dist') { const r = LS.get('recent', []); r.unshift({ id: (kind === 'sample' ? 'S-' : 'D-') + Date.now().toString(36).toUpperCase(), kind, at: Date.now(), subject: m.subject, body: m.body, to: m.to, how }); LS.set('recent', r.slice(0, 30)); }
    };
    const om = $('#openMail', root); if (om) om.addEventListener('click', () => { done('mail'); setTimeout(() => toast('Opening Mail… tap Send there'), 50); });
    const co = $('#copyOpen', root); if (co) co.addEventListener('click', async () => { await copy(m.body); done('mail-copy'); location.href = mailtoURL(m.to, m.subject, 'Paste the copied request here (press and hold, then Paste).'); });
    $('#copyTxt', root).addEventListener('click', async () => { await copy(`To: ${m.to}\nSubject: ${m.subject}\n\n${m.body.replace(/\r\n/g, '\n')}`); done('copy'); toast('Copied – paste into an email to ' + m.to); });
    const sh = $('#shareTxt', root); if (sh) sh.addEventListener('click', async () => { try { await navigator.share({ title: m.subject, text: `To: ${m.to}\nSubject: ${m.subject}\n\n${m.body.replace(/\r\n/g, '\n')}` }); done('share'); } catch (_) {} });
  });
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok;
  }
}
function recordSent(m, how) {
  const c = draft.customer;
  LS.set('profile', { company: c.company.trim(), city: c.city.trim(), state: c.state, contact: c.contact.trim(), phone: c.phone.trim(), email: c.email.trim(), type: c.type, distributor: c.distributor.trim(), heard: draft.heard });
  const prefs = LS.get('prefs', {}); prefs.newsletter = !!draft.newsletter; LS.set('prefs', prefs);
  const r = LS.get('recent', []).filter(x => x.id !== m.id);
  r.unshift({ id: m.id, kind: 'rfq', at: Date.now(), subject: m.subject, body: m.body, to: m.to, how, company: c.company.trim(), distributor: c.distributor.trim(), items: JSON.parse(JSON.stringify(draft.items)), app: draft.app, deal: draft.deal });
  LS.set('recent', r.slice(0, 30));
  draft.sentId = m.id; save();
}

/* ---------- product detail / share / sample / distributor ---------- */
function productDetail(id) {
  const p = P(id); if (!p) return;
  const apps = [...p.applications.map(a => appName(a)), ...p.alsoFits.map(a => appName(a) + ' (fits)')];
  openSheet(`<div class="prod-card"><h2>${esc(p.name)}</h2><div class="tl">${esc(p.tagline)}</div>
   <p style="margin:6px 0">${esc(p.description)}</p>
   <dl class="kv"><dt>Gauges</dt><dd>${esc(p.gauges.min)}${p.gauges.max !== p.gauges.min ? ' – ' + esc(p.gauges.max) : ''}${p.gauges.listed.length > 1 ? `<br><span class="meta">Listed: ${esc(p.gauges.listed.join(', '))}</span>` : ''}</dd>
   <dt>Sizes</dt><dd>${esc(p.sizes.min)}${p.sizes.max !== p.sizes.min ? ' to ' + esc(p.sizes.max) : ''}${p.sizes.note ? `<br><span class="meta">${esc(p.sizes.note)}</span>` : ''}</dd>
   <dt>Colors</dt><dd>${esc(p.colors.join(', '))}</dd>${apps.length ? `<dt>Used for</dt><dd>${esc(apps.join(', '))}</dd>` : ''}</dl>
   <h2 style="font-size:15px">Benefits</h2><div>${p.benefits.map(b => `<span class="pill">${esc(b)}</span>`).join('')}</div>
   <h2 style="font-size:15px;margin-top:10px">Ideal for</h2><div>${p.idealFor.map(b => `<span class="pill">${esc(b)}</span>`).join('')}</div>
   ${p.notes.length ? `<div class="note warn"><b>Unclear or conflicting on the site:</b><br>${p.notes.map(esc).join('<br>')}</div>` : ''}
   <h2 style="font-size:15px;margin-top:12px">Data sheets &amp; resources</h2><div class="links"><a href="${esc(p.url)}" target="_blank" rel="noopener">Product page on gilmanbrothers.com</a>${p.resources.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>`).join('')}</div>
   <div class="btns"><button class="btn pri" type="button" data-quote="${p.id}">Quote this</button><button class="btn" type="button" data-sample="${p.id}">Request sample</button><button class="btn" type="button" data-shareprod="${p.id}">Share</button></div>
   <button class="btn ghost block" type="button" data-close style="margin-top:10px">Close</button></div>`);
}
function quoteProduct(id, prefill) {
  closeSheet();
  const p = P(id); if (!p) return;
  const a = CAT.applications.find(x => x.id === draft.app);
  if (!a || !a.products.concat(a.alsoFits).includes(id)) draft.app = p.applications[0] || p.alsoFits[0] || '';
  showAll = false; editor = blankItem(id); go('quote'); pickProduct(id, true);
  if (prefill) {
    for (const k of ['gauge', 'size', 'color', 'qty', 'unit', 'note']) if (prefill[k] != null && prefill[k] !== '') editor[k] = String(prefill[k]);
    if (prefill.variants) Object.assign(editor.variants, prefill.variants);
    // keep only values that are real options for this board
    if (editor.gauge && !p.gauges.listed.includes(editor.gauge)) { editor.gaugeOther = p.gauges.otherAllowed ? editor.gauge : ''; editor.gauge = p.gauges.otherAllowed ? OTHER : ''; }
    if (editor.size && !p.sizes.listed.includes(editor.size)) { const d = parseSize(editor.size); if (d && p.sizes.customAllowed) { editor.sizeW = String(d[0]); editor.sizeL = String(d[1]); editor.size = CUSTOM; } else editor.size = ''; }
    if (editor.color && !colorsFor(p, editor.gauge).includes(editor.color)) editor.color = '';
    if (editor.unit && !p.units.includes(editor.unit)) editor.unit = p.units[0];
    rerenderEditor(); save();
  }
  setTimeout(() => $('#c-spec').scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
}
async function shareProduct(id) {
  const p = P(id), link = `${APP_URL}#p=${id}`;
  const text = `${p.name} – ${p.tagline} from The Gilman Brothers Company.\n${p.url}\nQuote it in a few taps: ${link}`;
  if (navigator.share) { try { await navigator.share({ title: p.name, text }); } catch (_) {} return; }
  await copy(text); toast('Product link copied');
}
const stateOpts = sel => opt('', 'Select…', !sel) + STATES.map(s => opt(s[0], s[1], s[0] === sel)).join('');
function sampleSheet(preId) {
  const prof = LS.get('profile', {}), sp = LS.get('sampleAddr', {});
  openSheet(`<h2>Request samples</h2><p class="meta">Gilman's policy page: samples are free; shipping is paid by the requester. Resilient® 8.5x11 and 24x36 (limit 2) are no charge/freight collect; 50x87 has a sample charge. This builds an email to ${SALES_TO} labeled SAMPLE REQUEST. Gilman also has an official <a href="https://gilmanbrothers.com/wp-content/uploads/2024/03/Gilman-Brothers-SAMPLE-ORDER-FORM.doc" target="_blank" rel="noopener">Sample Order Form (.doc)</a>.</p>
   <form id="sampleF" novalidate>
   <div class="f"><span style="font-size:13.5px;font-weight:600">Products <i style="color:var(--red);font-style:normal">*</i></span>${CAT.products.map(p => `<label class="check"><input type="checkbox" name="sp" value="${p.id}" ${p.id === preId ? 'checked' : ''}> <span>${esc(p.name)} <span class="meta">${esc(p.tagline)}</span></span></label>`).join('')}<div class="err" data-err="s.products"></div></div>
   <label class="f"><span>Resilient® sample size (if Resilient is checked)</span><select name="rsize" aria-label="Resilient sample size">${opt('8.5" x 11" – no charge, freight collect')}${opt('24" x 36" – no charge, freight collect (limit 2)')}${opt('50" x 87" – sample charge, freight collect')}</select></label>
   <label class="f"><span>Gauges / colors wanted (optional)</span><input type="text" name="spec" maxlength="120" placeholder="e.g. INFINITY 3/16 white, EAGLECELL 1/2 W/K/W"></label>
   <label class="f"><span>Company <i>*</i></span><input type="text" name="company" value="${esc(sp.company || prof.company || '')}" maxlength="80" autocomplete="organization"><div class="err" data-err="s.company"></div></label>
   <label class="f"><span>Contact name <i>*</i></span><input type="text" name="contact" value="${esc(sp.contact || prof.contact || '')}" maxlength="60" autocomplete="name"><div class="err" data-err="s.contact"></div></label>
   <label class="f"><span>Ship-to street address <i>*</i></span><input type="text" name="street" value="${esc(sp.street || '')}" maxlength="100" autocomplete="street-address"><div class="err" data-err="s.street"></div></label>
   <div class="row"><label class="f"><span>City <i>*</i></span><input type="text" name="city" value="${esc(sp.city || prof.city || '')}" maxlength="60"><div class="err" data-err="s.city"></div></label><label class="f"><span>State <i>*</i></span><select name="state" aria-label="State">${stateOpts(sp.state || prof.state)}</select><div class="err" data-err="s.state"></div></label></div>
   <div class="row"><label class="f"><span>ZIP / postal <i>*</i></span><input type="text" name="zip" value="${esc(sp.zip || '')}" maxlength="10" autocomplete="postal-code"><div class="err" data-err="s.zip"></div></label><label class="f"><span>Phone</span><input type="tel" name="phone" value="${esc(sp.phone || prof.phone || '')}" maxlength="24"></label></div>
   <label class="f"><span>Email <i>*</i></span><input type="email" name="email" value="${esc(sp.email || prof.email || '')}" maxlength="80"><div class="err" data-err="s.email"></div></label>
   <label class="f"><span>Freight account # (UPS/FedEx, optional)</span><input type="text" name="freight" value="${esc(sp.freight || '')}" maxlength="40"></label>
   <label class="f"><span>What will you test it for?</span><input type="text" name="use" maxlength="140" placeholder="e.g. UV flatbed print test"></label>
   <div class="btns"><button class="btn pri" type="submit">Build sample request</button></div></form>
   <button class="btn ghost block" type="button" data-close style="margin-top:10px">Cancel</button>`, root => {
    $('#sampleF', root).addEventListener('submit', ev => {
      ev.preventDefault(); const f = ev.target, g = n => (f.elements[n].value || '').trim();
      const prods = $$('input[name=sp]:checked', f).map(i => P(i.value)), e = {};
      if (!prods.length) e['s.products'] = 'Pick at least one product';
      for (const k of ['company', 'contact', 'street', 'city', 'state', 'zip']) if (!g(k)) e['s.' + k] = 'Required';
      if (!EMAIL_RE.test(g('email'))) e['s.email'] = 'Enter a valid email';
      $$('[data-err]', root).forEach(x => { x.textContent = e[x.dataset.err] || ''; });
      if (Object.keys(e).length) { toast('Please fill the highlighted fields'); const first = $$('[data-err]', root).find(x => x.textContent); if (first) first.scrollIntoView({ block: 'center' }); return; }
      LS.set('sampleAddr', { company: g('company'), contact: g('contact'), street: g('street'), city: g('city'), state: g('state'), zip: g('zip'), phone: g('phone'), email: g('email'), freight: g('freight') });
      const L = ['SAMPLE REQUEST – sent from the Gilman Quote app (demo)', '', 'Products:', ...prods.map(p => `- ${p.name} (${p.tagline})`)];
      if (prods.some(p => /^resilient/.test(p.id))) L.push(`Resilient sample size: ${g('rsize')}`);
      if (g('spec')) L.push(`Gauges / colors: ${g('spec')}`);
      if (g('use')) L.push(`Testing for: ${g('use')}`);
      L.push('', `Company: ${g('company')}`, `Contact: ${g('contact')}`, `Email: ${g('email')}`); if (g('phone')) L.push(`Phone: ${g('phone')}`);
      L.push('Ship to:', `  ${g('street')}`, `  ${g('city')}, ${g('state')} ${g('zip')}`, `Freight account: ${g('freight') || 'none given – please advise freight cost'}`);
      if (ref) L.push(`App link ref: ${ref}`);
      L.push('', '--', `Sent with Gilman Quote ${VERSION} (demo).`);
      const subject = `SAMPLE REQUEST – ${g('company')} – ${prods.map(p => p.name).slice(0, 3).join(', ')}${prods.length > 3 ? ' +' + (prods.length - 3) : ''}`;
      sendSheet({ to: SALES_TO, subject, body: L.join('\r\n') }, 'sample');
    });
  });
}
function distributorSheet() {
  const prof = LS.get('profile', {});
  openSheet(`<h2>Find a distributor</h2><p class="meta">gilmanbrothers.com doesn't publish a distributor list. Its “Where to Buy” button opens a <b>Distributor Referral</b> form that asks for material, gauge, size and quantity, and Gilman connects you with a channel partner.</p>
   <div class="links"><a href="https://gilmanbrothers.com/contact-us/distributor-referral/" target="_blank" rel="noopener">Open Gilman's Distributor Referral form</a><a href="tel:+18608898444">Call Gilman sales: (860) 889-8444</a></div>
   <h2 style="font-size:15px;margin-top:14px">Or email a referral request</h2>
   <form id="distF" novalidate>
    <label class="f"><span>Company <i>*</i></span><input type="text" name="company" value="${esc(prof.company || '')}" maxlength="80"><div class="err" data-err="d.company"></div></label>
    <div class="row"><label class="f"><span>City <i>*</i></span><input type="text" name="city" value="${esc(prof.city || '')}" maxlength="60"><div class="err" data-err="d.city"></div></label><label class="f"><span>State <i>*</i></span><select name="state" aria-label="State">${stateOpts(prof.state)}</select><div class="err" data-err="d.state"></div></label></div>
    <label class="f"><span>Contact name <i>*</i></span><input type="text" name="contact" value="${esc(prof.contact || '')}" maxlength="60"><div class="err" data-err="d.contact"></div></label>
    <label class="f"><span>Email <i>*</i></span><input type="email" name="email" value="${esc(prof.email || '')}" maxlength="80"><div class="err" data-err="d.email"></div></label>
    <label class="f"><span>Material, gauge, size, quantity <i>*</i></span><textarea name="need" maxlength="400" placeholder="e.g. INFINITY 3/16 white 48x96, about 200 sheets a month"></textarea><div class="err" data-err="d.need"></div></label>
    <label class="check"><input type="checkbox" name="call"> <span>OK to call me</span></label>
    <div class="btns"><button class="btn pri" type="submit">Build referral email</button></div></form>
   <button class="btn ghost block" type="button" data-close style="margin-top:10px">Close</button>`, root => {
    $('#distF', root).addEventListener('submit', ev => {
      ev.preventDefault(); const f = ev.target, g = n => (f.elements[n].value || '').trim(), e = {};
      for (const k of ['company', 'city', 'state', 'contact', 'need']) if (!g(k)) e['d.' + k] = 'Required';
      if (!EMAIL_RE.test(g('email'))) e['d.email'] = 'Enter a valid email';
      $$('[data-err]', root).forEach(x => { x.textContent = e[x.dataset.err] || ''; });
      if (Object.keys(e).length) { toast('Please fill the highlighted fields'); return; }
      const body = ['DISTRIBUTOR REFERRAL REQUEST – sent from the Gilman Quote app (demo)', '', `Company: ${g('company')}`, `Contact: ${g('contact')}`, `Email: ${g('email')}`, `City/State: ${g('city')}, ${g('state')}`, `May we call you: ${f.elements.call.checked ? 'Yes' : 'Email only'}`, '', 'Material / gauge / size / quantity:', g('need'), ...(ref ? ['', `App link ref: ${ref}`] : []), '', '--', `Sent with Gilman Quote ${VERSION} (demo).`].join('\r\n');
      sendSheet({ to: SALES_TO, subject: `DISTRIBUTOR REFERRAL – ${g('company')} – ${g('city')}, ${g('state')}`, body }, 'dist');
    });
  });
}

/* ---------- HOT DEALS ---------- */
function activeDeals() { const t = todayISO(); return (DEALS.items || []).filter(d => d && d.id && d.title && (!d.expires || d.expires >= t) && (!d.starts || d.starts <= t)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(a.expires || '9999').localeCompare(String(b.expires || '9999'))); }
function unseenCount() { const seen = new Set(LS.get('seenDeals', [])); return activeDeals().filter(d => !seen.has(d.id)).length; }
function updateBadge() { const n = unseenCount(), b = $('#dealBadge'); b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n; b.setAttribute('aria-label', `${n} new`); try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (_) {} }
function daysLeft(iso) { if (!iso) return 'No end date'; const d = Math.round((new Date(iso + 'T23:59:59') - new Date()) / 864e5); return d <= 0 ? 'Ends today' : d === 1 ? 'Ends tomorrow' : `Ends in ${d} days (${fmtDate(iso).replace(/ \(.*/, '')})`; }
function renderDeals() {
  const seen = new Set(LS.get('seenDeals', [])), list = activeDeals();
  const ps = window.GQPush ? GQPush.status() : { enabled: false };
  $('#v-deals').innerHTML = `<h1>Hot Deals &amp; Opportunities</h1><p class="sub">Specials, stock opportunities and new-product pushes from Gilman. Tap a deal to start a pre-filled quote.</p>
   ${DEALS.demo ? `<div class="note warn">Demo content: these sample items show how the feed works. Real items are published from the admin page.</div>` : ''}
   <div id="dealList">${list.length ? list.map(d => `<div class="card deal ${seen.has(d.id) ? 'seen' : ''}" data-deal="${esc(d.id)}">${seen.has(d.id) ? '' : '<span class="new-dot" title="New"></span>'}
     <h2><span class="tag ${esc(String(d.tag || 'HOT').toLowerCase())}">${esc(d.tag || 'HOT')}</span>${esc(d.title)}</h2>
     <p style="margin:4px 0 6px">${esc(d.details)}</p>
     <div class="meta">${esc(daysLeft(d.expires))}${d.region ? ' · ' + esc(d.region) : ''}</div>
     <div style="margin-top:6px">${(d.products || []).map(id => P(id) ? `<span class="pill">${esc(P(id).name)}</span>` : '').join('')}</div>
     <div class="btns">${d.cta && d.cta.productId && P(d.cta.productId) ? `<button class="btn pri sm" type="button" data-dealcta="${esc(d.id)}">${esc(d.cta.label || 'Request a quote')}</button>` : ''}${d.link && /^https:\/\//.test(d.link) ? `<a class="btn sm" href="${esc(d.link)}" target="_blank" rel="noopener">Details</a>` : ''}</div></div>`).join('') : '<div class="card empty">No active deals right now. New ones show a red badge on the Hot Deals tab.</div>'}</div>
   <div class="card"><h2>Alerts</h2>${ps.enabled ? `<p class="meta">${esc(ps.message)}</p>${ps.canAsk ? '<button class="btn teal" type="button" id="pushOn">Turn on deal alerts</button>' : ''}` : `<p class="meta" style="margin:0">The app checks for new deals each time you open it and shows a red badge. Lock-screen push alerts are built in and switch on once Gilman connects a push service. On iPhone they need iOS 16.4 or later and the app added to your Home Screen.</p>`}</div>
   <p class="foot">Feed updated ${esc(DEALS.updated || '—')}</p>`;
  const now = new Set(LS.get('seenDeals', [])); list.forEach(d => now.add(d.id)); LS.set('seenDeals', [...now].slice(-200));
  setTimeout(updateBadge, 300);
}
async function loadDeals() {
  try { const r = await fetch('deals.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); DEALS = await r.json(); LS.set('dealsCache', DEALS); }
  catch (_) { DEALS = LS.get('dealsCache', { items: [] }); }
  updateBadge();
}

/* ---------- EXPLORE ---------- */
function prodRow(p) { return `<button class="pbtn" type="button" data-detail="${p.id}"><span class="sw" style="background:${famColor(p.family)}"></span><span><b>${esc(p.name)}</b><small>${esc(p.tagline)} · ${esc(p.gauges.min)}${p.gauges.max !== p.gauges.min ? '–' + esc(p.gauges.max) : ''}</small></span></button>`; }
const LIB_LABEL = { 'Cutting guidelines': 'Machine settings – cutting (Zünd, Kongsberg…)', 'Printing guidelines': 'Machine settings – printing' };
function renderExplore() {
  const L = CAT.resourceLibrary, pg = CAT.company.pages;
  $('#v-explore').innerHTML = `<h1>Explore Gilman</h1><p class="sub">Applications, boards, machine settings and where to buy, all linked to gilmanbrothers.com.</p>
   <div class="card"><h2>Where to buy</h2><p class="meta" style="margin-top:0">Gilman sells through distribution. Get connected with a stocking channel partner.</p><div class="btns"><button class="btn pri" type="button" id="findDist">Find a distributor</button><button class="btn" type="button" id="sampleBtn">Request samples</button></div><div class="links" style="margin-top:8px"><a href="${pg.requestVisit}" target="_blank" rel="noopener">Request a visit from the Commercial Team</a><a href="tel:+18608898444">Call sales (860) 889-8444</a></div></div>
   <h2 style="margin:16px 4px 8px">Applications &amp; solutions</h2>
   ${CAT.applications.map(a => `<details class="acc"><summary>${esc(a.name)}</summary><div class="in"><p class="meta" style="margin-top:0">${esc(a.blurb)} <a href="${a.url}" target="_blank" rel="noopener">Site page</a></p><div class="plist">${a.products.map(id => prodRow(P(id))).join('')}</div>${a.alsoFits.length ? `<div class="meta" style="margin:10px 0 4px">Also fits, from each board's “ideal for” list:</div><div class="plist">${a.alsoFits.map(id => prodRow(P(id))).join('')}</div>` : ''}</div></details>`).join('')}
   <details class="acc"><summary>Find a board by end use</summary><div class="in">${CAT.endUses.map(e => `<div style="margin:8px 0 4px;font-weight:600">${esc(e.label)}</div><div>${e.products.map(id => `<button class="chip" type="button" data-detail="${id}" style="margin:0 6px 6px 0">${esc(P(id).name)}</button>`).join('')}</div>`).join('')}</div></details>
   <h2 style="margin:16px 4px 8px">Spotlight &amp; new</h2>
   ${SPOTLIGHT.map(s => `<div class="card"><h2>${esc(s.title)}</h2><p class="meta" style="margin:0 0 6px">${esc(s.text)}</p><div class="btns"><button class="btn sm" type="button" data-detail="${s.product}">See the board</button><a class="btn sm ghost" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></div></div>`).join('')}
   <details class="acc"><summary>Application gallery</summary><div class="in"><p class="meta" style="margin-top:0">Trade-show booths and builds from Gilman's gallery. Photos open on gilmanbrothers.com.</p>${CAT.gallery.map(g => `<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${esc(g.title)}</b><div class="meta">${esc(g.detail)}</div><div>${g.products.map(id => `<button class="chip" type="button" data-detail="${id}" style="margin:6px 6px 0 0">${esc(P(id).name)}</button>`).join('')}</div></div>`).join('')}<div class="links" style="margin-top:8px"><a href="${pg.gallery}" target="_blank" rel="noopener">Open the full gallery</a><a href="${pg.videos}" target="_blank" rel="noopener">Product videos</a></div></div></details>
   <h2 style="margin:16px 4px 8px">Resource library</h2>
   ${Object.entries(L).map(([k, arr]) => `<details class="acc"><summary>${esc(LIB_LABEL[k] || k)}</summary><div class="in"><div class="links">${arr.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>`).join('')}</div></div></details>`).join('')}
   <div class="links"><a href="${pg.resources}" target="_blank" rel="noopener">Full Resource Library (incl. Safety Data Sheets)</a><a href="${pg.sustainability}" target="_blank" rel="noopener">Sustainability</a><a href="${pg.news}" target="_blank" rel="noopener">News</a></div>
   <div class="card" style="margin-top:12px"><h2>Follow Gilman</h2><div class="links">${Object.entries(CAT.company.social).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`).join('')}</div></div>
   <p class="foot">Data from gilmanbrothers.com, crawled ${esc(CAT.meta.crawled)}.</p>`;
}

/* ---------- SHARE ---------- */
function qrCanvas(text, px = 8) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), m = 4, c = document.createElement('canvas'); c.width = c.height = (n + m * 2) * px;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#063f50';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + m) * px, (r + m) * px, px, px);
  c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'QR code for ' + text); c.dataset.url = text; return c;
}
const cleanTag = s => String(s || '').trim().replace(/[^\w.\- ]/g, '').slice(0, 40);
function shareLink(tag) { return APP_URL + (tag ? '?ref=' + encodeURIComponent(tag) : ''); }
function renderShare() {
  const tag = LS.get('qrTag', '');
  $('#v-share').innerHTML = `<h1>Share the app</h1><p class="sub">Put Gilman in front of more buyers: a QR code for trade-show booths, counters and business cards, plus one-tap product sharing.</p>
   <div class="card"><div class="qr" id="qrBox"></div>
    <label class="f"><span>Tracking tag (optional)</span><input type="text" id="qrTag" value="${esc(tag)}" maxlength="40" placeholder="e.g. PU2026-booth, bizcard-joe" aria-label="Tracking tag"><div class="hint">Added to the link as ?ref=… and printed on every RFQ sent from it, so you can see which booth, card or flyer brought in the request.</div></label>
    <div class="meta" id="qrUrl" style="word-break:break-all;margin-top:8px"></div>
    <div class="btns"><button class="btn teal" type="button" id="qrDl">Save QR image</button><button class="btn" type="button" id="qrShare">${navigator.share ? 'Share link…' : 'Copy link'}</button></div></div>
   <div class="card"><h2>Share a board with a colleague</h2>${selectF('shareProd', 'Board', CAT.products.map(p => [p.id, p.name + ' – ' + p.tagline]), '', false)}<div class="btns"><button class="btn" type="button" id="shareProdBtn">Share board</button></div></div>
   <div class="card"><h2>Ideas for using it</h2><ul style="margin:0;padding-left:20px;font-size:14.5px">
    <li>Print the QR on booth signage and sample swatches, with a tag per show.</li>
    <li>Put it on distributor counter cards so counter staff can send an RFQ in seconds.</li>
    <li>Add it to email signatures and business cards, one tag per rep.</li>
    <li>Use Hot Deals for launch pushes and stock opportunities.</li></ul></div>`;
  const draw = () => { const t = cleanTag($('#qrTag').value), u = shareLink(t); LS.set('qrTag', t); const b = $('#qrBox'); b.innerHTML = ''; b.appendChild(qrCanvas(u)); $('#qrUrl').textContent = u; };
  draw(); $('#qrTag').addEventListener('input', draw);
  $('#qrDl').addEventListener('click', () => {
    const t = cleanTag($('#qrTag').value), c = qrCanvas(shareLink(t), 16);
    c.toBlob(async b => {
      const name = `gilman-quote-qr${t ? '-' + t.replace(/\W+/g, '-') : ''}.png`;
      try { const file = new File([b], name, { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Gilman Quote QR' }); } catch (_) {} return; } } catch (_) {}
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('QR image saved');
    });
  });
  $('#qrShare').addEventListener('click', async () => { const u = shareLink(cleanTag($('#qrTag').value)); if (navigator.share) { try { await navigator.share({ title: 'Gilman Quote', text: 'Request a Gilman Brothers foam board quote in a few taps:', url: u }); } catch (_) {} } else { await copy(u); toast('Link copied'); } });
  $('#shareProdBtn').addEventListener('click', () => { const id = $('[data-path="shareProd"]').value; if (!id) { toast('Pick a board first'); return; } shareProduct(id); });
}

/* ---------- ME ---------- */
function renderMe() {
  const p = LS.get('profile', {}), prefs = LS.get('prefs', {}), recent = LS.get('recent', []);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('#v-me').innerHTML = `<h1>Me</h1><p class="sub">Saved on this device only, so repeat requests take a few taps.</p>
   <div class="card"><h2>My company profile</h2><form id="profF">
    ${inputF('company', 'Company name', p.company || '', 'text', false, 'autocomplete="organization" maxlength="80"')}
    <div class="row">${inputF('city', 'City', p.city || '', 'text', false, 'maxlength="60"')}${selectF('state', 'State / province', STATES, p.state || '', false)}</div>
    ${inputF('contact', 'Contact name', p.contact || '', 'text', false, 'autocomplete="name" maxlength="60"')}
    <div class="row">${inputF('email', 'Email', p.email || '', 'email', false, 'autocomplete="email" maxlength="80"')}${inputF('phone', 'Phone', p.phone || '', 'tel', false, 'autocomplete="tel" maxlength="24"')}</div>
    ${selectF('type', 'Customer type', CUSTOMER_TYPES, p.type || '', false)}
    ${inputF('distributor', 'Preferred distributor', p.distributor || '', 'text', false, 'maxlength="80"')}
    <label class="check"><input type="checkbox" id="nl" ${prefs.newsletter ? 'checked' : ''}> <span>Opt me in to Gilman product news &amp; specials on my requests</span></label>
    <div class="btns"><button class="btn teal" type="submit">Save profile</button></div></form></div>
   <div class="card"><h2>Recent requests <span class="pill">${recent.length}</span></h2>${recent.length ? recent.map((r, i) => `<div class="recent" style="padding:8px 0;border-top:${i ? '1px solid var(--line)' : '0'}"><div class="grow"><b>${esc(r.subject)}</b><span class="meta">${new Date(r.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${esc(r.id)}</span></div>${r.kind === 'rfq' && r.items ? `<button class="btn sm" type="button" data-reorder="${i}">Reorder</button>` : ''}<button class="btn ghost sm" type="button" data-viewreq="${i}">View</button></div>`).join('') : '<div class="empty">Requests you build show up here. Tap Reorder to start a new RFQ with the same line items.</div>'}</div>
   <div class="card"><h2>Install on your phone</h2><p class="meta" style="margin:0">${standalone ? 'Installed – you are using the Home Screen app.' : 'iPhone: open this page in Safari, tap Share, then “Add to Home Screen”. Android: tap ⋮, then “Install app”.'}</p></div>
   <div class="card"><h2>About</h2><p class="meta" style="margin:0">Gilman Quote ${VERSION} – demo build, not an official Gilman Brothers app. Product options come only from gilmanbrothers.com (crawled ${esc(CAT.meta.crawled)}). Where the site gives only a range, the app lists the stated values and lets you request others. Requests go out through your own Mail app.</p>
    <div class="btns"><button class="btn ghost sm" type="button" id="clearAll">Clear saved data on this device</button></div></div>`;
  $('#profF').addEventListener('submit', ev => {
    ev.preventDefault(); const f = ev.target, g = n => ($(`[data-path="${n}"]`, f).value || '').trim();
    const prof = { company: g('company'), city: g('city'), state: g('state'), contact: g('contact'), email: g('email'), phone: g('phone'), type: g('type'), distributor: g('distributor'), heard: (LS.get('profile', {}).heard || '') };
    if (prof.email && !EMAIL_RE.test(prof.email)) { toast('That email doesn’t look right'); return; }
    LS.set('profile', prof); const pr = LS.get('prefs', {}); pr.newsletter = $('#nl').checked; LS.set('prefs', pr);
    for (const k of ['company', 'city', 'state', 'contact', 'email', 'phone', 'type', 'distributor']) if (!draft.customer[k]) draft.customer[k] = prof[k];
    if (!draft.delivery.state) draft.delivery.state = prof.state; draft.newsletter = pr.newsletter; save(); toast('Profile saved');
  });
  $('#clearAll').addEventListener('click', () => { if (!confirm('Clear your profile, recent requests and draft from this device?')) return; for (const k of ['profile', 'recent', 'draft', 'prefs', 'sampleAddr', 'seenDeals', 'qrTag', 'ref']) LS.del(k); draft = newDraft({}); editor = blankItem(); renderMe(); updateBadge(); toast('Cleared'); });
}
function reorder(i) {
  const r = LS.get('recent', [])[i]; if (!r || !r.items) return;
  draft = newDraft(); draft.items = JSON.parse(JSON.stringify(r.items)).filter(it => P(it.productId)); draft.app = r.app || ''; editor = blankItem(draft.items[0] ? draft.items[0].productId : '');
  save(); go('quote'); if (draft.items[0]) pickProduct(draft.items[0].productId, true);
  toast(`Loaded ${draft.items.length} line item${draft.items.length > 1 ? 's' : ''} – set the new delivery date`);
  setTimeout(() => $('#c-del').scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
}

/* ---------- navigation & events ---------- */
function go(v) {
  view = v; $$('.view').forEach(s => { s.hidden = s.dataset.view !== v; });
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === v)));
  ({ quote: renderQuote, deals: renderDeals, explore: renderExplore, share: renderShare, me: renderMe })[v]();
  window.scrollTo(0, 0);
}
function onClick(e) {
  const t = e.target.closest('button, a'); if (!t) return;
  const ds = t.dataset;
  if (ds.app) { draft.app = draft.app === ds.app ? '' : ds.app; showAll = false; save(); renderQuote(); $('#c-prod').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (ds.pick) { pickProduct(ds.pick); const er = $('[data-err="ed.productId"]'); if (er) er.textContent = ''; setTimeout(() => $('#c-spec').scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
  else if (t.id === 'toggleAll') { showAll = !showAll; renderQuote(); }
  else if (t.id === 'addItem') addItem();
  else if (ds.edit != null) { const i = +ds.edit; editor = JSON.parse(JSON.stringify(draft.items[i])); editor._editIndex = i; rerenderEditor(); $$('.pbtn[data-pick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pick === editor.productId)); $('#c-spec').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (ds.dup != null) { draft.items.splice(+ds.dup + 1, 0, JSON.parse(JSON.stringify(draft.items[+ds.dup]))); rerenderItems(); save(); toast('Line duplicated – edit the copy'); }
  else if (ds.del != null) { draft.items.splice(+ds.del, 1); if (editor._editIndex != null) { delete editor._editIndex; rerenderEditor(); } rerenderItems(); save(); toast('Line removed'); }
  else if (t.id === 'review') review();
  else if (t.id === 'resetDraft') { if (draft.items.length && !draft.sentId && !confirm('Discard this request and start over?')) return; draft = newDraft(); editor = blankItem(); showAll = false; save(); renderQuote(); window.scrollTo(0, 0); }
  else if (t.id === 'clearDeal') { draft.deal = null; save(); renderQuote(); }
  else if (ds.detail) { e.preventDefault(); productDetail(ds.detail); }
  else if (ds.quote) quoteProduct(ds.quote);
  else if (ds.sample != null) sampleSheet(ds.sample);
  else if (ds.shareprod) shareProduct(ds.shareprod);
  else if (ds.close != null) closeSheet();
  else if (t.id === 'findDist') distributorSheet();
  else if (t.id === 'sampleBtn') sampleSheet('');
  else if (ds.dealcta) { const d = (DEALS.items || []).find(x => x.id === ds.dealcta); if (d) { draft.deal = { id: d.id, title: d.title }; save(); quoteProduct(d.cta.productId, d.cta); toast('Deal pre-filled – check the specs, then add it'); } }
  else if (ds.reorder != null) reorder(+ds.reorder);
  else if (ds.viewreq != null) { const r = LS.get('recent', [])[+ds.viewreq]; if (r) sendSheet({ to: r.to, subject: r.subject, body: r.body, id: r.id }, 'resend'); }
  else if (t.id === 'pushOn' && window.GQPush) GQPush.enable().then(m => { toast(m, 4000); renderDeals(); });
}
function onEndUse(e) {
  if (e.target.id !== 'endUse') return;
  const i = e.target.value, out = $('#endUseOut'); if (i === '') { out.innerHTML = ''; return; }
  const eu = CAT.endUses[+i];
  out.innerHTML = `<div class="meta" style="margin-top:8px">Boards for ${esc(eu.label)}:</div><div class="plist">${eu.products.map(id => pbtn(P(id), false)).join('')}</div>`;
  if (!draft.jobUse) { draft.jobUse = eu.label; save(); const js = $('[data-path="jobUse"]'); if (js) js.value = eu.label; }
}
function handleHash() {
  if (!location.hash) return;
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('p') && P(h.get('p'))) productDetail(h.get('p'));
  else if (h.get('tab') && ['quote', 'deals', 'explore', 'share', 'me'].includes(h.get('tab'))) go(h.get('tab'));
  else if (h.get('deal') != null) go('deals');
  history.replaceState(null, '', location.pathname + location.search);
}
async function init() {
  try { const r = await fetch('catalog.json', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); CAT = await r.json(); LS.set('catCache', CAT); }
  catch (_) { CAT = LS.get('catCache', null); }
  if (!CAT) { $('#v-quote').innerHTML = '<div class="card">Could not load the product catalog. Check your connection and reopen the app.</div>'; return; }
  if (editor.productId && !P(editor.productId)) editor = blankItem();
  $$('.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  $('#sheetBg').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  $('#v-quote').addEventListener('input', onQuoteInput); $('#v-quote').addEventListener('change', onQuoteInput);
  document.addEventListener('click', onClick); document.addEventListener('change', onEndUse);
  window.addEventListener('hashchange', handleHash);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDeals().then(() => { if (view === 'deals') renderDeals(); }); });
  go('quote'); handleHash(); await loadDeals();
  if ('serviceWorker' in navigator && location.protocol === 'https:') { const pc = window.GQ_PUSH || {}; navigator.serviceWorker.register(pc.enabled && pc.provider === 'onesignal' ? 'OneSignalSDKWorker.js' : 'sw.js').catch(() => {}); }
}
window.GQ = { buildRFQ: (d, id) => buildRFQ(d, id), mailtoURL, validateItem, validateDraft, get draft() { return draft; }, get editor() { return editor; }, catalog: () => CAT, MAILTO_MAX, VERSION, ready: init() };
})();
