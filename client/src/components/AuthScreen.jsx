import { useState, useEffect, useRef } from 'react';
import {
  authStatus, registerAccount, loginAccount, googleLoginStart, googleLoginResult,
  googleFirebaseLogin, IS_WEB,
} from '../api';
import './AuthScreen.css';

// Google "G" mark for the sign-in button.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');      // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [googleWaiting, setGoogleWaiting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const pollRef = useRef(null);

  // Typing a password with the keyboard left in Hebrew produces Hebrew letters
  // that look identical behind the dots — warn instead of failing silently.
  const hebrewInPassword = /[֐-׿]/.test(password);

  // First run (no accounts yet) → start on the register form.
  useEffect(() => {
    authStatus().then(s => { if (!s.hasUsers) setMode('register'); }).catch(() => {});
  }, []);

  // Stop polling if the screen unmounts.
  useEffect(() => () => stopGooglePoll(), []);

  function stopGooglePoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setGoogleWaiting(false);
  }

  // Web: Firebase opens the Google popup right here and verifies the identity.
  async function webGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      const r = await googleFirebaseLogin();
      onAuthed({ token: r.token, email: r.user.email, name: r.user.name });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // Desktop: open Google sign-in in the system browser and poll for the result.
  async function googleSignIn() {
    setError(null);
    try {
      await googleLoginStart();
    } catch (err) {
      setError(err.message);
      return;
    }
    setGoogleWaiting(true);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {  // give up after 3 minutes
        stopGooglePoll();
        setError('ההתחברות עם Google לא הושלמה — נסו שוב');
        return;
      }
      try {
        const r = await googleLoginResult();
        if (r && r.ok) {
          stopGooglePoll();
          onAuthed({ token: r.token, email: r.user?.email || '', name: r.user?.name || '' });
        }
      } catch {}
    }, 1500);
  }

  const isRegister = mode === 'register';

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('צריך להזין אימייל וסיסמה'); return; }
    setBusy(true);
    try {
      const r = isRegister
        ? await registerAccount(email, password, name)
        : await loginAccount(email, password);
      onAuthed({
        token: r.token,
        email: r.user?.email || email.trim().toLowerCase(),
        name: r.user?.name || '',
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-stars">⭐</div>
        <h1>KidsLearn</h1>
        <p className="auth-sub">{isRegister ? 'יצירת חשבון חדש' : 'התחברות לחשבון'}</p>

        {isRegister && (
          <label className="auth-field">
            <span>שם (לא חובה)</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: משפחת אברהם"
              maxLength={40}
            />
          </label>
        )}

        <label className="auth-field">
          <span>אימייל</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="auth-field">
          <span>סיסמה</span>
          <div className="auth-pw-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isRegister ? 'לפחות 6 תווים' : '••••••'}
              dir="ltr"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="auth-pw-eye"
              onClick={() => setShowPassword(s => !s)}
              title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
            >{showPassword ? '🙈' : '👁️'}</button>
          </div>
        </label>

        {hebrewInPassword && (
          <div className="auth-hint">⌨️ הסיסמה מכילה אותיות בעברית — אולי צריך להחליף שפה (Alt+Shift)</div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-submit" disabled={busy || googleWaiting}>
          {busy ? '…' : (isRegister ? '✨ צור חשבון' : '🔑 התחבר')}
        </button>

        <div className="auth-divider"><span>או</span></div>
        {googleWaiting ? (
          <div className="auth-google-wait">
            <div className="auth-google-spinner" />
            ממתין לאישור בדפדפן…
            <button type="button" className="auth-toggle" onClick={stopGooglePoll}>ביטול</button>
          </div>
        ) : (
          <button
            type="button"
            className="auth-google"
            onClick={IS_WEB ? webGoogleSignIn : googleSignIn}
            disabled={busy}
          >
            <GoogleIcon /> התחבר עם Google
          </button>
        )}

        <button
          type="button"
          className="auth-toggle"
          onClick={() => { setError(null); setMode(isRegister ? 'login' : 'register'); }}
        >
          {isRegister ? 'כבר יש חשבון? התחברו' : 'אין עדיין חשבון? הירשמו'}
        </button>
      </form>
      <div className="auth-footer">
        {IS_WEB
          ? '🔒 החשבון וההתקדמות נשמרים בדפדפן במכשיר הזה'
          : '🔒 הסיסמה נשמרת מוצפנת על המחשב הזה'}
      </div>
    </div>
  );
}
