import asyncio, os, json, time
from playwright.async_api import async_playwright

BASE = 'http://localhost:5174'
OUT = 'screenshots'
os.makedirs(OUT, exist_ok=True)

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
        browser = await pw.chromium.launch(args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        page = await ctx.new_page()
        page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))

        # ---- REGISTER: client-side validation (invalid input) ----
        print('Register: validation (invalid input)...', flush=True)
        await page.goto(BASE + '/register', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3000)
        await page.locator('input[name="fullName"]').fill('A')
        await page.locator('input[name="email"]').fill('not-an-email')
        await page.locator('input[name="password"]').fill('weak')
        await page.locator('input[name="confirmPassword"]').fill('nope')
        await page.locator('button[type="submit"]').click()
        await shot(page, '30_register_invalid')

        # ---- REGISTER: duplicate e-mail (409) ----
        print('Register: duplicate e-mail (409)...', flush=True)
        await page.goto(BASE + '/register', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(2500)
        await page.locator('input[name="fullName"]').fill('Duplicate Test')
        await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
        await page.locator('input[name="password"]').fill('ChangeMe123!')
        await page.locator('input[name="confirmPassword"]').fill('ChangeMe123!')
        await page.locator('button[type="submit"]').click()
        await shot(page, '31_register_duplicate')

        # ---- REGISTER: success (creates a fresh account for lockout demo) ----
        print('Register: success...', flush=True)
        await page.goto(BASE + '/register', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(2500)
        ts = str(int(time.time()))
        lock_email = 'lockdemo' + ts + '@example.com'
        await page.locator('input[name="fullName"]').fill('Lock Demo')
        await page.locator('input[name="email"]').fill(lock_email)
        await page.locator('input[name="password"]').fill('ChangeMe123!')
        await page.locator('input[name="confirmPassword"]').fill('ChangeMe123!')
        await page.locator('button[type="submit"]').click()
        await shot(page, '32_register_success')

        # ---- LOGIN: empty required-field validation ----
        print('Login: empty required-field validation...', flush=True)
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(2500)
        await page.locator('button[type="submit"]').click()
        await shot(page, '33_login_empty')

        # ---- LOGIN: wrong password (401) ----
        print('Login: wrong password (401)...', flush=True)
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(2500)
        await page.locator('input[name="email"]').fill(lock_email)
        await page.locator('input[name="password"]').fill('WrongPass123!')
        await page.locator('button[type="submit"]').click()
        await page.wait_for_timeout(1400)
        await shot(page, '34_login_wrongpw')

        # ---- LOGIN: trigger 5-attempt account lock ----
        for _ in range(4):
            await page.wait_for_timeout(1200)
            await page.locator('button[type="submit"]').click()
            await page.wait_for_timeout(1400)
        print('Login: account lockout message...', flush=True)
        await shot(page, '35_login_lockout')

        # ---- LOGIN: success + redirect to dashboard ----
        print('Login: success + redirect...', flush=True)
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(2500)
        await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
        await page.locator('input[name="password"]').fill(ADMIN_PASS)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: '/dashboard' in u, timeout=15000)
        await shot(page, '36_login_redirect')

        # ---- DASHBOARD performance trends ----
        print('Dashboard trends...', flush=True)
        await page.goto(BASE + '/dashboard', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3500)
        try:
            t = page.get_by_text('Readiness trend', exact=False).first
            await t.scroll_into_view_if_needed(timeout=4000)
            await page.wait_for_timeout(800)
            await shot(page, '37_trends', full=False)
        except Exception as e:
            print('  trends skip:', str(e)[:120], flush=True)

        # ---- API: health response ----
        print('API health...', flush=True)
        await page.goto(BASE + '/api/health', wait_until='networkidle', timeout=30000)
        await shot(page, '40_api_health')

        # ---- API: unauthenticated security response ----
        print('API unauthenticated...', flush=True)
        await page.goto(BASE + '/api/auth/me', wait_until='networkidle', timeout=30000)
        await shot(page, '41_api_unauth')

        # ---- API: authenticated response with JWT ----
        print('API authenticated...', flush=True)
        em = json.dumps(ADMIN_EMAIL); pw = json.dumps(ADMIN_PASS)
        js = """async () => {
            const base = '/api';
            const login = await fetch(base + '/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-Requested-With': 'GhostInterview'},
                body: JSON.stringify({email: __EM__, password: __PW__})
            });
            const lj = await login.json();
            const token = lj && lj.data && lj.data.accessToken;
            const me = await fetch(base + '/auth/me', {
                headers: {'Authorization': 'Bearer ' + token, 'X-Requested-With': 'GhostInterview'}
            });
            const mj = await me.json();
            document.documentElement.style.background = '#0b1020';
            const esc = JSON.stringify(mj, null, 2).replace(/&/g,'&amp;').replace(/</g,'&lt;');
            document.body.innerHTML = '<pre style="color:#e5e7eb;font:14px/1.5 monospace;padding:24px;white-space:pre-wrap">HTTP ' + me.status + String.fromCharCode(10,10) + esc + '</pre>';
            return {status: me.status};
        }""".replace('__EM__', em).replace('__PW__', pw)
        authed = await page.evaluate(js)
        print('  authed status', authed['status'], flush=True)
        await page.wait_for_timeout(600)
        await shot(page, '42_api_authenticated')

        # ---- PARTIAL REPORT via early termination ----
        print('Partial report via End interview...', flush=True)
        await page.goto(BASE + '/interview/new', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3000)
        rb = page.locator('button[aria-pressed]')
        n = await rb.count()
        if n > 0:
            await rb.first.click(); await page.wait_for_timeout(600)
        await page.get_by_role('button', name='Start interview').click()
        await page.wait_for_url(lambda u: '/interview/' in u, timeout=15000)
        await page.wait_for_timeout(4000)
        sb = page.get_by_role('button', name='Start answering')
        await sb.wait_for(timeout=10000); await sb.click(); await page.wait_for_timeout(1000)
        ta = page.locator('textarea[placeholder="Type your answer…"]')
        await ta.wait_for(timeout=8000); await ta.click(); await ta.fill(ANSWER)
        await page.get_by_role('button', name='Submit answer').click()
        await page.wait_for_timeout(6000)
        end = page.get_by_role('button', name='End interview')
        await end.wait_for(timeout=10000); await end.click()
        for _ in range(20):
            if '/reports/' in page.url: break
            await page.wait_for_timeout(1000)
        print('  report url', page.url, flush=True)
        if '/reports/' in page.url:
            await shot(page, '38_partial_report', full=True)

        await browser.close()
        print('DONE', flush=True)

asyncio.run(main())
