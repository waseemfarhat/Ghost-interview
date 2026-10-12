import asyncio, os
from playwright.async_api import async_playwright

BASE = 'http://localhost:5174'
OUT = 'screenshots'
ADMIN_EMAIL = 'admin@ghostinterview.local'
ADMIN_PASS = 'ChangeMe123!'
ANSWER = ("I have several years of hands-on experience building REST APIs with Node.js and Express, "
          "backed by MongoDB. For example, I designed an authentication service using JWT access and "
          "refresh tokens, hashed credentials with bcrypt, and added role-based access control.")

async def main():
    os.makedirs(OUT, exist_ok=True)
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
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=90000)
        await page.wait_for_timeout(3000)
        await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
        await page.locator('input[name="password"]').fill(ADMIN_PASS)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: '/dashboard' in u, timeout=20000)
        print('logged in', flush=True)

        # start interview
        await page.goto(BASE + '/interview/new', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(4000)
        rb = page.locator('button[aria-pressed]')
        n = await rb.count()
        print('roles found:', n, flush=True)
        if n > 0:
            await rb.first.click(); await page.wait_for_timeout(800)
        await page.get_by_role('button', name='Start interview').click()
        await page.wait_for_url(lambda u: '/interview/' in u and not u.endswith('/interview/new'), timeout=20000)
        print('interview page', page.url, flush=True)
        await page.wait_for_timeout(6000)

        # answer Q1
        sb = page.get_by_role('button', name='Start answering')
        await sb.wait_for(timeout=20000)
        await sb.click(); await page.wait_for_timeout(1500)
        ta = page.locator('textarea[placeholder="Type your answer…"]')
        await ta.wait_for(timeout=15000); await ta.click(); await ta.fill(ANSWER)
        await page.get_by_role('button', name='Submit answer').click()
        await page.wait_for_timeout(8000)
        print('answered Q1', flush=True)

        # end early -> confirm dialog auto-accepted -> dashboard
        end = page.get_by_role('button', name='End interview')
        await end.wait_for(timeout=15000); await end.click()
        await page.wait_for_url(lambda u: '/dashboard' in u, timeout=25000)
        print('back on dashboard', flush=True)
        await page.wait_for_timeout(4000)

        # find first View report link (terminated session is newest => row 1)
        vr = page.get_by_role('link', name='View report').first
        await vr.wait_for(timeout=15000)
        await vr.click()
        await page.wait_for_url(lambda u: '/reports/' in u, timeout=20000)
        print('report page', page.url, flush=True)
        await page.wait_for_timeout(5000)
        path = os.path.join(OUT, '38_partial_report.png')
        await page.screenshot(path=path, full_page=True)
        print('saved', path, flush=True)

        await browser.close()
        print('DONE', flush=True)

asyncio.run(main())
