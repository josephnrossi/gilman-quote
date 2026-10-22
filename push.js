/* Gilman Quote – Web Push opt-in, ready to connect. Does nothing unless GQ_PUSH.enabled is true (push-config.js).
   iPhone/iPad: Web Push works on iOS/iPadOS 16.4+ only when the app is opened from the Home Screen,
   and the permission prompt must come from a user tap. */
(() => {
  const C = window.GQ_PUSH || { enabled: false };
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  function configured() { return C.provider === 'onesignal' ? !!(C.onesignal && C.onesignal.appId) : !!(C.vapid && C.vapid.publicKey && C.vapid.subscribeUrl); }
  function status() {
    if (!C.enabled) return { enabled: false };
    if (!configured()) return { enabled: true, canAsk: false, message: 'Push is switched on but not configured yet (missing keys in push-config.js).' };
    if (isIOS && !standalone()) return { enabled: true, canAsk: false, message: 'To get deal alerts on iPhone: tap Share, then “Add to Home Screen”, then open Gilman Quote from the new icon and come back here. Needs iOS 16.4 or later.' };
    if (!supported()) return { enabled: true, canAsk: false, message: 'This browser does not support push alerts. You will still see new deals here with a red badge.' };
    if (Notification.permission === 'granted') return { enabled: true, canAsk: localStorage.getItem('gq.pushOn') !== '1', message: localStorage.getItem('gq.pushOn') === '1' ? 'Deal alerts are on for this device.' : 'Notifications are allowed – tap to finish connecting.' };
    if (Notification.permission === 'denied') return { enabled: true, canAsk: false, message: 'Notifications are blocked for this app. Turn them on in Settings › Notifications › Gilman Quote.' };
    return { enabled: true, canAsk: true, message: 'Get a notification when Gilman posts a hot deal or special opportunity.' };
  }
  async function enableVapid() {
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'Alerts not turned on.';
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(C.vapid.publicKey) });
    let topics = []; try { const p = JSON.parse(localStorage.getItem('gq.profile') || '{}'); topics = [p.type || '', p.state || ''].filter(Boolean); } catch (_) {}
    const r = await fetch(C.vapid.subscribeUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), topics, app: 'gilman-quote' }) });
    if (!r.ok) throw new Error('subscribe failed ' + r.status);
    localStorage.setItem('gq.pushOn', '1'); return 'Deal alerts are on.';
  }
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.defer = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function enableOneSignal() {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
    await new Promise(res => window.OneSignalDeferred.push(async OS => { await OS.init({ appId: C.onesignal.appId, serviceWorkerPath: 'OneSignalSDKWorker.js', serviceWorkerParam: { scope: './' } }); await OS.Notifications.requestPermission(); res(); }));
    if (Notification.permission === 'granted') { localStorage.setItem('gq.pushOn', '1'); return 'Deal alerts are on.'; }
    return 'Alerts not turned on.';
  }
  async function enable() {
    const s = status(); if (!s.enabled || !s.canAsk) return s.message || 'Push alerts are not available.';
    try { return C.provider === 'onesignal' ? await enableOneSignal() : await enableVapid(); }
    catch (e) { console.warn(e); return 'Could not turn on alerts right now. Try again later.'; }
  }
  window.GQPush = { status, enable, config: C };
})();
