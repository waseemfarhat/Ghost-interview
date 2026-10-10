/**
 * Live smoke test: boots the real Express app in-process and exercises the
 * request pipeline (routing, validation, auth guards, error handler) for the
 * endpoints that do NOT require a live database. Run: node scripts/smoke.mjs
 */
import { createApp } from '../src/app.js';
import http from 'node:http';

const app = createApp();
const server = http.createServer(app);

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function req(port, method, path, { body, headers = {} } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'X-Requested-With': 'GhostInterview', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

let failures = 0;
function check(name, cond, extra = '') {
  const ok = !!cond;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
}

const port = await listen();
console.log(`Smoke server on :${port}\n`);

// 1. Health endpoint (no auth, no DB)
const health = await req(port, 'GET', '/api/health');
check('GET /api/health returns 200', health.status === 200, JSON.stringify(health.json?.message));

// 2. Unknown route -> 404 via notFoundHandler
const notFound = await req(port, 'GET', '/api/does-not-exist');
check('unknown route returns 404 JSON', notFound.status === 404 && notFound.json?.success === false, String(notFound.status));

// 3. Register with invalid body -> 400 with field details (validation runs before DB)
const badRegister = await req(port, 'POST', '/api/auth/register', { body: { email: 'nope', password: 'x' } });
check(
  'register validation rejects bad input (400 + field details)',
  badRegister.status === 400 &&
    Array.isArray(badRegister.json?.details) &&
    badRegister.json.details.some((d) => d.field === 'email') &&
    badRegister.json.details.some((d) => d.field === 'password'),
  JSON.stringify(badRegister.json?.details)
);

// 4. Login missing password -> 400 validation
const badLogin = await req(port, 'POST', '/api/auth/login', { body: { email: 'a@b.com' } });
check('login validation rejects missing password (400)', badLogin.status === 400, String(badLogin.status));

// 5. Protected route without token -> 401 (auth middleware, before DB)
const noAuth = await req(port, 'GET', '/api/auth/me');
check('GET /api/auth/me without token returns 401', noAuth.status === 401, String(noAuth.status));

// 6. Protected route with malformed token -> 401
const badToken = await req(port, 'GET', '/api/auth/me', { headers: { Authorization: 'Bearer not-a-jwt' } });
check('GET /api/auth/me with invalid token returns 401', badToken.status === 401, String(badToken.status));

// 7. CSRF guard: refresh without X-Requested-With -> 403
const noCsrf = await fetch(`http://127.0.0.1:${port}/api/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
check('POST /api/auth/refresh without X-Requested-With returns 403', noCsrf.status === 403, String(noCsrf.status));

// 8. Admin route requires auth -> 401 before role check
const adminGuard = await req(port, 'GET', '/api/admin/users');
check('GET /api/admin/users without token returns 401', adminGuard.status === 401, String(adminGuard.status));

// 9. NoSQL-injection style body key is sanitized (no 500)
const injection = await req(port, 'POST', '/api/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
check('NoSQL-injection style login body does not 500', injection.status < 500, String(injection.status));

console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
// Drop any keep-alive sockets fetch left open, then close and exit — avoids
// the Windows libuv "UV_HANDLE_CLOSING" teardown warning from a forced exit.
if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
server.close(() => process.exit(failures === 0 ? 0 : 1));

