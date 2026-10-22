# Gilman Quote: turning on real push alerts for Hot Deals

**Status:** the client code is built and **off** (`push-config.js` → `enabled: false`). Without push, the app still loads `deals.json` every time it opens or comes back to the foreground, shows a red badge for unseen items, and sets the Home Screen icon badge where the browser supports it. Nothing has been signed up for.

## How iPhone web push works (what matters)

- **iOS / iPadOS 16.4 or later.** Web Push works only for a web app **added to the Home Screen** and opened from that icon. A plain Safari tab can't subscribe. The app's `manifest.json` already has `display: standalone`.
- The permission prompt must come from a **user tap**. The app asks only when someone taps "Turn on deal alerts" on the Hot Deals tab, and never on load.
- Push uses standard **Web Push + VAPID** (RFC 8030/8291/8292). Apple accepts only `aes128gcm` payloads.
- A **push server** is required: something has to store each device's subscription and send to it. A static GitHub Pages site can't do that on its own.
- Android Chrome and desktop browsers work with the same code, with no Home Screen step.

## Option A: OneSignal (free plan, least code)

- **Cost (checked Oct 2026 on onesignal.com/pricing):** the Free plan includes **unlimited web push subscribers, up to 10,000 per send**. The new 1,000-MAU Free-plan cap applies to mobile/in-app push, not web push. Growth plan web push is $0.004 per subscriber per month.
- **Pros:** dashboard to write and schedule pushes, segments (e.g. by state or customer type), delivery stats, no server to run.
- **Cons:** third-party SDK and tracking on a Gilman-branded app; data lives with OneSignal; 10k per send on the free plan.
- **Steps:**
  1. Create a OneSignal account → New App → Web. Site URL `https://josephnrossi.github.io` (or Gilman's final domain). Choose "Custom code". Set the service worker path to `/gilman-quote/OneSignalSDKWorker.js` and the scope to `/gilman-quote/`.
  2. Copy the **App ID** into `push-config.js`: `enabled: true, provider: 'onesignal', onesignal: { appId: '…' }`.
  3. `OneSignalSDKWorker.js` is already in the repo. It loads OneSignal's worker plus the app's own `sw.js`, and the app registers it automatically when the provider is `onesignal`.
  4. Commit, open the app from the Home Screen on an iPhone, Hot Deals → **Turn on deal alerts** → Allow.
  5. Send a test from the OneSignal dashboard. For each new deal, use the admin page's "push alert payload" text as the title and message.

## Option B: Cloudflare Worker + VAPID (free tier, you own the data)

- **Cost:** Cloudflare Workers' free plan (about 100k requests/day) and Workers KV's free tier are plenty for a channel-partner audience. Check current limits before launch.
- **Pros:** no third-party SDK, subscriptions stay in Gilman's own Cloudflare account, any domain, and easy to trigger from the admin page later.
- **Cons:** a small amount of code to own, no marketing dashboard, and expired subscriptions (404/410) need cleaning up, which the sample code does.
- **Steps:**
  1. Generate VAPID keys once, locally: `npx web-push generate-vapid-keys`. Keep the **private key secret**; it never goes in the repo.
  2. `npm create cloudflare@latest gilman-push` (Worker). Add `npm i @block65/webcrypto-web-push`. It is Web Crypto based, works on Workers, and uses `aes128gcm`, which Apple accepts. `@mmmike/web-push` is an alternative.
  3. Create a KV namespace `SUBS` and bind it. Add the secrets: `wrangler secret put VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (e.g. `mailto:sales@gilmanbrothers.com`), and `ADMIN_TOKEN` (a long random string).
  4. Worker code (sketch, untested):

```js
import { buildPushPayload } from '@block65/webcrypto-web-push';
const CORS = { 'access-control-allow-origin': 'https://josephnrossi.github.io', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'POST, OPTIONS' };
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/subscribe' && req.method === 'POST') {
      const { subscription, topics = [] } = await req.json();
      if (!subscription?.endpoint?.startsWith('https://')) return new Response('bad', { status: 400, headers: CORS });
      const id = btoa(subscription.endpoint).slice(-60);
      await env.SUBS.put(id, JSON.stringify({ subscription, topics, at: Date.now() }));
      return new Response('ok', { headers: CORS });
    }
    if (url.pathname === '/send' && req.method === 'POST') {           // called by Gilman staff only
      if (req.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return new Response('no', { status: 401 });
      const msg = await req.json();                                     // { title, body, id, url } – the admin page's payload
      const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
      let sent = 0, removed = 0, cursor;
      do {
        const page = await env.SUBS.list({ cursor }); cursor = page.cursor;
        for (const k of page.keys) {
          const rec = JSON.parse(await env.SUBS.get(k.name));
          const payload = await buildPushPayload({ data: JSON.stringify(msg), options: { ttl: 86400, urgency: 'normal' } }, rec.subscription, vapid);
          const r = await fetch(rec.subscription.endpoint, payload);
          if (r.status === 404 || r.status === 410) { await env.SUBS.delete(k.name); removed++; } else if (r.ok) sent++;
        }
      } while (cursor);
      return Response.json({ sent, removed });
    }
    return new Response('not found', { status: 404 });
  }
};
```

  5. `wrangler deploy`, then set `push-config.js`: `enabled: true, provider: 'vapid', vapid: { publicKey: '<VAPID public key>', subscribeUrl: 'https://gilman-push.<account>.workers.dev/subscribe' }`.
  6. To send a deal alert: `curl -X POST https://gilman-push.<account>.workers.dev/send -H "authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" -d '<payload from admin.html>'`. The app's `sw.js` already shows the notification, and tapping it opens the Hot Deals tab.

## Recommendation

For a **demo or pilot with distributor reps**, start with **OneSignal free**: about 15 minutes of setup, no server, and a dashboard sales can use. If Gilman adopts the app officially, move to **Option B** on a Gilman domain so subscriber data stays in-house. Get Gilman's sign-off before either one goes live under the Gilman name.

## What's in the code now

- `push-config.js`: the feature flag and provider keys, public values only.
- `push.js`: status checks (iOS version/Home Screen, permission state), a tap-only permission request, VAPID subscribe that POSTs `{subscription, topics:[customer type, state]}` to your endpoint, and the OneSignal SDK loader.
- `sw.js`: `push` → `showNotification` (title, body, icon, tag; OneSignal payloads are left to OneSignal), `notificationclick` → opens/focuses `./#tab=deals`, app icon badge.
- `OneSignalSDKWorker.js`: used only when the provider is `onesignal`.
- `admin.html`: generates `deals.json` and a ready-to-send push payload for the newest deal.
