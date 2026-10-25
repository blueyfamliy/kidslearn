import { useState, useEffect } from 'react';
import {
  fetchStats, fetchHistory, fetchChildren, fetchInsights, updateChild, fetchMagicBox, openMagicBox, IS_WEB,
  fetchParentConfig, saveParentConfig, buildParentReport, exportAllData, importAllData,
} from '../api';
import { PREP_TRACKS, NEXT_TRACK, stageName, STREAK_TO_ADVANCE, HEBREW_STAGES, ENGLISH_STAGES } from '../../../server/exercises/curriculum.js';
import { listHebrewVoices, getTtsSettings, saveTtsSettings, speakSample, stopSpeech } from '../lib/tts';
import { buildReminderIcs, downloadTextFile, requestNotifyPermission, notificationsSupported, DAY_NAMES_HE } from '../lib/reminder';
import EmailSettings from './EmailSettings';
import BgRemovalSettings from './BgRemovalSettings';
import LexiLogo from './LexiLogo';
import './ParentsScreen.css';
import { LEXI_INFO } from '../../../server/ml/pool.js';

const TYPE_LABELS = {
  addition: 'חיבור',
  subtraction: 'חיסור',
  complete: 'השלמה למספר עגול',
  addition_10: 'חיבור עד 10',
  addition_20: 'חיבור עד 20',
  subtraction_10: 'חיסור עד 10',
  subtraction_20: 'חיסור עד 20',
  addition_30: 'חיבור עד 30',
  subtraction_30: 'חיסור עד 30',
  complete_10: 'השלמה ל-10',
  complete_20: 'השלמה ל-20',
  compare: 'השוואת מספרים',
  sequence: 'רצף מספרים',
  tens_in_number: 'כמה עשרות',
  ones_in_number: 'כמה אחדות',
  build_tens_ones: 'בניית מספר – עשרות ואחדות',
  expanded_form: 'פירוק לעשרות ואחדות',
  hundreds_in_number: 'כמה מאות',
  build_hundreds: 'בניית מספר תלת-ספרתי',
  expanded_form_3: 'פירוק מאות, עשרות ואחדות',
  skip_count: 'דילוגים – עולה',
  skip_count_back: 'דילוגים – יורד',
  skip_count_100: 'דילוגים ב-100',
  word_add: 'בעיה מילולית – חיבור',
  word_sub: 'בעיה מילולית – חיסור',
  geo_sides: 'גאומטריה – צלעות',
  geo_corners: 'גאומטריה – פינות',
  geo_identify: 'גאומטריה – זיהוי צורה',
  geo_count_sides_compare: 'גאומטריה – השוואה',
  geo_count: 'גאומטריה – ספירת צורות',
  count_objects: 'ספירת חפצים',
  compare_quantities: 'השוואת כמויות',
  number_after: 'המספר שאחרי',
  number_before: 'המספר שלפני',
  visual_add: 'חיבור עם ציורים',
  visual_sub: 'חיסור עם ציורים',
  pattern: 'חוקיות (דגם חוזר)',
  biggest_number: 'המספר הגדול ביותר',
  smallest_number: 'המספר הקטן ביותר',
  round_tens_add: 'חיבור עשרות שלמות',
  round_tens_sub: 'חיסור עשרות שלמות',
  two_digit_add: 'חיבור דו-ספרתי',
  two_digit_sub: 'חיסור דו-ספרתי',
  two_digit_add_carry: 'חיבור עם המרה',
  two_digit_sub_borrow: 'חיסור עם פריטה',
  three_digit_add: 'חיבור עד 1000',
  three_digit_sub: 'חיסור עד 1000',
  mul_table: 'לוח הכפל',
  div_table: 'חילוק',
  missing_number: 'מספר חסר בתרגיל',
  even_odd: 'זוגי או אי-זוגי',
  repeated_add: 'חיבור חוזר (לקראת כפל)',
  name_letter: 'שם האות',
  word_starts_with: 'מילה שמתחילה ב-',
  fill_letter: 'השלמת אות במילה',
  fill_letter_choice: 'אות חסרה (בחירה)',
  find_letter: 'מציאת אות',
  match_letter: 'התאמת אות למילה',
  type_letter: 'כתיבת אות',
  count_letter: 'ספירת אותיות',
  first_letter_of_word: 'אות ראשונה',
  odd_one_out: 'מה שונה',
  read_word: 'קריאת מילה',
  last_letter: 'אות אחרונה',
  en_letter_name: 'אנגלית – שם האות',
  en_letter_find: 'אנגלית – מציאת אות',
  en_first_letter: 'אנגלית – אות פותחת',
  en_word_to_pic: 'אנגלית – מילה לתמונה',
  en_pic_to_word: 'אנגלית – תמונה למילה',
  en_listen_pick: 'אנגלית – הבנת הנשמע',
  en_translate_to_he: 'אנגלית – תרגום לעברית',
  en_translate_to_en: 'אנגלית – תרגום לאנגלית',
  en_missing_letter: 'אנגלית – אות חסרה',
  en_spell: 'אנגלית – כתיבת מילה',
};

const PLAN_SUBJECT_NAMES = { math: '➕ חשבון', hebrew: '🔤 עברית', english: '🇬🇧 אנגלית' };

// 🎁 The parents' gift for connecting KidsLearn to Tavixo: one free surprise
// a day — bonus stickers for the kids, family coupons, riddles and more.
function MagicBoxSection() {
  const [box, setBox] = useState(null);
  const [surprise, setSurprise] = useState(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    fetchMagicBox().then(b => {
      setBox(b);
      if (b.openedToday) setSurprise(b.openedToday);
    }).catch(() => setBox({ unlocked: false }));
  }, []);

  if (!box || !box.unlocked) return null;

  async function open() {
    setOpening(true);
    try {
      const r = await openMagicBox();
      setSurprise(r.surprise);
    } catch (e) {
      alert(e.message);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="section magic-box">
      <h2>🎁 קופסת הקסמים</h2>
      {!surprise ? (
        <div className="magic-closed">
          <div className="magic-icon">🎁</div>
          <p>ההפתעה היומית שלכם מחכה בפנים — בחינם, כי חיברתם את KidsLearn ל-Tavixo!</p>
          <button className="magic-open-btn" onClick={open} disabled={opening}>
            {opening ? '...' : '✨ פתחו את הקופסה'}
          </button>
        </div>
      ) : (
        <div className="magic-surprise">
          <div className="magic-icon">{surprise.icon}</div>
          <h3>{surprise.title}</h3>
          <p>{surprise.text}</p>
          {surprise.awarded && (
            <p className="magic-awarded">
              {surprise.awarded.map(a => `${a.name} קיבל/ה ${a.emoji}`).join(' · ')} — כבר באלבום!
            </p>
          )}
          <div className="hint-text">🗓️ הפתעה חדשה מחכה כאן כל יום.</div>
        </div>
      )}
    </div>
  );
}

const REC_STYLE = {
  strengthen:  { icon: '🎯', color: '#e65100', bg: '#fff3e0' },
  consolidate: { icon: '💪', color: '#1565c0', bg: '#e3f2fd' },
  advance:     { icon: '🚀', color: '#2e7d32', bg: '#e8f5e9' },
  new_topics:  { icon: '🌟', color: '#6a1b9a', bg: '#f3e5f5' },
  more_data:   { icon: '⏳', color: '#616161', bg: '#f5f5f5' },
};
const TREND_ARROW = { up: '▲', down: '▼', flat: '•' };
const TREND_COLOR = { up: '#2e7d32', down: '#c62828', flat: '#999' };

// Real learning analysis: mastery per topic family + one clear recommendation
// per subject — strengthen / consolidate / advance a stage / move to NEW material.
function InsightsSection({ child, childName }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    fetchInsights(child).then(d => setData(d.insights)).catch(() => setData([]));
  }, [child]);

  if (!data || !data.length) return null;
  const withData = data.filter(s => s.overall.attempts > 0);
  if (!withData.length) return null;

  return (
    <div className="section">
      <h2>🧠 ניתוח והמלצות — {childName}</h2>
      {withData.map(s => {
        const st = REC_STYLE[s.recommendation.action] || REC_STYLE.more_data;
        return (
          <div key={s.subject} className="insight-subject">
            <div className="insight-header">
              {PLAN_SUBJECT_NAMES[s.subject] || s.subject}
              <span className="insight-meta">
                שלב {s.stage}/{s.maxStage} · {Math.round(s.overall.rate * 100)}% בניסיון ראשון ({s.overall.attempts} תרגילים אחרונים)
              </span>
            </div>

            <div className="insight-rec" style={{ background: st.bg, color: st.color }}>
              <span className="rec-icon">{st.icon}</span>
              <span>
                <strong>{s.recommendation.title}.</strong> {s.recommendation.text}
                {s.recommendation.nextStage && <> השלב הבא: <strong>{s.recommendation.nextStage}</strong>.</>}
              </span>
            </div>

            <div className="topic-list">
              {s.families.map(f => (
                <div key={f.key} className={`topic-row ${f.rate < 0.7 ? 'weak' : f.rate >= 0.9 ? 'strong' : ''}`}>
                  <span className="topic-name">
                    {f.label}
                    {f.trend && (
                      <span className="topic-trend" style={{ color: TREND_COLOR[f.trend] }} title="מגמה מול התקופה הקודמת">
                        {' '}{TREND_ARROW[f.trend]}
                      </span>
                    )}
                  </span>
                  <span className="topic-bar">
                    <span
                      className="bar-fill"
                      style={{ width: `${f.rate * 100}%`, background: f.rate < 0.7 ? '#e53935' : f.rate >= 0.9 ? '#43a047' : '#fb8c00' }}
                    />
                  </span>
                  <span className="topic-stats">{f.firstTry}/{f.attempts} ({Math.round(f.rate * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="hint-text">
        💡 הניתוח מבוסס על התרגול האחרון (עד 10 מפגשים בכל מקצוע), עם מגמה מול התקופה שלפניה. ▲ = שיפור, ▼ = ירידה.
      </div>
    </div>
  );
}

// Quick daily-quota editor: the parent can raise/lower each subject's daily
// exercise count right from the parents area (0 = no daily requirement).
function PlanEditor({ profile, onSaved }) {
  const [plan, setPlan] = useState(null);
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setPlan({ ...(profile?.dailyPlan || {}) });
    setUntil(profile?.planUntil || '');      // empty = no end date
    setSavedMsg(false);
  }, [profile?.id]);

  if (!profile || !plan) return null;
  const subjects = Array.isArray(profile.subjects) && profile.subjects.length
    ? profile.subjects
    : [profile.subject || 'math'];

  const today = new Date().toISOString().slice(0, 10);
  const expired = !!until && until < today && subjects.some(s => plan[s] > 0);

  async function save() {
    setSaving(true);
    try {
      const cleaned = {};
      for (const s of subjects) if (plan[s] > 0) cleaned[s] = Number(plan[s]);
      const { child } = await updateChild(profile.id, {
        dailyPlan: Object.keys(cleaned).length ? cleaned : null,
        planUntil: until,
      });
      onSaved(child);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section">
      <h2>🗓️ מכסת תרגילים יומית — {profile.name}</h2>
      <div className="quota-rows">
        {subjects.map(s => (
          <label key={s} className="quota-row">
            <span className="quota-name">{PLAN_SUBJECT_NAMES[s] || s}</span>
            <input
              type="number" min="0" max="50"
              value={plan[s] ?? 0}
              onChange={e => setPlan(p => ({ ...p, [s]: Number(e.target.value) }))}
            />
            <span className="quota-unit">תרגילים ביום</span>
          </label>
        ))}
        <label className="quota-row">
          <span className="quota-name">עד תאריך (לא חובה)</span>
          <input type="date" value={until} onChange={e => setUntil(e.target.value)} />
        </label>
      </div>

      {/* An end date that has passed switches the quota off. That used to happen
          silently — sessions just got shorter than the number on this screen. */}
      {expired && (
        <div className="quota-expired">
          ⚠️ המכסה <b>לא פעילה</b> — תאריך הסיום ({until}) כבר עבר, ולכן המפגשים
          חוזרים לאורך הרגיל שלהם במקום למספר שמוגדר כאן.
          {' '}
          <button className="quota-clear" onClick={() => setUntil('')}>
            הסרת תאריך הסיום
          </button>
          {' '}ואז שמירה.
        </div>
      )}

      <button className="quota-save" onClick={save} disabled={saving}>
        {saving ? 'שומר...' : savedMsg ? '✓ נשמר!' : '💾 שמור מכסה'}
      </button>
      <div className="hint-text">
        💡 0 = בלי חובה יומית. המפגשים מתאימים את עצמם למכסה אוטומטית.
        בלי תאריך סיום המכסה פעילה תמיד.
      </div>
    </div>
  );
}

// Multiplication & division stay hidden until the child has actually learned
// them. Only shown for the "עולה לכיתה ב׳" track, the one whose sessions can
// contain mul/div. Off by default; toggling saves immediately.
// The ABC (alphabet-letter) drills inside English can be hidden until school
// starts — same pattern as the mul/div switch in math. English itself STAYS:
// the letter questions are swapped for picture/audio vocabulary (words,
// listening, rhymes), so the session keeps its full length.
function EnglishToggle({ profile, onSaved }) {
  const learnsEnglish = Array.isArray(profile?.subjects) && profile.subjects.includes('english');
  const [on, setOn] = useState(!profile?.hideEnglishLetters);   // on = ABC shown
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOn(!profile?.hideEnglishLetters); }, [profile?.id, profile?.hideEnglishLetters]);

  if (!profile || !learnsEnglish) return null;

  async function toggle() {
    const next = !on;
    setOn(next);                               // optimistic
    setSaving(true);
    try {
      const { child } = await updateChild(profile.id, { hideEnglishLetters: !next });
      onSaved(child);
    } catch (e) {
      setOn(!next);                            // revert on failure
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section">
      <h2>🔤 אותיות ABC באנגלית — {profile.name}</h2>
      <label className={`muldiv-toggle ${on ? 'on' : ''}`}>
        <input type="checkbox" checked={on} onChange={toggle} disabled={saving} />
        <span className="muldiv-text">
          {on
            ? `${profile.name} לומד/ת את אותיות ה-ABC — תרגילי אותיות מופיעים במפגשי האנגלית`
            : `אותיות ה-ABC מוסתרות — האנגלית ממשיכה דרך שמיעה ותמונות בלבד (מילים, צלילים, חרוזים)`}
        </span>
      </label>
      <div className="hint-text">
        💡 האנגלית עצמה נשארת! כמו מתג הכפל והחילוק — תרגילי האותיות מוחלפים
        בתרגילי מילים באודיו ותמונות, והמפגש נשאר באותו אורך. מפעילים שוב כשמתחילה כיתה א׳.
      </div>
    </div>
  );
}

function MulDivToggle({ profile, onSaved }) {
  const [on, setOn] = useState(!!profile?.allowMulDiv);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOn(!!profile?.allowMulDiv); }, [profile?.id]);

  if (!profile || profile.grade !== 'a_to_b') return null;

  async function toggle() {
    const next = !on;
    setOn(next);                               // optimistic
    setSaving(true);
    try {
      const { child } = await updateChild(profile.id, { allowMulDiv: next });
      onSaved(child);
    } catch (e) {
      setOn(!next);                            // revert on failure
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section">
      <h2>✖️ כפל וחילוק — {profile.name}</h2>
      <label className={`muldiv-toggle ${on ? 'on' : ''}`}>
        <input type="checkbox" checked={on} onChange={toggle} disabled={saving} />
        <span className="muldiv-text">
          {profile.name} כבר למד/ה כפל וחילוק — הצג תרגילי כפל וחילוק במפגשים
        </span>
      </label>
      <div className="hint-text">
        💡 כבוי כברירת מחדל. כשכבוי, תרגילי הכפל/חילוק מוחלפים בחיבור וחיסור דו-ספרתי שהילד/ה כבר יודע/ת.
      </div>
    </div>
  );
}

// Exercises per day, last 14 days — the parent sees the practice rhythm at a
// glance (research: consistency beats intensity for young learners).
function ActivityChart({ history }) {
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  const counts = days.map(date =>
    (history || [])
      .filter(s => s.date === date)
      .reduce((n, s) => n + (s.results || []).length, 0));
  const max = Math.max(...counts, 1);
  if (!counts.some(c => c > 0)) return null;

  return (
    <div className="section">
      <h2>📊 פעילות ב-14 הימים האחרונים</h2>
      <div className="activity-chart" dir="ltr">
        {days.map((date, i) => (
          <div key={date} className="activity-col" title={`${date}: ${counts[i]} תרגילים`}>
            <span className="activity-count">{counts[i] || ''}</span>
            <div
              className={`activity-bar ${counts[i] > 0 ? 'active' : ''}`}
              style={{ height: `${Math.max(4, (counts[i] / max) * 90)}px` }}
            />
            <span className="activity-day">{Number(date.slice(8, 10))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Current stage + streak per adaptive subject: prep-track math/hebrew and the
// global English ladder (English adapts for every child who learns it).
function ProgressSection({ profile, progress }) {
  if (!profile || !progress) return null;
  const track = PREP_TRACKS[profile.grade];
  const subjects = Array.isArray(profile.subjects) && profile.subjects.length
    ? profile.subjects
    : [profile.subject || 'math'];

  const rows = subjects
    .filter(s => (s === 'math' ? !!track : true))
    .map(s => {
      const p = progress[s] || { stage: 1, streak: 0 };
      const stage = s === 'english'
        ? Math.max(p.stage, profile.englishLevel || 1)
        : s === 'hebrew'
          ? Math.max(p.stage, profile.hebrewLevel || 1)
          : Math.max(p.stage, profile.mathStage || 1);
      const total = s === 'english' ? ENGLISH_STAGES : s === 'hebrew' ? HEBREW_STAGES : track.mathStages;
      const icon = s === 'english' ? '🇬🇧 אנגלית' : s === 'hebrew' ? '🔤 עברית' : '➕ חשבון';
      return { s, icon, stage, total, name: stageName(profile.grade, s, stage), streak: p.streak };
    });

  if (!rows.length) return null;

  return (
    <div className="section">
      <h2>🎓 התקדמות{track ? ` — ${track.label}` : ''}</h2>
      <div className="topic-list">
        {rows.map(r => (
          <div key={r.s} className="topic-row">
            <span className="topic-name">
              {r.icon}: שלב {r.stage} מתוך {r.total} — {r.name}
            </span>
            <span className="topic-stats">
              🔥 רצף ימי הצלחה: {r.streak}/{STREAK_TO_ADVANCE}
            </span>
          </div>
        ))}
      </div>
      <div className="hint-text">
        💡 אחרי {STREAK_TO_ADVANCE} ימי תרגול מוצלחים ברצף (80% ומעלה בניסיון ראשון) עולים שלב אוטומטית.
      </div>
    </div>
  );
}

// ── School-year switch ──────────────────────────────────────────────────────
// The summer prep tracks lead into the school-year tracks. Once the year has
// started, offer the switch right here (one click) instead of leaving a child
// on "rising first grader" material all year.
function TrackSwitchSection({ profile, onSaved }) {
  const [saving, setSaving] = useState(false);
  if (!profile || !['gan_to_a', 'a_to_b'].includes(profile.grade)) return null;
  const next = NEXT_TRACK[profile.grade];
  const nextTrack = PREP_TRACKS[next];
  if (!nextTrack) return null;

  async function go() {
    setSaving(true);
    try {
      const { child } = await updateChild(profile.id, { grade: next, mathStage: 1 });
      onSaved(child);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section track-switch">
      <h2>🏫 שנת הלימודים התחילה — {profile.name}</h2>
      <p>
        {profile.name} עדיין במסלול הקיץ "{PREP_TRACKS[profile.grade].label}". המסלול השנתי{' '}
        <b>{nextTrack.label}</b> עוקב אחרי תוכנית הלימודים של משרד החינוך לאורך השנה:{' '}
        {nextTrack.stageNames.join(' • ')}.
      </p>
      <button className="quota-save" onClick={go} disabled={saving}>
        {saving ? 'עובר...' : `🚀 מעבר למסלול "${nextTrack.label}" (מתחילים משלב 1)`}
      </button>
      <div className="hint-text">
        💡 ההיסטוריה, המדבקות ואוסף הטעויות נשמרים. רק סולם החשבון מתחיל מהשלב הראשון של
        המסלול החדש — ועולה לבד אחרי {STREAK_TO_ADVANCE} ימי הצלחה. אפשר גם לבחור שלב התחלה אחר בעריכת הילד/ה.
      </div>
    </div>
  );
}

// ── Web-only parent tools (everything stays in this browser) ────────────────
const REPORT_RANGES = [{ d: 1, l: 'היום' }, { d: 7, l: 'השבוע' }, { d: 30, l: 'החודש' }];

// Parent emails + a report that opens in the parent's OWN mail app (mailto:).
// There is no server behind the site, so nothing is sent by itself.
function ParentReportSection({ children }) {
  const [emails, setEmails] = useState('');
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState(1);
  const [report, setReport] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchParentConfig().then(c => setEmails(c.emails || '')).catch(() => {}); }, []);
  useEffect(() => { buildParentReport({ days }).then(setReport).catch(() => setReport(null)); }, [days, children]);

  async function save() {
    try {
      const { config } = await saveParentConfig({ emails });
      setEmails(config.emails);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  const mailto = report
    ? `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.body)}`
    : '#';

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPreview(true);
    }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function share() {
    try { await navigator.share({ title: report.subject, text: report.body }); } catch {}
  }

  return (
    <div className="section">
      <h2>📧 דוח להורים</h2>
      <p className="section-intro">
        הדוח נבנה מהנתונים ששמורים במכשיר הזה בלבד, ונפתח באפליקציית המייל שלכם — שום דבר לא נשלח לשרת.
      </p>
      <label className="field-row">
        <span>כתובות המייל של ההורים (מופרדות בפסיק)</span>
        <input
          type="text" dir="ltr" value={emails}
          onChange={e => setEmails(e.target.value)} onBlur={save}
          placeholder="ima@gmail.com, aba@gmail.com"
        />
      </label>
      <div className="chip-row">
        {REPORT_RANGES.map(o => (
          <button key={o.d} className={`chip ${days === o.d ? 'on' : ''}`} onClick={() => setDays(o.d)}>{o.l}</button>
        ))}
      </div>
      <div className="btn-row">
        <a className="btn-main" href={mailto} onClick={save}>📧 פתיחה במייל</a>
        <button className="btn-soft" onClick={copy} disabled={!report}>{copied ? '✓ הועתק' : '📋 העתקה'}</button>
        {canShare && <button className="btn-soft" onClick={share} disabled={!report}>📤 שיתוף</button>}
        <button className="btn-soft" onClick={() => setShowPreview(v => !v)} disabled={!report}>
          {showPreview ? 'הסתרת התצוגה' : '👁️ תצוגה מקדימה'}
        </button>
      </div>
      {saved && <div className="hint-text">✓ הכתובות נשמרו במכשיר הזה</div>}
      {showPreview && report && <pre className="report-preview">{report.body}</pre>}
      <div className="hint-text">
        💡 הדוח כולל לכל ילד/ה: כמה תרגילים, אחוז הצלחה בניסיון ראשון, הטעויות לחזרה, המכסה היומית והשלב בכל מקצוע.
      </div>
    </div>
  );
}

// Which voice reads the questions. Edge ships free neural Hebrew voices
// (Hila / Avri); plain Windows Chrome only has the old robotic "Asaf".
function VoiceSection() {
  const [voices, setVoices] = useState(null);
  const [settings, setSettings] = useState(() => getTtsSettings());

  useEffect(() => {
    listHebrewVoices().then(setVoices).catch(() => setVoices([]));
    return () => stopSpeech();
  }, []);

  function update(patch) {
    setSettings(s => ({ ...s, ...patch }));
    saveTtsSettings(patch);
  }

  const hasNatural = (voices || []).some(v => v.natural);
  return (
    <div className="section">
      <h2>🔊 הקול שמקריא לילדים</h2>
      {voices === null && <div className="loading">טוען קולות...</div>}
      {voices && voices.length === 0 && (
        <div className="quota-expired">
          ⚠️ בדפדפן הזה אין קול עברי. פתחו את kidslearn.fun ב-<b>Microsoft Edge</b> (מגיע עם הקולות
          הטבעיים "Hila" ו-"Avri" בחינם, בלי התקנה), או בכרום בטלפון/טאבלט.
        </div>
      )}
      {voices && voices.length > 0 && (
        <>
          <label className="field-row">
            <span>קול</span>
            <select value={settings.voiceURI} onChange={e => update({ voiceURI: e.target.value })}>
              <option value="">אוטומטי — הקול הטבעי ביותר כאן ({voices[0].name})</option>
              {voices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.natural ? '✨ ' : ''}{v.name}</option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>קצב דיבור: {settings.rate.toFixed(2)} {settings.rate < 0.95 ? '(לאט יותר)' : settings.rate > 1.05 ? '(מהר יותר)' : '(רגיל)'}</span>
            <input
              type="range" min="0.7" max="1.2" step="0.05" value={settings.rate}
              onChange={e => update({ rate: Number(e.target.value) })}
            />
          </label>
          <div className="btn-row">
            <button className="btn-main" onClick={() => speakSample()}>▶️ השמעת דוגמה</button>
          </div>
          {!hasNatural && (
            <div className="quota-expired">
              💡 הקולות שמותקנים בדפדפן הזה ישנים ונשמעים "רובוטיים". ל<b>עברית טבעית</b> פתחו את האתר
              ב-<b>Microsoft Edge</b> — שם יש את הקולות Hila ו-Avri (Natural), בחינם וללא התקנה.
            </div>
          )}
        </>
      )}
      <div className="hint-text">
        💡 ההקראה עצמה שופרה: מספרים נקראים כמילים בעברית נכונה ("שתי בננות", "חמישה שקלים",
        "שלוש ועוד ארבע"), בלי אמוג׳י ובלי "ילד/ה", והעידודים בלשון בן או בת לפי הילד/ה.
      </div>
    </div>
  );
}

// A daily practice reminder: a calendar file (works everywhere, even when the
// site is closed) plus an in-app nudge while the site is open.
function ReminderSection({ children }) {
  const [rem, setRem] = useState(null);
  const [perm, setPerm] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'));

  useEffect(() => { fetchParentConfig().then(c => setRem(c.reminder)).catch(() => {}); }, []);

  async function update(patch) {
    const next = { ...rem, ...patch };
    setRem(next);
    try { await saveParentConfig({ reminder: next }); } catch {}
  }

  if (!rem) return null;
  const names = (children || []).map(c => c.name).join(' ו');
  const days = rem.days || [];

  return (
    <div className="section">
      <h2>⏰ תזכורת יומית לתרגול</h2>
      <label className={`muldiv-toggle ${rem.enabled ? 'on' : ''}`}>
        <input type="checkbox" checked={!!rem.enabled} onChange={e => update({ enabled: e.target.checked })} />
        <span className="muldiv-text">{rem.enabled ? `התזכורת פעילה — בשעה ${rem.time}` : 'התזכורת כבויה'}</span>
      </label>
      <div className="field-row inline">
        <span>שעה</span>
        <input type="time" value={rem.time} onChange={e => update({ time: e.target.value })} />
      </div>
      <div className="chip-row">
        {DAY_NAMES_HE.map((n, i) => (
          <button
            key={i}
            className={`chip ${days.includes(i) ? 'on' : ''}`}
            onClick={() => update({ days: days.includes(i) ? days.filter(d => d !== i) : [...days, i].sort() })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button
          className="btn-main"
          onClick={() => downloadTextFile(buildReminderIcs({ time: rem.time, days, names }), 'kidslearn-reminder.ics', 'text/calendar')}
        >
          📅 הוספה ליומן (קובץ .ics)
        </button>
        {perm !== 'unsupported' && perm !== 'granted' && (
          <button className="btn-soft" onClick={async () => setPerm(await requestNotifyPermission())}>
            🔔 אישור התראות בדפדפן
          </button>
        )}
        {perm === 'granted' && <span className="hint-inline">🔔 התראות הדפדפן מאושרות</span>}
      </div>
      <div className="hint-text">
        💡 הדרך הבטוחה: קובץ היומן נפתח ביומן של הטלפון/המחשב ומזכיר בכל יום שנבחר — גם כשהאתר סגור.
        בנוסף, כשהאתר פתוח אחרי השעה שנבחרה מופיעה תזכורת במסך הבית (והתראת דפדפן, אם אושרה).
      </div>
    </div>
  );
}

// The data lives only in this browser — a backup file protects it from a
// browser clean-up and moves it to another device.
function BackupSection({ onRestored }) {
  const [msg, setMsg] = useState(null);

  async function exportNow() {
    const data = await exportAllData();
    downloadTextFile(JSON.stringify(data, null, 2), `kidslearn-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    setMsg('✓ קובץ הגיבוי ירד למכשיר');
  }

  async function importFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!window.confirm('לשחזר מהקובץ? הנתונים הנוכחיים במכשיר הזה יוחלפו.')) return;
      const r = await importAllData(JSON.parse(text));
      setMsg(`✓ שוחזר: ${r.children} ילדים. המסך נטען מחדש...`);
      setTimeout(() => onRestored?.(), 800);
    } catch (err) {
      setMsg('❌ ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="section">
      <h2>💾 גיבוי והעברה למכשיר אחר</h2>
      <p className="section-intro">
        כל הנתונים (ילדים, היסטוריה, מדבקות, אוסף הטעויות, הגדרות ההורים) נשמרים בדפדפן של המכשיר הזה בלבד.
        גיבוי מדי פעם מגן מפני ניקוי הדפדפן, והקובץ מאפשר להמשיך מאותו מקום במחשב או בטלפון אחר.
      </p>
      <div className="btn-row">
        <button className="btn-main" onClick={exportNow}>⬇️ הורדת גיבוי</button>
        <label className="btn-soft file-btn">
          ⬆️ שחזור מקובץ
          <input type="file" accept="application/json,.json" onChange={importFile} hidden />
        </label>
      </div>
      {msg && <div className="hint-text">{msg}</div>}
    </div>
  );
}

// ── History, grouped by day ─────────────────────────────────────────────────
const SUBJECT_BADGE = { math: '➕ חשבון', hebrew: '🔤 עברית', english: '🇬🇧 אנגלית' };
const DAYS_PER_PAGE = 14;

function HistorySection({ history }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(DAYS_PER_PAGE);

  const list = [...history].reverse().filter(s => filter === 'all' || (s.subject || 'math') === filter);
  const groups = [];
  for (const s of list) {
    const d = s.date || String(s.savedAt || '').slice(0, 10);
    let g = groups[groups.length - 1];
    if (!g || g.date !== d) { g = { date: d, sessions: [] }; groups.push(g); }
    g.sessions.push(s);
  }
  const visible = groups.slice(0, shown);
  const subjectsPresent = [...new Set(history.map(s => s.subject || 'math'))];
  const firstTry = (results) => results.filter(r => r.firstAttemptCorrect !== false && r.correct).length;

  return (
    <div className="section">
      <h2>📚 היסטוריית מפגשים ({history.length})</h2>
      {subjectsPresent.length > 1 && (
        <div className="chip-row">
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>הכל</button>
          {subjectsPresent.map(s => (
            <button key={s} className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>{SUBJECT_BADGE[s] || s}</button>
          ))}
        </div>
      )}
      <div className="sessions-list">
        {visible.map(g => {
          const total = g.sessions.reduce((n, s) => n + (s.results || []).length, 0);
          const ok = g.sessions.reduce((n, s) => n + firstTry(s.results || []), 0);
          return (
            <div key={g.date} className="history-day">
              <div className="history-day-head">
                <span>{new Date(`${g.date}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="history-day-stats">
                  {g.sessions.length} מפגשים · {total} תרגילים · {total ? Math.round(ok / total * 100) : 0}% בניסיון ראשון
                </span>
              </div>
              {g.sessions.map((s, i) => {
                const correctCount = (s.results || []).filter(r => r.correct).length;
                const n = (s.results || []).length || 1;
                const sessionId = `${s.savedAt}-${g.date}-${i}`;
                const isOpen = expanded === sessionId;
                return (
                  <div key={sessionId} className="session-item">
                    <button className="session-summary" onClick={() => setExpanded(isOpen ? null : sessionId)}>
                      <span className="session-date">
                        {new Date(s.savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        <span className="session-subject">
                          {SUBJECT_BADGE[s.subject || 'math'] || s.subject}{s.practice ? ' · 🔁 תרגול טעויות' : ''}
                        </span>
                      </span>
                      <span className="session-score">
                        {correctCount}/{n} ({Math.round(correctCount / n * 100)}%)
                      </span>
                      <span className="expand-icon">{isOpen ? '▼' : '◀'}</span>
                    </button>
                    {isOpen && (
                      <div className="session-details">
                        {(s.results || []).map((r, j) => {
                          const noMistake = r.firstAttemptCorrect !== false && r.correct;
                          const corrected = r.firstAttemptCorrect === false && r.correct;
                          const cls = noMistake ? 'correct' : corrected ? 'corrected' : 'wrong';
                          const icon = noMistake ? '✅' : corrected ? '⚠️' : '❌';
                          return (
                            <div key={j} className={`detail-row ${cls}`}>
                              <span className="d-icon">{icon}</span>
                              <span className="d-q" dir={r.dir || 'rtl'}>{String(r.question || '').split('\n')[0]}</span>
                              <span className="d-ans">תשובה: <strong>{/^[<>=]$/.test(String(r.answer)) ? <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{r.answer}</span> : r.answer}</strong></span>
                              <span className="d-att">{r.attempts} ניסיונות</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {groups.length > shown && (
          <button className="btn-soft" onClick={() => setShown(n => n + DAYS_PER_PAGE)}>הצגת ימים נוספים</button>
        )}
        {history.length === 0 && (
          <div className="empty-state">אין עדיין מפגשים שמורים</div>
        )}
      </div>
    </div>
  );
}

export default function ParentsScreen({ onBack }) {
  const [children, setChildren] = useState([]);
  const [activeChild, setActiveChild] = useState('son');
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChildren()
      .then(data => {
        const list = data.children || [];
        setChildren(list);
        if (list.length && !list.some(c => c.id === activeChild)) {
          setActiveChild(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(activeChild), fetchHistory(activeChild)])
      .then(([s, h]) => {
        setStats(s);
        setHistory(h.sessions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeChild]);

  const activeProfile = children.find(c => c.id === activeChild);
  const childName = activeProfile ? activeProfile.name : '';

  return (
    <div className="parents-screen">
      <div className="parents-header">
        <button className="back-btn" onClick={onBack}>← חזרה לאזור הילדים</button>
        <h1>👨‍👩‍👧 אזור הורים</h1>
      </div>

      <div className="child-tabs">
        {children.map(c => (
          <button
            key={c.id}
            className={`tab ${activeChild === c.id ? 'active' : ''}`}
            onClick={() => setActiveChild(c.id)}
          >
            {c.photo && !c.avatar
              ? <img src={c.photo} alt="" className={`tab-photo ${c.subject === 'hebrew' ? 'tab-photo-daughter' : ''}`} />
              : <span className="tab-emoji">{c.avatar || (c.gender === 'girl' ? '👧' : '👦')}</span>}
            {c.name}
          </button>
        ))}
      </div>

      {loading && <div className="loading">טוען...</div>}

      {!loading && stats && (
        <>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-num">{stats.totalSessions}</div>
              <div className="stat-label">מפגשים</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{stats.totalExercises}</div>
              <div className="stat-label">תרגילים</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">
                {stats.totalExercises ? Math.round(stats.totalCorrect / stats.totalExercises * 100) : 0}%
              </div>
              <div className="stat-label">הצלחה</div>
            </div>
          </div>

          {stats.totalSessions === 0 && (
            <div className="empty-state">
              {childName} עדיין לא ביצע/ה תרגילים. כשתסיים/י מפגש – הנתונים יופיעו כאן.
            </div>
          )}

          <MagicBoxSection />

          <TrackSwitchSection
            profile={activeProfile}
            onSaved={(child) => setChildren(cs => cs.map(c => (c.id === child.id ? child : c)))}
          />

          <InsightsSection child={activeChild} childName={childName} />

          <ProgressSection profile={activeProfile} progress={stats.progress} />

          <PlanEditor
            profile={activeProfile}
            onSaved={(child) => setChildren(cs => cs.map(c => (c.id === child.id ? child : c)))}
          />

          <EnglishToggle
            profile={activeProfile}
            onSaved={(child) => setChildren(cs => cs.map(c => (c.id === child.id ? child : c)))}
          />

          <MulDivToggle
            profile={activeProfile}
            onSaved={(child) => setChildren(cs => cs.map(c => (c.id === child.id ? child : c)))}
          />

          <ActivityChart history={history} />

          {IS_WEB && <ParentReportSection children={children} />}
          {IS_WEB && <ReminderSection children={children} />}
          {IS_WEB && <VoiceSection />}
          {IS_WEB && <BackupSection onRestored={() => window.location.reload()} />}

          {!IS_WEB && (
            <div className="section">
              <EmailSettings />
            </div>
          )}

          {!IS_WEB && (
            <div className="section">
              <BgRemovalSettings />
            </div>
          )}

          {!IS_WEB && (
            <div className="section">
              <h2>🏪 חנות האפליקציות — KidsLearn Coli</h2>
              <p style={{ color: '#607d8b', lineHeight: 1.7, margin: '0 0 12px' }}>
                אפליקציות לימוד ומשחקים לילדים — כל אחת נבדקה ידנית לפני שהיא נכנסה לחנות:
                בלי פרסומות, בלי רכישות מפתיעות ובלי צ׳אט עם זרים.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => window.open('/coli', '_blank')}
                  style={{
                    background: 'linear-gradient(135deg,#5e35b1,#3949ab)', color: '#fff',
                    border: 'none', borderRadius: 12, padding: '11px 22px',
                    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  🏪 פתחו את החנות
                </button>
                <button
                  onClick={() => window.open('/coli/publish', '_blank')}
                  style={{
                    background: '#eceff1', color: '#37474f',
                    border: 'none', borderRadius: 12, padding: '11px 22px',
                    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  ⬆️ פרסום אפליקציה (בחינם)
                </button>
              </div>
            </div>
          )}

          {!IS_WEB && (
            <div className="section">
              <h2>☁️ KidsLearn Cloud — למפתחים</h2>
              <p style={{ color: '#607d8b', lineHeight: 1.7, margin: '0 0 12px' }}>
                בונים אפליקציה משלכם? קבלו <b>Client ID</b> ו-<b>Client Secret</b> לכפתור
                "התחברות עם KidsLearn", ו-<b>API Key</b> לגישה למנוע התרגילים — הכול בקונסולת המפתחים.
                מאותו מקום גם מעלים את האפליקציה לחנות <b>Coli</b>.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => window.open('/cloud', '_blank')}
                  style={{
                    background: 'linear-gradient(135deg,#5c6bc0,#3949ab)', color: '#fff',
                    border: 'none', borderRadius: 12, padding: '11px 22px',
                    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  🔑 פתחו את הקונסולה
                </button>
                <button
                  onClick={() => window.open('/cloud/docs', '_blank')}
                  style={{
                    background: '#eceff1', color: '#37474f',
                    border: 'none', borderRadius: 12, padding: '11px 22px',
                    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  📚 תיעוד
                </button>
              </div>
            </div>
          )}

          <div className="section">
            <h2>✈️ Lexi — מודל השפה של KidsLearn</h2>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <LexiLogo width={150} />
              <p style={{ color: '#607d8b', lineHeight: 1.7, margin: 0, flex: '1 1 260px' }}>
                את בעיות המילה בחשבון מנסח <b>Lexi</b> — מודל שפה קטן שאומן מאפס במיוחד
                לאפליקציה, ורץ כאן במכשיר בלי אינטרנט. הוא מספק{' '}
                <b>{LEXI_INFO.total.toLocaleString('he-IL')}</b> ניסוחים שונים במקום שש
                תבניות קבועות, כדי שהתרגילים לא יחזרו על עצמם.
                <br />
                <span style={{ fontSize: '0.92rem' }}>
                  המספרים והתשובות <b>לא</b> מגיעים מהמודל — הם מחושבים בקוד רגיל, כך
                  שתרגיל לא יכול לצאת עם תשובה שגויה.
                </span>
              </p>
            </div>
          </div>

          <HistorySection history={history} />
        </>
      )}
    </div>
  );
}
