import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = await browser.new_context(viewport={"width": 1920, "height": 800})
        page = await context.new_page()
        
        errors = []
        page.on('console', lambda msg: errors.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: errors.append(f'[PAGE_ERROR] {str(err)}'))
        
        try:
            await page.goto('http://localhost:3000/transactions', wait_until='domcontentloaded', timeout=20000)
            await page.wait_for_timeout(10000)
        except Exception as e:
            errors.append(f'[NAV_ERROR] {str(e)}')
        
        await page.screenshot(path='/app/debug_screenshot.png')
        
        text = await page.text_content('body')
        
        print('=== PAGE TEXT ===')
        print((text or '')[:2000])
        print('\n=== CONSOLE/ERRORS ===')
        for e in errors:
            print(e)
        
        await browser.close()

asyncio.run(main())
