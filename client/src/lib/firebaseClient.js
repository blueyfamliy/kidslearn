// Google sign-in for the static web build (kidslearn.fun), where there is no
// server to run the flow. Firebase's SDK opens the Google popup and verifies
// the identity; only the verified email + display name come back, and
// localApi.js turns those into a device-local account. No password is involved
// and nothing leaves the browser.
//
// The SDK is imported lazily so the ~150 KB of Firebase is only fetched when a
// parent actually presses the button — the kids' daily session never pays for it.
//
// The desktop build does NOT use this file: it opens the system browser against
// the server's own /auth/google page (server/firebaseAuth.js), because Google
// refuses to render its sign-in page inside an app window.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB9KE12QiIpaO1QPuPPVOVHvoMbjfN41Y8',
  authDomain: 'test1-24681.firebaseapp.com',
  projectId: 'test1-24681',
  appId: '1:453752355234:web:d73e323d91de6c3de5dafb',
};

let loading = null;

/** Load the Firebase SDK once and hand back an initialised auth instance. */
function loadFirebase() {
  return (loading ||= Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ])
    .then(([{ initializeApp }, authMod]) => ({
      auth: authMod.getAuth(initializeApp(FIREBASE_CONFIG)),
      authMod,
    }))
    .catch((err) => {
      loading = null;          // let a later attempt retry after a network blip
      throw err;
    }));
}

/**
 * Open the Google popup and return the verified identity.
 * @returns {Promise<{email: string, name: string}>}
 */
export async function firebaseGoogleSignIn() {
  let auth, authMod;
  try {
    ({ auth, authMod } = await loadFirebase());
  } catch {
    throw new Error('טעינת ההתחברות עם Google נכשלה — בדקו את החיבור לאינטרנט');
  }

  const provider = new authMod.GoogleAuthProvider();
  // Always show the chooser: families share a machine, and silently reusing
  // whichever Google account the browser remembers is how a parent ends up
  // signed in as someone else.
  provider.setCustomParameters({ prompt: 'select_account' });

  let result;
  try {
    result = await authMod.signInWithPopup(auth, provider);
  } catch (err) {
    throw new Error(describe(err));
  }

  const email = String(result.user?.email || '').trim().toLowerCase();
  if (!email) throw new Error('לא התקבל אימייל מ-Google');
  return { email, name: String(result.user?.displayName || '').trim() };
}

/** Firebase's error codes, in words a parent can act on. */
function describe(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'ההתחברות בוטלה — אפשר לנסות שוב';
    case 'auth/popup-blocked':
      return 'הדפדפן חסם את חלון ההתחברות — אפשרו חלונות קופצים ונסו שוב';
    case 'auth/network-request-failed':
      return 'שגיאת רשת — בדקו את החיבור לאינטרנט';
    case 'auth/unauthorized-domain':
      return 'הכתובת הזו לא מאושרת להתחברות — צריך להוסיף אותה ב-Firebase Console';
    default:
      return 'ההתחברות עם Google נכשלה — נסו שוב';
  }
}
