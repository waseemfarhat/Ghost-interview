import asyncio, os
from playwright.async_api import async_playwright

BASE = 'http://localhost:5174'
OUT = 'screenshots'
os.makedirs(OUT, exist_ok=True)

EMAIL = 'admin@ghostinterview.local'
PASS = 'ChangeMe123!'

ANSWER = ("I have several years of hands-on experience building REST APIs with Node.js and Express, "
          "backed by MongoDB. For example, I designed an authentication service using JWT access and "
          "refresh tokens, hashed credentials with bcrypt, and added role-based access control so admins "
          "and candidates see different views. I also wrote integration tests to keep the endpoints "
          "reliable and documented everything so the team could onboard quickly.")

async def shot(page, name, full=True):
    path = os.path.join(OUT, name + '.png')
    await page.wait_for_timeout(1600)
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
        # Disable Web Speech API so the manual text-answer box is shown in headless mode.
        await ctx.add_init_script("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;")
        page = await ctx.new_page()

        # --- login (networkidle waits for Vite cold-compile on first load) ---
        print('Login...', flush=True)
        await page.goto(BASE + '/login', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(4000)
        await page.locator('input[name="email"]').fill(EMAIL, timeout=45000)
        await page.locator('input[name="password"]').fill(PASS, timeout=45000)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_timeout(4000)
        print('  landed on', page.url, flush=True)

        # --- start interview ---
        print('Start interview...', flush=True)
        await page.goto(BASE + '/interview/new', wait_until='networkidle', timeout=60000)
        await page.wait_for_timeout(3000)
        # select first role card
        role_buttons = page.locator('button[aria-pressed]')
        n = await role_buttons.count()
        print('  roles found:', n, flush=True)
        if n > 0:
            await role_buttons.first.click()
            await page.wait_for_timeout(600)
        await page.get_by_role('button', name='Start interview').click()
        await page.wait_for_url(lambda u: '/interview/' in u, timeout=15000)
        await page.wait_for_timeout(4000)
        print('  interview url', page.url, flush=True)

        # --- idle state (question + AI avatar + live camera + progress) ---
        await shot(page, '12_interview_idle')

        # --- answer through every question ---
        captured_listening = False
        captured_analyzing = False
        captured_q2 = False
        for q in range(1, 13):
            if '/reports/' in page.url:
                break
            # begin answering -> listening state (waveform + transcript box)
            try:
                start_btn = page.get_by_role('button', name='Start answering')
                await start_btn.wait_for(timeout=8000)
                await start_btn.click()
                await page.wait_for_timeout(1200)
                if not captured_listening:
                    await shot(page, '13_interview_listening')
                    captured_listening = True
                # type the answer
                ta = page.locator('textarea[placeholder="Type your answer…"]')
                await ta.wait_for(timeout=8000)
                await ta.click()
                await ta.fill(ANSWER)
                await page.wait_for_timeout(600)
                # submit
                await page.get_by_role('button', name='Submit answer').click()
                await page.wait_for_timeout(900)
                if not captured_analyzing:
                    await shot(page, '14_interview_analyzing', full=False)
                    captured_analyzing = True
                # wait for next question or report redirect
                await page.wait_for_timeout(6000)
                # capture question 2 idle (progress advanced)
                if not captured_q2 and '/interview/' in page.url and q == 1:
                    await shot(page, '15_interview_q2')
                    captured_q2 = True
            except Exception as e:
                print('  step', q, 'error:', str(e)[:160], flush=True)
                break

        # --- report page ---
        if '/reports/' in page.url or '/interview/' not in page.url:
            print('  at report url:', page.url, flush=True)
        await page.wait_for_timeout(2500)
        # if we're still on interview (e.g. last submit), wait for redirect
        for _ in range(15):
            if '/reports/' in page.url:
                break
            await page.wait_for_timeout(1000)
        print('  final url', page.url, flush=True)
        if '/reports/' in page.url:
            await shot(page, '20_report_full', full=True)
            await shot(page, '21_report_top', full=False)
            # scroll to per-question analysis if present
            try:
                await page.get_by_text('per-question', exact=False).first.scroll_into_view_if_needed(timeout=3000)
                await page.wait_for_timeout(1000)
                await shot(page, '22_report_perquestion', full=False)
            except Exception as e:
                print('  perquestion scroll skip:', str(e)[:100], flush=True)

        await browser.close()
        print('DONE', flush=True)

asyncio.run(main())
