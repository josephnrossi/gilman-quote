const { chromium } = require('/workspace/tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8811/', { waitUntil: 'networkidle' });
  for (const t of ['deals', 'explore', 'share', 'me', 'quote']) { await p.click(`.tabs [data-tab=${t}]`); await p.waitForTimeout(200); }
  await p.goto('http://localhost:8811/admin.html', { waitUntil: 'networkidle' });
  console.log('errors', errs);
  await b.close();
})();
