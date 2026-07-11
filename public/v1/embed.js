/*! Dynopay Embed SDK v1 — embeddable crypto checkout (Stripe-style).
 *  Load this script from the Dynopay checkout origin. It exposes window.Dynopay.
 *
 *  SECURITY: never put your SECRET api key in the browser. Your SERVER creates a
 *  session (POST /api/user/embed/session with the x-api-key header) and returns
 *  the `client_secret`; this SDK only renders it in an iframe. Order fulfillment
 *  must rely on WEBHOOKS (X-DynoPay-Signature), not the browser success event.
 *
 *  Usage (a) inline:
 *    const checkout = await Dynopay.initEmbeddedCheckout({
 *      fetchClientSecret: () => fetch('/create-session').then(r=>r.json()).then(d=>d.client_secret),
 *      onComplete: (paymentId) => {},
 *    });
 *    checkout.mount('#dynopay-checkout');
 *
 *  Usage (a) modal:
 *    Dynopay.openCheckout({ fetchClientSecret, onComplete });
 */
(function () {
  'use strict';
  if (window.Dynopay && window.Dynopay.__v) return;

  var ORIGIN = (function () {
    try {
      var cs = document.currentScript;
      if (!cs) {
        var ss = document.getElementsByTagName('script');
        cs = ss[ss.length - 1];
      }
      return new URL(cs.src).origin;
    } catch (e) {
      return window.location.origin;
    }
  })();

  function checkoutUrl(clientSecret, embed) {
    return ORIGIN + '/pay?d=' + encodeURIComponent(clientSecret) + (embed ? '&embed=1' : '');
  }

  function resolveEl(sel) {
    if (!sel) return null;
    if (typeof sel === 'string') return document.querySelector(sel);
    return sel;
  }

  function buildIframe(url) {
    var f = document.createElement('iframe');
    f.src = url;
    f.title = 'Dynopay Checkout';
    f.setAttribute('allow', 'clipboard-write; clipboard-read');
    f.style.border = '0';
    f.style.width = '100%';
    f.style.minHeight = '540px';
    f.style.display = 'block';
    f.style.background = 'transparent';
    return f;
  }

  var instances = [];

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'dynopay') return;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (inst._frame && inst._frame.contentWindow === ev.source) {
        inst._onMessage(d);
        break;
      }
    }
  });

  function Instance(opts, modal) {
    this.opts = opts || {};
    this._modal = !!modal;
    this._frame = null;
    this._overlay = null;
    this._done = false;
    instances.push(this);
  }

  Instance.prototype._onMessage = function (d) {
    var o = this.opts;
    switch (d.type) {
      case 'dynopay:ready':
        if (typeof o.onReady === 'function') o.onReady();
        break;
      case 'dynopay:resize':
        if (this._frame && d.height) this._frame.style.height = d.height + 'px';
        break;
      case 'dynopay:success':
        if (this._done) break;
        this._done = true;
        if (typeof o.onComplete === 'function') o.onComplete(d.paymentId || null);
        break;
      case 'dynopay:redirect':
        if (d.url) {
          if (typeof o.onComplete === 'function' && !this._done) {
            this._done = true;
            o.onComplete(null);
          }
          try { window.top.location.href = d.url; } catch (e) { window.location.href = d.url; }
        }
        break;
      case 'dynopay:close':
        this.destroy();
        break;
    }
  };

  Instance.prototype._render = function (clientSecret, parentEl) {
    this._frame = buildIframe(checkoutUrl(clientSecret, true));
    if (this._modal) {
      var self = this;
      var overlay = document.createElement('div');
      overlay.setAttribute('data-dynopay-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
      var panel = document.createElement('div');
      panel.style.cssText = 'position:relative;width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:16px;background:#0b0b0b;box-shadow:0 24px 80px rgba(0,0,0,0.5);';
      var close = document.createElement('button');
      close.setAttribute('aria-label', 'Close checkout');
      close.innerHTML = '&times;';
      close.style.cssText = 'position:absolute;top:8px;right:12px;z-index:2;border:0;background:transparent;color:#fff;font-size:26px;line-height:1;cursor:pointer;';
      close.onclick = function () { self.destroy(); };
      overlay.onclick = function (e) { if (e.target === overlay) self.destroy(); };
      panel.appendChild(close);
      panel.appendChild(this._frame);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      this._overlay = overlay;
    } else {
      parentEl.appendChild(this._frame);
    }
  };

  Instance.prototype.mount = function (selector) {
    var parentEl = resolveEl(selector);
    if (!parentEl) throw new Error('Dynopay: mount target not found: ' + selector);
    var self = this;
    return Promise.resolve(this._secretPromise).then(function (cs) {
      if (!cs) throw new Error('Dynopay: fetchClientSecret returned no client_secret');
      self._render(cs, parentEl);
      return self;
    });
  };

  Instance.prototype.destroy = function () {
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    } else if (this._frame && this._frame.parentNode) {
      this._frame.parentNode.removeChild(this._frame);
    }
    this._frame = null;
    this._overlay = null;
    var idx = instances.indexOf(this);
    if (idx >= 0) instances.splice(idx, 1);
  };

  function resolveSecret(opts) {
    if (opts.clientSecret) return Promise.resolve(opts.clientSecret);
    if (typeof opts.fetchClientSecret === 'function') {
      return Promise.resolve(opts.fetchClientSecret());
    }
    return Promise.reject(new Error('Dynopay: provide clientSecret or fetchClientSecret'));
  }

  var Dynopay = {
    __v: '1',
    origin: ORIGIN,

    // (a) Inline embedded checkout — mounts an iframe inside your page.
    initEmbeddedCheckout: function (opts) {
      opts = opts || {};
      var inst = new Instance(opts, false);
      inst._secretPromise = resolveSecret(opts);
      return Promise.resolve({
        mount: function (sel) { return inst.mount(sel); },
        destroy: function () { inst.destroy(); },
      });
    },

    // (a) Modal variant — opens the checkout in a centered overlay.
    openCheckout: function (opts) {
      opts = opts || {};
      var inst = new Instance(opts, true);
      resolveSecret(opts).then(function (cs) {
        if (!cs) throw new Error('Dynopay: no client_secret');
        inst._render(cs, null);
      }).catch(function (e) {
        if (typeof opts.onError === 'function') opts.onError(e);
      });
      return { close: function () { inst.destroy(); } };
    },

    // Full-page redirect fallback (no iframe) — like the classic hosted checkout.
    redirectToCheckout: function (opts) {
      opts = opts || {};
      return resolveSecret(opts).then(function (cs) {
        window.location.href = checkoutUrl(cs, false);
      });
    },
  };

  window.Dynopay = Dynopay;
})();
