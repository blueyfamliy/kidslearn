// KidsLearn Coli — the storefront itself. Server-rendered HTML with no build
// step and no dependencies, exactly like the Cloud console, so the store works
// inside the packaged desktop app and in a plain browser tab alike.
import { esc } from './cloudConsole.js';
import { CATEGORIES, AGES, PLATFORMS, PLEDGES } from './coli.js';

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f6fb;color:#263238}
a{color:#5e35b1;text-decoration:none}
header.top{background:linear-gradient(135deg,#5e35b1,#3949ab 60%,#1e88e5);color:#fff;padding:16px 22px}
header.top .bar{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header.top .logo{font-size:1.5rem;font-weight:900;letter-spacing:.5px;color:#fff;display:flex;align-items:center;gap:9px}
header.top .logo small{font-weight:500;opacity:.8;font-size:.78rem;letter-spacing:2px}
header.top nav{margin-inline-start:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
header.top nav a{background:rgba(255,255,255,.16);color:#fff;border-radius:999px;padding:8px 15px;font-weight:700;font-size:.9rem}
header.top nav a:hover{background:rgba(255,255,255,.3)}
header.top nav a.cta{background:#ffca28;color:#4e342e}
form.search{max-width:1080px;margin:14px auto 0;display:flex;gap:8px}
form.search input{flex:1;border:none;border-radius:14px;padding:13px 16px;font-size:1rem;font-family:inherit}
form.search button{border:none;border-radius:14px;padding:0 22px;font-weight:800;font-size:1rem;cursor:pointer;background:#ffca28;color:#4e342e}
.wrap{max-width:1080px;margin:24px auto 70px;padding:0 18px}
h1{margin:0 0 6px;font-size:1.9rem}
h2{margin:26px 0 12px;font-size:1.25rem;color:#311b92}
p.sub{color:#78909c;margin:0 0 16px;line-height:1.7}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.chip{background:#fff;border:2px solid #e6e9f5;border-radius:999px;padding:8px 15px;font-weight:700;font-size:.9rem;color:#455a64}
.chip:hover{border-color:#7e57c2}
.chip.on{background:#5e35b1;border-color:#5e35b1;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.app{display:flex;flex-direction:column;background:#fff;border-radius:20px;padding:18px;box-shadow:0 6px 20px rgba(49,27,146,.07);color:inherit;transition:.15s;border:2px solid transparent}
.app:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(49,27,146,.16);border-color:#d1c4e9}
.app .head{display:flex;gap:12px;align-items:center}
.icon{width:58px;height:58px;border-radius:16px;background:linear-gradient(135deg,#ede7f6,#e3f2fd);display:flex;align-items:center;justify-content:center;font-size:2rem;flex:none;overflow:hidden}
.icon img{width:100%;height:100%;object-fit:cover}
.app b{font-size:1.06rem;display:block;line-height:1.3}
.app .by{color:#90a4ae;font-size:.82rem}
.app p{color:#546e7a;font-size:.92rem;line-height:1.6;margin:12px 0 0;flex:1}
.meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center}
.tag{background:#ede7f6;color:#5e35b1;border-radius:999px;padding:3px 10px;font-size:.76rem;font-weight:800}
.tag.free{background:#e8f5e9;color:#2e7d32}
.tag.gray{background:#eceff1;color:#607d8b}
.tag.star{background:#fff8e1;color:#f57f17}
.card{background:#fff;border-radius:20px;padding:22px 24px;box-shadow:0 6px 20px rgba(49,27,146,.07);margin-bottom:18px}
.hero{background:linear-gradient(135deg,#ede7f6,#e3f2fd);border-radius:22px;padding:26px;margin-bottom:22px}
.hero h1{font-size:2rem;color:#311b92}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.stats div{background:rgba(255,255,255,.75);border-radius:14px;padding:10px 18px;font-weight:800;color:#311b92}
.stats span{display:block;font-weight:500;color:#7e57c2;font-size:.8rem}
.btn{display:inline-block;background:linear-gradient(135deg,#5e35b1,#3949ab);color:#fff;border:none;border-radius:14px;padding:13px 26px;font-size:1rem;font-weight:800;cursor:pointer}
.btn.ghost{background:#eceff1;color:#37474f}
.btn.gold{background:linear-gradient(135deg,#ffca28,#ffa000);color:#4e342e}
.btn.sm{padding:9px 18px;font-size:.9rem;border-radius:11px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.shots{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
.shots img{height:260px;border-radius:16px;border:1px solid #e0e0e0;flex:none}
.pledge{display:flex;align-items:center;gap:8px;background:#f1f8e9;color:#33691e;border-radius:12px;padding:9px 14px;font-weight:700;font-size:.9rem}
.desc{white-space:pre-wrap;line-height:1.85;color:#37474f}
.empty{background:#fff;border-radius:20px;padding:40px 24px;text-align:center;color:#78909c}
footer{max-width:1080px;margin:0 auto;padding:26px 18px 50px;color:#90a4ae;font-size:.88rem;line-height:1.8}
@media(max-width:600px){.wrap{margin-top:16px}.shots img{height:180px}h1{font-size:1.5rem}}
`;

function layout(title, body, { q = '', nav = '' } = {}) {
  return `<!doctype html><html dir="rtl" lang="he"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — KidsLearn Coli</title><style>${CSS}</style></head><body>
<header class="top">
  <div class="bar">
    <a class="logo" href="/coli">🏪 KidsLearn <span style="color:#ffca28">Coli</span><small>חנות האפליקציות</small></a>
    <nav>
      <a href="/coli">בית</a>
      <a href="/coli/kids">לפי גיל</a>
      <a class="cta" href="/coli/publish">פרסמו אפליקציה — בחינם</a>
      ${nav}
    </nav>
  </div>
  <form class="search" action="/coli/search" method="get">
    <input type="search" name="q" value="${esc(q)}" placeholder="חיפוש אפליקציה, קטגוריה או מפרסם…">
    <button type="submit">חיפוש</button>
  </form>
</header>
<div class="wrap">${body}</div>
<footer>
  KidsLearn Coli — כל אפליקציה נבדקת ידנית לפני שהיא מגיעה לילדים.
  ההעלאה מתבצעת דרך <a href="/cloud">KidsLearn Cloud</a> והיא <b>חינמית לחלוטין</b>: בלי דמי מפתח, בלי עמלות.
</footer>
</body></html>`;
}

const ageLabels = (ages) => (ages || []).map(a => AGES[a] || a).join(' · ');

function appCard(a) {
  const iconBox = a.icon
    ? `<div class="icon"><img src="${esc(a.icon)}" alt=""></div>`
    : `<div class="icon">${esc(a.emoji)}</div>`;
  return `<a class="app" href="/coli/app/${encodeURIComponent(a.slug)}">
    <div class="head">${iconBox}
      <div><b>${esc(a.name)}</b><span class="by">${esc(a.publisher || '')}</span></div>
    </div>
    <p>${esc(a.tagline || (a.description || '').slice(0, 90))}</p>
    <div class="meta">
      <span class="tag ${a.free ? 'free' : 'gray'}">${esc(a.price)}</span>
      <span class="tag">${esc(CATEGORIES[a.category]?.icon || '')} ${esc(a.categoryLabel)}</span>
      ${a.featured ? '<span class="tag star">⭐ מומלץ</span>' : ''}
      ${(a.ages || []).length ? `<span class="tag gray">${esc((a.ages || []).join(', '))}</span>` : ''}
    </div>
  </a>`;
}

const gridOf = (apps, emptyText) => apps.length
  ? `<div class="grid">${apps.map(appCard).join('')}</div>`
  : `<div class="empty">${esc(emptyText)}</div>`;

function categoryChips(cats, active = '') {
  return `<div class="chips">
    <a class="chip ${active ? '' : 'on'}" href="/coli">הכול</a>
    ${cats.map(c => `<a class="chip ${active === c.key ? 'on' : ''}" href="/coli/category/${esc(c.key)}">
      ${esc(c.icon)} ${esc(c.label)}${c.count ? ` <span style="opacity:.6">${c.count}</span>` : ''}</a>`).join('')}
  </div>`;
}

// ── Home ───────────────────────────────────────────────────────────────────
export function homePage({ stats, cats, featured, newest, popular }) {
  return layout('חנות האפליקציות', `
  <div class="hero">
    <h1>🏪 חנות האפליקציות של KidsLearn</h1>
    <p class="sub" style="margin:0;font-size:1.05rem">
      אפליקציות לימוד ומשחקים לילדים — כל אחת נבדקה ידנית: בלי פרסומות מפחידות, בלי צ׳אטים עם זרים.
      בונים אפליקציה? <a href="/coli/publish"><b>פרסמו אותה כאן בחינם</b></a>.
    </p>
    <div class="stats">
      <div>${stats.apps}<span>אפליקציות בחנות</span></div>
      <div>${stats.developers}<span>מפתחים</span></div>
      <div>${stats.opens}<span>פתיחות</span></div>
      <div>0 ₪<span>עלות פרסום</span></div>
    </div>
  </div>
  ${categoryChips(cats)}
  ${featured.length ? `<h2>⭐ מומלצים</h2>${gridOf(featured, '')}` : ''}
  <h2>🆕 חדש בחנות</h2>
  ${gridOf(newest, 'עוד אין אפליקציות בחנות. האפליקציה הראשונה יכולה להיות שלכם — הפרסום חינם.')}
  ${popular.length ? `<h2>🔥 הכי נפתחות</h2>${gridOf(popular, '')}` : ''}
  <div class="card" style="margin-top:26px;background:linear-gradient(135deg,#fff8e1,#ffecb3)">
    <h2 style="margin-top:0">רוצים להעלות אפליקציה?</h2>
    <p class="sub">ההעלאה מתבצעת מתוך <b>KidsLearn Cloud</b> — אותה קונסולה שבה מקבלים Client ID ו-API Key.
      אין דמי מפתח, אין עמלות, אין הגבלת הורדות.</p>
    <a class="btn gold" href="/coli/publish">איך מעלים? →</a>
  </div>`, {});
}

// ── Browse / search / category ─────────────────────────────────────────────
export function browsePage({ title, subtitle = '', apps, cats, mode = 'category', active = '', q = '' }) {
  const ageChips = `<div class="chips">
    <a class="chip ${active ? '' : 'on'}" href="/coli/kids">כל הגילים</a>
    ${Object.entries(AGES).map(([k, label]) =>
      `<a class="chip ${active === k ? 'on' : ''}" href="/coli/kids?age=${encodeURIComponent(k)}">${esc(label)}</a>`).join('')}
  </div>`;
  return layout(title, `
  <h1>${esc(title)}</h1>
  ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
  ${mode === 'age' ? ageChips : categoryChips(cats, active)}
  ${gridOf(apps, 'לא נמצאו אפליקציות מתאימות.')}`, { q });
}

// ── One app ────────────────────────────────────────────────────────────────
export function listingPage({ app, related }) {
  const iconBox = app.icon
    ? `<div class="icon" style="width:96px;height:96px;border-radius:24px;font-size:3rem"><img src="${esc(app.icon)}" alt=""></div>`
    : `<div class="icon" style="width:96px;height:96px;border-radius:24px;font-size:3rem">${esc(app.emoji)}</div>`;

  const buttons = (app.platforms || []).map(p => `
    <a class="btn ${p === 'source' ? 'ghost' : ''}" rel="noopener noreferrer" target="_blank"
       href="/coli/open/${encodeURIComponent(app.slug)}/${esc(p)}">
      ${esc(PLATFORMS[p]?.icon || '')} ${esc(PLATFORMS[p]?.label || p)}
    </a>`).join('');

  const shots = (app.screenshots || []).length
    ? `<div class="card"><h2 style="margin-top:0">תמונות מסך</h2>
       <div class="shots">${app.screenshots.map(s => `<img src="${esc(s)}" alt="">`).join('')}</div></div>`
    : '';

  const pledges = (app.pledges || []).length
    ? `<div class="card"><h2 style="margin-top:0">🛡️ ההצהרה של המפרסם</h2>
       <div class="row">${app.pledges.map(p =>
         `<div class="pledge">${esc(PLEDGES[p].icon)} ${esc(PLEDGES[p].label)}</div>`).join('')}</div>
       <p class="sub" style="margin:12px 0 0;font-size:.85rem">ההצהרה ניתנה על ידי המפרסם ונבדקה בעת אישור האפליקציה.</p></div>`
    : '';

  return layout(app.name, `
  <div class="card">
    <div class="row" style="align-items:flex-start;gap:18px">
      ${iconBox}
      <div style="flex:1;min-width:220px">
        <h1 style="margin-bottom:2px">${esc(app.name)}</h1>
        <div class="by" style="color:#90a4ae;font-size:.95rem">${esc(app.publisher || '')}</div>
        <p class="sub" style="margin:10px 0 0">${esc(app.tagline || '')}</p>
        <div class="meta">
          <span class="tag ${app.free ? 'free' : 'gray'}">${esc(app.price)}</span>
          <span class="tag">${esc(CATEGORIES[app.category]?.icon || '')} ${esc(app.categoryLabel)}</span>
          ${app.version ? `<span class="tag gray">גרסה ${esc(app.version)}</span>` : ''}
          ${(app.ages || []).length ? `<span class="tag gray">${esc(ageLabels(app.ages))}</span>` : ''}
          ${app.featured ? '<span class="tag star">⭐ מומלץ</span>' : ''}
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:20px">${buttons || '<span class="sub">אין כרגע קישור פעיל.</span>'}</div>
  </div>
  ${shots}
  <div class="card">
    <h2 style="margin-top:0">על האפליקציה</h2>
    <div class="desc">${esc(app.description || '')}</div>
    ${app.changelog ? `<h2>מה חדש${app.version ? ` בגרסה ${esc(app.version)}` : ''}</h2><div class="desc">${esc(app.changelog)}</div>` : ''}
  </div>
  ${pledges}
  <div class="card">
    <h2 style="margin-top:0">פרטים</h2>
    <div class="row" style="gap:26px;color:#546e7a">
      <div><b style="display:block;color:#311b92">${app.stats.opens}</b>פתיחות</div>
      <div><b style="display:block;color:#311b92">${app.stats.views}</b>צפיות</div>
      <div><b style="display:block;color:#311b92">${esc((app.publishedAt || '').slice(0, 10) || '—')}</b>פורסם</div>
      <div><b style="display:block;color:#311b92">${esc((app.updatedAt || '').slice(0, 10) || '—')}</b>עודכן</div>
    </div>
  </div>
  ${related.length ? `<h2>עוד ב${esc(app.categoryLabel)}</h2>${gridOf(related, '')}` : ''}`, {});
}

// ── How to publish (free) ──────────────────────────────────────────────────
export function publishPage({ stats, baseUrl }) {
  const step = (n, title, body) => `
    <div class="card" style="display:flex;gap:16px;align-items:flex-start">
      <div class="icon" style="width:44px;height:44px;border-radius:14px;font-size:1.3rem;font-weight:900;color:#5e35b1">${n}</div>
      <div style="flex:1"><h2 style="margin:0 0 6px">${title}</h2><div class="sub" style="margin:0">${body}</div></div>
    </div>`;
  return layout('פרסום אפליקציה', `
  <div class="hero">
    <h1>פרסום אפליקציה ב-Coli — חינם</h1>
    <p class="sub" style="margin:0;font-size:1.05rem">
      בלי דמי מפתח שנתיים, בלי עמלה על הורדות, בלי הגבלה על מספר האפליקציות.
      כל מה שצריך זה חשבון KidsLearn — ההעלאה עצמה נעשית מתוך <b>KidsLearn Cloud</b>.
    </p>
    <div class="row" style="margin-top:18px">
      <a class="btn gold" href="/cloud/apps">☁️ פתחו את KidsLearn Cloud</a>
      <a class="btn ghost" href="/cloud/docs">📚 תיעוד למפתחים</a>
    </div>
  </div>
  ${step(1, 'נכנסים ל-KidsLearn Cloud', 'הקונסולה נמצאת בכתובת <code>' + esc(baseUrl) + '/cloud</code>. נכנסים עם חשבון KidsLearn רגיל — אותו אימייל וסיסמה של האפליקציה המשפחתית.')}
  ${step(2, 'יוצרים אפליקציה', 'לוחצים על "אפליקציה חדשה" ומקבלים <b>Client ID</b>, <b>Client Secret</b> ו-<b>API Key</b> — כדי שהאפליקציה שלכם תוכל להציע "התחברות עם KidsLearn" ולהשתמש במנוע התרגילים.')}
  ${step(3, 'ממלאים את דף החנות', 'בעמוד האפליקציה יש כרטיס <b>"פרסום בחנות Coli"</b>: שם, תיאור, אייקון, תמונות מסך, קטגוריה, גיל מתאים וקישורי הורדה (אתר, APK, Windows, Mac, iOS).')}
  ${step(4, 'מצהירים על בטיחות לילדים', 'מסמנים מה נכון לאפליקציה: בלי פרסומות, בלי רכישות, בלי צ׳אט עם זרים, בלי איסוף מידע אישי. ההצהרה מוצגת להורים בדף האפליקציה.')}
  ${step(5, 'שולחים לאישור', 'לוחצים "שליחה לאישור". אדם אמיתי עובר על האפליקציה ומאשר — ומאותו רגע היא מופיעה כאן בחנות. עדכון של אפליקציה מפורסמת עובר בדיקה חוזרת.')}
  <div class="card" style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9)">
    <h2 style="margin-top:0">כמה זה עולה?</h2>
    <p class="sub" style="margin:0">
      <b style="font-size:1.4rem;color:#2e7d32">0 ₪</b> — הפרסום, האחסון של האייקון והתמונות, וההופעה בחנות. אין עמלות.
      אם האפליקציה שלכם עצמה בתשלום, אפשר לציין את המחיר בדף — התשלום מתבצע אצלכם, לא דרכנו.
    </p>
  </div>
  <div class="card">
    <h2 style="margin-top:0">מה נבדק לפני אישור</h2>
    <p class="sub" style="margin:0">
      ✔ התוכן מתאים לגיל שהוגדר &nbsp;·&nbsp; ✔ הקישורים עובדים ומובילים למה שהובטח &nbsp;·&nbsp;
      ✔ אין פרסומות לא מתאימות &nbsp;·&nbsp; ✔ אין איסוף מידע אישי מילדים בלי הסכמת הורה &nbsp;·&nbsp;
      ✔ ההצהרה תואמת למציאות
    </p>
  </div>
  <div class="card">
    <h2 style="margin-top:0">ל-API של החנות</h2>
    <p class="sub">רשימת האפליקציות זמינה גם כ-JSON, בלי מפתח:</p>
    <pre style="background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;overflow-x:auto;direction:ltr;text-align:left">GET ${esc(baseUrl)}/api/coli/apps
GET ${esc(baseUrl)}/api/coli/apps/:slug
GET ${esc(baseUrl)}/api/coli/categories</pre>
    <p class="sub" style="margin:0">כרגע בחנות ${stats.apps} אפליקציות מ-${stats.developers} מפתחים.</p>
  </div>`, {});
}

export function coliErrorPage(title, detail = '') {
  return layout(title, `
  <div class="empty">
    <h1 style="color:#311b92">${esc(title)}</h1>
    <p class="sub">${esc(detail)}</p>
    <a class="btn" href="/coli">חזרה לחנות</a>
  </div>`, {});
}
