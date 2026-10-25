// API layer. In the desktop/server build this talks to the Express server.
// In the static web build (VITE_TARGET=web) it delegates to a localStorage-
// backed implementation so the app runs entirely in the browser.
import * as local from './lib/localApi.js';

const WEB = import.meta.env.VITE_TARGET === 'web';
const BASE = '/api';

// ── Server implementations ──────────────────────────────────────────────
async function serverFetchExercises(child, date, subject, operation) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (subject) params.set('subject', subject);
  if (operation) params.set('op', operation);
  const qs = params.toString();
  const url = qs ? `${BASE}/exercises/${child}?${qs}` : `${BASE}/exercises/${child}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exercises');
  return res.json();
}

async function serverSaveSession(payload) {
  const res = await fetch(`${BASE}/save-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function serverFetchStats(child) {
  const res = await fetch(`${BASE}/stats/${child}`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function serverFetchHistory(child) {
  const res = await fetch(`${BASE}/history/${child}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

async function serverFetchChildren() {
  const res = await fetch(`${BASE}/children`);
  if (!res.ok) throw new Error('Failed to fetch children');
  return res.json();
}

async function serverFetchMistakes(child) {
  const res = await fetch(`${BASE}/mistakes/${child}`);
  if (!res.ok) throw new Error('Failed to fetch mistakes');
  return res.json();
}

async function serverFetchRewards(child) {
  const res = await fetch(`${BASE}/rewards/${child}`);
  if (!res.ok) throw new Error('Failed to fetch rewards');
  return res.json();
}

async function serverFetchInsights(child) {
  const res = await fetch(`${BASE}/insights/${child}`);
  if (!res.ok) throw new Error('Failed to fetch insights');
  return res.json();
}

async function serverAddChild(payload) {
  const res = await fetch(`${BASE}/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add child');
  return data;
}

async function serverUpdateChild(id, payload) {
  const res = await fetch(`${BASE}/children/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update child');
  return data;
}

async function serverDeleteChild(id) {
  const res = await fetch(`${BASE}/children/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete child');
  return data;
}

async function serverFetchEmailConfig() {
  const res = await fetch(`${BASE}/config/email`);
  if (!res.ok) throw new Error('Failed to fetch email config');
  return res.json();
}

async function serverSaveEmailConfig(cfg) {
  const res = await fetch(`${BASE}/config/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  return res.json();
}

async function serverTestEmail() {
  const res = await fetch(`${BASE}/config/email/test`, { method: 'POST' });
  return res.json();
}

// Checks the SMTP login only — authenticates and disconnects, no mail is sent.
async function serverVerifyEmail() {
  const res = await fetch(`${BASE}/config/email/verify`, { method: 'POST' });
  return res.json();
}

// ── Background removal (desktop only — proxies to the configured API) ──────
async function serverRemoveBackground(image) {
  const res = await fetch(`${BASE}/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'הסרת הרקע נכשלה');
  return data; // { ok, image }
}

async function serverFetchBgConfig() {
  const res = await fetch(`${BASE}/config/removebg`);
  if (!res.ok) throw new Error('Failed to fetch background-removal config');
  return res.json();
}

async function serverSaveBgConfig(cfg) {
  const res = await fetch(`${BASE}/config/removebg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שמירה נכשלה');
  return data;
}

// ── Accounts (register / login) ───────────────────────────────────────────
async function serverAuthStatus() {
  try { const res = await fetch(`${BASE}/auth/status`); return res.json(); }
  catch { return { hasUsers: false }; }
}

async function serverRegister(email, password, name) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'ההרשמה נכשלה');
  return data; // { ok, token, user }
}

async function serverLogin(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'ההתחברות נכשלה');
  return data; // { ok, token, user }
}

async function serverMe(token) {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { ok: false };
  return res.json(); // { ok, user }
}

async function serverLogout(token) {
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ token }),
    });
  } catch {}
  return { ok: true };
}

// Magic Box (קופסת הקסמים) — the parents' daily-surprise gift (desktop only).
async function serverFetchMagicBox() {
  const res = await fetch(`${BASE}/magicbox`);
  if (!res.ok) throw new Error('Failed to fetch magic box');
  return res.json();
}

async function serverOpenMagicBox() {
  const res = await fetch(`${BASE}/magicbox/open`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to open magic box');
  return data;
}

// Silent sign-in on a trusted family machine (desktop only) — no login screen.
async function serverDeviceLogin() {
  const res = await fetch(`${BASE}/auth/device`);
  if (!res.ok) throw new Error('device not trusted');
  return res.json();
}

// "Sign in with Google" (desktop only): the server opens the system browser;
// the app then polls for the finished login.
async function serverGoogleStart() {
  const res = await fetch(`${BASE}/auth/google/start`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'פתיחת ההתחברות עם Google נכשלה');
  return data; // { ok, url, opened }
}

async function serverGoogleResult() {
  const res = await fetch(`${BASE}/auth/google/result`);
  return res.json(); // { pending: true } | { ok, token, user }
}

// ── Public API (picks local or server) ──────────────────────────────────
export const fetchExercises   = WEB ? local.fetchExercises   : serverFetchExercises;
export const saveSession      = WEB ? local.saveSession      : serverSaveSession;
export const fetchStats       = WEB ? local.fetchStats       : serverFetchStats;
export const fetchHistory     = WEB ? local.fetchHistory     : serverFetchHistory;
export const fetchChildren    = WEB ? local.fetchChildren    : serverFetchChildren;
export const fetchMistakes    = WEB ? local.fetchMistakes    : serverFetchMistakes;
export const fetchRewards     = WEB ? local.fetchRewards     : serverFetchRewards;
export const fetchInsights    = WEB ? local.fetchInsights    : serverFetchInsights;
export const addChild         = WEB ? local.addChild         : serverAddChild;
export const updateChild      = WEB ? local.updateChild      : serverUpdateChild;
export const deleteChild      = WEB ? local.deleteChild      : serverDeleteChild;
export const fetchEmailConfig = WEB ? local.fetchEmailConfig : serverFetchEmailConfig;
export const saveEmailConfig  = WEB ? local.saveEmailConfig  : serverSaveEmailConfig;
export const testEmail        = WEB ? local.testEmail        : serverTestEmail;
export const verifyEmail      = WEB ? local.verifyEmail      : serverVerifyEmail;
export const googleLoginStart  = WEB ? (async () => { throw new Error('web'); }) : serverGoogleStart;
export const googleLoginResult = WEB ? (async () => ({ pending: true }))        : serverGoogleResult;
// Web only: Firebase Authentication popup → verified Google identity → local session.
export const googleFirebaseLogin = WEB ? local.googleFirebaseLogin : (async () => { throw new Error('desktop'); });
export const removeBackground = WEB ? local.removeBackground : serverRemoveBackground;
export const fetchBgConfig    = WEB ? local.fetchBgConfig    : serverFetchBgConfig;
export const saveBgConfig     = WEB ? local.saveBgConfig     : serverSaveBgConfig;
export const authStatus       = WEB ? local.authStatus       : serverAuthStatus;
export const registerAccount  = WEB ? local.registerAccount  : serverRegister;
export const loginAccount     = WEB ? local.loginAccount     : serverLogin;
export const meAccount        = WEB ? local.meAccount        : serverMe;
export const logoutAccount    = WEB ? local.logoutAccount    : serverLogout;
export const deviceLogin      = WEB ? (async () => { throw new Error('web'); }) : serverDeviceLogin;
export const fetchMagicBox    = WEB ? (async () => ({ unlocked: false })) : serverFetchMagicBox;
export const openMagicBox     = WEB ? (async () => { throw new Error('web'); }) : serverOpenMagicBox;
// Desktop only: the server opens the system browser, the app polls for the result.

export const IS_WEB = WEB;
