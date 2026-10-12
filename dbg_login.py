import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--no-sandbox', '--use-fake-device-for-media-stream'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        p = await ctx.new_page()
        p.on('console', lambda m: print('CONSOLE', m.type, m.text[:200]))
        p.on('pageerror', lambda e: print('PAGEERROR', str(e)[:300]))
        p.on('pageerror', lambda e: print('PAGEERROR', str(e)[:300]))
        for wait in [3, 6, 10]:
            await p.goto('http://localhost:5173/login', wait_until='networkidle', timeout=60000)
            await p.wait_for_timeout(wait * 1000)
            url = p.url
            has_email = await p.evaluate("!!document.querySelector('input[name=\"email\"]')")
            body = (await p.inner_text('body'))[:180].replace('\n', ' | ')
            print('WAIT=%ss URL=%s HAS_EMAIL=%s' % (wait, url, has_email))
            print('  BODY: ' + body)
            if has_email:
                break
        await b.close()

asyncio.run(main())
