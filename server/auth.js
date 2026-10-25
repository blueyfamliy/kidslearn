// Local account auth for the desktop app. Accounts live in users.json (in the
// same writable userData dir as the rest of the app data). Passwords are hashed
// with Node's built-in scrypt (per-user random salt) — never stored in plain
// text — so there are no external dependencies and no cloud service required.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { resolveDataDir } from './dataDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Share the exact same data dir as storage.js (see server/dataDir.js) so the
// dev server and the installed app read one users.json, not two.
const DATA_DIR = resolveDataDir(path.join(__dirname, 'data'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const KEYLEN = 64;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readUsers() {
  try {
    const list = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeUsers(list) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2));
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(String(password), salt, KEYLEN);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(test, known);
}

const newToken = () => crypto.randomBytes(32).toString('hex');
const publicUser = (u) => ({ email: u.email, name: u.name || '' });

export function userCount() {
  return readUsers().length;
}

export function registerUser({ email, password, name }) {
  email = normEmail(email);
  if (!EMAIL_RE.test(email)) return { error: 'כתובת אימייל לא תקינה' };
  if (String(password || '').length < 6) return { error: 'הסיסמה צריכה להיות לפחות 6 תווים' };
  const users = readUsers();
  if (users.some(u => u.email === email)) return { error: 'כבר קיים חשבון עם האימייל הזה' };
  const { salt, hash } = hashPassword(password);
  const token = newToken();
  const user = {
    email,
    name: String(name || '').trim(),
    salt,
    hash,
    tokens: [token],
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return { ok: true, token, user: publicUser(user) };
}

// ── Brute-force brake ──────────────────────────────────────────────────────
// Unlimited guessing is cheap for an attacker and pointless for a parent who
// mistyped. After MAX_ATTEMPTS wrong tries an email stops answering for a
// while; one correct password clears the record. In memory on purpose — a
// restart forgiving the counter is fine, locking a parent out of their own
// kids' app across restarts is not.
const failures = new Map();   // email → { count, until }
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

function lockedOut(email) {
  const rec = failures.get(email);
  if (!rec || rec.count < MAX_ATTEMPTS) return 0;
  if (rec.until <= Date.now()) { failures.delete(email); return 0; }
  return Math.ceil((rec.until - Date.now()) / 60000);   // minutes left
}

function noteFailure(email) {
  const rec = failures.get(email) || { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCKOUT_MS;
  failures.set(email, rec);
}

export function loginUser({ email, password }) {
  email = normEmail(email);
  const wait = lockedOut(email);
  if (wait) return { error: `יותר מדי ניסיונות התחברות — נסו שוב בעוד ${wait} דקות` };
  const users = readUsers();
  const user = users.find(u => u.email === email);
  // Verify even when the user is missing, to avoid leaking which emails exist.
  if (!user) { hashPassword(password || 'x'); noteFailure(email); return { error: 'אימייל או סיסמה שגויים' }; }
  // Google-created accounts have no local password.
  if (!user.hash) return { error: 'החשבון הזה נכנס עם "התחבר עם Google"' };
  if (!verifyPassword(password, user.salt, user.hash)) {
    noteFailure(email);
    return { error: 'אימייל או סיסמה שגויים' };
  }
  failures.delete(email);
  const token = newToken();
  user.tokens = [...(user.tokens || []), token].slice(-10);   // keep last 10 devices
  writeUsers(users);
  return { ok: true, token, user: publicUser(user) };
}

// Sign-in via a verified external identity (Google through Firebase). Such
// accounts are created on first sign-in and carry no local password.
export function externalLogin({ email, name }) {
  email = normEmail(email);
  if (!EMAIL_RE.test(email)) return { error: 'חשבון Google ללא אימייל תקין' };
  const users = readUsers();
  let user = users.find(u => u.email === email);
  if (!user) {
    user = {
      email,
      name: String(name || '').trim(),
      provider: 'google',
      tokens: [],
      createdAt: new Date().toISOString(),
    };
    users.push(user);
  }
  if (!user.name && name) user.name = String(name).trim();
  const token = newToken();
  user.tokens = [...(user.tokens || []), token].slice(-10);
  writeUsers(users);
  return { ok: true, token, user: publicUser(user) };
}

export function userForToken(token) {
  if (!token) return null;
  const user = readUsers().find(u => Array.isArray(u.tokens) && u.tokens.includes(token));
  return user ? publicUser(user) : null;
}

// ── Device trust: the family's own computer never sees the login screen ────
// After one successful register/login on a machine, that machine is marked
// trusted (device.json next to the rest of the data). From then on the app
// signs in silently as that account. Fresh installs (other people) still get
// the one-time registration screen. Logging out clears the trust.
const DEVICE_FILE = path.join(DATA_DIR, 'device.json');

export function rememberDevice(email) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DEVICE_FILE, JSON.stringify({ email: normEmail(email) }, null, 2));
  } catch {}
}

export function forgetDevice() {
  try { fs.unlinkSync(DEVICE_FILE); } catch {}
}

export function deviceLogin() {
  let email;
  try { email = normEmail(JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')).email); } catch { return null; }
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return null;
  const token = newToken();
  user.tokens = [...(user.tokens || []), token].slice(-10);
  writeUsers(users);
  return { ok: true, token, user: publicUser(user) };
}

// ── "Sign in with KidsLearn" for the family's OTHER apps (Tavixo, …) ───────
// A local single-sign-on: another app on this machine asks KidsLearn "who is
// the signed-in family?" and gets the identity of the device-trusted account,
// plus an app-scoped token it can re-verify on every launch. No passwords
// ever leave KidsLearn.

export function ssoAuthorize(appName) {
  const app = String(appName || '').trim().slice(0, 40);
  if (!app) return null;
  let email;
  try { email = normEmail(JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')).email); } catch { return null; }
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return null;
  const token = newToken();
  const others = (user.ssoTokens || []).filter(t => t.app !== app).slice(-15);
  const mine = (user.ssoTokens || []).filter(t => t.app === app).slice(-4);   // keep a few per app
  user.ssoTokens = [...others, ...mine, { app, token, createdAt: new Date().toISOString() }];
  writeUsers(users);
  return { ok: true, app, token, user: publicUser(user) };
}

export function ssoVerify(token) {
  if (!token) return null;
  for (const u of readUsers()) {
    const rec = (u.ssoTokens || []).find(t => t.token === token);
    if (rec) return { ok: true, app: rec.app, user: publicUser(u) };
  }
  return null;
}

/** The device-trusted account's email (or null) — for the authorize page. */
export function deviceEmail() {
  try { return normEmail(JSON.parse(fs.readFileSync(DEVICE_FILE, 'utf8')).email); } catch { return null; }
}

// ── One-time connection codes (device-code style flow) ─────────────────────
// The KidsLearn authorization page issues a short single-use code AFTER the
// parent gate; the other app exchanges it for an identity + sso token. Codes
// live 10 minutes, are single-use, and are stored next to the rest of the data
// so an app restart doesn't void a code the parent just wrote down.
const SSO_CODES_FILE = path.join(DATA_DIR, 'sso-codes.json');
const CODE_TTL_MS = 10 * 60 * 1000;

function readCodes() {
  try {
    const list = JSON.parse(fs.readFileSync(SSO_CODES_FILE, 'utf8'));
    return (Array.isArray(list) ? list : []).filter(c => c.exp > Date.now() && !c.used);
  } catch { return []; }
}

function writeCodes(list) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SSO_CODES_FILE, JSON.stringify(list, null, 2));
  } catch {}
}

/** All family accounts — for the "who is connecting?" picker. */
export function listAccounts() {
  return readUsers().map(publicUser);
}

export function createSsoCode(appName, accountEmail = null) {
  const app = String(appName || '').trim().slice(0, 40);
  if (!app) return null;
  // The parent may pick WHICH family member connects (e.g. דין with his own
  // account) — defaults to the device-trusted account.
  const email = accountEmail ? normEmail(accountEmail) : deviceEmail();
  if (!email || !readUsers().some(u => u.email === email)) return null;
  // Readable and unambiguous: no 0/O or 1/I lookalikes.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (const b of crypto.randomBytes(6)) code += alphabet[b % alphabet.length];
  writeCodes([...readCodes(), { code, app, email, exp: Date.now() + CODE_TTL_MS, used: false }]);
  return { code, app };
}

export function exchangeSsoCode(rawCode, appName) {
  const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const app = String(appName || '').trim().slice(0, 40);
  if (!code) return null;
  const list = readCodes();
  const rec = list.find(c => c.code === code && (!app || c.app === app));
  if (!rec) return null;
  writeCodes(list.filter(c => c !== rec));   // single-use: gone the moment it's claimed
  const users = readUsers();
  const user = users.find(u => u.email === rec.email);
  if (!user) return null;
  const token = newToken();
  const others = (user.ssoTokens || []).filter(t => t.app !== rec.app).slice(-15);
  const mine = (user.ssoTokens || []).filter(t => t.app === rec.app).slice(-4);
  user.ssoTokens = [...others, ...mine, { app: rec.app, token, createdAt: new Date().toISOString() }];
  writeUsers(users);
  return { ok: true, app: rec.app, token, user: publicUser(user) };
}

export function logoutToken(token) {
  if (!token) return;
  const users = readUsers();
  let changed = false;
  for (const u of users) {
    if (Array.isArray(u.tokens) && u.tokens.includes(token)) {
      u.tokens = u.tokens.filter(t => t !== token);
      changed = true;
    }
  }
  if (changed) writeUsers(users);
}
