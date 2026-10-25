import { useState, useEffect } from 'react';
import { fetchMistakes } from '../api';
import './MistakesScreen.css';

// Labels reused from the session cards (kept short for kids).
const TYPE_LABELS = {
  addition: 'חיבור', subtraction: 'חיסור', complete: 'השלמה למספר עגול',
  addition_10: 'חיבור עד 10', addition_20: 'חיבור עד 20', addition_30: 'חיבור עד 30',
  subtraction_10: 'חיסור עד 10', subtraction_20: 'חיסור עד 20', subtraction_30: 'חיסור עד 30',
  complete_10: 'השלמה ל-10', complete_20: 'השלמה ל-20',
  compare: 'השוואת מספרים', sequence: 'רצף מספרים',
  tens_in_number: 'כמה עשרות', ones_in_number: 'כמה אחדות',
  build_tens_ones: 'בניית מספר', expanded_form: 'פירוק מספר',
  hundreds_in_number: 'כמה מאות', build_hundreds: 'מספר תלת-ספרתי', expanded_form_3: 'פירוק מאות',
  skip_count: 'דילוגים קדימה', skip_count_back: 'דילוגים אחורה', skip_count_100: 'דילוגים ב-100',
  word_add: 'בעיה מילולית – חיבור', word_sub: 'בעיה מילולית – חיסור',
  geo_sides: 'צלעות', geo_corners: 'פינות', geo_identify: 'זיהוי צורה',
  geo_count_sides_compare: 'השוואת צורות', geo_count: 'ספירת צורות',
  count_objects: 'ספירת חפצים', compare_quantities: 'השוואת כמויות',
  number_after: 'המספר שאחרי', number_before: 'המספר שלפני',
  visual_add: 'חיבור עם ציורים', visual_sub: 'חיסור עם ציורים',
  pattern: 'חוקיות', biggest_number: 'הכי גדול', smallest_number: 'הכי קטן',
  round_tens_add: 'חיבור עשרות', round_tens_sub: 'חיסור עשרות',
  two_digit_add: 'חיבור דו-ספרתי', two_digit_sub: 'חיסור דו-ספרתי',
  two_digit_add_carry: 'חיבור עם המרה', two_digit_sub_borrow: 'חיסור עם פריטה',
  three_digit_add: 'חיבור עד 1000', three_digit_sub: 'חיסור עד 1000',
  mul_table: 'לוח הכפל', div_table: 'חילוק',
  missing_number: 'מספר חסר', even_odd: 'זוגי או אי-זוגי', repeated_add: 'חיבור חוזר',
  name_letter: 'שם האות', word_starts_with: 'מילה שמתחילה ב-',
  fill_letter: 'השלמת אות', fill_letter_choice: 'אות חסרה', find_letter: 'מציאת אות',
  match_letter: 'התאמת אות', type_letter: 'כתיבת אות', count_letter: 'ספירת אותיות',
  first_letter_of_word: 'אות ראשונה', odd_one_out: 'מה שונה',
  read_word: 'קריאת מילה', last_letter: 'אות אחרונה',
  ordinal_position: 'מי בתור', count_category: 'ספירה חכמה', days_of_week: 'ימי השבוע',
  clock_reading: 'קריאת שעון', money_count: 'שקלים', pictogram_read: 'גרף תמונות', mul_div_facts: 'כפל וחילוק',
  he_rhyme: 'חרוזים', he_syllable_count: 'הברות', he_word_blend: 'הרכבת מילה', he_listen_story: 'הבנת הנשמע',
  en_rhyme: 'חרוזים באנגלית', en_sound_start: 'צליל פותח', en_sentence_pic: 'משפט ותמונה',
  en_letter_name: 'שם האות באנגלית', en_letter_find: 'מציאת אות באנגלית',
  en_first_letter: 'אות פותחת באנגלית', en_word_to_pic: 'מילה ← תמונה',
  en_pic_to_word: 'תמונה ← מילה', en_listen_pick: 'הבנת הנשמע',
  en_translate_to_he: 'תרגום לעברית', en_translate_to_en: 'תרגום לאנגלית',
  en_missing_letter: 'אות חסרה באנגלית', en_spell: 'כתיבה באנגלית',
  en_next_letter: 'האות הבאה', en_upper_lower: 'אות גדולה/קטנה', en_last_letter: 'אות אחרונה באנגלית',
  en_number_word: 'מספרים באנגלית', en_count: 'ספירה באנגלית', en_color: 'צבעים באנגלית',
  en_verb: 'פעולות באנגלית', en_opposite: 'הפכים', en_odd_one_out: 'מה לא שייך',
  en_plural: 'יחיד ורבים', en_scramble: 'סידור אותיות', en_sentence_fill: 'השלמת משפט', en_phrase: 'ביטויים',
};

const SUBJECT_META = {
  math: { title: 'חשבון', icon: '➕' },
  hebrew: { title: 'עברית', icon: '🔤' },
  english: { title: 'אנגלית', icon: '🇬🇧' },
};

const PREVIEW_LIMIT = 4;

function groupByType(list) {
  const groups = {};
  for (const m of list) {
    const t = m.exercise.type;
    if (!groups[t]) groups[t] = [];
    groups[t].push(m);
  }
  // Biggest trouble first
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

export default function MistakesScreen({ child, childName, onPractice, onBack }) {
  const [mistakes, setMistakes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMistakes(child)
      .then(data => setMistakes(data.mistakes || {}))
      .catch(err => setError(err.message));
  }, [child]);

  if (error) return (
    <div className="mistakes-screen">
      <button className="back-btn" onClick={onBack}>← חזרה</button>
      <p className="mistakes-error">שגיאה: {error}</p>
    </div>
  );

  if (!mistakes) return (
    <div className="mistakes-screen"><div className="mistakes-loading">טוען...</div></div>
  );

  const subjects = Object.entries(mistakes).filter(([, list]) => list.length > 0);
  const total = subjects.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="mistakes-screen">
      <div className="mistakes-header">
        <button className="back-btn" onClick={onBack}>← חזרה</button>
        <h1>🔁 תרגול טעויות של {childName}</h1>
        <p className="mistakes-sub">
          כאן נאספים תרגילים שטעית בהם. פותרים נכון בפעם הראשונה — והם נעלמים מהרשימה! ✨
        </p>
      </div>

      {total === 0 && (
        <div className="mistakes-empty">
          🏆 הרשימה ריקה — אין אף טעות לתרגל. כל הכבוד!
        </div>
      )}

      {subjects.map(([subject, list]) => (
        <div key={subject} className="mistakes-subject">
          <div className="mistakes-subject-header">
            <h2>{SUBJECT_META[subject]?.icon} {SUBJECT_META[subject]?.title || subject} ({list.length})</h2>
            <button className="practice-btn practice-all" onClick={() => onPractice(subject, null)}>
              ▶️ תרגל הכל
            </button>
          </div>
          {groupByType(list).map(([type, items]) => (
            <div key={type} className="mistakes-group">
              <div className="mistakes-group-header">
                <span className="group-title">{TYPE_LABELS[type] || type}</span>
                <span className="group-count">{items.length} {items.length === 1 ? 'תרגיל' : 'תרגילים'}</span>
                <button className="practice-btn" onClick={() => onPractice(subject, type)}>▶️ תרגל</button>
              </div>
              <div className="mistakes-list">
                {items.slice(0, PREVIEW_LIMIT).map((m, i) => (
                  <div key={i} className="mistake-item" dir={m.exercise.dir || 'rtl'}>
                    {m.exercise.displayImage && <span className="mi-img">{m.exercise.displayImage}</span>}
                    <span className="mi-q">{m.exercise.question.split('\n')[0]}</span>
                    {m.wrongCount > 1 && <span className="mi-count">✗{m.wrongCount}</span>}
                  </div>
                ))}
                {items.length > PREVIEW_LIMIT && (
                  <div className="mistake-item more">ועוד {items.length - PREVIEW_LIMIT}...</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
