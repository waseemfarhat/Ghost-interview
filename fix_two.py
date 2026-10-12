import asyncio, os
from playwright.async_api import async_playwright

BASE = 'http://localhost:5174'
OUT = 'screenshots'
ADMIN_EMAIL = 'admin@ghostinterview.local'
ADMIN_PASS = 'ChangeMe123!'
ANSWER = ("I have several years of hands-on experience building REST APIs with Node.js and Express, "
          "backed by MongoDB. For example, I designed an authentication service using JWT access and "
          "refresh tokens, hashed credentials with bcrypt, and added role-based access control so admins "
          "and candidates see different views.")

async def shot(page, name, full=True):
    path = os.path.join(OUT, name + '.png')
    await page.wait_for_timeout(1200)
    await page.screenshot(path=path, full_page=full)
    print('  saved', path, flush=True)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=[
            '--no-sandbox',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
        ])
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900},
                                        permissions=['camera', 'microphone'])
        await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        page = await ctx.new_page()
        page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))

        # login
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3000)
        await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
        await page.locator('input[name="password"]').fill(ADMIN_PASS)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: '/dashboard' in u, timeout=15000)

        # ---- PERFORMANCE TRENDS ----
        print('Dashboard trends...', flush=True)
        await page.goto(BASE + '/dashboard', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(4000)
        try:
            t = page.get_by_text('Readiness trend', exact=False).first
            await t.scroll_into_view_if_needed(timeout=6000)
            await page.wait_for_timeout(1000)
            await shot(page, '37_trends', full=False)
        except Exception as e:
            print('  trends locator failed, capturing full dashboard:', str(e)[:100], flush=True)
            await shot(page, '37_trends', full=True)

        # ---- PARTIAL REPORT ----
        print('Partial report via End interview...', flush=True)
        await page.goto(BASE + '/interview/new', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3500)
        rb = page.locator('button[aria-pressed]')
        n = await rb.count()
        print('  roles found:', n, flush=True)
        if n > 0:
            await rb.first.click(); await page.wait_for_timeout(700)
        await page.get_by_role('button', name='Start interview').click()
        await page.wait_for_url(lambda u: '/interview/' in u, timeout=15000)
        await page.wait_for_timeout(5000)
        sb = page.get_by_role('button', name='Start answering')
        await sb.wait_for(timeout=15000)
        await sb.click(); await page.wait_for_timeout(1200)
        ta = page.locator('textarea[placeholder="Type your answer…"]')
        await ta.wait_for(timeout=10000); await ta.click(); await ta.fill(ANSWER)
        await page.get_by_role('button', name='Submit answer').click()
        await page.wait_for_timeout(7000)
        end = page.get_by_role('button', name='End interview')
        await end.wait_for(timeout=12000); await end.click()
        for _ in range(20):
            if '/reports/' in page.url: break
            await page.wait_for_timeout(1000)
        print('  report url', page.url, flush=True)
        if '/reports/' in page.url:
            await shot(page, '38_partial_report', full=True)

        await browser.close()
        print('DONE', flush=True)

asyncio.run(main())
