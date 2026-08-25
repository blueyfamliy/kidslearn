// KidsLearn Cloud — the developer platform behind "Login with KidsLearn".
//
// This is the data + crypto layer for three things:
//   1. Apps — anyone (a friend building a competing app, a school, ourselves)
//      registers an app and gets a client_id / client_secret pair and an
//      API key.
//   2. OAuth 2.0 (authorization code + PKCE) — so their app can offer a
//      "Login with KidsLearn" button. Passwords never leave KidsLearn.
//   3. API keys — server-to-server access to the public KidsLearn API
//      (exercise generation, catalog) with a per-day quota.
//
// Everything lives in cloud.json inside the same writable data dir as the rest
// of the app (see dataDir.js). Secrets are NEVER stored in plain text: only a
// sha256 hash plus a short display prefix, exactly like a real cloud console —
// the full value is shown once, at creation, and can be regenerated.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { resolveDataDir } from './dataDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolveDataDir(path.join(__dirname, 'data'));
const CLOUD_FILE = path.join(DATA_DIR, 'cloud.json');

const CODE_TTL_MS = 10 * 60 * 1000;             // authorization code: 10 minutes
const ACCESS_TTL_MS = 60 * 60 * 1000;           // access token: 1 hour
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // refresh token: 60 days
const DEFAULT_DAILY_QUOTA = 2000;
const OOB_URI = 'urn:ietf:wg:oauth:2.0:oob';    // desktop/CLI apps: show the code

// ── What an app may ask the family for ─────────────────────────────────────
export const SCOPES = {
  'profile': {
    label: 'השם והאימייל של החשבון',
    detail: 'זהות בסיסית בלבד — לעולם לא סיסמאות.',
    icon: '👤',
  },
  'children:read': {
    label: 'רשימת הילדים ורמות הלימוד',
    detail: 'שמות, אווטאר, מקצועות ורמה. בלי תמונות ובלי פרטים אישיים.',
    icon: '🧒',
  },
  'progress:read': {
    label: 'התקדמות וסטטיסטיקות למידה',
    detail: 'כמה תרגילים נפתרו, אחוזי הצלחה ורצף ימים.',
    icon: '📈',
  },
  'exercises:read': {
    label: 'יצירת תרגילים ממנוע KidsLearn',
    detail: 'חשבון, עברית ואנגלית — אותם תרגילים שהאפליקציה עצמה משתמשת בהם.',
    icon: '➗',
  },
};
export const ALL_SCOPES = Object.keys(SCOPES);
export const APP_TYPES = ['confidential', 'public'];

// ── Storage ────────────────────────────────────────────────────────────────
const EMPTY = { apps: [], codes: [], tokens: [] };

function readDb() {
  try {
    const db = JSON.parse(fs.readFileSync(CLOUD_FILE, 'utf8'));
    return {
      apps: Array.isArray(db.apps) ? db.apps : [],
      codes: Array.isArray(db.codes) ? db.codes : [],
      tokens: Array.isArray(db.tokens) ? db.tokens : [],
    };
  } catch {
    return { ...EMPTY, apps: [], codes: [], tokens: [] };
  }
}

function writeDb(db) {
  const now = Date.now();
  // Housekeeping on every write: expired codes and tokens simply disappear.
  db.codes = (db.codes || []).filter(c => c.exp > now && !c.used);
  db.tokens = (db.tokens || []).filter(t => (t.refreshExp || t.exp) > now);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(CLOUD_FILE, JSON.stringify(db, null, 2));
}

// ── Crypto helpers ─────────────────────────────────────────────────────────
const rand = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

const normEmail = (e) => String(e || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** Public view of an app — never leaks a secret hash. */
function publicApp(a) {
  if (!a) return null;
  const { secretHash, apiKeyHash, ...rest } = a;
  return rest;
}

// ── Apps ───────────────────────────────────────────────────────────────────
export function sanitizeRedirectUris(raw) {
  const lines = (Array.isArray(raw) ? raw : String(raw || '').split(/[\s,]+/))
    .map(s => String(s || '').trim())
    .filter(Boolean);
  const out = [];
  for (const uri of lines.slice(0, 10)) {
    if (uri === OOB_URI) { out.push(uri); continue; }
    try {
      const u = new URL(uri);
      if (!['http:', 'https:'].includes(u.protocol)) continue;
      if (u.hash) continue;                       // fragments are not allowed
      out.push(u.toString());
    } catch { /* not a URL — drop it */ }
  }
  return [...new Set(out)];
}

export function listApps(owner) {
  const email = normEmail(owner);
  return readDb().apps.filter(a => a.owner === email).map(publicApp);
}

export function getApp(id, owner = null) {
  const app = readDb().apps.find(a => a.id === id);
  if (!app) return null;
  if (owner && app.owner !== normEmail(owner)) return null;
  return publicApp(app);
}

export function getAppByClientId(clientId) {
  const app = readDb().apps.find(a => a.clientId === String(clientId || ''));
  return app ? publicApp(app) : null;
}

export function createApp({ owner, name, description, homepage, redirectUris, scopes, appType }) {
  const email = normEmail(owner);
  if (!email) return { error: 'חסר בעלים לאפליקציה' };
  const appName = String(name || '').trim().slice(0, 60);
  if (appName.length < 2) return { error: 'שם האפליקציה חייב להיות לפחות 2 תווים' };

  const db = readDb();
  if (db.apps.filter(a => a.owner === email).length >= 25) {
    return { error: 'הגעתם למקסימום 25 אפליקציות בחשבון' };
  }

  const wanted = (Array.isArray(scopes) ? scopes : [scopes]).filter(s => ALL_SCOPES.includes(s));
  const clientSecret = 'kls_' + rand(32);
  const apiKey = 'klapi_' + rand(24);

  const app = {
    id: 'app_' + rand(9),
    clientId: 'kl_' + rand(16),
    secretHash: sha256(clientSecret),
    secretPrefix: clientSecret.slice(0, 12),
    secretCreatedAt: nowIso(),
    apiKeyHash: sha256(apiKey),
    apiKeyPrefix: apiKey.slice(0, 14),
    apiKeyCreatedAt: nowIso(),
    appType: APP_TYPES.includes(appType) ? appType : 'confidential',
    name: appName,
    description: String(description || '').trim().slice(0, 300),
    homepage: String(homepage || '').trim().slice(0, 200),
    redirectUris: sanitizeRedirectUris(redirectUris),
    scopes: wanted.length ? wanted : ['profile'],
    owner: email,
    createdAt: nowIso(),
    quota: DEFAULT_DAILY_QUOTA,
    usage: { total: 0, day: today(), today: 0, lastUsedAt: null, logins: 0 },
    recent: [],
  };
  db.apps.push(app);
  writeDb(db);
  return { ok: true, app: publicApp(app), clientSecret, apiKey };
}

export function updateApp(id, owner, patch = {}) {
  const db = readDb();
  const app = db.apps.find(a => a.id === id && a.owner === normEmail(owner));
  if (!app) return { error: 'האפליקציה לא נמצאה' };
  if (patch.name !== undefined) {
    const n = String(patch.name).trim().slice(0, 60);
    if (n.length < 2) return { error: 'שם האפליקציה קצר מדי' };
    app.name = n;
  }
  if (patch.description !== undefined) app.description = String(patch.description).trim().slice(0, 300);
  if (patch.homepage !== undefined) app.homepage = String(patch.homepage).trim().slice(0, 200);
  if (patch.redirectUris !== undefined) app.redirectUris = sanitizeRedirectUris(patch.redirectUris);
  if (patch.appType !== undefined && APP_TYPES.includes(patch.appType)) app.appType = patch.appType;
  if (patch.scopes !== undefined) {
    const wanted = (Array.isArray(patch.scopes) ? patch.scopes : [patch.scopes]).filter(s => ALL_SCOPES.includes(s));
    app.scopes = wanted.length ? wanted : ['profile'];
  }
  writeDb(db);
  return { ok: true, app: publicApp(app) };
}

export function deleteApp(id, owner) {
  const db = readDb();
  const app = db.apps.find(a => a.id === id && a.owner === normEmail(owner));
  if (!app) return { error: 'האפליקציה לא נמצאה' };
  db.apps = db.apps.filter(a => a !== app);
  db.tokens = db.tokens.filter(t => t.clientId !== app.clientId);
  db.codes = db.codes.filter(c => c.clientId !== app.clientId);
  writeDb(db);
  return { ok: true };
}

export function rotateSecret(id, owner) {
  const db = readDb();
  const app = db.apps.find(a => a.id === id && a.owner === normEmail(owner));
  if (!app) return { error: 'האפליקציה לא נמצאה' };
  const clientSecret = 'kls_' + rand(32);
  app.secretHash = sha256(clientSecret);
  app.secretPrefix = clientSecret.slice(0, 12);
  app.secretCreatedAt = nowIso();
  writeDb(db);
  return { ok: true, clientSecret };
}

export function rotateApiKey(id, owner) {
  const db = readDb();
  const app = db.apps.find(a => a.id === id && a.owner === normEmail(owner));
  if (!app) return { error: 'האפליקציה לא נמצאה' };
  const apiKey = 'klapi_' + rand(24);
  app.apiKeyHash = sha256(apiKey);
  app.apiKeyPrefix = apiKey.slice(0, 14);
  app.apiKeyCreatedAt = nowIso();
  writeDb(db);
  return { ok: true, apiKey };
}

// ── Client authentication ──────────────────────────────────────────────────
/** Confidential clients prove themselves with the secret; public ones use PKCE. */
export function verifyClientSecret(clientId, secret) {
  const app = readDb().apps.find(a => a.clientId === String(clientId || ''));
  if (!app) return null;
  if (!safeEqual(app.secretHash, sha256(secret))) return null;
  return publicApp(app);
}

export function redirectUriAllowed(app, redirectUri) {
  if (!app || !redirectUri) return false;
  return (app.redirectUris || []).includes(String(redirectUri));
}

export { OOB_URI };

// ── Authorization codes (OAuth 2.0 code flow, with optional PKCE) ──────────
export function createAuthCode({ clientId, email, name, scopes, redirectUri, codeChallenge, codeChallengeMethod }) {
  const db = readDb();
  const app = db.apps.find(a => a.clientId === String(clientId || ''));
  if (!app) return null;
  const code = 'klc_' + rand(24);
  db.codes.push({
    code,
    clientId: app.clientId,
    email: normEmail(email),
    name: String(name || ''),
    scopes: (scopes || []).filter(s => ALL_SCOPES.includes(s)),
    redirectUri: String(redirectUri || ''),
    codeChallenge: codeChallenge ? String(codeChallenge) : null,
    codeChallengeMethod: codeChallengeMethod === 'plain' ? 'plain' : (codeChallenge ? 'S256' : null),
    exp: Date.now() + CODE_TTL_MS,
    used: false,
    createdAt: nowIso(),
  });
  writeDb(db);
  return { code, expiresIn: Math.floor(CODE_TTL_MS / 1000) };
}

function pkceMatches(rec, verifier) {
  if (!rec.codeChallenge) return true;                     // no PKCE requested
  if (!verifier) return false;
  if (rec.codeChallengeMethod === 'plain') return safeEqual(rec.codeChallenge, verifier);
  const digest = crypto.createHash('sha256').update(String(verifier)).digest('base64url');
  return safeEqual(rec.codeChallenge, digest);
}

/**
 * Trade an authorization code for tokens. Confidential apps must send
 * client_secret; public apps must send the PKCE code_verifier.
 */
export function exchangeCode({ code, clientId, clientSecret, redirectUri, codeVerifier }) {
  const db = readDb();
  const now = Date.now();
  const rec = db.codes.find(c => c.code === String(code || '') && !c.used && c.exp > now);
  if (!rec) return { error: 'invalid_grant', detail: 'קוד לא קיים או שפג תוקפו' };
  if (rec.clientId !== String(clientId || '')) return { error: 'invalid_grant', detail: 'הקוד שייך לאפליקציה אחרת' };

  const app = db.apps.find(a => a.clientId === rec.clientId);
  if (!app) return { error: 'invalid_client', detail: 'האפליקציה נמחקה' };
  if (rec.redirectUri && String(redirectUri || '') && rec.redirectUri !== String(redirectUri)) {
    return { error: 'invalid_grant', detail: 'redirect_uri לא תואם לזה שבבקשת האישור' };
  }

  if (app.appType === 'confidential') {
    if (!safeEqual(app.secretHash, sha256(clientSecret))) {
      return { error: 'invalid_client', detail: 'client_secret שגוי' };
    }
  } else if (!pkceMatches(rec, codeVerifier)) {
    return { error: 'invalid_grant', detail: 'code_verifier לא תואם ל-code_challenge' };
  }
  // A confidential app that ALSO used PKCE must satisfy both.
  if (app.appType === 'confidential' && rec.codeChallenge && !pkceMatches(rec, codeVerifier)) {
    return { error: 'invalid_grant', detail: 'code_verifier לא תואם ל-code_challenge' };
  }

  rec.used = true;                                          // single use, always
  const tokens = mintTokens(db, app, { email: rec.email, name: rec.name, scopes: rec.scopes });
  app.usage = app.usage || { total: 0, day: today(), today: 0, lastUsedAt: null, logins: 0 };
  app.usage.logins = (app.usage.logins || 0) + 1;
  pushRecent(app, 'login', `${rec.email} · ${rec.scopes.join(' ')}`);
  writeDb(db);
  return { ok: true, ...tokens };
}

function mintTokens(db, app, { email, name, scopes }) {
  const accessToken = 'kla_' + rand(32);
  const refreshToken = 'klr_' + rand(32);
  const now = Date.now();
  db.tokens.push({
    accessHash: sha256(accessToken),
    refreshHash: sha256(refreshToken),
    clientId: app.clientId,
    email: normEmail(email),
    name: String(name || ''),
    scopes,
    exp: now + ACCESS_TTL_MS,
    refreshExp: now + REFRESH_TTL_MS,
    createdAt: nowIso(),
  });
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  };
}

export function refreshTokens({ refreshToken, clientId, clientSecret }) {
  const db = readDb();
  const hash = sha256(refreshToken);
  const rec = db.tokens.find(t => t.refreshHash === hash && t.refreshExp > Date.now());
  if (!rec) return { error: 'invalid_grant', detail: 'refresh_token לא קיים או שפג תוקפו' };
  if (clientId && rec.clientId !== String(clientId)) return { error: 'invalid_grant', detail: 'האסימון שייך לאפליקציה אחרת' };
  const app = db.apps.find(a => a.clientId === rec.clientId);
  if (!app) return { error: 'invalid_client', detail: 'האפליקציה נמחקה' };
  if (app.appType === 'confidential' && !safeEqual(app.secretHash, sha256(clientSecret))) {
    return { error: 'invalid_client', detail: 'client_secret שגוי' };
  }
  db.tokens = db.tokens.filter(t => t !== rec);              // rotate the refresh token
  const tokens = mintTokens(db, app, { email: rec.email, name: rec.name, scopes: rec.scopes });
  writeDb(db);
  return { ok: true, ...tokens };
}

/** Resolve a Bearer access token → who it is and what it may do. */
export function verifyAccessToken(token) {
  if (!token) return null;
  const hash = sha256(token);
  const db = readDb();
  const rec = db.tokens.find(t => t.accessHash === hash);
  if (!rec || rec.exp < Date.now()) return null;
  const app = db.apps.find(a => a.clientId === rec.clientId);
  if (!app) return null;
  return {
    email: rec.email,
    name: rec.name,
    scopes: rec.scopes || [],
    clientId: rec.clientId,
    appName: app.name,
    appId: app.id,
  };
}

export function revokeToken(token) {
  const db = readDb();
  const hash = sha256(token);
  const before = db.tokens.length;
  db.tokens = db.tokens.filter(t => t.accessHash !== hash && t.refreshHash !== hash);
  if (db.tokens.length !== before) writeDb(db);
  return { ok: true };
}

/** Every app the family granted access to — for a future "connected apps" screen. */
export function grantsForUser(email) {
  const e = normEmail(email);
  const db = readDb();
  const byClient = new Map();
  for (const t of db.tokens) {
    if (t.email !== e) continue;
    const app = db.apps.find(a => a.clientId === t.clientId);
    if (!app) continue;
    byClient.set(t.clientId, { app: publicApp(app), scopes: t.scopes, since: t.createdAt });
  }
  return [...byClient.values()];
}

// ── API keys ───────────────────────────────────────────────────────────────
function pushRecent(app, kind, detail) {
  app.recent = [{ at: nowIso(), kind, detail: String(detail || '').slice(0, 120) }, ...(app.recent || [])].slice(0, 25);
}

/**
 * Verify an API key and count the call against today's quota.
 * Returns { app } or { error, status }.
 */
export function useApiKey(key, endpoint = '') {
  const raw = String(key || '').trim();
  if (!raw) return { error: 'חסר מפתח API — שלחו כותרת X-API-Key', status: 401 };
  const db = readDb();
  const hash = sha256(raw);
  const app = db.apps.find(a => safeEqual(a.apiKeyHash, hash));
  if (!app) return { error: 'מפתח API לא מוכר', status: 401 };

  const day = today();
  app.usage = app.usage || { total: 0, day, today: 0, lastUsedAt: null, logins: 0 };
  if (app.usage.day !== day) { app.usage.day = day; app.usage.today = 0; }
  const quota = app.quota || DEFAULT_DAILY_QUOTA;
  if (app.usage.today >= quota) {
    writeDb(db);
    return { error: `חרגתם מהמכסה היומית (${quota} קריאות ליום)`, status: 429, app: publicApp(app) };
  }
  app.usage.today += 1;
  app.usage.total = (app.usage.total || 0) + 1;
  app.usage.lastUsedAt = nowIso();
  pushRecent(app, 'api', endpoint);
  writeDb(db);
  return {
    ok: true,
    app: publicApp(app),
    remaining: quota - app.usage.today,
    quota,
  };
}

export function appStats(id, owner) {
  const app = readDb().apps.find(a => a.id === id && a.owner === normEmail(owner));
  if (!app) return null;
  const tokens = readDb().tokens.filter(t => t.clientId === app.clientId);
  return {
    usage: app.usage || { total: 0, today: 0, logins: 0 },
    quota: app.quota || DEFAULT_DAILY_QUOTA,
    activeTokens: tokens.length,
    users: new Set(tokens.map(t => t.email)).size,
    recent: app.recent || [],
  };
}

export const CLOUD_LIMITS = { DEFAULT_DAILY_QUOTA, ACCESS_TTL_MS, REFRESH_TTL_MS, CODE_TTL_MS };
