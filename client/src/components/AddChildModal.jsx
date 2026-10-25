import { useState, useRef } from 'react';
import { addChild, updateChild, removeBackground, IS_WEB } from '../api';
import { PREP_TRACKS, HEBREW_STAGE_NAMES } from '../../../server/exercises/curriculum.js';
import './AddChildModal.css';

// Kid-friendly avatar choices (always available).
const AVATARS = [
  '🦁', '🐯', '🐼', '🦊', '🐰', '🐸', '🐵', '🦄',
  '🐱', '🐶', '🐨', '🐷', '🐧', '🦉', '🦕', '🐠',
  '🌟', '🚀', '⚽', '🦋',
];

// Focused addition/subtraction ceilings the parent can choose from.
const MATH_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Preparation tracks aligned with the MoE curriculum. When one is chosen the
// difficulty climbs automatically (3 successful days in a row = next stage).
const GRADE_OPTIONS = [
  { value: 'none', label: 'ללא מסלול — לפי רמה ידנית' },
  { value: 'grade_a', label: '🏫 כיתה א׳ — תוכנית הלימודים השנתית' },
  { value: 'grade_b', label: '🏫 כיתה ב׳ — תוכנית הלימודים השנתית' },
  { value: 'gan_to_a', label: '🌱 חופש גדול: עולה מגן חובה לכיתה א׳' },
  { value: 'a_to_b', label: '📗 חופש גדול: עולה מכיתה א׳ לכיתה ב׳' },
];

// English starting stage (Foundation Level). The level climbs automatically
// from here as the child succeeds.
const ENGLISH_LEVEL_OPTIONS = [
  { value: 1, label: '1 — אותיות ראשונות (מתחילים)' },
  { value: 2, label: '2 — מילים ראשונות' },
  { value: 3, label: '3 — קוראים וכותבים' },
  { value: 4, label: '4 — מרחיבים אוצר מילים' },
  { value: 5, label: '5 — משפטים וכתיבה (מתקדמים)' },
  { value: 6, label: '6 — שליטה באנגלית' },
  { value: 7, label: '7 — דקדוק ראשון (זמנים והשוואה)' },
  { value: 8, label: '8 — קריאה והבנה (הכי קשה)' },
];

const SUBJECT_NAMES = { math: '➕ חשבון', hebrew: '🔤 עברית', english: '🇬🇧 אנגלית' };
// A quota has no end date unless a parent picks one. It used to default to
// the end of the summer holiday, which meant every child created after that
// date was born with a quota that had already stopped applying.

// Render any File or data-URL into a centered square PNG of the given size.
// PNG (not JPEG) so a transparent background from the cut-out is preserved.
function toSquarePng(src, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = max; canvas.height = max;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, max, max);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, max, max);
      resolve(canvas.toDataURL('image/png'));
    };
    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => { img.src = reader.result; };
      reader.readAsDataURL(src);
    }
  });
}

export default function AddChildModal({ onClose, onSaved, editChild }) {
  const isEdit = !!editChild;
  const initialSubjects = Array.isArray(editChild?.subjects) && editChild.subjects.length
    ? editChild.subjects
    : [editChild?.subject || 'math'];

  const [name, setName] = useState(editChild?.name || '');
  const [gender, setGender] = useState(editChild?.gender || 'boy');
  const [subjects, setSubjects] = useState(initialSubjects);
  const [mathLevel, setMathLevel] = useState(editChild?.mathLevel ?? null);   // null = mixed
  const [grade, setGrade] = useState(editChild?.grade ?? null);               // null = no prep track
  const [englishLevel, setEnglishLevel] = useState(editChild?.englishLevel ?? 1);
  const [hebrewLevel, setHebrewLevel] = useState(editChild?.hebrewLevel ?? 1);
  const [mathStage, setMathStage] = useState(editChild?.mathStage ?? 1);
  // Daily summer plan: exercises-per-day per subject (0 = no requirement).
  const [dailyPlan, setDailyPlan] = useState(editChild?.dailyPlan || null);
  const [planUntil, setPlanUntil] = useState(editChild?.planUntil || '');
  const [avatar, setAvatar] = useState(editChild?.avatar || AVATARS[0]);
  const [photo, setPhoto] = useState(editChild?.photo || '');   // data URL or path when set
  const [saving, setSaving] = useState(false);
  const [bgWorking, setBgWorking] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  function toggleSubject(s) {
    setSubjects(prev => {
      if (prev.includes(s)) {
        const next = prev.filter(x => x !== s);
        return next.length ? next : prev;   // never leave the child with no subject
      }
      return [...prev, s];
    });
  }

  function pickAvatar(a) {
    setAvatar(a);
    setPhoto('');           // choosing an avatar clears any uploaded photo
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      // Show the cropped photo immediately, then remove its background.
      const square = await toSquarePng(file, 384);
      setPhoto(square);
      setBgWorking(true);
      try {
        const { ok, image } = await removeBackground(square);
        if (ok && image) {
          setPhoto(await toSquarePng(image, 256));   // transparent cut-out
        } else {
          setPhoto(await toSquarePng(square, 256));   // web build / no key — keep as-is
          if (!IS_WEB) setError('לא הוגדר מפתח API להסרת רקע (אזור הורים → הסרת רקע). התמונה נשמרה ללא הסרת רקע.');
        }
      } catch (bgErr) {
        setPhoto(await toSquarePng(square, 256));
        setError(bgErr.message + ' — התמונה נשמרה ללא הסרת רקע.');
      } finally {
        setBgWorking(false);
      }
    } catch {
      setError('לא הצלחנו לטעון את התמונה');
      setBgWorking(false);
    }
    e.target.value = '';
  }

  async function handleSave() {
    if (!name.trim()) { setError('צריך להזין שם'); return; }
    if (!subjects.length) { setError('צריך לבחור לפחות מקצוע אחד'); return; }
    setSaving(true);
    setError(null);
    try {
      // Only keep plan quotas for subjects the child actually learns.
      const plan = {};
      for (const s of subjects) {
        if (dailyPlan?.[s] > 0) plan[s] = dailyPlan[s];
      }
      const base = {
        name: name.trim(), gender, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage,
        dailyPlan: Object.keys(plan).length ? plan : null,
        planUntil,
      };
      // Photo and avatar are mutually exclusive in what we store.
      const payload = photo
        ? { ...base, photo, avatar: '' }
        : { ...base, avatar, photo: '' };
      const { child } = isEdit
        ? await updateChild(editChild.id, payload)
        : await addChild(payload);
      onSaved(child);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{isEdit ? '✏️ עריכת ילד/ה' : '➕ הוספת ילד/ה'}</h2>

        {/* Everything between the title and the save button scrolls, so the
            save button stays reachable no matter how tall the form gets. */}
        <div className="modal-body">
        <div className="avatar-preview">
          {photo ? <img src={photo} alt="" className="preview-photo" /> : avatar}
        </div>

        {/* Photo upload is available only in the local (installed) version. */}
        {!IS_WEB && (
          <div className="photo-upload">
            <button type="button" className="photo-btn" disabled={bgWorking} onClick={() => fileRef.current?.click()}>
              📷 העלה תמונה
            </button>
            {bgWorking && <span className="bg-working">⏳ מסיר רקע…</span>}
            {photo && !bgWorking && <button type="button" className="photo-clear" onClick={() => setPhoto('')}>הסר תמונה</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
          </div>
        )}

        <div className="field">
          <span>{IS_WEB ? 'בחרו דמות (אווטאר)' : 'או בחרו דמות'}</span>
          <div className="avatar-grid">
            {AVATARS.map(a => (
              <button
                key={a}
                type="button"
                className={`avatar-btn ${(!photo && avatar === a) ? 'on' : ''}`}
                onClick={() => pickAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>שם</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="לדוגמה: נועה"
            maxLength={20}
            autoFocus
          />
        </label>

        <div className="field">
          <span>בן או בת?</span>
          <div className="toggle-row">
            <button className={`toggle-btn ${gender === 'boy' ? 'on' : ''}`} onClick={() => setGender('boy')}>👦 בן</button>
            <button className={`toggle-btn ${gender === 'girl' ? 'on' : ''}`} onClick={() => setGender('girl')}>👧 בת</button>
          </div>
        </div>

        <div className="field">
          <span>מה ללמוד? <small className="field-hint">(אפשר לבחור גם וגם)</small></span>
          <div className="toggle-row">
            <button
              type="button"
              className={`toggle-btn ${subjects.includes('math') ? 'on' : ''}`}
              onClick={() => toggleSubject('math')}
            >➕ חשבון</button>
            <button
              type="button"
              className={`toggle-btn ${subjects.includes('hebrew') ? 'on' : ''}`}
              onClick={() => toggleSubject('hebrew')}
            >🔤 עברית</button>
            <button
              type="button"
              className={`toggle-btn ${subjects.includes('english') ? 'on' : ''}`}
              onClick={() => toggleSubject('english')}
            >🇬🇧 אנגלית</button>
          </div>
        </div>

        {subjects.includes('hebrew') && (
          <label className="field">
            <span>רמת עברית</span>
            <select
              className="level-select"
              value={hebrewLevel}
              onChange={e => setHebrewLevel(Number(e.target.value))}
            >
              {HEBREW_STAGE_NAMES.map((n, i) => (
                <option key={i} value={i + 1}>{i + 1} — {n}</option>
              ))}
            </select>
            <small className="field-hint">רמת ההתחלה — עולה לבד לפי ההצלחה 🚀</small>
          </label>
        )}

        {subjects.includes('english') && (
          <label className="field">
            <span>רמת אנגלית</span>
            <select
              className="level-select"
              value={englishLevel}
              onChange={e => setEnglishLevel(Number(e.target.value))}
            >
              {ENGLISH_LEVEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <small className="field-hint">
              הרמה עולה לבד אחרי 3 ימי הצלחה רצופים, עם הקראה באנגלית אמיתית 🔊
            </small>
          </label>
        )}

        <label className="field">
          <span>🎓 מסלול הכנה לכיתה</span>
          <select
            className="level-select"
            value={grade ?? 'none'}
            onChange={e => setGrade(e.target.value === 'none' ? null : e.target.value)}
          >
            {GRADE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {grade && (
            <small className="field-hint">
              התרגילים לפי תכנית הלימודים של משרד החינוך, והרמה עולה לבד אחרי 3 ימי הצלחה רצופים 🚀
            </small>
          )}
        </label>

        {subjects.includes('math') && grade && (
          <label className="field">
            <span>שלב התחלה בחשבון</span>
            <select
              className="level-select"
              value={mathStage}
              onChange={e => setMathStage(Number(e.target.value))}
            >
              {(PREP_TRACKS[grade]?.stageNames || []).map((n, i) => (
                <option key={i} value={i + 1}>{i + 1} — {n}</option>
              ))}
            </select>
            <small className="field-hint">מכאן מתחילים — והרמה ממשיכה לטפס לבד 🚀</small>
          </label>
        )}

        {subjects.includes('math') && !grade && (
          <label className="field">
            <span>רמת חשבון</span>
            <select
              className="level-select"
              value={mathLevel ?? 'mixed'}
              onChange={e => setMathLevel(e.target.value === 'mixed' ? null : Number(e.target.value))}
            >
              <option value="mixed">מעורב — כל הנושאים (כיתה א׳–ב׳)</option>
              {MATH_LEVELS.map(n => (
                <option key={n} value={n}>חיבור וחיסור עד {n}</option>
              ))}
            </select>
          </label>
        )}

        <div className="field">
          <span>🗓️ תכנית יומית לחופש הגדול <small className="field-hint">(0 = בלי חובה יומית)</small></span>
          <div className="plan-rows">
            {subjects.map(s => (
              <label key={s} className="plan-row">
                <span className="plan-subject">{SUBJECT_NAMES[s]}</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  className="plan-count"
                  value={dailyPlan?.[s] ?? 0}
                  onChange={e => setDailyPlan(p => ({ ...(p || {}), [s]: Number(e.target.value) }))}
                />
                <span className="plan-unit">תרגילים ביום</span>
              </label>
            ))}
          </div>
          {subjects.some(s => dailyPlan?.[s] > 0) && (
            <label className="plan-row">
              <span className="plan-subject">עד תאריך (לא חובה)</span>
              <input
                type="date"
                className="plan-until"
                value={planUntil}
                onChange={e => setPlanUntil(e.target.value)}
              />
            </label>
          )}
        </div>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <button className="modal-save" onClick={handleSave} disabled={saving || bgWorking}>
          {saving ? 'שומר...' : (isEdit ? '💾 שמור שינויים' : '💾 הוסף')}
        </button>
      </div>
    </div>
  );
}
