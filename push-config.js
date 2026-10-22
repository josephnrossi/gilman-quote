/* Push notification config. Off by default – the in-app Hot Deals feed works without it.
   See push-setup.md in the project notes. Set enabled:true and fill ONE provider block to turn on real push. */
window.GQ_PUSH = {
  enabled: false,
  provider: 'vapid',            // 'vapid' (your own Cloudflare Worker) or 'onesignal'
  vapid: {
    publicKey: '',               // base64url VAPID public key (never put the private key here)
    subscribeUrl: ''             // e.g. https://gilman-push.<you>.workers.dev/subscribe
  },
  onesignal: {
    appId: ''                    // OneSignal Web Push app id
  }
};
