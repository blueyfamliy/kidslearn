// KidsLearn Cloud — every page of the developer console and the OAuth consent
// screen. Plain server-rendered HTML (no build step, no dependencies) so the
// console works in the packaged desktop app exactly like it does in dev.
import { SCOPES, ALL_SCOPES, CLOUD_LIMITS, OOB_URI } from './cloud.js';
import { STATUS, missingForSubmit } from './coli.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const BRAND = '#5c6bc0';

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fb;color:#263238}
a{color:${BRAND}}
header.topbar{background:linear-gradient(135deg,#1a237e,#3949ab);color:#fff;padding:14px 22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header.topbar .logo{font-size:1.35rem;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:8px}
header.topbar nav{margin-inline-start:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
header.topbar nav a,header.topbar nav button{background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:.92rem;font-weight:700;text-decoration:none;cursor:pointer}
header.topbar nav a:hover,header.topbar nav button:hover{background:rgba(255,255,255,.28)}
.wrap{max-width:980px;margin:26px auto 60px;padding:0 18px}
.card{background:#fff;border-radius:18px;padding:22px 24px;box-shadow:0 6px 24px rgba(38,50,56,.08);margin-bottom:18px}
h1{margin:0 0 6px;font-size:1.7rem}
h2{margin:0 0 10px;font-size:1.2rem;color:#1a237e}
h3{margin:18px 0 6px;font-size:1rem;color:#37474f}
p.sub{color:#78909c;margin:0 0 18px}
label{display:block;font-weight:700;margin:14px 0 5px;color:#37474f}
input[type=text],input[type=email],input[type=password],textarea,select{width:100%;padding:11px 12px;border:2px solid #dfe4ee;border-radius:11px;font-size:1rem;font-family:inherit;background:#fff}
input:focus,textarea:focus,select:focus{outline:none;border-color:${BRAND}}
textarea{min-height:88px;resize:vertical}
small.hint{color:#90a4ae;display:block;margin-top:4px;line-height:1.5}
.btn{display:inline-block;background:linear-gradient(135deg,#5c6bc0,#3949ab);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:1rem;font-weight:800;cursor:pointer;text-decoration:none}
.btn.green{background:linear-gradient(135deg,#66bb6a,#43a047)}
.btn.ghost{background:#eceff1;color:#37474f}
.btn.danger{background:#ffebee;color:#c62828}
.btn.sm{padding:8px 16px;font-size:.88rem;border-radius:10px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.appcard{display:block;background:#fff;border:2px solid #e8ecf5;border-radius:16px;padding:16px 18px;text-decoration:none;color:inherit;transition:.15s}
.appcard:hover{border-color:${BRAND};transform:translateY(-2px);box-shadow:0 10px 24px rgba(57,73,171,.14)}
.appcard b{font-size:1.08rem}
code,.mono{font-family:Consolas,'Courier New',monospace;direction:ltr;unicode-bidi:embed}
.secret{display:flex;align-items:center;gap:8px;background:#0f172a;color:#8ff0c2;border-radius:12px;padding:12px 14px;font-family:Consolas,monospace;font-size:.95rem;word-break:break-all;direction:ltr;text-align:left}
.secret button{margin-inline-start:auto;background:#334155;color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;flex:none}
pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px;overflow-x:auto;direction:ltr;text-align:left;font-size:.86rem;line-height:1.6}
pre .k{color:#c792ea}pre .s{color:#c3e88d}pre .c{color:#607d8b}
table{width:100%;border-collapse:collapse;margin:8px 0 4px}
th,td{text-align:right;padding:9px 10px;border-bottom:1px solid #eceff1;font-size:.93rem}
th{color:#546e7a;font-size:.85rem;text-transform:uppercase;letter-spacing:.5px}
.pill{display:inline-block;background:#e8eaf6;color:#3949ab;border-radius:999px;padding:3px 11px;font-size:.8rem;font-weight:700;margin:2px 2px 2px 0}
.pill.gray{background:#eceff1;color:#607d8b}
.pill.green{background:#e8f5e9;color:#2e7d32}
.alert{border-radius:12px;padding:12px 16px;margin:12px 0;font-weight:700;line-height:1.6}
.alert.err{background:#ffebee;color:#c62828}
.alert.ok{background:#e8f5e9;color:#2e7d32}
.alert.warn{background:#fff8e1;color:#8d6e63;border:1px solid #ffe082}
.stat{background:#f8f9fc;border-radius:14px;padding:14px 16px;text-align:center;flex:1;min-width:120px}
.stat b{display:block;font-size:1.6rem;color:#1a237e}
.stat span{color:#78909c;font-size:.85rem}
.scopebox{border:2px solid #dfe4ee;border-radius:12px;padding:6px 12px}
.scopebox label{display:flex;gap:10px;align-items:flex-start;font-weight:600;margin:10px 0;color:#37474f}
.scopebox input{margin-top:3px;width:18px;height:18px;accent-color:${BRAND};flex:none}
.scopebox small{display:block;color:#90a4ae;font-weight:500}
`;

export function consoleLayout(title, body, { user = null, active = '', admin = false, pending = 0 } = {}) {
  const nav = user
    ? `<nav>
         <a href="/cloud/apps" ${active === 'apps' ? 'style="background:rgba(255,255,255,.3)"' : ''}>האפליקציות שלי</a>
         <a href="/coli">🏪 חנות Coli</a>
         ${admin ? `<a href="/cloud/coli/review" ${active === 'review' ? 'style="background:rgba(255,255,255,.3)"' : ''}>בדיקת אפליקציות${pending ? ` (${pending})` : ''}</a>` : ''}
         <a href="/cloud/docs" ${active === 'docs' ? 'style="background:rgba(255,255,255,.3)"' : ''}>תיעוד</a>
         <span style="opacity:.85;font-size:.88rem" dir="ltr">${esc(user.email)}</span>
         <form method="post" action="/cloud/logout" style="margin:0"><button type="submit">יציאה</button></form>
       </nav>`
    : `<nav><a href="/coli">🏪 חנות Coli</a><a href="/cloud/docs">תיעוד</a></nav>`;
  return `<!doctype html><html dir="rtl" lang="he"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — KidsLearn Cloud</title><style>${CSS}</style></head><body>
<header class="topbar"><div class="logo">☁️ KidsLearn <span style="opacity:.7;font-weight:400">Cloud</span></div>${nav}</header>
<div class="wrap">${body}</div>
<script>
function copyText(el, btn){
  var t = el.getAttribute('data-value') || el.textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(function(){ var o = btn.textContent; btn.textContent = '✓ הועתק'; setTimeout(function(){ btn.textContent = o; }, 1600); },
          function(){ var r = document.createRange(); r.selectNode(el); getSelection().removeAllRanges(); getSelection().addRange(r); });
}
</script></body></html>`;
}

// Shared with the Coli publisher pages (coliConsole.js) so the whole console —
// OAuth settings and store listing alike — is one consistent screen.
const layout = consoleLayout;

// ── Sign in / sign up to the console ───────────────────────────────────────
export function loginPage({ error = '', mode = 'login', email = '' } = {}) {
  const isRegister = mode === 'register';
  return layout('כניסה', `
  <div class="card" style="max-width:520px;margin:0 auto">
    <h1>${isRegister ? 'פתיחת חשבון מפתח' : 'כניסה לקונסולת המפתחים'}</h1>
    <p class="sub">חשבון KidsLearn רגיל — אותו אימייל וסיסמה של האפליקציה המשפחתית.</p>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    <form method="post" action="/cloud/${isRegister ? 'register' : 'login'}">
      ${isRegister ? `<label>שם</label><input type="text" name="name" placeholder="השם שלכם">` : ''}
      <label>אימייל</label>
      <input type="email" name="email" dir="ltr" required value="${esc(email)}" placeholder="you@example.com">
      <label>סיסמה</label>
      <input type="password" name="password" required minlength="6" placeholder="לפחות 6 תווים">
      <div style="margin-top:20px"><button class="btn" type="submit">${isRegister ? 'צרו חשבון' : 'כניסה'}</button></div>
    </form>
    <p style="margin-top:18px;color:#78909c">
      ${isRegister
        ? 'כבר יש לכם חשבון? <a href="/cloud">כניסה</a>'
        : 'אין לכם חשבון? <a href="/cloud?mode=register">פתחו חשבון מפתח</a>'}
    </p>
  </div>
  <div class="card" style="max-width:520px;margin:0 auto;background:#eef1fb">
    <h2>מה מקבלים כאן?</h2>
    <p style="line-height:1.9;margin:0;color:#37474f">
      🔑 <b>Client ID + Client Secret</b> — לכפתור "התחברות עם KidsLearn" באפליקציה שלכם.<br>
      🧪 <b>API Key</b> — גישה למנוע התרגילים של KidsLearn (חשבון, עברית, אנגלית).<br>
      📊 <b>מעקב שימוש</b> — כמה משתמשים התחברו וכמה קריאות API בוצעו.<br>
      📚 <b><a href="/cloud/docs">תיעוד מלא</a></b> — כל הכתובות, הדוגמאות וההרשאות.
    </p>
  </div>`, { user: null });
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export function dashboardPage({ user, apps, flash = '', admin = false, pending = 0, storeByApp = {} }) {
  const storePill = (id) => {
    const st = storeByApp[id];
    if (!st) return `<span class="pill gray">🏪 לא בחנות</span>`;
    const s = STATUS[st] || STATUS.draft;
    return `<span class="pill ${s.pill === 'green' ? 'green' : 'gray'}">🏪 ${esc(s.label)}</span>`;
  };
  const cards = apps.length ? apps.map(a => `
    <a class="appcard" href="/cloud/apps/${esc(a.id)}">
      <b>${esc(a.name)}</b>
      <div class="mono" style="color:#90a4ae;font-size:.8rem;margin:6px 0">${esc(a.clientId)}</div>
      <div>${storePill(a.id)}${(a.scopes || []).map(s => `<span class="pill">${esc(SCOPES[s]?.icon || '')} ${esc(s)}</span>`).join('')}</div>
      <div style="color:#78909c;font-size:.85rem;margin-top:8px">
        ${a.usage?.logins || 0} התחברויות · ${a.usage?.total || 0} קריאות API
      </div>
    </a>`).join('') : `
    <div class="card" style="grid-column:1/-1;text-align:center;color:#78909c">
      עוד אין אפליקציות. <a href="/cloud/apps/new">צרו את הראשונה</a> — לוקח 30 שניות.
    </div>`;
  return layout('האפליקציות שלי', `
  ${flash ? `<div class="alert ok">${esc(flash)}</div>` : ''}
  <div class="row" style="margin-bottom:16px">
    <div style="flex:1"><h1>האפליקציות שלי</h1><p class="sub" style="margin:0">כל אפליקציה מקבלת Client ID, Client Secret ו-API Key משלה — ויכולה להתפרסם בחינם ב<a href="/coli">חנות Coli</a>.</p></div>
    <a class="btn" href="/cloud/apps/new">+ אפליקציה חדשה</a>
  </div>
  <div class="grid">${cards}</div>`, { user, active: 'apps', admin, pending });
}

// ── Create app ─────────────────────────────────────────────────────────────
export function newAppPage({ user, error = '', values = {} }) {
  const scopeBoxes = ALL_SCOPES.map(s => `
    <label><input type="checkbox" name="scopes" value="${esc(s)}" ${s === 'profile' || (values.scopes || []).includes(s) ? 'checked' : ''}>
      <span>${SCOPES[s].icon} <b>${esc(s)}</b> — ${esc(SCOPES[s].label)}<small>${esc(SCOPES[s].detail)}</small></span>
    </label>`).join('');
  return layout('אפליקציה חדשה', `
  <div class="card">
    <h1>אפליקציה חדשה</h1>
    <p class="sub">אחרי היצירה נציג את ה-Client Secret וה-API Key <b>פעם אחת בלבד</b> — שמרו אותם.</p>
    ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
    <form method="post" action="/cloud/apps">
      <label>שם האפליקציה *</label>
      <input type="text" name="name" required value="${esc(values.name || '')}" placeholder="למשל: SmartKids">
      <small class="hint">השם שההורים יראו במסך האישור.</small>

      <label>תיאור קצר</label>
      <input type="text" name="description" value="${esc(values.description || '')}" placeholder="אפליקציית לימוד לילדים">

      <label>אתר האפליקציה</label>
      <input type="text" name="homepage" dir="ltr" value="${esc(values.homepage || '')}" placeholder="https://example.com">

      <label>סוג האפליקציה</label>
      <select name="appType">
        <option value="confidential" ${values.appType !== 'public' ? 'selected' : ''}>שרת / Web — יש client_secret (מומלץ)</option>
        <option value="public" ${values.appType === 'public' ? 'selected' : ''}>נייטיב / SPA — בלי secret, עם PKCE</option>
      </select>
      <small class="hint">אפליקציה שרצה רק בדפדפן או במכשיר לא יכולה לשמור סוד — בחרו "נייטיב / SPA" והשתמשו ב-PKCE.</small>

      <label>Redirect URIs (כתובת חזרה) — שורה לכל כתובת</label>
      <textarea name="redirectUris" dir="ltr" placeholder="http://localhost:5173/callback&#10;https://myapp.com/auth/kidslearn">${esc(values.redirectUris || '')}</textarea>
      <small class="hint">חייב להיות התאמה מדויקת. לאפליקציות שולחן עבודה/CLI אפשר להשתמש ב-<code>${OOB_URI}</code> — הקוד יוצג על המסך להעתקה.</small>

      <label>הרשאות (scopes) שהאפליקציה תבקש</label>
      <div class="scopebox">${scopeBoxes}</div>

      <div style="margin-top:22px" class="row">
        <button class="btn" type="submit">צרו אפליקציה</button>
        <a class="btn ghost" href="/cloud/apps">ביטול</a>
      </div>
    </form>
  </div>`, { user, active: 'apps' });
}

// ── App details ────────────────────────────────────────────────────────────
export function appPage({ user, app, stats, reveal = {}, baseUrl, flash = '', admin = false, pending = 0, listing = null }) {
  const secretBlock = reveal.clientSecret
    ? `<div class="alert warn">⚠️ זה ה-Client Secret — הוא מוצג <b>פעם אחת בלבד</b>. העתיקו ושמרו אותו במקום בטוח.</div>
       <div class="secret"><span id="cs" data-value="${esc(reveal.clientSecret)}">${esc(reveal.clientSecret)}</span>
       <button onclick="copyText(document.getElementById('cs'),this)">העתק</button></div>`
    : `<div class="row"><code style="color:#90a4ae">${esc(app.secretPrefix)}••••••••••••••••</code>
       <form method="post" action="/cloud/apps/${esc(app.id)}/secret" style="margin:0"
             onsubmit="return confirm('ליצור Client Secret חדש? הישן יפסיק לעבוד מיד.')">
         <button class="btn ghost sm" type="submit">יצירת secret חדש</button></form></div>`;

  const keyBlock = reveal.apiKey
    ? `<div class="alert warn">⚠️ זה ה-API Key — מוצג <b>פעם אחת בלבד</b>.</div>
       <div class="secret"><span id="ak" data-value="${esc(reveal.apiKey)}">${esc(reveal.apiKey)}</span>
       <button onclick="copyText(document.getElementById('ak'),this)">העתק</button></div>`
    : `<div class="row"><code style="color:#90a4ae">${esc(app.apiKeyPrefix)}••••••••••••</code>
       <form method="post" action="/cloud/apps/${esc(app.id)}/apikey" style="margin:0"
             onsubmit="return confirm('ליצור API Key חדש? הישן יפסיק לעבוד מיד.')">
         <button class="btn ghost sm" type="submit">יצירת מפתח חדש</button></form></div>`;

  const firstRedirect = (app.redirectUris || [])[0] || 'http://localhost:5173/callback';
  const authUrl = `${baseUrl}/oauth/authorize?client_id=${encodeURIComponent(app.clientId)}`
    + `&redirect_uri=${encodeURIComponent(firstRedirect)}&response_type=code`
    + `&scope=${encodeURIComponent((app.scopes || []).join(' '))}&state=xyz123`;

  const recent = (stats.recent || []).slice(0, 10).map(r => `
    <tr><td>${esc(r.at.replace('T', ' ').slice(0, 16))}</td>
        <td><span class="pill ${r.kind === 'login' ? 'green' : 'gray'}">${r.kind === 'login' ? 'התחברות' : 'API'}</span></td>
        <td class="mono" style="font-size:.85rem">${esc(r.detail)}</td></tr>`).join('')
    || `<tr><td colspan="3" style="color:#90a4ae">עוד לא הייתה פעילות.</td></tr>`;

  return layout(app.name, `
  ${flash ? `<div class="alert ok">${esc(flash)}</div>` : ''}
  <div class="card">
    <div class="row">
      <div style="flex:1">
        <h1>${esc(app.name)}</h1>
        <p class="sub" style="margin:0">${esc(app.description || 'ללא תיאור')}</p>
      </div>
      <span class="pill ${app.appType === 'public' ? 'gray' : 'green'}">${app.appType === 'public' ? 'נייטיב / SPA (PKCE)' : 'שרת / Web'}</span>
    </div>
    <div class="row" style="margin-top:16px">
      <div class="stat"><b>${stats.usage.logins || 0}</b><span>התחברויות</span></div>
      <div class="stat"><b>${stats.users || 0}</b><span>משתמשים מחוברים</span></div>
      <div class="stat"><b>${stats.usage.total || 0}</b><span>קריאות API</span></div>
      <div class="stat"><b>${stats.usage.today || 0}/${stats.quota}</b><span>מכסה היום</span></div>
    </div>
  </div>

  <div class="card">
    <h2>🔑 פרטי OAuth — "התחברות עם KidsLearn"</h2>
    <h3>Client ID</h3>
    <div class="secret" style="background:#eceff1;color:#263238">
      <span id="cid" data-value="${esc(app.clientId)}">${esc(app.clientId)}</span>
      <button onclick="copyText(document.getElementById('cid'),this)" style="background:#546e7a">העתק</button>
    </div>
    <h3>Client Secret</h3>
    ${app.appType === 'public'
      ? `<p style="color:#78909c;margin:0 0 8px">אפליקציה ציבורית — לא נדרש secret. חובה להשתמש ב-PKCE.</p>` : ''}
    ${secretBlock}
    <h3>כתובת האישור (למה שהכפתור יפנה)</h3>
    <div class="secret" style="background:#eceff1;color:#263238;font-size:.82rem">
      <span id="au" data-value="${esc(authUrl)}">${esc(authUrl)}</span>
      <button onclick="copyText(document.getElementById('au'),this)" style="background:#546e7a">העתק</button>
    </div>
    <p style="margin-top:10px"><a href="/cloud/docs?client_id=${encodeURIComponent(app.clientId)}">📚 תיעוד מלא עם דוגמאות קוד לאפליקציה הזו ←</a></p>
  </div>

  <div class="card">
    <h2>🧪 API Key</h2>
    <p class="sub">לגישת שרת-לשרת ל-API הציבורי (מנוע התרגילים). מכסה: ${stats.quota} קריאות ליום.</p>
    ${keyBlock}
    <pre><span class="c"># דוגמה מהירה</span>
curl <span class="s">"${esc(baseUrl)}/api/v1/exercises?subject=math&amp;level=20&amp;count=5"</span> \\
  -H <span class="s">"X-API-Key: ${esc(app.apiKeyPrefix)}..."</span></pre>
  </div>

  ${storeCard(app, listing)}

  <div class="card">
    <h2>⚙️ הגדרות</h2>
    <form method="post" action="/cloud/apps/${esc(app.id)}/update">
      <label>שם</label><input type="text" name="name" value="${esc(app.name)}" required>
      <label>תיאור</label><input type="text" name="description" value="${esc(app.description || '')}">
      <label>אתר</label><input type="text" name="homepage" dir="ltr" value="${esc(app.homepage || '')}">
      <label>סוג</label>
      <select name="appType">
        <option value="confidential" ${app.appType !== 'public' ? 'selected' : ''}>שרת / Web</option>
        <option value="public" ${app.appType === 'public' ? 'selected' : ''}>נייטיב / SPA (PKCE)</option>
      </select>
      <label>Redirect URIs</label>
      <textarea name="redirectUris" dir="ltr">${esc((app.redirectUris || []).join('\n'))}</textarea>
      <label>הרשאות</label>
      <div class="scopebox">${ALL_SCOPES.map(s => `
        <label><input type="checkbox" name="scopes" value="${esc(s)}" ${(app.scopes || []).includes(s) ? 'checked' : ''}>
        <span>${SCOPES[s].icon} <b>${esc(s)}</b> — ${esc(SCOPES[s].label)}<small>${esc(SCOPES[s].detail)}</small></span></label>`).join('')}
      </div>
      <div class="row" style="margin-top:20px">
        <button class="btn" type="submit">שמירה</button>
        <a class="btn ghost" href="/cloud/apps">חזרה</a>
      </div>
    </form>
  </div>

  <div class="card">
    <h2>📊 פעילות אחרונה</h2>
    <table><tr><th>מתי</th><th>סוג</th><th>פרטים</th></tr>${recent}</table>
  </div>

  <div class="card">
    <h2 style="color:#c62828">אזור מסוכן</h2>
    <form method="post" action="/cloud/apps/${esc(app.id)}/delete"
          onsubmit="return confirm('למחוק לצמיתות את ${esc(app.name)}? כל המשתמשים שהתחברו דרכה יתנתקו.')">
      <button class="btn danger" type="submit">מחיקת האפליקציה</button>
    </form>
  </div>`, { user, active: 'apps', admin, pending });
}

/** The bridge from Cloud to the store: status + a link into the listing form. */
function storeCard(app, listing) {
  if (!listing) {
    return `<div class="card" style="background:linear-gradient(135deg,#ede7f6,#e8eaf6)">
      <h2>🏪 פרסום בחנות Coli — בחינם</h2>
      <p class="sub">האפליקציה הזו עוד לא בחנות. מלאו דף חנות (שם, אייקון, תמונות מסך וקישורי הורדה),
        שלחו לאישור — ומשפחות ימצאו אתכם ב-KidsLearn Coli. אין דמי מפתח ואין עמלות.</p>
      <a class="btn" href="/cloud/apps/${esc(app.id)}/store">פרסום האפליקציה בחנות ←</a>
    </div>`;
  }
  const s = STATUS[listing.status] || STATUS.draft;
  const missing = missingForSubmit(listing);
  return `<div class="card">
    <div class="row">
      <div style="flex:1"><h2 style="margin:0">🏪 חנות Coli</h2></div>
      <span class="pill ${s.pill === 'green' ? 'green' : 'gray'}">${esc(s.label)}</span>
    </div>
    ${listing.status === 'approved'
      ? `<p class="sub" style="margin:10px 0">האפליקציה מפורסמת: <a href="/coli/app/${encodeURIComponent(listing.slug)}">/coli/app/${esc(listing.slug)}</a>
         — ${listing.stats?.opens || 0} פתיחות, ${listing.stats?.views || 0} צפיות.</p>`
      : listing.status === 'pending'
        ? `<p class="sub" style="margin:10px 0">נשלחה לאישור ומחכה לבדיקה ידנית. אין מה לעשות — נעדכן בדף הזה.</p>`
        : listing.status === 'rejected' || listing.status === 'suspended'
          ? `<div class="alert err" style="margin:10px 0">${esc(listing.reviewNote || 'האפליקציה לא אושרה לפרסום.')}</div>`
          : `<p class="sub" style="margin:10px 0">${missing.length
              ? 'טיוטה — חסר עדיין: ' + esc(missing.join(', ')) + '.'
              : 'הטיוטה מוכנה. אפשר לשלוח לאישור.'}</p>`}
    <a class="btn ghost sm" href="/cloud/apps/${esc(app.id)}/store">עריכת דף החנות</a>
  </div>`;
}

// ── Developer documentation ────────────────────────────────────────────────
export function docsPage({ user = null, baseUrl, clientId = 'YOUR_CLIENT_ID' }) {
  const cid = esc(clientId);
  const b = esc(baseUrl);
  const scopeRows = ALL_SCOPES.map(s => `
    <tr><td class="mono">${esc(s)}</td><td>${SCOPES[s].icon} ${esc(SCOPES[s].label)}</td><td style="color:#78909c">${esc(SCOPES[s].detail)}</td></tr>`).join('');
  return layout('תיעוד', `
  <div class="card">
    <h1>☁️ KidsLearn Cloud — תיעוד למפתחים</h1>
    <p class="sub">כל מה שצריך כדי לחבר אפליקציה ל-KidsLearn: התחברות (OAuth 2.0) וגישה ל-API.</p>
    <div class="row">
      <div class="stat"><b>1</b><span>רושמים אפליקציה</span></div>
      <div class="stat"><b>2</b><span>מוסיפים כפתור התחברות</span></div>
      <div class="stat"><b>3</b><span>מחליפים code ב-token</span></div>
    </div>
  </div>

  <div class="card" style="background:linear-gradient(135deg,#ede7f6,#e8eaf6)">
    <h2>🏪 מפרסמים את האפליקציה בחנות Coli</h2>
    <p style="color:#37474f;line-height:1.8;margin:0 0 12px">
      סיימתם לבנות? כל אפליקציה שנרשמה כאן יכולה להתפרסם ב-<b>KidsLearn Coli</b> — חנות האפליקציות
      של KidsLearn. הפרסום <b>חינם</b>: אין דמי מפתח, אין עמלה על הורדות.
      נכנסים לעמוד האפליקציה → "פרסום בחנות Coli" → ממלאים, ושולחים לאישור.
    </p>
    <div class="row">
      <a class="btn" href="/coli/publish">איך מפרסמים ←</a>
      <a class="btn ghost" href="/coli">לחנות</a>
    </div>
  </div>

  <div class="card">
    <h2>נקודות הקצה</h2>
    <table>
      <tr><th>מה</th><th>כתובת</th></tr>
      <tr><td>Discovery</td><td class="mono">GET ${b}/.well-known/kidslearn-configuration</td></tr>
      <tr><td>קטלוג החנות</td><td class="mono">GET ${b}/api/coli/apps</td></tr>
      <tr><td>Authorize</td><td class="mono">GET ${b}/oauth/authorize</td></tr>
      <tr><td>Token</td><td class="mono">POST ${b}/oauth/token</td></tr>
      <tr><td>Userinfo</td><td class="mono">GET ${b}/oauth/userinfo</td></tr>
      <tr><td>Revoke</td><td class="mono">POST ${b}/oauth/revoke</td></tr>
      <tr><td>API ציבורי</td><td class="mono">GET ${b}/api/v1/…</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>שלב 1 — שולחים את המשתמש לאישור</h2>
    <pre><span class="k">GET</span> ${b}/oauth/authorize
  ?client_id=<span class="s">${cid}</span>
  &amp;redirect_uri=<span class="s">http://localhost:5173/callback</span>
  &amp;response_type=<span class="s">code</span>
  &amp;scope=<span class="s">profile children:read</span>
  &amp;state=<span class="s">random123</span>
  &amp;code_challenge=<span class="s">&lt;PKCE, לאפליקציות ציבוריות&gt;</span>
  &amp;code_challenge_method=<span class="s">S256</span></pre>
    <p style="color:#546e7a;line-height:1.7">ההורה רואה מסך אישור בעיצוב KidsLearn, בוחר איזה חשבון מתחבר ומאשר.
    KidsLearn מחזיר אתכם ל-<code>redirect_uri</code> עם <code>?code=…&amp;state=…</code>.
    הקוד תקף ל-10 דקות ולשימוש חד-פעמי.</p>
    <h3>כפתור מוכן להעתקה</h3>
    <pre>&lt;<span class="k">a</span> href=<span class="s">"${b}/oauth/authorize?client_id=${cid}&amp;redirect_uri=…&amp;response_type=code&amp;scope=profile"</span>
   style=<span class="s">"display:inline-flex;gap:8px;align-items:center;background:#5c6bc0;color:#fff;
          padding:12px 22px;border-radius:12px;font-weight:700;text-decoration:none"</span>&gt;
  ⭐ Continue with KidsLearn
&lt;/<span class="k">a</span>&gt;</pre>
  </div>

  <div class="card">
    <h2>שלב 2 — מחליפים code ב-access_token</h2>
    <pre><span class="k">POST</span> ${b}/oauth/token
Content-Type: application/json

{
  <span class="s">"grant_type"</span>: <span class="s">"authorization_code"</span>,
  <span class="s">"code"</span>: <span class="s">"klc_…"</span>,
  <span class="s">"client_id"</span>: <span class="s">"${cid}"</span>,
  <span class="s">"client_secret"</span>: <span class="s">"kls_…"</span>,      <span class="c">// אפליקציית שרת</span>
  <span class="s">"code_verifier"</span>: <span class="s">"…"</span>,          <span class="c">// אפליקציה ציבורית (PKCE)</span>
  <span class="s">"redirect_uri"</span>: <span class="s">"http://localhost:5173/callback"</span>
}

<span class="c">// תשובה</span>
{
  <span class="s">"access_token"</span>: <span class="s">"kla_…"</span>,
  <span class="s">"token_type"</span>: <span class="s">"Bearer"</span>,
  <span class="s">"expires_in"</span>: ${Math.floor(CLOUD_LIMITS.ACCESS_TTL_MS / 1000)},
  <span class="s">"refresh_token"</span>: <span class="s">"klr_…"</span>,
  <span class="s">"scope"</span>: <span class="s">"profile children:read"</span>
}</pre>
    <h3>Node.js</h3>
    <pre><span class="k">const</span> r = <span class="k">await</span> fetch(<span class="s">'${b}/oauth/token'</span>, {
  method: <span class="s">'POST'</span>,
  headers: { <span class="s">'Content-Type'</span>: <span class="s">'application/json'</span> },
  body: JSON.stringify({
    grant_type: <span class="s">'authorization_code'</span>,
    code, client_id: <span class="s">'${cid}'</span>, client_secret: process.env.KIDSLEARN_SECRET,
    redirect_uri: <span class="s">'http://localhost:5173/callback'</span>,
  }),
});
<span class="k">const</span> { access_token } = <span class="k">await</span> r.json();

<span class="k">const</span> me = <span class="k">await</span> fetch(<span class="s">'${b}/oauth/userinfo'</span>, {
  headers: { Authorization: <span class="s">'Bearer ' + access_token</span> },
}).then(x =&gt; x.json());
<span class="c">// { sub, email, name, scopes }</span></pre>
    <p style="color:#546e7a">חידוש: <code>grant_type=refresh_token</code> עם <code>refresh_token</code>
    (תקף ${Math.round(CLOUD_LIMITS.REFRESH_TTL_MS / 86400000)} ימים, מתחלף בכל שימוש).</p>
  </div>

  <div class="card">
    <h2>שלב 3 — קוראים נתונים בשם המשתמש</h2>
    <table>
      <tr><th>כתובת</th><th>scope נדרש</th><th>מחזיר</th></tr>
      <tr><td class="mono">GET /oauth/userinfo</td><td class="mono">profile</td><td>מזהה, אימייל ושם</td></tr>
      <tr><td class="mono">GET /api/v1/children</td><td class="mono">children:read</td><td>רשימת הילדים ורמות</td></tr>
      <tr><td class="mono">GET /api/v1/children/:id/progress</td><td class="mono">progress:read</td><td>סטטיסטיקות והתקדמות</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>🧪 API Key — מנוע התרגילים</h2>
    <p class="sub">בלי משתמש בכלל: שלחו <code>X-API-Key</code> וקבלו תרגילים מוכנים.</p>
    <table>
      <tr><th>כתובת</th><th>מה זה עושה</th></tr>
      <tr><td class="mono">GET /api/v1/ping</td><td>בדיקת מפתח + מכסה שנותרה</td></tr>
      <tr><td class="mono">GET /api/v1/catalog</td><td>מקצועות, רמות, שלבים ונושאים</td></tr>
      <tr><td class="mono">GET /api/v1/exercises</td><td>יצירת תרגילים</td></tr>
    </table>
    <h3>פרמטרים של /api/v1/exercises</h3>
    <table>
      <tr><th>פרמטר</th><th>ערכים</th><th>ברירת מחדל</th></tr>
      <tr><td class="mono">subject</td><td>math · hebrew · english</td><td>math</td></tr>
      <tr><td class="mono">level</td><td>10…100 (תקרת חיבור/חיסור בחשבון)</td><td>—</td></tr>
      <tr><td class="mono">stage</td><td>1…8 (אנגלית / עברית / מסלול הכנה)</td><td>1</td></tr>
      <tr><td class="mono">track</td><td>gan_to_a · a_to_b</td><td>—</td></tr>
      <tr><td class="mono">op</td><td>mix · add · sub</td><td>mix</td></tr>
      <tr><td class="mono">topic</td><td>מזהה נושא מ-/catalog (למשל clock)</td><td>—</td></tr>
      <tr><td class="mono">count</td><td>1…50</td><td>10</td></tr>
    </table>
    <pre>curl <span class="s">"${b}/api/v1/exercises?subject=english&amp;stage=3&amp;count=8"</span> \\
  -H <span class="s">"X-API-Key: klapi_…"</span>

<span class="c">// { ok: true, subject: "english", count: 8, exercises: [ { question, answer, type, ... } ] }</span></pre>
    <p style="color:#546e7a">מכסה: ${CLOUD_LIMITS.DEFAULT_DAILY_QUOTA} קריאות ליום לכל מפתח.
    כל תשובה כוללת <code>X-RateLimit-Remaining</code>. חריגה מחזירה <code>429</code>.</p>
  </div>

  <div class="card">
    <h2>הרשאות (scopes)</h2>
    <table><tr><th>scope</th><th>מה זה נותן</th><th>הערות</th></tr>${scopeRows}</table>
    <div class="alert warn" style="margin-top:14px">
      🔒 סיסמאות של משפחות <b>לעולם</b> לא עוברות לאפליקציה שלכם. ההורה מאשר במסך של KidsLearn בלבד,
      ואפשר לבטל גישה בכל רגע ב-<code>POST /oauth/revoke</code>.
    </div>
  </div>

  <div class="card">
    <h2>שגיאות</h2>
    <table>
      <tr><th>קוד</th><th>מתי</th></tr>
      <tr><td class="mono">400 invalid_request</td><td>חסר פרמטר חובה</td></tr>
      <tr><td class="mono">401 invalid_client</td><td>client_id/secret או API key שגויים</td></tr>
      <tr><td class="mono">400 invalid_grant</td><td>code/refresh_token פג, שומש כבר, או PKCE לא תואם</td></tr>
      <tr><td class="mono">403 insufficient_scope</td><td>לאסימון אין את ה-scope הנדרש</td></tr>
      <tr><td class="mono">429</td><td>חריגה מהמכסה היומית</td></tr>
    </table>
  </div>`, { user, active: 'docs' });
}

// ── OAuth consent screen (what the parent sees) ────────────────────────────
export function consentPage({ app, accounts, deviceEmail, reqId, scopes, error = '', needsPassword }) {
  const accountCards = accounts.map(a => `
    <label style="display:flex;align-items:center;gap:10px;border:2px solid ${a.email === deviceEmail ? BRAND : '#e0e0e0'};border-radius:14px;padding:10px 14px;margin:6px 0;cursor:pointer">
      <input type="radio" name="accountEmail" value="${esc(a.email)}" ${a.email === deviceEmail ? 'checked' : ''} style="width:18px;height:18px;accent-color:${BRAND};flex:none">
      <span style="flex:1"><b>${esc(a.name || a.email.split('@')[0])}</b><br>
      <span dir="ltr" style="color:#90a4ae;font-size:.85rem">${esc(a.email)}</span></span>
    </label>`).join('');

  const scopeList = scopes.map(s => `
    <div style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;text-align:right">
      <div style="font-size:1.3rem;line-height:1.2">${SCOPES[s].icon}</div>
      <div><b style="color:#37474f">${esc(SCOPES[s].label)}</b>
      <div style="color:#90a4ae;font-size:.86rem">${esc(SCOPES[s].detail)}</div></div>
    </div>`).join('');

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KidsLearn — אישור התחברות</title><style>${CSS}
body{background:linear-gradient(135deg,#6a5acd,#3949ab);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{background:#fff;border-radius:24px;padding:34px 36px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}
</style></head><body>
<div class="box">
  <div style="font-size:52px;line-height:1">⭐</div>
  <h1 style="margin:6px 0 2px;color:${BRAND};letter-spacing:2px">KidsLearn</h1>
  <p style="color:#546e7a;line-height:1.6;margin:14px 0">
    <b>${esc(app.name)}</b> מבקשת להתחבר עם חשבון KidsLearn שלכם.
    ${app.homepage ? `<br><a href="${esc(app.homepage)}" dir="ltr" style="font-size:.85rem">${esc(app.homepage)}</a>` : ''}
  </p>
  ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
  <div style="background:#f8f9fc;border-radius:14px;padding:12px 16px;margin:14px 0">
    <div style="font-weight:800;color:${BRAND};margin-bottom:4px;text-align:right">האפליקציה תקבל:</div>
    ${scopeList}
  </div>
  <form method="post" action="/oauth/authorize/decide">
    <input type="hidden" name="reqId" value="${esc(reqId)}">
    ${needsPassword ? `
      <div style="text-align:right">
        <label>אימייל</label><input type="email" name="accountEmail" dir="ltr" required placeholder="you@example.com">
        <label>סיסמה</label><input type="password" name="password" required>
      </div>`
    : `<div style="font-weight:800;color:${BRAND};margin:12px 0 4px;text-align:right">מי מתחבר?</div>${accountCards}`}
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn green" type="submit" name="decision" value="allow" style="flex:1">✓ מאשר</button>
      <button class="btn ghost" type="submit" name="decision" value="deny" style="flex:1">ביטול</button>
    </div>
  </form>
  <p style="color:#b0bec5;font-size:.8rem;margin-top:16px;line-height:1.5">
    🔒 הסיסמה שלכם לעולם לא נמסרת ל-${esc(app.name)}.<br>אפשר לבטל את הגישה בכל רגע מתוך KidsLearn.
  </p>
</div></body></html>`;
}

/** Out-of-band flow (desktop/CLI apps): show the code for copy-paste. */
export function oobCodePage({ app, code }) {
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KidsLearn — קוד אישור</title><style>${CSS}
body{background:linear-gradient(135deg,#6a5acd,#3949ab);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{background:#fff;border-radius:24px;padding:34px 36px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}
</style></head><body>
<div class="box">
  <div style="font-size:52px">✅</div>
  <h1 style="color:${BRAND};margin:8px 0">אושר!</h1>
  <p style="color:#546e7a">העתיקו את הקוד והדביקו ב-<b>${esc(app.name)}</b>:</p>
  <div class="secret"><span id="c" data-value="${esc(code)}">${esc(code)}</span>
  <button onclick="copyText(document.getElementById('c'),this)">העתק</button></div>
  <p style="color:#90a4ae;font-size:.85rem;margin-top:14px">הקוד תקף ל-10 דקות ולשימוש חד-פעמי.</p>
</div>
<script>
function copyText(el, btn){var t=el.getAttribute('data-value');
 (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject())
  .then(function(){btn.textContent='✓ הועתק';},function(){});}
</script></body></html>`;
}

/** A dead-end error page for OAuth requests we can't safely redirect back. */
export function oauthErrorPage(title, detail) {
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KidsLearn — שגיאה</title><style>${CSS}
body{background:linear-gradient(135deg,#455a64,#263238);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{background:#fff;border-radius:24px;padding:34px 36px;max-width:460px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)}
</style></head><body>
<div class="box"><div style="font-size:52px">😕</div>
<h1 style="color:#c62828;font-size:1.3rem">${esc(title)}</h1>
<p style="color:#546e7a;line-height:1.6">${esc(detail)}</p>
<p style="margin-top:16px"><a href="/cloud/docs">📚 תיעוד KidsLearn Cloud</a></p>
</div></body></html>`;
}
