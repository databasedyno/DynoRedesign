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

  // ─── (b) Elements Inline Widget — native crypto pay UI in your DOM ─────
  //
  // Usage:
  //   const dp = Dynopay('pk_live_...');
  //   const elements = dp.elements({ appearance: { theme: 'auto', preset: 'stripe-like', accent: '#CCFF00', locale: 'es' } });
  //   const el = elements.create('crypto', { amount: 20, currency: 'USDT-TRC20' });
  //   el.mount('#dynopay-crypto-el');
  //   el.on('succeeded',       (data) => location.href = '/thanks?p=' + data.payment_id);
  //   el.on('currency_selected', (d) => console.log('picked', d.currency));
  //
  // The rendered widget shows: currency picker → address + QR + amount + live status.
  // Status is polled from GET /api/embed/public/elements/status every 5 seconds until
  // the payment reaches `succeeded`, `expired`, or `failed`. Fulfillment must still
  // rely on the server-to-server webhook (X-DynoPay-Signature) — the browser event
  // is UI-only.
  //
  // Appearance API:
  //   theme:   'dark' | 'light' | 'auto'  (default 'auto' → follows prefers-color-scheme)
  //   preset:  'default' | 'stripe-like' | 'flat' | 'minimal'  (default 'default')
  //   accent:  '#RRGGBB'                  (default '#CCFF00')
  //   radius:  number in px               (default derived from preset)
  //   locale:  'en'|'es'|'fr'|'pt'|'hi'   (default: navigator.language → 'en')
  //   labels:  { [key]: string }          (override any built-in string)
  var POLL_INTERVAL_MS = 5000;

  // ─── i18n string table (Elements widget) ───────────────────────────
  var DEFAULT_LOCALE = 'en';
  var LOCALES = {
    en: {
      title: 'Pay with crypto',
      subPick: '{amount} {baseCurrency} · pick a currency',
      sendTitle: 'Send {currency}',
      sendSub: 'Send exactly {amount} {currency} · {baseAmount} {baseCurrency}',
      address: 'Address',
      copy: 'Copy',
      copied: 'Copied',
      destTag: '\u26A0 Destination tag required: {tag}',
      changeCurrency: 'Change currency',
      secured: 'Secured by Dynopay',
      loading: 'Loading\u2026',
      errorTitle: 'Payment error',
      waiting: 'Waiting for payment\u2026',
      processing: 'Confirming on-chain\u2026',
      succeeded: 'Payment received \u2713',
      expired: 'Expired',
      failed: 'Failed',
    },
    es: {
      title: 'Pagar con cripto',
      subPick: '{amount} {baseCurrency} \u00B7 elige una moneda',
      sendTitle: 'Env\u00EDa {currency}',
      sendSub: 'Env\u00EDa exactamente {amount} {currency} \u00B7 {baseAmount} {baseCurrency}',
      address: 'Direcci\u00F3n',
      copy: 'Copiar',
      copied: 'Copiado',
      destTag: '\u26A0 Se requiere destination tag: {tag}',
      changeCurrency: 'Cambiar moneda',
      secured: 'Protegido por Dynopay',
      loading: 'Cargando\u2026',
      errorTitle: 'Error de pago',
      waiting: 'Esperando pago\u2026',
      processing: 'Confirmando en la red\u2026',
      succeeded: 'Pago recibido \u2713',
      expired: 'Expirado',
      failed: 'Fallido',
    },
    fr: {
      title: 'Payer en crypto',
      subPick: '{amount} {baseCurrency} \u00B7 choisissez une devise',
      sendTitle: 'Envoyez {currency}',
      sendSub: 'Envoyez exactement {amount} {currency} \u00B7 {baseAmount} {baseCurrency}',
      address: 'Adresse',
      copy: 'Copier',
      copied: 'Copi\u00E9',
      destTag: '\u26A0 Destination tag requis : {tag}',
      changeCurrency: 'Changer de devise',
      secured: 'S\u00E9curis\u00E9 par Dynopay',
      loading: 'Chargement\u2026',
      errorTitle: 'Erreur de paiement',
      waiting: 'En attente de paiement\u2026',
      processing: 'Confirmation sur la blockchain\u2026',
      succeeded: 'Paiement re\u00E7u \u2713',
      expired: 'Expir\u00E9',
      failed: '\u00C9chec',
    },
    pt: {
      title: 'Pagar com cripto',
      subPick: '{amount} {baseCurrency} \u00B7 escolha uma moeda',
      sendTitle: 'Enviar {currency}',
      sendSub: 'Envie exatamente {amount} {currency} \u00B7 {baseAmount} {baseCurrency}',
      address: 'Endere\u00E7o',
      copy: 'Copiar',
      copied: 'Copiado',
      destTag: '\u26A0 Destination tag necess\u00E1rio: {tag}',
      changeCurrency: 'Mudar moeda',
      secured: 'Protegido por Dynopay',
      loading: 'Carregando\u2026',
      errorTitle: 'Erro no pagamento',
      waiting: 'Aguardando pagamento\u2026',
      processing: 'Confirmando na blockchain\u2026',
      succeeded: 'Pagamento recebido \u2713',
      expired: 'Expirado',
      failed: 'Falhou',
    },
    hi: {
      title: '\u0915\u094D\u0930\u093F\u092A\u094D\u091F\u094B \u0938\u0947 \u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0930\u0947\u0902',
      subPick: '{amount} {baseCurrency} \u00B7 \u092E\u0941\u0926\u094D\u0930\u093E \u091A\u0941\u0928\u0947\u0902',
      sendTitle: '{currency} \u092D\u0947\u091C\u0947\u0902',
      sendSub: '\u0920\u0940\u0915 {amount} {currency} \u092D\u0947\u091C\u0947\u0902 \u00B7 {baseAmount} {baseCurrency}',
      address: '\u092A\u0924\u093E',
      copy: '\u0915\u0949\u092A\u0940',
      copied: '\u0915\u0949\u092A\u0940 \u0939\u094B \u0917\u092F\u093E',
      destTag: '\u26A0 Destination tag \u0906\u0935\u0936\u094D\u092F\u0915: {tag}',
      changeCurrency: '\u092E\u0941\u0926\u094D\u0930\u093E \u092C\u0926\u0932\u0947\u0902',
      secured: 'Dynopay \u0926\u094D\u0935\u093E\u0930\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924',
      loading: '\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u2026',
      errorTitle: '\u092D\u0941\u0917\u0924\u093E\u0928 \u0924\u094D\u0930\u0941\u091F\u093F',
      waiting: '\u092D\u0941\u0917\u0924\u093E\u0928 \u0915\u0940 \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093E \u0939\u0948\u2026',
      processing: '\u092C\u094D\u0932\u0949\u0915\u091A\u0947\u0928 \u092A\u0930 \u092A\u0941\u0937\u094D\u091F\u093F \u0939\u094B \u0930\u0939\u0940 \u0939\u0948\u2026',
      succeeded: '\u092D\u0941\u0917\u0924\u093E\u0928 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0939\u0941\u0906 \u2713',
      expired: '\u0938\u092E\u093E\u092A\u094D\u0924',
      failed: '\u0935\u093F\u092B\u0932',
    },
  };

  function resolveLocale(explicit) {
    if (explicit && LOCALES[explicit]) return explicit;
    try {
      var nav = ((navigator.language || navigator.userLanguage || '') + '').slice(0, 2).toLowerCase();
      if (LOCALES[nav]) return nav;
    } catch (e) { /* SSR / no navigator */ }
    return DEFAULT_LOCALE;
  }

  function interpolate(str, vars) {
    if (str == null) return '';
    if (!vars) return String(str);
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : '';
    });
  }

  // Named appearance presets — merchant can still override individual keys
  var APPEARANCE_PRESETS = {
    'default':     { radius: 12, panelBg: true,  borders: true  },
    'stripe-like': { radius: 8,  panelBg: true,  borders: true  },
    'flat':        { radius: 0,  panelBg: true,  borders: true  },
    'minimal':     { radius: 16, panelBg: false, borders: false },
  };

  function ElementsFactory(pk, cfg) {
    cfg = cfg || {};
    var appearance = cfg.appearance || {};
    return {
      create: function (type, opts) {
        if (type !== 'crypto') throw new Error("Dynopay.elements: only 'crypto' element type is supported in v1");
        return new CryptoElement(pk, opts || {}, appearance);
      },
    };
  }

  function CryptoElement(pk, opts, appearance) {
    this._pk = pk;
    this._opts = opts;
    this._appearance = appearance || {};
    this._listeners = {};
    this._root = null;
    this._parent = null;
    this._pollTimer = null;
    this._intent = null;   // { intent_id, client_secret, available_currencies, amount, base_currency }
    this._selection = null;   // { currency, address, qr_code, amount, destination_tag, payment_id }
    this._destroyed = false;
    this._done = false;
  }

  CryptoElement.prototype.on = function (event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return this;
  };
  CryptoElement.prototype._emit = function (event, payload) {
    var arr = this._listeners[event] || [];
    for (var i = 0; i < arr.length; i++) { try { arr[i](payload); } catch (e) { /* swallow */ } }
    if (this._root) this._root.dispatchEvent(new CustomEvent('dynopay:' + event, { detail: payload, bubbles: true }));
  };

  CryptoElement.prototype._apiHeaders = function () {
    return {
      'Content-Type': 'application/json',
      'x-publishable-key': this._pk,
      'x-dynopay-source': 'elements',
    };
  };

  CryptoElement.prototype._createIntent = function () {
    var body = {};
    if (this._opts.amount != null) body.amount = Number(this._opts.amount);
    if (this._opts.currency)       body.currency = this._opts.currency;
    if (this._opts.redirectUri)    body.redirect_uri = this._opts.redirectUri;
    if (this._opts.meta)           body.meta_data = this._opts.meta;
    var self = this;
    return fetch(ORIGIN + '/api/embed/public/elements/intent', {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: this._apiHeaders(), body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || !d || !d.success) throw new Error((d && d.message) || 'Intent creation failed');
        self._intent = d.data;
        return d.data;
      });
    });
  };

  CryptoElement.prototype._selectCurrency = function (currency) {
    var self = this;
    return fetch(ORIGIN + '/api/embed/public/elements/select-currency', {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: this._apiHeaders(),
      body: JSON.stringify({ intent_id: self._intent.intent_id, currency: currency }),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || !d || !d.success) throw new Error((d && d.message) || 'Currency selection failed');
        self._selection = d.data;
        return d.data;
      });
    });
  };

  CryptoElement.prototype._fetchStatus = function () {
    if (!this._intent) return Promise.resolve(null);
    var self = this;
    var url = ORIGIN + '/api/embed/public/elements/status?intent_id=' + encodeURIComponent(this._intent.intent_id);
    return fetch(url, {
      method: 'GET', mode: 'cors', credentials: 'omit', headers: this._apiHeaders(),
    }).then(function (r) { return r.json(); }).then(function (d) {
      return (d && d.data) || null;
    }).catch(function () { return null; });
  };

  CryptoElement.prototype._startPolling = function () {
    var self = this;
    if (self._pollTimer) return;
    self._pollTimer = setInterval(function () {
      if (self._destroyed || self._done) { self._stopPolling(); return; }
      self._fetchStatus().then(function (data) {
        if (!data) return;
        self._renderStatusBanner(data.status);
        if (data.status === 'succeeded') {
          self._done = true;
          self._stopPolling();
          self._emit('succeeded', data);
        } else if (data.status === 'expired' || data.status === 'failed') {
          self._done = true;
          self._stopPolling();
          self._emit(data.status, data);
        }
      });
    }, POLL_INTERVAL_MS);
  };
  CryptoElement.prototype._stopPolling = function () {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  };

  /* --- rendering helpers --- */
  CryptoElement.prototype._t = function (key, vars) {
    var app = this._appearance || {};
    var locale = resolveLocale(app.locale);
    var labels = app.labels || {};
    var strings = LOCALES[locale] || LOCALES[DEFAULT_LOCALE];
    var tpl = (labels[key] != null) ? labels[key] : strings[key];
    if (tpl == null) tpl = LOCALES[DEFAULT_LOCALE][key];
    if (tpl == null) tpl = key;
    return interpolate(tpl, vars);
  };
  CryptoElement.prototype._theme = function () {
    var app = this._appearance || {};
    var presetName = app.preset || 'default';
    var preset = APPEARANCE_PRESETS[presetName] || APPEARANCE_PRESETS['default'];

    // Auto theme: if theme unset or 'auto', follow prefers-color-scheme.
    // Falls back to 'dark' on SSR / older browsers.
    var themeName = app.theme;
    if (!themeName || themeName === 'auto') {
      try {
        themeName = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      } catch (e) { themeName = 'dark'; }
    }
    var dark = themeName !== 'light';
    var radius = (app.radius != null ? Number(app.radius) : preset.radius);

    return {
      dark: dark,
      bg:     dark ? '#0b0b0b' : '#ffffff',
      panel:  preset.panelBg ? (dark ? '#141414' : '#f8fafc') : (dark ? '#0b0b0b' : '#ffffff'),
      fg:     dark ? '#fafafa' : '#0b0b0b',
      muted:  dark ? '#a1a1aa' : '#52525b',
      border: preset.borders ? (dark ? '#27272a' : '#e4e4e7') : 'transparent',
      accent: app.accent || '#CCFF00',
      radius: radius + 'px',
    };
  };
  CryptoElement.prototype._h = function (tag, style, text) {
    var el = document.createElement(tag);
    if (style) el.style.cssText = style;
    if (text != null) el.textContent = text;
    return el;
  };
  CryptoElement.prototype._panel = function () {
    var t = this._theme();
    var wrap = this._h('div', [
      'font: 400 14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
      'color:' + t.fg, 'background:' + t.bg,
      'border:1px solid ' + t.border, 'border-radius:' + t.radius,
      'padding:20px', 'max-width:460px', 'box-sizing:border-box',
    ].join(';'));
    return wrap;
  };
  CryptoElement.prototype._renderLoading = function () {
    var t = this._theme();
    var root = this._panel();
    root.appendChild(this._h('div', 'font-weight:600;font-size:15px;color:' + t.muted + ';margin-bottom:8px;', this._t('loading')));
    this._swap(root);
  };
  CryptoElement.prototype._renderError = function (msg) {
    var t = this._theme();
    var root = this._panel();
    root.appendChild(this._h('div', 'font-weight:600;color:#dc2626;margin-bottom:4px;', this._t('errorTitle')));
    root.appendChild(this._h('div', 'color:' + t.muted + ';font-size:13px;', msg));
    this._swap(root);
    this._emit('error', { message: msg });
  };
  CryptoElement.prototype._renderCurrencyPicker = function () {
    var self = this;
    var t = this._theme();
    var root = this._panel();
    var d = this._intent;
    root.appendChild(this._h('div', 'font-weight:600;font-size:16px;margin-bottom:4px;', this._t('title')));
    root.appendChild(this._h('div', 'color:' + t.muted + ';font-size:13px;margin-bottom:16px;',
      this._t('subPick', { amount: d.amount, baseCurrency: d.base_currency })));

    var list = this._h('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;');
    d.available_currencies.forEach(function (c) {
      var b = self._h('button', [
        'appearance:none', 'cursor:pointer',
        'padding:10px 12px', 'font: 500 13px/1 inherit', 'color:' + t.fg,
        'background:' + t.panel, 'border:1px solid ' + t.border, 'border-radius:10px',
        'transition:border-color 150ms',
      ].join(';'), c);
      b.setAttribute('data-testid', 'elements-currency-' + c);
      b.onmouseenter = function () { b.style.borderColor = t.accent; };
      b.onmouseleave = function () { b.style.borderColor = t.border; };
      b.onclick = function () { self._pickCurrency(c); };
      list.appendChild(b);
    });
    root.appendChild(list);

    root.appendChild(this._h('div', 'color:' + t.muted + ';font-size:11px;margin-top:14px;text-align:center;', this._t('secured')));
    this._swap(root);
  };

  CryptoElement.prototype._renderAddress = function () {
    var self = this, t = this._theme(), s = this._selection, d = this._intent;
    var root = this._panel();
    root.appendChild(this._h('div', 'font-weight:600;font-size:16px;margin-bottom:2px;',
      this._t('sendTitle', { currency: s.currency })));
    var amountLine = this._h('div', 'color:' + t.muted + ';font-size:13px;margin-bottom:16px;',
      this._t('sendSub', {
        amount: s.amount, currency: s.currency,
        baseAmount: d.amount, baseCurrency: d.base_currency,
      }));
    root.appendChild(amountLine);

    if (s.qr_code) {
      var qrWrap = this._h('div', 'display:flex;justify-content:center;margin-bottom:14px;');
      var img = document.createElement('img');
      img.src = s.qr_code;
      img.alt = s.currency + ' payment QR';
      img.style.cssText = 'width:200px;height:200px;background:#fff;border-radius:10px;padding:8px;box-sizing:border-box;border:1px solid ' + t.border + ';';
      qrWrap.appendChild(img);
      root.appendChild(qrWrap);
    }

    var addrLabel = this._h('div', 'color:' + t.muted + ';font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;', this._t('address'));
    root.appendChild(addrLabel);
    var addrRow = this._h('div', 'display:flex;gap:8px;align-items:stretch;margin-bottom:12px;');
    var addr = this._h('div', 'flex:1;font: 400 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:' + t.panel + ';border:1px solid ' + t.border + ';padding:10px;border-radius:8px;overflow-wrap:anywhere;color:' + t.fg + ';', s.address);
    addr.setAttribute('data-testid', 'elements-address');
    addrRow.appendChild(addr);
    var copyLabel = this._t('copy');
    var copiedLabel = this._t('copied');
    var copy = this._h('button', 'appearance:none;cursor:pointer;padding:8px 14px;background:' + t.accent + ';color:#0b0b0b;border:0;border-radius:8px;font: 500 12px/1 inherit;', copyLabel);
    copy.onclick = function () { try { navigator.clipboard.writeText(s.address); copy.textContent = copiedLabel; setTimeout(function () { copy.textContent = copyLabel; }, 1500); } catch (e) { /* older browsers */ } };
    addrRow.appendChild(copy);
    root.appendChild(addrRow);

    if (s.destination_tag) {
      root.appendChild(this._h('div', 'color:#f59e0b;font-size:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:8px 10px;border-radius:8px;margin-bottom:12px;',
        this._t('destTag', { tag: s.destination_tag })));
    }

    // Status banner (updated by polling)
    this._statusEl = this._h('div', 'display:flex;align-items:center;gap:8px;color:' + t.muted + ';font-size:13px;margin-top:4px;padding:10px 12px;background:' + t.panel + ';border-radius:8px;border:1px solid ' + t.border + ';');
    this._statusEl.setAttribute('data-testid', 'elements-status');
    this._renderStatusInto(this._statusEl, 'awaiting_payment');
    root.appendChild(this._statusEl);

    // "Change currency" link
    var chg = this._h('button', 'appearance:none;cursor:pointer;margin-top:12px;background:transparent;color:' + t.muted + ';border:0;font: 500 12px/1 inherit;text-decoration:underline;padding:0;', this._t('changeCurrency'));
    chg.onclick = function () { if (self._done) return; self._selection = null; self._done = false; self._stopPolling(); self._renderCurrencyPicker(); };
    root.appendChild(chg);

    this._swap(root);
    this._startPolling();
    this._emit('currency_selected', { currency: s.currency, address: s.address, amount: s.amount });
  };

  CryptoElement.prototype._renderStatusInto = function (el, status) {
    var t = this._theme();
    el.innerHTML = '';
    var dot = this._h('span', 'width:8px;height:8px;border-radius:50%;flex-shrink:0;');
    var text;
    if (status === 'succeeded') { dot.style.background = '#10b981'; text = this._t('succeeded'); el.style.color = '#10b981'; }
    else if (status === 'processing') { dot.style.background = '#f59e0b'; text = this._t('processing'); el.style.color = t.fg; }
    else if (status === 'expired') { dot.style.background = '#dc2626'; text = this._t('expired'); el.style.color = '#dc2626'; }
    else if (status === 'failed')  { dot.style.background = '#dc2626'; text = this._t('failed');  el.style.color = '#dc2626'; }
    else { dot.style.background = t.accent; text = this._t('waiting'); el.style.color = t.muted; }
    el.appendChild(dot);
    el.appendChild(this._h('span', '', text));
  };
  CryptoElement.prototype._renderStatusBanner = function (status) {
    if (this._statusEl) this._renderStatusInto(this._statusEl, status);
  };

  CryptoElement.prototype._swap = function (newRoot) {
    if (this._destroyed) return;
    if (this._root && this._root.parentNode) this._root.parentNode.replaceChild(newRoot, this._root);
    else if (this._parent) this._parent.appendChild(newRoot);
    this._root = newRoot;
  };

  CryptoElement.prototype._pickCurrency = function (currency) {
    var self = this;
    this._renderLoading();
    this._selectCurrency(currency).then(function () {
      self._renderAddress();
    }).catch(function (err) {
      self._renderError(err.message || String(err));
    });
  };

  CryptoElement.prototype.mount = function (selector) {
    var self = this;
    var parentEl = resolveEl(selector);
    if (!parentEl) throw new Error('Dynopay Elements: mount target not found: ' + selector);
    this._parent = parentEl;
    this._renderLoading();
    // If a pre-created intent was passed (clientSecret style), skip intent creation.
    var intentPromise;
    if (this._opts.intent) {
      this._intent = this._opts.intent;
      intentPromise = Promise.resolve(this._intent);
    } else {
      intentPromise = this._createIntent();
    }
    intentPromise.then(function () {
      // If currency was passed, auto-select — otherwise show picker
      if (self._opts.currency && self._intent.available_currencies.indexOf(self._opts.currency) >= 0) {
        self._pickCurrency(self._opts.currency);
      } else {
        self._renderCurrencyPicker();
      }
    }).catch(function (err) {
      self._renderError(err.message || String(err));
    });
    return this;
  };

  CryptoElement.prototype.destroy = function () {
    this._destroyed = true;
    this._stopPolling();
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null; this._parent = null; this._listeners = {};
  };

  // Public factory — `const dp = Dynopay('pk_live_...')` returns an SDK client.
  // Existing global `Dynopay` (holding initEmbeddedCheckout etc.) stays for
  // Phase 1a — the factory is BOTH a function AND a namespace.
  function DynopayClient(pk) {
    return { elements: function (cfg) { return ElementsFactory(pk, cfg); } };
  }
  // We wire the callable up below, AFTER the existing `Dynopay` object is
  // defined, by merging its properties onto the callable.


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

  // Merge the namespace `Dynopay` onto the callable factory so BOTH work:
  //   const dp = Dynopay('pk_live_...');            // callable factory (b)
  //   dp.elements().create('crypto').mount('#el');
  //   Dynopay.initEmbeddedCheckout({...}).then(...); // static (a)/(c)
  var DynopayCallable = function (pk) { return DynopayClient(pk); };
  for (var _k in Dynopay) { if (Object.prototype.hasOwnProperty.call(Dynopay, _k)) DynopayCallable[_k] = Dynopay[_k]; }
  window.Dynopay = DynopayCallable;
})();
