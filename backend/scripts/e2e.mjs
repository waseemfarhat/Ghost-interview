/**
 * End-to-end integration test against the real MongoDB (from .env).
 * Exercises the full candidate workflow plus admin RBAC:
 *   register -> login -> list roles -> start session -> submit answers +
 *   emotion batches -> complete -> fetch report, and admin authorization.
 *
 * All records are created under a unique *_smoke_* email and fully cleaned
 * up (deleted) at the end. Run: node scripts/e2e.mjs
 */
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import http from 'node:http';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { InterviewSession } from '../src/models/InterviewSession.js';
import { SpeechRecord } from '../src/models/SpeechRecord.js';
import { EmotionRecord } from '../src/models/EmotionRecord.js';
import { Report } from '../src/models/Report.js';

await connectDB();

const app = createApp();
const server = http.createServer(app);
const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const BASE = `http://127.0.0.1:${port}/api`;

let cookieJar = '';
async function api(method, path, { body, token } = {}) {
  const headers = { 'X-Requested-With': 'GhostInterview' };
  if (cookieJar) headers.Cookie = cookieJar;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookieJar = setCookie.split(';')[0];
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

let failures = 0;
function check(name, cond, extra = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
}

const stamp = Date.now();
const email = `cand_${stamp}_smoke@example.test`;
const password = 'Smoke!Passw0rd';
const userIds = [];
const sessionIds = [];

try {
  // 1. Register
  const reg = await api('POST', '/auth/register', { body: { fullName: 'Smoke Candidate', email, password } });
  check('register candidate', reg.status === 201 && reg.json?.data?.user?.email === email, String(reg.status));
  const userId = reg.json?.data?.user?.id;
  if (userId) userIds.push(userId.toString());

  // 2. Login
  const login = await api('POST', '/auth/login', { body: { email, password } });
  check('login returns access token + refresh cookie', login.status === 200 && !!login.json?.data?.accessToken && cookieJar.includes('gi_refresh_token'), String(login.status));
  const token = login.json?.data?.accessToken;

  // 3. Refresh (uses cookie)
  const refresh = await api('POST', '/auth/refresh');
  check('refresh cookie yields new access token', refresh.status === 200 && !!refresh.json?.data?.accessToken, String(refresh.status));

  // 4. List job roles
  const roles = await api('GET', '/job-roles?limit=5', { token });
  const roleList = roles.json?.data?.items || [];
  check('list active job roles', roles.status === 200 && roleList.length > 0, `count=${roleList.length}`);
  const roleId = roleList[0]?._id;
  check('job role omits questionBank for candidates', roleList[0] && roleList[0].questionBank === undefined, 'no questionBank leaked');

  if (roleId) {
    const start = await api('POST', '/sessions', { body: { jobRoleId: roleId }, token });
    check('start interview session', start.status === 201 && !!start.json?.data?.session?.id, String(start.status));
    const sessionId = start.json?.data?.session?.id;
    const totalQ = start.json?.data?.session?.totalQuestions || 0;
    if (sessionId) sessionIds.push(sessionId);
    check('session snapshots >=1 question', totalQ >= 1, `total=${totalQ}`);

    if (sessionId) {
      const ans = await api('POST', `/sessions/${sessionId}/responses`, {
        body: { transcript: 'Um, I think uh I would approach that problem, you know, systematically and basically debug it step by step.' },
        token
      });
      check('submit answer returns analysis', ans.status === 200 && ans.json?.data?.analysis?.fillerWordCount > 0, JSON.stringify(ans.json?.data?.analysis));

      const emo = await api('POST', `/sessions/${sessionId}/emotion`, {
        body: {
          readings: [
            { emotionLabel: 'happy', confidenceScore: 0.8, eyeContactScore: 0.7, nervousnessScore: 0.2 },
            { emotionLabel: 'neutral', confidenceScore: 0.6, eyeContactScore: 0.6, nervousnessScore: 0.3 }
          ]
        },
        token
      });
      check('submit emotion batch', emo.status === 201, String(emo.status));

      const complete = await api('POST', `/sessions/${sessionId}/complete`, { token });
      check('complete session generates report', complete.status === 200 && complete.json?.data?.report?.overallReadinessScore != null, String(complete.status));
      const report = complete.json?.data?.report;
      check('report has confidence/competency/stability scores', report && report.confidenceScore != null && report.competencyScore != null && report.emotionalStabilityScore != null, 'scores present');
      check('report marked partial (only 1 of N answered)', report?.isPartial === true, `isPartial=${report?.isPartial}`);
      check('report counts filler words', typeof report?.fillerWordCount === 'number' && report.fillerWordCount > 0, `fillers=${report?.fillerWordCount}`);

      const getReport = await api('GET', `/reports/session/${sessionId}`, { token });
      check('fetch own report by session', getReport.status === 200 && !!getReport.json?.data?.report?.session, String(getReport.status));

      const myReports = await api('GET', '/reports?page=1&limit=10', { token });
      const ids = (myReports.json?.data?.items || []).map((r) => (r.session?._id || r.session));
      check('list my reports includes the new report', ids.includes(sessionId), `total=${myReports.json?.data?.pagination?.total}`);
    }
  }

  // Ownership: second user cannot read first user's session
  const email2 = `cand2_${stamp}_smoke@example.test`;
  const reg2 = await api('POST', '/auth/register', { body: { fullName: 'Other User', email: email2, password } });
  const uid2 = reg2.json?.data?.user?.id;
  if (uid2) userIds.push(uid2.toString());
  cookieJar = '';
  const login2 = await api('POST', '/auth/login', { body: { email: email2, password } });
  const token2 = login2.json?.data?.accessToken;
  cookieJar = '';
  if (sessionIds[0]) {
    const crossRead = await api('GET', `/sessions/${sessionIds[0]}`, { token: token2 });
    check('ownership: other user cannot read session (403/404)', crossRead.status === 403 || crossRead.status === 404, String(crossRead.status));
  }

  // RBAC: candidate blocked from admin routes
  cookieJar = '';
  const adminAsCandidate = await api('GET', '/admin/users', { token: token2 });
  check('RBAC: candidate blocked from admin users (403)', adminAsCandidate.status === 403, String(adminAsCandidate.status));

  // Duplicate email registration -> 409
  cookieJar = '';
  const dup = await api('POST', '/auth/register', { body: { fullName: 'Dup', email, password } });
  check('duplicate email registration -> 409', dup.status === 409, String(dup.status));

  console.log(`\n${failures === 0 ? 'ALL E2E CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
} catch (err) {
  failures += 1;
  console.log('E2E THREW:', err.stack || err.message);
} finally {
  const oid = (arr) => arr.map((s) => new mongoose.Types.ObjectId(s));
  await Promise.all([
    Report.deleteMany({ session: { $in: oid(sessionIds) } }),
    SpeechRecord.deleteMany({ session: { $in: oid(sessionIds) } }),
    EmotionRecord.deleteMany({ session: { $in: oid(sessionIds) } }),
    InterviewSession.deleteMany({ _id: { $in: oid(sessionIds) } }),
    User.deleteMany({ _id: { $in: oid(userIds) } })
  ]);
  console.log('Cleanup complete.');
  server.close();
  await disconnectDB();
  process.exit(failures === 0 ? 0 : 1);
}
