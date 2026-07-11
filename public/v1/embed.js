/*! Dynopay Embed SDK v1 — embeddable crypto checkout (Stripe-style).
 *  Load this script from the Dynopay checkout origin. It exposes window.Dynopay.
 *
 *  SECURITY: never put your SECRET api key in the browser. Your SERVER creates a
 *  session (POST /api/user/embed/session with the x-api-key header) and returns
 *  the `client_secret`; this SDK only renders it in an iframe. Order fulfillment
 *  must rely on WEBHOOKS (X-DynoPay-Signature), not the browser success event.
 *
 *  ─── (a) Embedded Checkout — merchant server creates the session ───
 *  Inline:
 *    const checkout = await Dynopay.initEmbeddedCheckout({
 *      fetchClientSecret: () => fetch('/create-session').then(r=>r.json()).then(d=>d.client_secret),
 *      onComplete: (paymentId) => {},
 *    });
 *    checkout.mount('#dynopay-checkout');
 *
 *  Modal:
 *    Dynopay.openCheckout({ fetchClientSecret, onComplete });
 *
 *  ─── (c) Buy Button — merchant server NOT required ───
 *  <script src="https://checkout.dynopay.com/v1/embed.js"></script>
 *
 *  Option 1: pre-created button object (CANONICAL, safest — amount lives server-side)
 *  <dynopay-buy-button
 *      publishable-key="pk_live_…"
 *      button-id="btn_…">
 *  </dynopay-buy-button>
 *
 *  Option 2: inline amount (backward-compat, only when you don't need tamper protection)
 *  <dynopay-buy-button
 *      publishable-key="pk_live_…"
 *      amount="49"
 *      currency="USD"
 *      label="Pay with crypto"
 *      mode="modal"
 *      redirect-uri="https://shop.com/thanks">
 *  </dynopay-buy-button>
 *
 *  Attributes:
 *    publishable-key  (required)   pk_live_… or pk_test_… — safe to expose
 *    button-id        (preferred)  pre-created buy-button object — server resolves amount
 *                                  and cannot be tampered with in the merchant's HTML
 *    amount           (fallback)   numeric, min 5, ≤ the pk's max_amount
 *                                  — required if button-id is absent
 *                                  — for customer-priced buttons, forwarded as the shopper amount
 *    currency         (optional)   restrict to one crypto: BTC / ETH / USDT-TRC20 …
 *    label            (optional)   button text (default "Pay with crypto")
 *    mode             (optional)   "modal" (default) | "redirect" | "inline"
 *    theme            (optional)   "dark" | "light" — controls native button style only
 *    redirect-uri     (optional)   URL to send customer to after payment
 *    meta             (optional)   JSON string echoed back in webhooks
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

    // (c) Buy Button click handler — hits the PUBLIC endpoint with the pk header
    // and then either opens the modal / inline embed / redirects. Exposed so
    // advanced merchants can wire their own custom button element to this flow.
    createSessionWithPk: function (opts) {
      opts = opts || {};
      var pk = opts.publishableKey;
      if (!pk) return Promise.reject(new Error('Dynopay: publishableKey is required'));
      // Canonical path: pass a pre-created button-id and let the server resolve
      // the amount/currencies. Falls back to inline amount for backward compat.
      var body = {};
      if (opts.buttonId) {
        body.button_id = opts.buttonId;
        // For customer-priced buttons we still pass the shopper-chosen amount.
        if (opts.amount != null && !Number.isNaN(Number(opts.amount))) body.amount = Number(opts.amount);
      } else {
        body.amount = opts.amount;
      }
      if (opts.currency)    body.currency = opts.currency;
      if (opts.redirectUri) body.redirect_uri = opts.redirectUri;
      if (opts.meta)        body.meta_data = opts.meta;
      return fetch(ORIGIN + '/api/embed/public/session', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'x-publishable-key': pk,
          'x-dynopay-source': opts.buttonId ? 'buy-button-object' : 'buy-button',
        },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok || !d || !d.success) {
            var msg = (d && d.message) || ('Session creation failed (' + r.status + ')');
            throw new Error(msg);
          }
          return d.data.client_secret;
        });
      });
    },
  };

  // ─── (c) <dynopay-buy-button> custom element ────────────────────────────
  // Rendered as a plain <button> with Dynopay styling. On click it hits the
  // public session endpoint using the pk header, then opens the checkout in
  // the requested mode ("modal" | "redirect" | "inline"). This is the
  // no-code path for merchants who don't want a server integration.
  function readAttrs(el) {
    var rawAmt = el.getAttribute('amount');
    return {
      publishableKey: el.getAttribute('publishable-key') || '',
      // Prefer a pre-created button object (Stripe-canonical path). When a
      // button-id is present the amount lives server-side and cannot be
      // tampered with in the merchant's HTML.
      buttonId:       el.getAttribute('button-id') || '',
      amount:         rawAmt == null || rawAmt === '' ? undefined : Number(rawAmt),
      currency:       el.getAttribute('currency') || undefined,
      label:          el.getAttribute('label') || 'Pay with crypto',
      mode:           (el.getAttribute('mode') || 'modal').toLowerCase(),
      theme:          (el.getAttribute('theme') || 'dark').toLowerCase(),
      redirectUri:    el.getAttribute('redirect-uri') || undefined,
      meta:           (function (raw) {
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
      })(el.getAttribute('meta')),
    };
  }

  function styleButton(btn, theme) {
    var dark = theme !== 'light';
    var bg   = dark ? '#0b0b0b'  : '#ffffff';
    var fg   = dark ? '#ffffff'  : '#0b0b0b';
    var bd   = dark ? '#2a2a2a'  : '#e5e7eb';
    var accent = '#CCFF00';
    btn.style.cssText = [
      'appearance:none',
      'font: 500 15px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
      'display:inline-flex', 'align-items:center', 'gap:10px',
      'padding:12px 20px',
      'border:1px solid ' + bd,
      'border-radius:12px',
      'background:' + bg,
      'color:' + fg,
      'cursor:pointer',
      'transition:transform 80ms ease,box-shadow 200ms ease,border-color 200ms ease',
      'box-shadow:0 1px 2px rgba(0,0,0,0.04)',
    ].join(';');
    btn.onmouseenter = function () { btn.style.borderColor = accent; };
    btn.onmouseleave = function () { btn.style.borderColor = bd; };
    btn.onmousedown  = function () { btn.style.transform = 'scale(0.98)'; };
    btn.onmouseup    = function () { btn.style.transform = 'scale(1)'; };
  }

  var DYNO_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 7l8 5 8-5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 7l8 5 8-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function BuyButtonElement() {
    return Reflect.construct(HTMLElement, [], BuyButtonElement);
  }
  BuyButtonElement.prototype = Object.create(HTMLElement.prototype);
  BuyButtonElement.prototype.constructor = BuyButtonElement;

  BuyButtonElement.prototype.connectedCallback = function () {
    var self = this;
    var attrs = readAttrs(this);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-dynopay-buy-button', '');
    styleButton(btn, attrs.theme);
    btn.innerHTML = DYNO_ICON + '<span>' + (attrs.label || 'Pay with crypto') + '</span>';

    if (!attrs.publishableKey || (!attrs.buttonId && !(attrs.amount >= 5))) {
      btn.disabled = true;
      btn.title = 'dynopay-buy-button: needs publishable-key + (button-id OR amount ≥ 5)';
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Loading…</span>';
      Dynopay.createSessionWithPk({
        publishableKey: attrs.publishableKey,
        buttonId:       attrs.buttonId,
        amount:         attrs.amount,
        currency:       attrs.currency,
        redirectUri:    attrs.redirectUri,
        meta:           attrs.meta,
      }).then(function (cs) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        var onComplete = function (paymentId) {
          self.dispatchEvent(new CustomEvent('dynopay:complete', { detail: { paymentId: paymentId }, bubbles: true }));
        };
        var onError = function (e) {
          self.dispatchEvent(new CustomEvent('dynopay:error', { detail: { message: (e && e.message) || String(e) }, bubbles: true }));
        };
        if (attrs.mode === 'redirect') {
          Dynopay.redirectToCheckout({ clientSecret: cs });
        } else if (attrs.mode === 'inline') {
          // Insert an inline iframe right after the button.
          var host = document.createElement('div');
          host.setAttribute('data-dynopay-inline', '');
          host.style.cssText = 'max-width:460px;margin-top:12px;';
          self.parentNode.insertBefore(host, self.nextSibling);
          Dynopay.initEmbeddedCheckout({
            clientSecret: cs, onComplete: onComplete, onError: onError,
          }).then(function (chk) { chk.mount(host); });
        } else {
          // default: modal
          Dynopay.openCheckout({ clientSecret: cs, onComplete: onComplete, onError: onError });
        }
      }).catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        self.dispatchEvent(new CustomEvent('dynopay:error', { detail: { message: err.message || 'Session error' }, bubbles: true }));
        // Also render a tiny inline error so integrators see what happened
        var msg = document.createElement('div');
        msg.textContent = 'Payment error: ' + (err.message || 'unknown');
        msg.style.cssText = 'color:#dc2626;font-size:12px;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
        self.appendChild(msg);
        setTimeout(function () { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 6000);
      });
    });

    this.innerHTML = '';
    this.appendChild(btn);
  };

  if (window.customElements && !window.customElements.get('dynopay-buy-button')) {
    try { window.customElements.define('dynopay-buy-button', BuyButtonElement); } catch (e) { /* older browsers */ }
  }

  window.Dynopay = Dynopay;
})();
