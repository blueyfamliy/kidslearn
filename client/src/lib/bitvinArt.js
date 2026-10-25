// גרפיקות BITVIN - הציורים שנוצרים ב-CHATGPDEAN (מודל "BITVIN 3") ונשמרים
// אוטומטית לתוך public/bitvin. כאן פשוט קוראים אותם ומחזירים ציור מתאים
// לרגע הנכון בתרגיל: תשובה נכונה, טעות, פרס וכו'.
//
// אין כאן שום קריאה לאינטרנט - הקבצים כבר יושבים בתוך האפליקציה, אז זה
// עובד גם בגרסת הדסקטופ וגם בלי חיבור לרשת.

const MANIFEST_URL = '/bitvin/manifest.json';

// שמות התיקיות שמודל BITVIN יוצר (זהים לשמות ב-chatbot.py)
export const ART = {
  CHARACTER: 'characters',
  CORRECT: 'correct',
  WRONG: 'wrong',
  REWARD: 'rewards',
  TOPIC: 'topics',
  BACKGROUND: 'backgrounds',
};

let cache = null;          // הרשימה נטענת פעם אחת לכל ריצה של האפליקציה
let loading = null;

// טוען את רשימת הגרפיקות. אם אין קובץ manifest (עוד לא נוצרו ציורים) -
// מחזיר רשימה ריקה בשקט, והאפליקציה ממשיכה לעבוד בדיוק כמו קודם.
export async function loadBitvinArt() {
  if (cache) return cache;
  if (loading) return loading;

  loading = fetch(MANIFEST_URL)
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      cache = Array.isArray(list) ? list : [];
      return cache;
    })
    .catch(() => {
      cache = [];
      return cache;
    });

  return loading;
}

// מחזיר ציור אקראי מקטגוריה מסוימת, או null אם אין עדיין ציור כזה.
// דוגמה: const art = await randomArt(ART.CORRECT)
export async function randomArt(category) {
  const list = await loadBitvinArt();
  const matches = list.filter((item) => item.category === category);
  if (!matches.length) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

// כמו randomArt אבל מחזיר רק את הכתובת לתמונה (או null).
export async function randomArtUrl(category) {
  const art = await randomArt(category);
  return art ? art.url : null;
}
