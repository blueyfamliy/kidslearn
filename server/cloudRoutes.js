// KidsLearn Cloud — all HTTP surfaces of the developer platform:
//
//   /cloud/**            the developer console (register an app, get keys)
//   /oauth/**            OAuth 2.0 authorization code flow + PKCE
//   /api/v1/**           the public API (API key, or a user's access token)
//   /.well-known/…       discovery document
//
// Mounted from index.js. Everything is server-rendered — no build step — so it
// behaves identically in dev and inside the packaged desktop app.
import express from 'express';
import crypto from 'crypto';
import {
  SCOPES, ALL_SCOPES, CLOUD_LIMITS, OOB_URI,
  listApps, getApp, getAppByClientId, createApp, updateApp, deleteApp,
  rotateSecret, rotateApiKey, redirectUriAllowed,
  createAuthCode, exchangeCode, refreshTokens, verifyAccessToken, revokeToken,
  useApiKey, appStats, grantsForUser,
} from './cloud.js';
import {
  loginPage, dashboardPage, newAppPage, appPage, docsPage,
  consentPage, oobCodePage, oauthErrorPage,
} from './cloudConsole.js';
import { loginUser, registerUser, userForToken, listAccounts, deviceEmail } from './auth.js';
import { listingForApp, listingsByOwner, deleteListing, isAdmin, pendingCount } from './coli.js';
import {
  readChildren, getChild, getStats, getProgress, getRewards, activeSubjects,
} from './storage.js';
import { generateMathExercises, generatePrepMath, generateTopicMath, MATH_LEVELS, MATH_TOPICS, topicsForChild } from './exercises/mathGenerator.js';
import { generateHebrewExercises } from './exercises/hebrewGenerator.js';
import { generateEnglishExercises, ENGLISH_STAGES } from './exercises/englishGenerator.js';

export const cloudRouter = express.Router();
cloudRouter.use(express.urlencoded({ extended: false, limit: '1mb' }));

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

// ── Console session (a normal KidsLearn account, kept in a cookie) ─────────
const COOKIE = 'kl_cloud';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

const setSession = (res, token) =>
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
const clearSession = (res) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

export const sessionUser = (req) => userForToken(readCookie(req, COOKIE));

/** Console pages behind the login wall. */
export function requireDev(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.redirect('/cloud');
  req.devUser = user;
  next();
}

// ── Console: sign in / sign up ─────────────────────────────────────────────
cloudRouter.get('/cloud', (req, res) => {
  if (sessionUser(req)) return res.redirect('/cloud/apps');
  res.send(loginPage({ mode: req.query.mode === 'register' ? 'register' : 'login' }));
});

cloudRouter.post('/cloud/login', (req, res) => {
  const { email, password } = req.body || {};
  const r = loginUser({ email, password });
  if (r.error) return res.status(401).send(loginPage({ error: r.error, email }));
  setSession(res, r.token);
  res.redirect('/cloud/apps');
});

cloudRouter.post('/cloud/register', (req, res) => {
  const { email, password, name } = req.body || {};
  const r = registerUser({ email, password, name });
  // Note: unlike the app's own /api/auth/register this does NOT mark the
  // machine as trusted — a developer account is not the family's device login.
  if (r.error) return res.status(400).send(loginPage({ error: r.error, mode: 'register', email }));
  setSession(res, r.token);
  res.redirect('/cloud/apps');
});

cloudRouter.post('/cloud/logout', (req, res) => {
  clearSession(res);
  res.redirect('/cloud');
});

// ── Console: apps ──────────────────────────────────────────────────────────
// Secrets are shown exactly once. They live here (in memory, 10 minutes) only
// long enough to survive the redirect that follows creation/rotation.
const reveals = new Map();
function stashReveal(appId, data) {
  for (const [k, v] of reveals) if (v.exp < Date.now()) reveals.delete(k);
  reveals.set(appId, { ...data, exp: Date.now() + 10 * 60 * 1000 });
}
function takeReveal(appId) {
  const r = reveals.get(appId);
  if (!r || r.exp < Date.now()) { reveals.delete(appId); return {}; }
  reveals.delete(appId);
  return r;
}

/** Store status + admin badge, shown on every console screen. */
const coliCtx = (user) => {
  const admin = isAdmin(user.email);
  return { admin, pending: admin ? pendingCount() : 0 };
};

cloudRouter.get('/cloud/apps', requireDev, (req, res) => {
  const storeByApp = {};
  for (const l of listingsByOwner(req.devUser.email)) storeByApp[l.appId] = l.status;
  res.send(dashboardPage({
    user: req.devUser,
    apps: listApps(req.devUser.email),
    flash: String(req.query.flash || ''),
    storeByApp,
    ...coliCtx(req.devUser),
  }));
});

cloudRouter.get('/cloud/apps/new', requireDev, (req, res) => {
  res.send(newAppPage({ user: req.devUser }));
});

cloudRouter.post('/cloud/apps', requireDev, (req, res) => {
  const body = req.body || {};
  const r = createApp({
    owner: req.devUser.email,
    name: body.name,
    description: body.description,
    homepage: body.homepage,
    redirectUris: body.redirectUris,
    scopes: body.scopes,
    appType: body.appType,
  });
  if (r.error) return res.status(400).send(newAppPage({ user: req.devUser, error: r.error, values: body }));
  stashReveal(r.app.id, { clientSecret: r.clientSecret, apiKey: r.apiKey });
  res.redirect(`/cloud/apps/${r.app.id}`);
});

cloudRouter.get('/cloud/apps/:id', requireDev, (req, res) => {
  const app = getApp(req.params.id, req.devUser.email);
  if (!app) return res.status(404).send(oauthErrorPage('האפליקציה לא נמצאה', 'ייתכן שנמחקה, או שהיא שייכת לחשבון אחר.'));
  res.send(appPage({
    user: req.devUser,
    app,
    stats: appStats(app.id, req.devUser.email) || { usage: {}, quota: CLOUD_LIMITS.DEFAULT_DAILY_QUOTA, recent: [] },
    reveal: takeReveal(app.id),
    baseUrl: baseUrl(req),
    flash: String(req.query.flash || ''),
    listing: listingForApp(app.id, req.devUser.email),
    ...coliCtx(req.devUser),
  }));
});

cloudRouter.post('/cloud/apps/:id/update', requireDev, (req, res) => {
  const body = req.body || {};
  const r = updateApp(req.params.id, req.devUser.email, {
    name: body.name,
    description: body.description,
    homepage: body.homepage,
    redirectUris: body.redirectUris,
    appType: body.appType,
    scopes: body.scopes || [],
  });
  if (r.error) return res.status(400).send(oauthErrorPage('העדכון נכשל', r.error));
  res.redirect(`/cloud/apps/${req.params.id}?flash=${encodeURIComponent('ההגדרות נשמרו')}`);
});

cloudRouter.post('/cloud/apps/:id/secret', requireDev, (req, res) => {
  const r = rotateSecret(req.params.id, req.devUser.email);
  if (r.error) return res.status(404).send(oauthErrorPage('לא נמצא', r.error));
  stashReveal(req.params.id, { clientSecret: r.clientSecret });
  res.redirect(`/cloud/apps/${req.params.id}`);
});

cloudRouter.post('/cloud/apps/:id/apikey', requireDev, (req, res) => {
  const r = rotateApiKey(req.params.id, req.devUser.email);
  if (r.error) return res.status(404).send(oauthErrorPage('לא נמצא', r.error));
  stashReveal(req.params.id, { apiKey: r.apiKey });
  res.redirect(`/cloud/apps/${req.params.id}`);
});

cloudRouter.post('/cloud/apps/:id/delete', requireDev, (req, res) => {
  const r = deleteApp(req.params.id, req.devUser.email);
  if (r.error) return res.status(404).send(oauthErrorPage('לא נמצא', r.error));
  // The store listing has no meaning without its app — take it down with it.
  deleteListing(req.params.id, req.devUser.email);
  res.redirect(`/cloud/apps?flash=${encodeURIComponent('האפליקציה נמחקה')}`);
});

cloudRouter.get('/cloud/docs', (req, res) => {
  res.send(docsPage({
    user: sessionUser(req),
    baseUrl: baseUrl(req),
    clientId: String(req.query.client_id || 'YOUR_CLIENT_ID'),
  }));
});

// Which third-party apps this account has connected (for the family, not the
// developer) — the data behind a future "connected apps" screen.
cloudRouter.get('/api/cloud/connected', (req, res) => {
  const h = req.headers.authorization || '';
  const user = userForToken(h.startsWith('Bearer ') ? h.slice(7) : String(req.query.token || ''));
  if (!user) return res.status(401).json({ error: 'לא מחובר' });
  res.json({
    ok: true,
    apps: grantsForUser(user.email).map(g => ({
      name: g.app.name, clientId: g.app.clientId, homepage: g.app.homepage,
      scopes: g.scopes, since: g.since,
    })),
  });
});

// ── OAuth 2.0 ──────────────────────────────────────────────────────────────
// Pending consent screens: reqId → the validated request (10-minute TTL).
const pending = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000;

function newPending(data) {
  for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
  const id = crypto.randomUUID();
  pending.set(id, { ...data, exp: Date.now() + PENDING_TTL_MS });
  return id;
}

/** Append params to a redirect_uri that may already carry a query string. */
function redirectWith(uri, params) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  return u.toString();
}

cloudRouter.get('/oauth/authorize', (req, res) => {
  const q = req.query || {};
  const app = getAppByClientId(q.client_id);
  if (!app) {
    return res.status(400).send(oauthErrorPage('client_id לא מוכר',
      'האפליקציה לא רשומה ב-KidsLearn Cloud, או שה-client_id הועתק חלקית.'));
  }
  const redirectUri = String(q.redirect_uri || (app.redirectUris || [])[0] || '');
  if (!redirectUriAllowed(app, redirectUri)) {
    // Never redirect to an unregistered URI — that is the whole point of the
    // allow-list. Show the error here instead.
    return res.status(400).send(oauthErrorPage('redirect_uri לא רשום',
      `הכתובת "${redirectUri}" לא מופיעה ברשימת ה-Redirect URIs של האפליקציה. הוסיפו אותה בקונסולה.`));
  }
  const state = String(q.state || '');
  const isOob = redirectUri === OOB_URI;
  const fail = (error, detail) => isOob
    ? res.status(400).send(oauthErrorPage(error, detail))
    : res.redirect(redirectWith(redirectUri, { error, error_description: detail, state }));

  if (String(q.response_type || 'code') !== 'code') {
    return fail('unsupported_response_type', 'נתמך רק response_type=code');
  }
  // Requested scopes must be a subset of what the app registered.
  const requested = String(q.scope || (app.scopes || []).join(' ')).split(/[\s+]+/).filter(Boolean);
  const bad = requested.filter(s => !ALL_SCOPES.includes(s) || !(app.scopes || []).includes(s));
  if (bad.length) return fail('invalid_scope', `ההרשאות ${bad.join(', ')} לא מאושרות לאפליקציה הזו`);
  const scopes = requested.length ? requested : ['profile'];

  const codeChallenge = String(q.code_challenge || '');
  if (app.appType === 'public' && !codeChallenge) {
    return fail('invalid_request', 'אפליקציה ציבורית חייבת לשלוח code_challenge (PKCE)');
  }

  const accounts = listAccounts();
  if (!accounts.length) {
    return res.status(401).send(oauthErrorPage('אין עדיין חשבון KidsLearn במחשב הזה',
      'פתחו את KidsLearn, צרו חשבון משפחה, ונסו שוב.'));
  }

  const reqId = newPending({
    clientId: app.clientId, redirectUri, scopes, state,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: String(q.code_challenge_method || (codeChallenge ? 'S256' : '')) || null,
  });

  res.send(consentPage({
    app, accounts, deviceEmail: deviceEmail(), reqId, scopes,
    needsPassword: !deviceEmail(),
  }));
});

cloudRouter.post('/oauth/authorize/decide', (req, res) => {
  const body = req.body || {};
  const reqRec = pending.get(String(body.reqId || ''));
  if (!reqRec || reqRec.exp < Date.now()) {
    pending.delete(String(body.reqId || ''));
    return res.status(410).send(oauthErrorPage('פג תוקף דף האישור', 'חזרו לאפליקציה ולחצו שוב על "התחברות עם KidsLearn".'));
  }
  const app = getAppByClientId(reqRec.clientId);
  if (!app) return res.status(400).send(oauthErrorPage('האפליקציה נמחקה', 'פנו למפתח האפליקציה.'));

  const isOob = reqRec.redirectUri === OOB_URI;
  const deny = (error, detail) => {
    pending.delete(String(body.reqId));
    return isOob
      ? res.status(400).send(oauthErrorPage(detail || error, 'לא הונפק קוד.'))
      : res.redirect(redirectWith(reqRec.redirectUri, { error, error_description: detail, state: reqRec.state }));
  };

  if (String(body.decision) !== 'allow') return deny('access_denied', 'המשתמש ביטל את ההתחברות');

  // Identify the family member: on a trusted machine we accept the picker,
  // otherwise the parent proves the account with its password.
  const accounts = listAccounts();
  const chosen = String(body.accountEmail || '').trim().toLowerCase();
  let identity = accounts.find(a => a.email === chosen);

  if (deviceEmail()) {
    if (!identity) {
      return res.status(400).send(consentPage({
        app, accounts, deviceEmail: deviceEmail(), reqId: body.reqId,
        scopes: reqRec.scopes, needsPassword: false, error: 'בחרו חשבון',
      }));
    }
  } else {
    const r = loginUser({ email: chosen, password: body.password });
    if (r.error) {
      return res.status(401).send(consentPage({
        app, accounts, deviceEmail: null, reqId: body.reqId,
        scopes: reqRec.scopes, needsPassword: true, error: r.error,
      }));
    }
    identity = r.user;
  }

  pending.delete(String(body.reqId));
  const made = createAuthCode({
    clientId: app.clientId,
    email: identity.email,
    name: identity.name,
    scopes: reqRec.scopes,
    redirectUri: reqRec.redirectUri,
    codeChallenge: reqRec.codeChallenge,
    codeChallengeMethod: reqRec.codeChallengeMethod,
  });
  if (!made) return deny('server_error', 'לא הצלחנו להנפיק קוד — נסו שוב');

  if (isOob) return res.send(oobCodePage({ app, code: made.code }));
  res.redirect(redirectWith(reqRec.redirectUri, { code: made.code, state: reqRec.state }));
});

/** client_secret_basic (Authorization: Basic) in addition to _post. */
function clientCreds(req) {
  const body = req.body || {};
  let clientId = body.client_id;
  let clientSecret = body.client_secret;
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [id, secret] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
    clientId = clientId || id;
    clientSecret = clientSecret || secret;
  }
  return { clientId, clientSecret };
}

cloudRouter.post('/oauth/token', (req, res) => {
  const body = req.body || {};
  const { clientId, clientSecret } = clientCreds(req);
  const grant = String(body.grant_type || '');

  if (grant === 'authorization_code') {
    const r = exchangeCode({
      code: body.code,
      clientId,
      clientSecret,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
    if (r.error) return res.status(r.error === 'invalid_client' ? 401 : 400).json({ error: r.error, error_description: r.detail });
    const { ok, ...tokens } = r;
    return res.json(tokens);
  }

  if (grant === 'refresh_token') {
    const r = refreshTokens({ refreshToken: body.refresh_token, clientId, clientSecret });
    if (r.error) return res.status(r.error === 'invalid_client' ? 401 : 400).json({ error: r.error, error_description: r.detail });
    const { ok, ...tokens } = r;
    return res.json(tokens);
  }

  res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: 'נתמכים authorization_code ו-refresh_token בלבד',
  });
});

cloudRouter.post('/oauth/revoke', (req, res) => {
  revokeToken(String((req.body || {}).token || ''));
  res.json({ ok: true });   // RFC 7009: always 200, even for unknown tokens
});

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : String((req.query || {}).access_token || '');
};

/** Guard for endpoints that act on behalf of a family account. */
function requireScope(scope) {
  return (req, res, next) => {
    const grant = verifyAccessToken(bearer(req));
    if (!grant) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'access token חסר, פג או לא מוכר' });
    }
    if (!grant.scopes.includes(scope)) {
      return res.status(403).json({ error: 'insufficient_scope', error_description: `נדרש scope: ${scope}` });
    }
    req.grant = grant;
    next();
  };
}

const subjectId = (email) => 'kluser_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 20);

cloudRouter.get('/oauth/userinfo', requireScope('profile'), (req, res) => {
  res.json({
    sub: subjectId(req.grant.email),
    email: req.grant.email,
    name: req.grant.name || req.grant.email.split('@')[0],
    scopes: req.grant.scopes,
    client_id: req.grant.clientId,
  });
});

cloudRouter.get('/.well-known/kidslearn-configuration', (req, res) => {
  const b = baseUrl(req);
  res.json({
    issuer: b,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/oauth/token`,
    userinfo_endpoint: `${b}/oauth/userinfo`,
    revocation_endpoint: `${b}/oauth/revoke`,
    registration_console: `${b}/cloud`,
    documentation: `${b}/cloud/docs`,
    api_base: `${b}/api/v1`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
  });
});

// ── Public API v1 ──────────────────────────────────────────────────────────
// Two ways in: an API key (machine-to-machine, no family data) or a user's
// access token (family data, scope-checked).
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || (req.query || {}).api_key || '';
  const r = useApiKey(key, `${req.method} ${req.path}`);
  if (r.error) return res.status(r.status || 401).json({ error: r.error });
  res.setHeader('X-RateLimit-Limit', String(r.quota));
  res.setHeader('X-RateLimit-Remaining', String(r.remaining));
  req.apiApp = r.app;
  next();
}

cloudRouter.get('/api/v1/ping', requireApiKey, (req, res) => {
  res.json({
    ok: true,
    app: req.apiApp.name,
    clientId: req.apiApp.clientId,
    quota: req.apiApp.quota,
    usedToday: req.apiApp.usage?.today || 0,
    serverTime: new Date().toISOString(),
  });
});

cloudRouter.get('/api/v1/catalog', requireApiKey, (req, res) => {
  res.json({
    ok: true,
    subjects: [
      { id: 'math', label: 'חשבון', levels: MATH_LEVELS, operations: ['mix', 'add', 'sub'] },
      { id: 'hebrew', label: 'עברית', stages: 8 },
      { id: 'english', label: 'אנגלית', stages: ENGLISH_STAGES },
    ],
    tracks: [
      { id: 'gan_to_a', label: 'עולה לכיתה א׳' },
      { id: 'a_to_b', label: 'עולה לכיתה ב׳' },
    ],
    mathTopics: Object.entries(MATH_TOPICS).map(([id, t]) => ({ id, ...t })),
    scopes: Object.entries(SCOPES).map(([id, s]) => ({ id, ...s })),
  });
});

cloudRouter.get('/api/v1/exercises', requireApiKey, (req, res) => {
  const q = req.query || {};
  const subject = ['math', 'hebrew', 'english'].includes(String(q.subject)) ? String(q.subject) : 'math';
  const count = Math.min(50, Math.max(1, parseInt(q.count, 10) || 10));
  const stage = Math.min(12, Math.max(1, parseInt(q.stage, 10) || 1));
  const track = ['gan_to_a', 'a_to_b'].includes(String(q.track)) ? String(q.track) : null;
  const level = MATH_LEVELS.includes(Number(q.level)) ? Number(q.level) : null;
  const op = ['mix', 'add', 'sub'].includes(String(q.op)) ? String(q.op) : 'mix';
  const allowMulDiv = String(q.allowMulDiv || '') === 'true';
  const topic = Object.keys(MATH_TOPICS).includes(String(q.topic)) ? String(q.topic) : null;

  const makeSession = () => {
    if (subject === 'english') return generateEnglishExercises(stage, [], track, String(q.hideLetters || '') === 'true');
    if (subject === 'hebrew') return generateHebrewExercises({}, [], stage, track);
    if (topic) return generateTopicMath(topic, { track, stage, level, allowMulDiv });
    if (track) return generatePrepMath(track, stage, [], op, allowMulDiv);
    return generateMathExercises({}, [], level, op);
  };

  // Generators return one session-sized batch; repeat (and de-duplicate) until
  // the caller's `count` is satisfied.
  const out = [];
  const seen = new Set();
  for (let round = 0; round < 12 && out.length < count; round++) {
    for (const ex of makeSession()) {
      const key = JSON.stringify(ex.question ?? ex);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ex);
      if (out.length >= count) break;
    }
  }

  res.json({
    ok: true,
    subject,
    params: { level, stage, track, op, topic, count },
    count: out.length,
    exercises: out,
  });
});

cloudRouter.get('/api/v1/topics', requireApiKey, (req, res) => {
  const q = req.query || {};
  const ids = topicsForChild({
    track: ['gan_to_a', 'a_to_b'].includes(String(q.track)) ? String(q.track) : null,
    stage: Math.max(1, parseInt(q.stage, 10) || 1),
    level: MATH_LEVELS.includes(Number(q.level)) ? Number(q.level) : null,
    allowMulDiv: String(q.allowMulDiv || '') === 'true',
  });
  res.json({ ok: true, topics: ids.map(id => ({ id, ...MATH_TOPICS[id] })) });
});

// ── Family data (OAuth access token) ───────────────────────────────────────
const publicChild = (c) => ({
  id: c.id,
  name: c.name,
  gender: c.gender || null,
  avatar: c.avatar || null,
  subjects: activeSubjects(c),
  mathLevel: c.mathLevel ?? null,
  grade: c.grade || null,
  englishLevel: c.englishLevel ?? null,
  hebrewLevel: c.hebrewLevel ?? null,
  dailyPlan: c.dailyPlan || null,
});

cloudRouter.get('/api/v1/children', requireScope('children:read'), (req, res) => {
  res.json({ ok: true, children: readChildren().map(publicChild) });
});

cloudRouter.get('/api/v1/children/:id/progress', requireScope('progress:read'), (req, res) => {
  const child = getChild(req.params.id);
  if (!child) return res.status(404).json({ error: 'not_found', error_description: 'ילד/ה לא נמצא/ה' });
  const stats = getStats(child.id);
  const rewards = getRewards(child.id);
  res.json({
    ok: true,
    child: publicChild(child),
    totals: {
      sessions: stats.totalSessions,
      exercises: stats.totalExercises,
      correct: stats.totalCorrect,
      firstTryCorrect: stats.totalNoMistake,
      accuracy: stats.totalExercises ? Math.round((stats.totalCorrect / stats.totalExercises) * 100) : 0,
    },
    byType: stats.byType,
    progress: Object.fromEntries(activeSubjects(child).map(s => [s, getProgress(child.id, s)])),
    rewards: { stickers: (rewards.stickers || []).length, streak: rewards.streak || 0 },
  });
});
