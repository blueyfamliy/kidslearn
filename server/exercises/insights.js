// Parent-facing learning analysis: per-topic-family mastery, trends, and a
// concrete recommendation — strengthen X / advance a stage / move on to NEW
// material. Pure functions over session history, shared by the server and the
// browser build.
import { maxStage, stageName } from './curriculum.js';

// Pedagogical topic families: exercise types grouped the way a teacher (and a
// parent) thinks about them, not the way the generators are organized.
export const TOPIC_FAMILIES = {
  math: [
    { key: 'addition', label: 'חיבור', types: ['addition', 'addition_10', 'addition_20', 'addition_30', 'visual_add', 'complete', 'complete_10', 'complete_20', 'round_tens_add', 'two_digit_add', 'two_digit_add_carry', 'three_digit_add', 'word_add'] },
    { key: 'subtraction', label: 'חיסור', types: ['subtraction', 'subtraction_10', 'subtraction_20', 'subtraction_30', 'visual_sub', 'round_tens_sub', 'two_digit_sub', 'two_digit_sub_borrow', 'three_digit_sub', 'word_sub'] },
    { key: 'place_value', label: 'המבנה העשרוני (עשרות ואחדות)', types: ['tens_in_number', 'ones_in_number', 'build_tens_ones', 'expanded_form', 'hundreds_in_number', 'build_hundreds', 'expanded_form_3'] },
    { key: 'number_sense', label: 'מושג המספר והשוואה', types: ['compare', 'biggest_number', 'smallest_number', 'number_after', 'number_before', 'compare_quantities', 'even_odd', 'count_objects', 'count_category'] },
    { key: 'ordinals', label: 'מספרים סודרים', types: ['ordinal_position'] },
    { key: 'week_days', label: 'ימי השבוע וזמן', types: ['days_of_week'] },
    { key: 'clock', label: 'קריאת שעון', types: ['clock_reading'] },
    { key: 'money', label: 'כסף וקניות', types: ['money_count'] },
    { key: 'data_reading', label: 'קריאת נתונים (גרפים)', types: ['pictogram_read'] },
    { key: 'sequences', label: 'סדרות, דילוגים וחוקיות', types: ['sequence', 'skip_count', 'skip_count_back', 'skip_count_100', 'pattern'] },
    { key: 'missing', label: 'מספר חסר (שוויונות)', types: ['missing_number'] },
    { key: 'geometry', label: 'גאומטריה', types: ['geo_sides', 'geo_corners', 'geo_identify', 'geo_count_sides_compare', 'geo_count'] },
    { key: 'multiplication', label: 'כפל וחילוק', types: ['repeated_add', 'mul_div_facts', 'mul_table', 'div_table'] },
  ],
  hebrew: [
    { key: 'letters', label: 'הכרת האותיות', types: ['name_letter', 'find_letter', 'odd_one_out', 'type_letter'] },
    { key: 'sounds', label: 'צלילים (פותח וסוגר)', types: ['word_starts_with', 'match_letter', 'first_letter_of_word', 'last_letter'] },
    { key: 'phono', label: 'חרוזים, הברות ומיזוג', types: ['he_rhyme', 'he_syllable_count', 'he_word_blend'] },
    { key: 'he_listening', label: 'הבנת הנשמע', types: ['he_listen_story'] },
    { key: 'in_words', label: 'אותיות בתוך מילים', types: ['fill_letter', 'fill_letter_choice', 'count_letter'] },
    { key: 'reading', label: 'קריאת מילים', types: ['read_word'] },
  ],
  english: [
    { key: 'en_letters', label: 'האלפבית', types: ['en_letter_name', 'en_letter_find', 'en_first_letter', 'en_next_letter', 'en_upper_lower', 'en_last_letter'] },
    { key: 'en_vocab', label: 'אוצר מילים', types: ['en_word_to_pic', 'en_pic_to_word', 'en_number_word', 'en_count', 'en_color', 'en_verb', 'en_opposite', 'en_odd_one_out', 'en_phrase'] },
    { key: 'en_phono', label: 'צלילים וחרוזים', types: ['en_rhyme', 'en_sound_start'] },
    { key: 'en_listening', label: 'הבנת הנשמע', types: ['en_listen_pick'] },
    { key: 'en_translate', label: 'תרגום', types: ['en_translate_to_he', 'en_translate_to_en'] },
    { key: 'en_spelling', label: 'כתיב וכתיבה', types: ['en_missing_letter', 'en_spell', 'en_scramble', 'en_plural'] },
    { key: 'en_sentences', label: 'משפטים באנגלית', types: ['en_sentence_fill', 'en_sentence_pic'] },
  ],
};

const familyOf = {};
for (const [subject, fams] of Object.entries(TOPIC_FAMILIES)) {
  for (const f of fams) for (const t of f.types) familyOf[`${subject}|${t}`] = f;
}

// Thresholds — tuned for young kids: generous, and only with enough evidence.
const WEAK_RATE = 0.7;
const STRONG_RATE = 0.9;
const MASTERY_RATE = 0.9;
const MIN_FAMILY_ATTEMPTS = 4;
const MIN_MASTERY_ATTEMPTS = 30;
const RECENT_SESSIONS = 10;

function familyStats(sessions, subject) {
  const acc = {};
  for (const s of sessions) {
    for (const r of s.results || []) {
      const fam = familyOf[`${subject}|${r.type}`];
      if (!fam) continue;
      const a = acc[fam.key] || (acc[fam.key] = { key: fam.key, label: fam.label, attempts: 0, firstTry: 0 });
      a.attempts++;
      if (r.firstAttemptCorrect !== false && r.correct) a.firstTry++;
    }
  }
  for (const a of Object.values(acc)) a.rate = a.attempts ? a.firstTry / a.attempts : 0;
  return acc;
}

/**
 * Analysis for one child+subject.
 * Returns { families, weak, strong, overall, recommendation } — families with
 * recent rate + trend vs the previous window, and one primary recommendation:
 *   strengthen  – specific weak families to work on
 *   consolidate – keep practicing at the current level
 *   advance     – ready for the next stage of the current ladder
 *   new_topics  – current ladder mastered: time for NEW material (with what's next)
 *   more_data   – not enough recent practice to judge
 */
export function analyzeSubject({ sessions, subject, profile, stage }) {
  const subjectSessions = sessions
    .filter(s => (s.subject || 'math') === subject)
    .slice(-RECENT_SESSIONS * 2);
  const recentSessions = subjectSessions.slice(-RECENT_SESSIONS);
  const prevSessions = subjectSessions.slice(0, -RECENT_SESSIONS);

  const recent = familyStats(recentSessions, subject);
  const previous = familyStats(prevSessions, subject);

  const families = Object.values(recent)
    .map(f => {
      const prev = previous[f.key];
      const trend = prev && prev.attempts >= MIN_FAMILY_ATTEMPTS
        ? (f.rate - prev.rate > 0.07 ? 'up' : prev.rate - f.rate > 0.07 ? 'down' : 'flat')
        : null;
      return { ...f, trend };
    })
    .sort((a, b) => a.rate - b.rate);

  const judged = families.filter(f => f.attempts >= MIN_FAMILY_ATTEMPTS);
  const weak = judged.filter(f => f.rate < WEAK_RATE);
  const strong = judged.filter(f => f.rate >= STRONG_RATE).reverse();

  let attempts = 0, firstTry = 0;
  for (const s of recentSessions) for (const r of s.results || []) {
    attempts++; if (r.firstAttemptCorrect !== false && r.correct) firstTry++;
  }
  const overall = { attempts, rate: attempts ? firstTry / attempts : 0 };

  const cap = maxStage(profile.grade, subject);
  const atTop = stage >= cap;

  let recommendation;
  if (attempts < MIN_MASTERY_ATTEMPTS) {
    recommendation = {
      action: 'more_data',
      title: 'ממשיכים לתרגל',
      text: 'עוד אין מספיק תרגול עדכני כדי להמליץ — אחרי עוד כמה מפגשים נדע יותר.',
    };
  } else if (weak.length) {
    recommendation = {
      action: 'strengthen',
      title: 'כדאי לחזק',
      text: `לפני שממשיכים קדימה, שווה להתמקד ב: ${weak.map(f => f.label).join(', ')}. תרגול הטעויות (🔁) בונה מפגש בדיוק מהשאלות האלה.`,
      focus: weak.map(f => f.key),
    };
  } else if (overall.rate >= MASTERY_RATE) {
    if (!atTop) {
      recommendation = {
        action: 'advance',
        title: 'מוכן/ה לשלב הבא',
        text: `שליטה מצוינת ברמה הנוכחית (${Math.round(overall.rate * 100)}% בניסיון ראשון). ההתקדמות האוטומטית תעלה שלב תוך יום-יומיים של הצלחה — זה קידום בתוך החומר הנוכחי, לא נושא חדש.`,
        nextStage: stageName(profile.grade, subject, stage + 1),
      };
    } else {
      recommendation = {
        action: 'new_topics',
        title: 'הסולם הנוכחי נכבש — זמן לחומר חדש!',
        text: newTopicsText(subject, profile),
      };
    }
  } else {
    recommendation = {
      action: 'consolidate',
      title: 'מבססים את הרמה הנוכחית',
      text: `${Math.round(overall.rate * 100)}% הצלחה בניסיון ראשון — התקדמות טובה. ממשיכים לתרגל ברמה הזו עד שליטה מלאה (90%+), ואז עולים.`,
    };
  }

  return { subject, stage, maxStage: cap, families, weak, strong, overall, recommendation };
}

// What "new material" means per subject — the answer to the parent's question
// "האם הוא מתקדם בדרגה או שכדאי לעבור לנושא חדש?".
function newTopicsText(subject, profile) {
  if (subject === 'math') {
    if (profile.grade === 'grade_b') {
      return 'כל שלבי כיתה ב׳ נשלטים — מצוין! ממשיכים לבסס את לוח הכפל והמספרים עד 1000; חומר כיתה ג׳ (כפל וחילוק מלאים, מספרים עד 10,000) יתווסף כשיגיע הזמן.';
    }
    if (profile.grade === 'grade_a') {
      return 'כל שלבי כיתה א׳ נשלטים! אפשר לעבור למסלול "כיתה ב׳" (באזור ההורים או בעריכת הילד/ה) — שם מחכים חיבור וחיסור עם המרה ולוח הכפל.';
    }
    return profile.grade === 'a_to_b'
      ? 'כל שלבי ההכנה לכיתה ב׳ נשלטים. הצעד הבא הוא המסלול השנתי "כיתה ב׳" (באזור ההורים) — חיבור וחיסור עם המרה, לוח הכפל, שעון וכסף.'
      : 'כל שלבי ההכנה לכיתה א׳ נשלטים! אפשר לעבור למסלול השנתי "כיתה א׳" (באזור ההורים) — שם מחכים חיבור וחיסור עד 20 והמבנה העשרוני.';
  }
  if (subject === 'hebrew') {
    return 'שלבי הקריאה הבסיסיים נשלטים — הצעד הבא הוא קריאת מילים ארוכות ומשפטים קצרים. בינתיים סולם העברית ממשיך לאתגר עם מילים קשות יותר.';
  }
  return 'אוצר המילים הבסיסי נשלט — ממשיכים להרחיב אוצר מילים ומתחילים משפטים פשוטים באנגלית.';
}

/** Full analysis for a child across their subjects (paused subjects hidden). */
export function computeInsights({ profile, sessions, stages }) {
  const subjects = (Array.isArray(profile.subjects) && profile.subjects.length
    ? profile.subjects
    : [profile.subject || 'math'])
    .filter(s => !(s === 'english' && profile.hideEnglish));
  return subjects.map(subject => analyzeSubject({
    sessions, subject, profile, stage: stages?.[subject] || 1,
  }));
}
