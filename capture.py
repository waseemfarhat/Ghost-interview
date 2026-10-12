import asyncio, os
from playwright.async_api import async_playwright

BASE = 'http://localhost:5173'
OUT = 'screenshots'
os.makedirs(OUT, exist_ok=True)

ADMIN_EMAIL = 'admin@ghostinterview.local'
ADMIN_PASS = 'ChangeMe123!'

async def shot(page, name, full=True):
    path = os.path.join(OUT, name + '.png')
    await page.wait_for_timeout(1500)
    await page.screenshot(path=path, full_page=full)
    print('  saved', path)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900},
                                        device_scale_factor=1)
        page = await ctx.new_page()

        # 1. Landing
        print('Landing...')
        await page.goto(BASE + '/', wait_until='networkidle')
        await shot(page, '01_landing')

        # 2. Login page
        print('Login page...')
        await page.goto(BASE + '/login', wait_until='networkidle')
        await shot(page, '02_login')

        # 3. Register page
        print('Register page...')
        await page.goto(BASE + '/register', wait_until='networkidle')
        await shot(page, '03_register')

        # 4. Forgot password
        print('Forgot password...')
        await page.goto(BASE + '/forgot-password', wait_until='networkidle')
        await shot(page, '04_forgot_password')

        # 5. Login (perform)
        print('Logging in as admin...')
        await page.goto(BASE + '/login', wait_until='networkidle')
        await page.fill('input[name="email"]', ADMIN_EMAIL)
        await page.fill('input[name="password"]', ADMIN_PASS)
        await page.click('button[type="submit"]')
        await page.wait_for_url(lambda url: '/dashboard' in url or '/login' not in url, timeout=15000)
        await page.wait_for_timeout(2500)
        print('  landed on', page.url)

        # 6. Dashboard
        print('Dashboard...')
        await page.goto(BASE + '/dashboard', wait_until='networkidle')
        await shot(page, '05_dashboard')

        # 7. Profile
        print('Profile...')
        await page.goto(BASE + '/profile', wait_until='networkidle')
        await shot(page, '06_profile')

        # 8. Settings
        print('Settings...')
        await page.goto(BASE + '/settings', wait_until='networkidle')
        await shot(page, '07_settings')

        # 9. Job role selection
        print('Job role selection...')
        await page.goto(BASE + '/interview/new', wait_until='networkidle')
        await shot(page, '08_jobrole_selection')

        # 10-12. Admin pages
        print('Admin users...')
        await page.goto(BASE + '/admin/users', wait_until='networkidle')
        await shot(page, '09_admin_users')

        print('Admin job roles...')
        await page.goto(BASE + '/admin/job-roles', wait_until='networkidle')
        await shot(page, '10_admin_jobroles')

        print('Admin analytics...')
        await page.goto(BASE + '/admin/analytics', wait_until='networkidle')
        await shot(page, '11_admin_analytics')

        # 13. Reports list (dashboard shows history); try first report if any
        print('Done. Closing.')
        await browser.close()

asyncio.run(main())
