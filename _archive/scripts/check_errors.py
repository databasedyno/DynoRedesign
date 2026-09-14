import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = await browser.new_page()
        
        errors = []
        page.on('console', lambda msg: errors.append(f'[{msg.type}] {msg.text}') if msg.type in ['error'] else None)
        page.on('pageerror', lambda err: errors.append(f'[PAGE_ERROR] {str(err)[:500]}'))
        
        try:
            await page.goto('http://localhost:3000/transactions', wait_until='domcontentloaded', timeout=15000)
            await page.wait_for_timeout(8000)
        except Exception as e:
            print(f'Nav error: {e}')
        
        print('=== TRANSACTIONS PAGE ERRORS ===')
        for e in errors[:15]:
            print(e)
        if not errors:
            print('(no errors)')
        
        errors.clear()
        try:
            await page.goto('http://localhost:3000/developer-keys', wait_until='domcontentloaded', timeout=15000)
            await page.wait_for_timeout(8000)
        except Exception as e:
            print(f'Nav error: {e}')
        
        print()
        print('=== DEVELOPER-KEYS PAGE ERRORS ===')
        for e in errors[:15]:
            print(e)
        if not errors:
            print('(no errors)')
        
        await browser.close()

asyncio.run(main())
