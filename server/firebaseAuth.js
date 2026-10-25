// "Sign in with Google" through Firebase Authentication (KidsLearn project).
// Google blocks its sign-in page inside embedded app windows, so the flow runs
// in the system browser against a page this local server serves:
//
//   1. GET /api/auth/google/start → open http://localhost:<port>/auth/google
//      in the default browser.
//   2. That page loads the Firebase SDK, runs the Google sign-in popup, and
//      POSTs the resulting ID token to /api/auth/google/complete, where the
//      token is verified against Google's servers — nothing client-side is
//      trusted blindly.
//   3. The login screen polls /api/auth/google/result and receives the same
//      kind of local session token that email+password login produces.
//
// Only the identity (email + name) is taken from Firebase; sessions stay in
// the app's own users.json system. The web config below is public by design
// (it identifies the Firebase project, it is not a secret).
import crypto from 'crypto';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB9KE12QiIpaO1QPuPPVOVHvoMbjfN41Y8',
  authDomain: 'test1-24681.firebaseapp.com',
  projectId: 'test1-24681',
  appId: '1:453752355234:web:d73e323d91de6c3de5dafb',
};
export const GOOGLE_SIGNIN_PATH = '/auth/google';

// One pending flow at a time — this is a single-family desktop app. Starting
// a new flow simply replaces the previous one.
let flow = null;
const FLOW_TTL_MS = 10 * 60 * 1000;

/** Begin a flow; returns the local sign-in page URL to open in a browser. */
export function startGoogleFlow(port) {
  const state = crypto.randomBytes(24).toString('hex');
  flow = { state, createdAt: Date.now(), result: null };
  return `http://localhost:${port}${GOOGLE_SIGNIN_PATH}?state=${state}`;
}

const flowAlive = () => flow && Date.now() - flow.createdAt <= FLOW_TTL_MS;

/** The sign-in page and /complete must present the state minted by /start. */
export function validState(state) {
  return flowAlive() && !!state && String(state) === flow.state;
}

/** Verify a Firebase ID token with Google's servers → {email, name}. */
export async function verifyFirebaseIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: String(idToken || '') }),
    },
  );
  const data = await res.json().catch(() => ({}));
  const user = (data.users || [])[0];
  if (!res.ok || !user) throw new Error('אימות Google נכשל — נסו שוב');
  if (!user.email) throw new Error('חשבון Google ללא כתובת אימייל');
  return { email: user.email, name: user.displayName || '' };
}

/** Store the finished login for the app to collect (it polls /result). */
export function setGoogleResult(result) {
  if (flow) flow.result = result;
}

/** Hand the finished login to the app exactly once. */
export function takeGoogleResult() {
  if (!flow || !flow.result) return null;
  const result = flow.result;
  flow = null;
  return result;
}

/** The page served at /auth/google — runs the Firebase Google popup. */
export function googleSignInPage(state) {
  return `<!doctype html><html dir="rtl" lang="he"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KidsLearn — התחברות עם Google</title></head>
<body style="font-family:Arial,sans-serif;background:linear-gradient(135deg,#6a5acd,#5c6bc0);color:#fff;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center">
<div id="card" style="background:#fff;color:#333;border-radius:24px;padding:44px 52px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);max-width:380px">
  <div style="font-size:56px;line-height:1">⭐</div>
  <h1 style="color:#5c6bc0;margin:14px 0 6px">KidsLearn</h1>
  <p style="color:#666;margin:0 0 18px">התחברות עם חשבון Google</p>
  <button id="gbtn" style="display:inline-flex;align-items:center;gap:10px;padding:12px 26px;border:2px solid #e3e8ff;border-radius:13px;background:#fff;color:#444;font-size:1.05rem;font-weight:700;font-family:inherit;cursor:pointer">
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
    המשך עם Google
  </button>
  <div id="gmsg" style="color:#c62828;font-weight:700;min-height:22px;margin-top:12px"></div>
</div>
<script type="module">
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';

const state = ${JSON.stringify(String(state))};
const auth = getAuth(initializeApp(${JSON.stringify(FIREBASE_CONFIG)}));
const btn = document.getElementById('gbtn');
const msg = document.getElementById('gmsg');

btn.onclick = async () => {
  btn.disabled = true;
  msg.style.color = '#5c6bc0';
  msg.textContent = 'נפתח חלון של Google…';
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    msg.textContent = 'מאמתים…';
    const r = await fetch('/api/auth/google/complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, idToken }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'ההתחברות נכשלה — נסו שוב');
    document.getElementById('card').innerHTML =
      '<div style="font-size:64px;line-height:1">🎉</div>' +
      '<h1 style="color:#5c6bc0;margin:14px 0 6px">ההתחברות הצליחה!</h1>' +
      '<p style="color:#666;margin:0">אפשר לסגור את החלון הזה ולחזור ל-KidsLearn</p>';
  } catch (e) {
    btn.disabled = false;
    msg.style.color = '#c62828';
    const code = e && e.code || '';
    msg.textContent =
      code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? 'ההתחברות בוטלה — אפשר לנסות שוב' :
      code === 'auth/popup-blocked' ? 'הדפדפן חסם את החלון הקופץ — אפשרו חלונות קופצים ונסו שוב' :
      code === 'auth/network-request-failed' ? 'שגיאת רשת — בדקו את החיבור לאינטרנט' :
      (e && e.message) || 'ההתחברות נכשלה — נסו שוב';
  }
};
</script></body></html>`;
}
