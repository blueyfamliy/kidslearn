// KidsLearn Coli — the publisher side, rendered inside the Cloud console.
//
// Uploading to the store happens here, in the same console that hands out the
// client_id: a developer never has to keep a second account or find another
// website. This file holds two screens — the listing form (for the developer)
// and the review queue (for whoever guards what reaches the children).
import { consoleLayout, esc } from './cloudConsole.js';
import {
  CATEGORIES, CATEGORY_KEYS, AGES, AGE_KEYS, PLATFORMS, PLATFORM_KEYS,
  PLEDGES, PLEDGE_KEYS, STATUS, COLI_LIMITS, missingForSubmit,
} from './coli.js';

const KB = Math.round(COLI_LIMITS.MAX_IMAGE_BYTES / 1024);

// Turns the two <input type=file> pickers into base64 fields on submit, so the
// whole listing (artwork included) posts as one ordinary form — no upload
// endpoint, no multipart dependency.
const UPLOAD_JS = `
<script>
(function(){
  var form = document.getElementById('storeForm');
  if (!form) return;
  var MAX = ${COLI_LIMITS.MAX_IMAGE_BYTES}, MAX_SHOTS = ${COLI_LIMITS.MAX_SHOTS};
  function read(file){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){ res(r.result); };
      r.onerror = function(){ rej(new Error('read')); };
      r.readAsDataURL(file);
    });
  }
  function tooBig(files){
    for (var i = 0; i < files.length; i++) if (files[i].size > MAX) return files[i].name;
    return '';
  }
  form.addEventListener('submit', function(ev){
    if (form.dataset.ready === '1') return;
    var iconEl = document.getElementById('iconPick');
    var shotEl = document.getElementById('shotPick');
    var iconFiles = iconEl ? iconEl.files : [];
    var shotFiles = shotEl ? shotEl.files : [];
    if (!iconFiles.length && !shotFiles.length) return;   // nothing to encode
    ev.preventDefault();
    var big = tooBig(iconFiles) || tooBig(shotFiles);
    if (big) { alert('הקובץ "' + big + '" גדול מ-${KB}KB. כדאי להקטין אותו.'); return; }
    var jobs = [];
    if (iconFiles.length) jobs.push(read(iconFiles[0]).then(function(d){ document.getElementById('iconData').value = d; }));
    for (var i = 0; i < shotFiles.length && i < MAX_SHOTS; i++) {
      jobs.push(read(shotFiles[i]).then(function(d){
        var h = document.createElement('input');
        h.type = 'hidden'; h.name = 'shots'; h.value = d;
        form.appendChild(h);
      }));
    }
    Promise.all(jobs).then(function(){
      if (iconEl) iconEl.value = '';
      if (shotEl) shotEl.value = '';
      form.dataset.ready = '1';
      form.submit();
    }, function(){ alert('קריאת הקובץ נכשלה. נסו קובץ אחר.'); });
  });
})();
</script>`;

function statusBanner(listing) {
  if (!listing) return '';
  const s = STATUS[listing.status] || STATUS.draft;
  if (listing.status === 'approved') {
    return `<div class="alert ok">✅ האפליקציה מפורסמת בחנות —
      <a href="/coli/app/${encodeURIComponent(listing.slug)}">צפייה בדף החנות</a>.
      כל עריכה תחזיר אותה לבדיקה קצרה לפני שהיא מתעדכנת.</div>`;
  }
  if (listing.status === 'pending') {
    return `<div class="alert warn">⏳ נשלחה לאישור — אדם עובר על האפליקציה לפני שהיא מגיעה לילדים.</div>`;
  }
  if (listing.status === 'rejected' || listing.status === 'suspended') {
    return `<div class="alert err">⛔ ${esc(s.label)}${listing.reviewNote ? ' — ' + esc(listing.reviewNote) : ''}
      <br><span style="font-weight:500">תקנו את מה שנכתב ושלחו שוב לאישור.</span></div>`;
  }
  return '';
}

// ── The listing form ───────────────────────────────────────────────────────
export function storeFormPage({ user, app, listing, error = '', flash = '', admin = false, pending = 0 }) {
  const l = listing || {};
  const has = (arr, v) => (arr || []).includes(v);
  const missing = listing ? missingForSubmit(listing) : ['הטופס עוד לא נשמר'];
  const ready = listing && !missing.length;

  const ageBoxes = AGE_KEYS.map(k => `
    <label><input type="checkbox" name="ages" value="${esc(k)}" ${has(l.ages, k) ? 'checked' : ''}>
      <span><b>${esc(AGES[k])}</b></span></label>`).join('');

  const pledgeBoxes = PLEDGE_KEYS.map(k => `
    <label><input type="checkbox" name="pledge_${esc(k)}" value="1" ${has(l.pledges, k) ? 'checked' : ''}>
      <span>${esc(PLEDGES[k].icon)} <b>${esc(PLEDGES[k].label)}</b></span></label>`).join('');

  const linkRows = PLATFORM_KEYS.map(k => `
    <label>${esc(PLATFORMS[k].icon)} ${esc(PLATFORMS[k].label)}</label>
    <input type="text" dir="ltr" name="link_${esc(k)}" value="${esc((l.links || {})[k] || '')}"
           placeholder="${esc(PLATFORMS[k].hint)}">`).join('');

  const shotList = (l.shots || []).length ? `
    <div class="row" style="margin-top:10px">
      ${(l.shots || []).map(f => `
        <div style="text-align:center">
          <img src="/coli/media/${esc(f)}" alt="" style="height:120px;border-radius:10px;border:1px solid #dfe4ee;display:block">
          <label style="font-weight:600;font-size:.82rem;color:#c62828;margin-top:4px">
            <input type="checkbox" name="dropShots" value="${esc(f)}" style="width:auto"> הסרה
          </label>
        </div>`).join('')}
    </div>` : '<small class="hint">עוד לא הועלו תמונות מסך.</small>';

  const iconPreview = l.iconFile ? `
    <div class="row" style="margin-top:8px">
      <img src="/coli/media/${esc(l.iconFile)}" alt="" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:1px solid #dfe4ee">
      <label style="font-weight:600;font-size:.85rem;color:#c62828;margin:0">
        <input type="checkbox" name="dropIcon" value="1" style="width:auto"> הסרת האייקון
      </label>
    </div>` : '';

  return consoleLayout(`פרסום — ${app.name}`, `
  ${flash ? `<div class="alert ok">${esc(flash)}</div>` : ''}
  ${error ? `<div class="alert err">${esc(error)}</div>` : ''}
  ${statusBanner(listing)}

  <div class="card">
    <div class="row">
      <div style="flex:1">
        <h1>🏪 פרסום ב-KidsLearn Coli</h1>
        <p class="sub" style="margin:0">${esc(app.name)} · הפרסום, האחסון והופעה בחנות — <b>בחינם</b>, בלי עמלות.</p>
      </div>
      <a class="btn ghost sm" href="/cloud/apps/${esc(app.id)}">חזרה לאפליקציה</a>
    </div>
  </div>

  <form method="post" id="storeForm" action="/cloud/apps/${esc(app.id)}/store">
    <div class="card">
      <h2>הכרטיס בחנות</h2>
      <label>שם האפליקציה</label>
      <input type="text" name="name" required maxlength="60" value="${esc(l.name || app.name)}">
      <label>משפט אחד שמסביר מה זה</label>
      <input type="text" name="tagline" maxlength="90" value="${esc(l.tagline || '')}" placeholder="לומדים לוח הכפל תוך כדי משחק חלל">
      <label>שם המפרסם (מה שההורים יראו)</label>
      <input type="text" name="publisher" maxlength="60" value="${esc(l.publisher || user.name || '')}" placeholder="דין ומשפחה / חברת X">
      <small class="hint">האימייל שלכם לעולם לא מוצג בחנות.</small>
      <label>תיאור מלא</label>
      <textarea name="description" maxlength="3000" style="min-height:150px"
        placeholder="מה האפליקציה עושה, למי היא מתאימה, ומה הילד לומד ממנה.">${esc(l.description || '')}</textarea>
    </div>

    <div class="card">
      <h2>אייקון ותמונות מסך</h2>
      <label>אימוג׳י (מוצג אם אין אייקון)</label>
      <input type="text" name="emoji" maxlength="8" style="width:90px;text-align:center;font-size:1.4rem" value="${esc(l.emoji || '')}" placeholder="🚀">
      <label>אייקון — PNG / JPG / WEBP, עד ${KB}KB</label>
      <input type="file" id="iconPick" accept="image/png,image/jpeg,image/webp,image/gif">
      <input type="hidden" name="icon" id="iconData">
      ${iconPreview}
      <label>תמונות מסך (עד ${COLI_LIMITS.MAX_SHOTS})</label>
      <input type="file" id="shotPick" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
      ${shotList}
    </div>

    <div class="card">
      <h2>סיווג</h2>
      <label>קטגוריה</label>
      <select name="category">
        ${CATEGORY_KEYS.map(k => `<option value="${esc(k)}" ${l.category === k ? 'selected' : ''}>
          ${esc(CATEGORIES[k].icon)} ${esc(CATEGORIES[k].label)}</option>`).join('')}
      </select>
      <label>גיל מתאים</label>
      <div class="scopebox">${ageBoxes}</div>
      <label>מחיר</label>
      <div class="scopebox">
        <label><input type="radio" name="price" value="free" ${l.price === 'paid' ? '' : 'checked'}>
          <span><b>חינם</b><small>האפליקציה חינמית לגמרי למשפחות.</small></span></label>
        <label><input type="radio" name="price" value="paid" ${l.price === 'paid' ? 'checked' : ''}>
          <span><b>בתשלום</b><small>הגבייה מתבצעת אצלכם — Coli לא לוקח עמלה ולא מטפל בתשלום.</small></span></label>
      </div>
      <label>מה כתוב במקום המחיר</label>
      <input type="text" name="priceNote" maxlength="40" value="${esc(l.priceNote || '')}" placeholder="₪19.90 / חינם עם רכישה באתר">
    </div>

    <div class="card">
      <h2>איפה מורידים / מפעילים</h2>
      <p class="sub">לפחות קישור אחד. רק כתובות http/https — הקישור נפתח מדף האפליקציה בחנות.</p>
      ${linkRows}
    </div>

    <div class="card">
      <h2>🛡️ הצהרת בטיחות לילדים</h2>
      <p class="sub">סמנו רק את מה שנכון. ההצהרה מוצגת להורים בדף האפליקציה, והיא נבדקת באישור.</p>
      <div class="scopebox">${pledgeBoxes}</div>
    </div>

    <div class="card">
      <h2>גרסה</h2>
      <label>מספר גרסה</label>
      <input type="text" name="version" maxlength="20" dir="ltr" value="${esc(l.version || '')}" placeholder="1.0.0">
      <label>מה חדש</label>
      <textarea name="changelog" maxlength="500" placeholder="מה השתנה בגרסה הזו">${esc(l.changelog || '')}</textarea>
      <div class="row" style="margin-top:20px">
        <button class="btn" type="submit">שמירת דף החנות</button>
        <a class="btn ghost" href="/cloud/apps/${esc(app.id)}">ביטול</a>
      </div>
    </div>
  </form>

  <div class="card">
    <h2>שליחה לאישור</h2>
    ${listing && listing.status === 'pending'
      ? `<p class="sub">האפליקציה כבר ממתינה לבדיקה. כל שמירה נוספת מעדכנת את מה שהבודק רואה.</p>`
      : missing.length
        ? `<div class="alert warn">עוד חסר: ${esc(missing.join(', '))}</div>`
        : `<p class="sub">הכול מוכן. אחרי האישור האפליקציה תופיע בחנות לכל המשפחות.</p>`}
    <form method="post" action="/cloud/apps/${esc(app.id)}/store/submit" style="margin:0">
      <button class="btn green" type="submit" ${ready ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>
        שליחה לאישור
      </button>
    </form>
  </div>

  ${listing ? `
  <div class="card">
    <h2 style="color:#c62828">הסרה</h2>
    <div class="row">
      <form method="post" action="/cloud/apps/${esc(app.id)}/store/unpublish" style="margin:0"
            onsubmit="return confirm('להוריד את האפליקציה מהחנות ולחזור לטיוטה?')">
        <button class="btn ghost sm" type="submit">הורדה מהחנות (חזרה לטיוטה)</button>
      </form>
      <form method="post" action="/cloud/apps/${esc(app.id)}/store/delete" style="margin:0"
            onsubmit="return confirm('למחוק את דף החנות לצמיתות? האייקון והתמונות יימחקו. האפליקציה עצמה ב-Cloud לא תיפגע.')">
        <button class="btn danger sm" type="submit">מחיקת דף החנות</button>
      </form>
    </div>
  </div>` : ''}
  ${UPLOAD_JS}`, { user, active: 'apps', admin, pending });
}

// ── The review queue ───────────────────────────────────────────────────────
export function reviewQueuePage({ user, listings, admin = true, pending = 0, flash = '' }) {
  const card = (l) => {
    const s = STATUS[l.status] || STATUS.draft;
    const links = Object.entries(l.links || {}).map(([k, url]) =>
      `<div><b>${esc(PLATFORMS[k]?.label || k)}:</b>
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" dir="ltr" class="mono" style="font-size:.85rem">${esc(url)}</a></div>`).join('')
      || '<div style="color:#c62828">אין קישורים!</div>';
    const shots = (l.shots || []).map(f =>
      `<img src="/coli/media/${esc(f)}" alt="" style="height:110px;border-radius:10px;border:1px solid #dfe4ee">`).join('');
    return `<div class="card">
      <div class="row">
        <div class="icon" style="width:52px;height:52px;border-radius:14px;background:#eef1fb;display:flex;align-items:center;justify-content:center;font-size:1.6rem;overflow:hidden">
          ${l.iconFile ? `<img src="/coli/media/${esc(l.iconFile)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc(l.emoji || '🧩')}
        </div>
        <div style="flex:1">
          <b style="font-size:1.1rem">${esc(l.name)}</b>
          <div style="color:#90a4ae;font-size:.85rem">${esc(l.publisher || '')} · <span dir="ltr">${esc(l.owner)}</span></div>
        </div>
        <span class="pill ${s.pill === 'green' ? 'green' : 'gray'}">${esc(s.label)}</span>
      </div>
      <p style="margin:12px 0 6px;color:#37474f;line-height:1.7">${esc(l.tagline || '')}</p>
      <div style="color:#546e7a;white-space:pre-wrap;line-height:1.7;font-size:.93rem;max-height:180px;overflow:auto">${esc(l.description || '')}</div>
      <div style="margin:12px 0">
        <span class="pill">${esc(CATEGORIES[l.category]?.label || l.category || '—')}</span>
        ${(l.ages || []).map(a => `<span class="pill gray">${esc(AGES[a] || a)}</span>`).join('')}
        <span class="pill ${l.price === 'paid' ? 'gray' : 'green'}">${l.price === 'paid' ? esc(l.priceNote || 'בתשלום') : 'חינם'}</span>
        ${(l.pledges || []).map(p => `<span class="pill green">${esc(PLEDGES[p]?.icon || '')} ${esc(PLEDGES[p]?.label || p)}</span>`).join('')}
      </div>
      ${shots ? `<div class="row" style="overflow-x:auto">${shots}</div>` : ''}
      <div style="margin:12px 0;line-height:1.9">${links}</div>
      <form method="post" action="/cloud/coli/review/${esc(l.id)}">
        <label>הערה למפרסם (מוצגת לו אם דוחים)</label>
        <input type="text" name="note" maxlength="300" value="${esc(l.reviewNote || '')}" placeholder="למשל: הקישור לאנדרואיד לא עובד">
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">
          <input type="checkbox" name="featured" value="1" style="width:18px;height:18px" ${l.featured ? 'checked' : ''}> ⭐ להציג כמומלץ בעמוד הבית
        </label>
        <div class="row" style="margin-top:14px">
          <button class="btn green" name="decision" value="approve" type="submit">אישור ופרסום</button>
          <button class="btn danger" name="decision" value="reject" type="submit">${l.status === 'approved' ? 'הסרה מהחנות' : 'דחייה'}</button>
          ${l.status === 'approved' ? `<a class="btn ghost sm" href="/coli/app/${encodeURIComponent(l.slug)}">צפייה בחנות</a>` : ''}
        </div>
      </form>
    </div>`;
  };

  const waiting = listings.filter(l => l.status === 'pending');
  const rest = listings.filter(l => l.status !== 'pending');

  return consoleLayout('בדיקת אפליקציות', `
  ${flash ? `<div class="alert ok">${esc(flash)}</div>` : ''}
  <div class="card">
    <h1>🛡️ בדיקת אפליקציות ל-Coli</h1>
    <p class="sub" style="margin:0">שום אפליקציה לא מגיעה לילדים בלי שאדם עבר עליה. בדקו שהקישורים עובדים,
      שהתוכן מתאים לגיל שהוגדר, ושההצהרה נכונה.</p>
  </div>
  <h2 style="margin:22px 0 10px">ממתינות לאישור (${waiting.length})</h2>
  ${waiting.map(card).join('') || '<div class="card" style="color:#78909c;text-align:center">אין אפליקציות שממתינות. 🎉</div>'}
  ${rest.length ? `<h2 style="margin:26px 0 10px">כל השאר (${rest.length})</h2>${rest.map(card).join('')}` : ''}`,
    { user, active: 'review', admin, pending });
}
