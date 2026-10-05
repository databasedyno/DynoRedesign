// Read-only DOM "clutter" metrics for the in-app UX audit (2026-10-05).
// Evaluated in the page via Playwright: page.evaluate(<this file contents>)
// Counts only elements inside the main content area (right of the sidebar, below the top bar).
(() => {
  const SIDEBAR_W = (document.querySelector('[data-testid="new-sidebar"], nav') || { getBoundingClientRect: () => ({ right: 240 }) }).getBoundingClientRect().right || 240;
  const TOPBAR_H = 64;
  const inMain = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    return r.left >= SIDEBAR_W - 2 && (r.top + window.scrollY) >= TOPBAR_H;
  };
  const all = [...document.querySelectorAll('body *')].filter(inMain);
  const interactive = all.filter((e) => e.matches('button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox]'));
  const textEls = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  const fontSizes = new Set(textEls.map((e) => getComputedStyle(e).fontSize));
  const fontWeights = new Set(textEls.map((e) => getComputedStyle(e).fontWeight));
  const colors = new Set(textEls.map((e) => getComputedStyle(e).color));
  const bordered = all.filter((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return r.width > 120 && r.height > 48 && parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && parseFloat(cs.borderRadius) >= 6;
  });
  const clipped = textEls.filter((e) => {
    const cs = getComputedStyle(e);
    return (cs.overflow.includes('hidden') || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1;
  }).map((e) => e.innerText.trim().slice(0, 40));
  const banners = all.filter((e) => e.matches('[role=alert], .MuiAlert-root, [data-testid*=banner], [data-testid*=tip], [data-testid*=nudge], [data-testid*=callout]')).length;
  const primaryBtns = interactive.filter((e) => {
    const bg = getComputedStyle(e).backgroundColor;
    return /rgb\(255, 209, 0\)|rgb\(255, 214, 0\)|rgb\(250, 204, 21\)|rgb\(255, 204, 0\)/.test(bg);
  }).length;
  const headings = all.filter((e) => e.matches('h1,h2,h3,h4,h5,h6')).map((e) => `${e.tagName}:${e.innerText.trim().slice(0, 40)}`);
  const tinyText = textEls.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).length;
  const scroller = [...document.querySelectorAll('body *')].filter((e) => {
    const cs = getComputedStyle(e);
    return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.getBoundingClientRect().left > 150;
  }).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0];
  if (scroller) scroller.setAttribute('data-audit-scroller', '1');
  return {
    url: location.pathname + location.search,
    pageHeight: scroller ? scroller.scrollHeight : document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    interactive: interactive.length,
    primaryYellowButtons: primaryBtns,
    distinctFontSizes: fontSizes.size,
    fontSizes: [...fontSizes].sort((a, b) => parseFloat(a) - parseFloat(b)).join(' '),
    distinctFontWeights: fontWeights.size,
    distinctTextColors: colors.size,
    borderedBoxes: bordered.length,
    banners,
    tinyTextUnder11px: tinyText,
    clippedText: clipped.slice(0, 8),
    headings: headings.slice(0, 14),
  };
})()
