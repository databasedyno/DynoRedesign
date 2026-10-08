import asyncio

BASE = "https://secure-vault-app-57.preview.emergentagent.com"

MARKETING = ["/", "/fees", "/for/freelancers", "/products", "/blog", "/about",
             "/pay?d=jgQQzL", "/pay/demo", "/auth/login", "/auth/signup", "/reset-password"]

async def get_theme(page):
    return await page.evaluate("() => document.documentElement.dataset.theme")

async def get_ls(page, key):
    try:
        return await page.evaluate(f"() => localStorage.getItem('{key}')")
    except Exception:
        return None

async def get_cookies(context):
    return {c["name"]: c["value"] for c in await context.cookies()}

async def visit(context, path, viewport=None):
    page = await context.new_page()
    if viewport:
        await page.set_viewport_size(viewport)
    url = BASE + path
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception:
        await asyncio.sleep(10)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    try:
        await page.wait_for_load_state("networkidle", timeout=3000)
    except Exception:
        pass
    theme = await get_theme(page)
    dyno = await get_ls(page, "dyno-theme")
    cookies = await get_cookies(context)
    return page, theme, dyno, cookies

async def run():
    from playwright.async_api import async_playwright
    results = {"S1": [], "S2": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # === S1 DARK ===
        ctx = await browser.new_context(color_scheme="dark", viewport={"width":1280,"height":800})
        for path in MARKETING:
            try:
                page, theme, dyno, cookies = await visit(ctx, path)
                ok = theme == "dark" and dyno in (None, "") and cookies.get("dyno-theme-eff") == "dark"
                results["S1"].append((f"DARK {path}", theme, dyno, cookies.get("dyno-theme-eff"), ok))
                await page.close()
            except Exception as e:
                results["S1"].append((f"DARK {path}", "ERR", str(e)[:80], None, False))
        await ctx.close()

        # S1 desktop + mobile viewport spot checks
        for vp_name, vp in [("desk1920", {"width":1920,"height":800}), ("mob390", {"width":390,"height":844})]:
            for path in ["/", "/pay?d=jgQQzL", "/auth/login"]:
                ctx = await browser.new_context(color_scheme="dark", viewport=vp)
                try:
                    page, theme, dyno, cookies = await visit(ctx, path)
                    ok = theme == "dark"
                    results["S1"].append((f"DARK {vp_name} {path}", theme, dyno, cookies.get("dyno-theme-eff"), ok))
                except Exception as e:
                    results["S1"].append((f"DARK {vp_name} {path}", "ERR", str(e)[:80], None, False))
                await ctx.close()

        # === S1 LIGHT ===
        ctx = await browser.new_context(color_scheme="light", viewport={"width":1280,"height":800})
        for path in MARKETING:
            try:
                page, theme, dyno, cookies = await visit(ctx, path)
                ok = theme == "light" and dyno in (None, "") and cookies.get("dyno-theme-eff") == "light"
                results["S1"].append((f"LIGHT {path}", theme, dyno, cookies.get("dyno-theme-eff"), ok))
                await page.close()
            except Exception as e:
                results["S1"].append((f"LIGHT {path}", "ERR", str(e)[:80], None, False))
        await ctx.close()

        # === S2 Live device follow ===
        ctx = await browser.new_context(color_scheme="dark", viewport={"width":1280,"height":800})
        page = await ctx.new_page()
        await page.goto(BASE + "/pay?d=jgQQzL", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle", timeout=5000)
        t1 = await get_theme(page)
        results["S2"].append(("initial dark /pay", t1, t1=="dark"))
        # emulate light
        await ctx.__aenter__() if False else None
        # Playwright: context.emulate_media applies to all pages? use page.emulate_media
        await page.emulate_media(color_scheme="light")
        await asyncio.sleep(1)
        t2 = await get_theme(page)
        results["S2"].append(("emulate light /pay", t2, t2=="light"))
        # /auth/login
        page2 = await ctx.new_page()
        await page2.emulate_media(color_scheme="light")
        await page2.goto(BASE + "/auth/login", wait_until="domcontentloaded")
        await page2.wait_for_load_state("networkidle", timeout=5000)
        t3 = await get_theme(page2)
        results["S2"].append(("light device /auth/login", t3, t3=="light"))
        # toggle
        try:
            await page2.click('[data-testid=theme-toggle-button]', timeout=5000)
            await asyncio.sleep(0.5)
            t4 = await get_theme(page2)
            dyno4 = await get_ls(page2, "dyno-theme")
            results["S2"].append(("after toggle /auth/login", t4, dyno4, t4=="dark" and dyno4=="dark"))
        except Exception as e:
            results["S2"].append(("toggle err", str(e)[:120], False))
        # emulate device dark→ but manual wins
        await page2.emulate_media(color_scheme="dark")
        await asyncio.sleep(0.8)
        t5 = await get_theme(page2)
        results["S2"].append(("manual wins after device change", t5, t5=="dark"))
        await ctx.close()

        await browser.close()

    # Print report
    print("\n=== S1 ===")
    pass_s1 = 0
    for r in results["S1"]:
        print(r)
        if r[-1]: pass_s1+=1
    print(f"S1 pass: {pass_s1}/{len(results['S1'])}")
    print("\n=== S2 ===")
    for r in results["S2"]:
        print(r)

asyncio.run(run())
