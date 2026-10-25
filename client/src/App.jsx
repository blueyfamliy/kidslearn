import { useState, useEffect } from 'react';
import HomeScreen from './components/HomeScreen';
import ExerciseSession from './components/ExerciseSession';
import ParentsScreen from './components/ParentsScreen';
import MistakesScreen from './components/MistakesScreen';
import AuthScreen from './components/AuthScreen';
import { IS_WEB, meAccount, logoutAccount, deviceLogin } from './api';
import { APP_TITLE } from './version';
import './App.css';
import './mobile.css';   // phone overrides — must load last

// Account session — BOTH platforms now REQUIRE an account (no guest entry).
// The web version always shows the login screen. The installed desktop app is
// shipped to every customer, so it asks for a login too — EXCEPT on a trusted
// family machine, where a silent device-trust sign-in (see deviceLogin) skips
// the screen entirely. Logging out forgets the machine, so it asks again.
const AUTH_KEY = 'kidslearn:auth';
function loadAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
function saveAuth(a) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch {} }
function clearAuth() { try { localStorage.removeItem(AUTH_KEY); } catch {} }

export default function App() {
  const [view, setView] = useState({ name: 'home' }); // 'home' | 'session' | 'mistakes' | 'parents'

  // Restore the saved session (both platforms), then validate it quietly.
  const [auth, setAuth] = useState(() => loadAuth());
  const [authReady, setAuthReady] = useState(false);

  // Stamp the version on the window/tab title ("KidsLearn v1.3.5") so the
  // running build is identifiable without digging into any menu.
  useEffect(() => { document.title = APP_TITLE; }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const finish = () => { if (alive) setAuthReady(true); };
      const stored = loadAuth();
      // 1) A saved session on this machine — validate it quietly.
      if (stored?.token) {
        try {
          const r = await meAccount(stored.token);
          if (!alive) return;
          if (r?.ok) { setAuth({ token: stored.token, email: r.user.email, name: r.user.name }); return finish(); }
          clearAuth(); setAuth(null);            // stale token → try device / show login
        } catch {
          return finish();                       // transient error: keep the stored session
        }
      }
      // 2) Desktop only: a trusted family machine signs in silently — no screen.
      if (!IS_WEB) {
        try {
          const r = await deviceLogin();
          if (r?.ok && alive) {
            const a = { token: r.token, email: r.user?.email || '', name: r.user?.name || '' };
            saveAuth(a); setAuth(a); return finish();
          }
        } catch {}                               // machine not trusted → login screen
      }
      // 3) No session and not a trusted machine → require a login.
      if (alive) setAuth(null);
      finish();
    })();
    return () => { alive = false; };
  }, []);

  function handleLogout() {
    if (auth?.token) logoutAccount(auth.token);
    clearAuth();
    setAuth(null);
    setView({ name: 'home' });
  }

  // Auth gate (both platforms): a registered account is required (no guest mode).
  // On a trusted family desktop the silent device sign-in above already filled
  // `auth`, so this screen never appears there.
  if (!authReady) return <div className="auth"><div className="auth-footer">טוען…</div></div>;
  if (!auth) return <AuthScreen onAuthed={(a) => { saveAuth(a); setAuth(a); }} />;

  if (view.name === 'session') {
    return (
      <ExerciseSession
        child={view.child}
        childName={view.childName}
        subject={view.subject}
        practice={view.practice}
        practiceType={view.practiceType}
        onBack={() => setView({ name: 'home' })}
      />
    );
  }

  if (view.name === 'mistakes') {
    return (
      <MistakesScreen
        child={view.child}
        childName={view.childName}
        onPractice={(subject, practiceType) =>
          setView({ name: 'session', child: view.child, childName: view.childName, subject, practice: true, practiceType })}
        onBack={() => setView({ name: 'home' })}
      />
    );
  }

  if (view.name === 'parents') {
    return <ParentsScreen onBack={() => setView({ name: 'home' })} />;
  }

  return (
    <>
      {auth && (
        <button
          onClick={handleLogout}
          title={auth.email}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 50,
            background: 'rgba(255,255,255,0.85)', color: '#5c6bc0',
            border: '1px solid rgba(92,107,192,0.3)', borderRadius: 10,
            padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >🚪 יציאה</button>
      )}
      <HomeScreen
        onSelect={(child, childName, subject) => setView({ name: 'session', child, childName, subject })}
        onMistakes={(child, childName) => setView({ name: 'mistakes', child, childName })}
        onParents={() => setView({ name: 'parents' })}
      />
    </>
  );
}
