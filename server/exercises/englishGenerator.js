// English exercises (Foundation Level – תכנית הלימודים באנגלית של משרד החינוך).
// Four stages, climbing with the same adaptive mechanism as the other subjects:
//   1. אותיות ראשונות   – the alphabet, letter names and first words
//   2. מילים ראשונות    – core vocabulary with pictures + listening
//   3. קוראים וכותבים    – reading, spelling and simple translation
//   4. מרחיבים אוצר מילים – vocabulary expansion for kids who already read/write
// Every exercise carries English audio (audioText + audioLang:'en') so the
// child hears real pronunciation and repeats it — that's the speaking practice.

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// [english, hebrew, emoji, level]. Levels follow the MoE Foundation bands:
// 1 = first words, 2 = core vocabulary, 3 = readers, 4 = vocabulary expansion.
const WORDS = [
  // Level 1 – first words (one clear picture per letter where possible)
  ['apple', 'תפוח', '🍎', 1], ['ball', 'כדור', '⚽', 1], ['cat', 'חתול', '🐱', 1],
  ['dog', 'כלב', '🐶', 1], ['egg', 'ביצה', '🥚', 1], ['fish', 'דג', '🐟', 1],
  ['hat', 'כובע', '🎩', 1], ['ice', 'קרח', '🧊', 1], ['king', 'מלך', '🤴', 1],
  ['lion', 'אריה', '🦁', 1], ['moon', 'ירח', '🌙', 1], ['nose', 'אף', '👃', 1],
  ['orange', 'תפוז', '🍊', 1], ['pig', 'חזיר', '🐷', 1], ['queen', 'מלכה', '👸', 1],
  ['rabbit', 'ארנב', '🐰', 1], ['sun', 'שמש', '☀️', 1], ['tree', 'עץ', '🌳', 1],
  ['umbrella', 'מטרייה', '☂️', 1], ['van', 'טנדר', '🚐', 1], ['water', 'מים', '💧', 1],
  ['box', 'קופסה', '📦', 1], ['yellow', 'צהוב', '🟡', 1], ['zebra', 'זברה', '🦓', 1],
  ['bird', 'ציפור', '🐦', 1], ['car', 'מכונית', '🚗', 1], ['duck', 'ברווז', '🦆', 1],

  // Level 2 – core vocabulary (animals, food, family, colors, home)
  ['mother', 'אמא', '👩', 2], ['father', 'אבא', '👨', 2], ['baby', 'תינוק', '👶', 2],
  ['boy', 'ילד', '🧒', 2], ['girl', 'ילדה', '👧', 2], ['house', 'בית', '🏠', 2],
  ['book', 'ספר', '📖', 2], ['milk', 'חלב', '🥛', 2], ['bread', 'לחם', '🍞', 2],
  ['cake', 'עוגה', '🎂', 2], ['banana', 'בננה', '🍌', 2], ['cheese', 'גבינה', '🧀', 2],
  ['cow', 'פרה', '🐮', 2], ['horse', 'סוס', '🐴', 2], ['bear', 'דוב', '🐻', 2],
  ['monkey', 'קוף', '🐵', 2], ['mouse', 'עכבר', '🐭', 2], ['bus', 'אוטובוס', '🚌', 2],
  ['red', 'אדום', '🔴', 2], ['blue', 'כחול', '🔵', 2], ['green', 'ירוק', '🟢', 2],
  ['black', 'שחור', '⚫', 2], ['white', 'לבן', '⚪', 2], ['flower', 'פרח', '🌸', 2],
  ['star', 'כוכב', '⭐', 2], ['heart', 'לב', '❤️', 2], ['door', 'דלת', '🚪', 2],
  ['bed', 'מיטה', '🛏️', 2], ['chair', 'כיסא', '🪑', 2], ['hand', 'יד', '✋', 2],
  ['eye', 'עין', '👁️', 2], ['ear', 'אוזן', '👂', 2], ['mouth', 'פה', '👄', 2],
  ['rain', 'גשם', '🌧️', 2], ['snow', 'שלג', '❄️', 2], ['candy', 'סוכריה', '🍬', 2],

  // Level 3 – readers (school, body, clothes, transport, nature)
  ['pencil', 'עיפרון', '✏️', 3], ['school', 'בית ספר', '🏫', 3], ['teacher', 'מורה', '🧑‍🏫', 3],
  ['table', 'שולחן', '🪵', 3], ['window', 'חלון', '🪟', 3], ['clock', 'שעון', '🕐', 3],
  ['phone', 'טלפון', '📱', 3], ['shoe', 'נעל', '👟', 3], ['shirt', 'חולצה', '👕', 3],
  ['dress', 'שמלה', '👗', 3], ['train', 'רכבת', '🚂', 3], ['plane', 'מטוס', '✈️', 3],
  ['boat', 'סירה', '⛵', 3], ['bicycle', 'אופניים', '🚲', 3], ['cloud', 'ענן', '☁️', 3],
  ['fire', 'אש', '🔥', 3], ['leaf', 'עלה', '🍃', 3], ['grapes', 'ענבים', '🍇', 3],
  ['pizza', 'פיצה', '🍕', 3], ['juice', 'מיץ', '🧃', 3], ['soup', 'מרק', '🍲', 3],
  ['sheep', 'כבשה', '🐑', 3], ['chicken', 'תרנגולת', '🐔', 3], ['snake', 'נחש', '🐍', 3],
  ['frog', 'צפרדע', '🐸', 3], ['turtle', 'צב', '🐢', 3], ['bee', 'דבורה', '🐝', 3],
  ['doctor', 'רופא', '🧑‍⚕️', 3], ['police', 'שוטר', '👮', 3], ['ring', 'טבעת', '💍', 3],
  ['key', 'מפתח', '🔑', 3], ['bag', 'תיק', '🎒', 3], ['gift', 'מתנה', '🎁', 3],

  // Level 4 – vocabulary expansion (richer nouns; for kids who already read)
  ['elephant', 'פיל', '🐘', 4], ['giraffe', "ג'ירפה", '🦒', 4], ['penguin', 'פינגווין', '🐧', 4],
  ['butterfly', 'פרפר', '🦋', 4], ['spider', 'עכביש', '🕷️', 4], ['dolphin', 'דולפין', '🐬', 4],
  ['whale', 'לוויתן', '🐋', 4], ['shark', 'כריש', '🦈', 4], ['octopus', 'תמנון', '🐙', 4],
  ['rainbow', 'קשת בענן', '🌈', 4], ['mountain', 'הר', '⛰️', 4], ['island', 'אי', '🏝️', 4],
  ['bridge', 'גשר', '🌉', 4], ['castle', 'טירה', '🏰', 4], ['rocket', 'טיל', '🚀', 4],
  ['robot', 'רובוט', '🤖', 4], ['guitar', 'גיטרה', '🎸', 4], ['drum', 'תוף', '🥁', 4],
  ['crown', 'כתר', '👑', 4], ['dragon', 'דרקון', '🐉', 4], ['ghost', 'רוח רפאים', '👻', 4],
  ['camera', 'מצלמה', '📷', 4], ['scissors', 'מספריים', '✂️', 4], ['ladder', 'סולם', '🪜', 4],
  ['sandwich', 'כריך', '🥪', 4], ['chocolate', 'שוקולד', '🍫', 4], ['strawberry', 'תות', '🍓', 4],
  ['watermelon', 'אבטיח', '🍉', 4], ['pineapple', 'אננס', '🍍', 4], ['mushroom', 'פטרייה', '🍄', 4],
  ['glasses', 'משקפיים', '👓', 4], ['lighthouse', 'מגדלור', '🗼', 4], ['helicopter', 'מסוק', '🚁', 4],
  ['ambulance', 'אמבולנס', '🚑', 4], ['firefighter', 'כבאי', '🧑‍🚒', 4], ['astronaut', 'אסטרונאוט', '🧑‍🚀', 4],
  ['kangaroo', 'קנגורו', '🦘', 4], ['crocodile', 'תנין', '🐊', 4], ['peacock', 'טווס', '🦚', 4],
  ['squirrel', 'סנאי', '🐿️', 4], ['hedgehog', 'קיפוד', '🦔', 4], ['unicorn', 'חד-קרן', '🦄', 4],

  // Level 2 – more core vocabulary (family, meals, weather, body)
  ['sister', 'אחות', '👭', 2], ['brother', 'אח', '👬', 2], ['grandma', 'סבתא', '👵', 2],
  ['grandpa', 'סבא', '👴', 2], ['friend', 'חבר', '🤝', 2], ['toy', 'צעצוע', '🧸', 2],
  ['sock', 'גרב', '🧦', 2], ['foot', 'כף רגל', '🦶', 2], ['hair', 'שיער', '💇', 2],
  ['tooth', 'שן', '🦷', 2], ['cup', 'כוס', '🥤', 2], ['spoon', 'כפית', '🥄', 2],
  ['fork', 'מזלג', '🍴', 2], ['plate', 'צלחת', '🍽️', 2], ['rice', 'אורז', '🍚', 2],
  ['meat', 'בשר', '🍖', 2], ['tea', 'תה', '🍵', 2], ['soap', 'סבון', '🧼', 2],
  ['sky', 'שמיים', '🌌', 2], ['grass', 'דשא', '🌿', 2], ['stone', 'אבן', '🪨', 2],
  ['wind', 'רוח', '🌬️', 2], ['night', 'לילה', '🌃', 2], ['day', 'יום', '🌤️', 2],
  ['purple', 'סגול', '🟣', 2], ['brown', 'חום', '🟤', 2], ['pink', 'ורוד', '🩷', 2],

  // Level 3 – more readers' vocabulary (places, jobs, clothes, nature, food)
  ['garden', 'גינה', '🌷', 3], ['kitchen', 'מטבח', '🍳', 3], ['bathroom', 'אמבטיה', '🛁', 3],
  ['street', 'רחוב', '🛣️', 3], ['shop', 'חנות', '🏪', 3], ['park', 'פארק', '🎠', 3],
  ['beach', 'חוף הים', '🏖️', 3], ['farm', 'חווה', '🚜', 3], ['hospital', 'בית חולים', '🏥', 3],
  ['library', 'ספרייה', '📚', 3], ['museum', 'מוזיאון', '🏛️', 3], ['nurse', 'אחות רפואית', '👩‍⚕️', 3],
  ['farmer', 'חקלאי', '👨‍🌾', 3], ['cook', 'טבח', '👨‍🍳', 3], ['pilot', 'טייס', '👨‍✈️', 3],
  ['artist', 'אמן', '🎨', 3], ['singer', 'זמר', '🎙️', 3], ['jacket', 'מעיל', '🧥', 3],
  ['pants', 'מכנסיים', '👖', 3], ['glove', 'כפפה', '🧤', 3], ['scarf', 'צעיף', '🧣', 3],
  ['boot', 'מגף', '🥾', 3], ['ruler', 'סרגל', '📏', 3], ['notebook', 'מחברת', '📓', 3],
  ['crayon', 'צבע לצביעה', '🖍️', 3], ['tiger', 'טיגריס', '🐅', 3], ['wolf', 'זאב', '🐺', 3],
  ['fox', 'שועל', '🦊', 3], ['owl', 'ינשוף', '🦉', 3], ['deer', 'אייל', '🦌', 3],
  ['goat', 'עז', '🐐', 3], ['ant', 'נמלה', '🐜', 3], ['carrot', 'גזר', '🥕', 3],
  ['tomato', 'עגבנייה', '🍅', 3], ['potato', 'תפוח אדמה', '🥔', 3], ['corn', 'תירס', '🌽', 3],
  ['lemon', 'לימון', '🍋', 3], ['peach', 'אפרסק', '🍑', 3], ['honey', 'דבש', '🍯', 3],
  ['cookie', 'עוגייה', '🍪', 3], ['popcorn', 'פופקורן', '🍿', 3], ['winter', 'חורף', '⛄', 3],

  // Level 4 – more expansion vocabulary (science, music, fantasy, machines)
  ['dinosaur', 'דינוזאור', '🦕', 4], ['volcano', 'הר געש', '🌋', 4], ['desert', 'מדבר', '🏜️', 4],
  ['forest', 'יער', '🌲', 4], ['ocean', 'אוקיינוס', '🌊', 4], ['planet', 'כוכב לכת', '🪐', 4],
  ['telescope', 'טלסקופ', '🔭', 4], ['magnet', 'מגנט', '🧲', 4], ['battery', 'סוללה', '🔋', 4],
  ['computer', 'מחשב', '💻', 4], ['printer', 'מדפסת', '🖨️', 4], ['envelope', 'מעטפה', '✉️', 4],
  ['calendar', 'לוח שנה', '📅', 4], ['suitcase', 'מזוודה', '🧳', 4], ['medicine', 'תרופה', '💊', 4],
  ['bandage', 'תחבושת', '🩹', 4], ['pumpkin', 'דלעת', '🎃', 4], ['balloon', 'בלון', '🎈', 4],
  ['kite', 'עפיפון', '🪁', 4], ['puzzle', 'פאזל', '🧩', 4], ['trophy', 'גביע', '🏆', 4],
  ['medal', 'מדליה', '🥇', 4], ['ticket', 'כרטיס', '🎫', 4], ['violin', 'כינור', '🎻', 4],
  ['piano', 'פסנתר', '🎹', 4], ['trumpet', 'חצוצרה', '🎺', 4], ['wizard', 'קוסם', '🧙', 4],
  ['mermaid', 'בת ים', '🧜', 4], ['fairy', 'פיה', '🧚', 4], ['treasure', 'אוצר', '💎', 4],
  ['compass', 'מצפן', '🧭', 4], ['anchor', 'עוגן', '⚓', 4], ['motorcycle', 'אופנוע', '🏍️', 4],
  ['taxi', 'מונית', '🚕', 4], ['truck', 'משאית', '🚚', 4], ['sunglasses', 'משקפי שמש', '🕶️', 4],

  // Level 5 – advanced vocabulary (the top band; longer, richer words)
  ['laboratory', 'מעבדה', '🧪', 5], ['microscope', 'מיקרוסקופ', '🔬', 5], ['satellite', 'לוויין', '🛰️', 5],
  ['galaxy', 'גלקסיה', '🌠', 5], ['waterfall', 'מפל מים', '🏞️', 5], ['chameleon', 'זיקית', '🦎', 5],
  ['scorpion', 'עקרב', '🦂', 5], ['jellyfish', 'מדוזה', '🪼', 5], ['flamingo', 'פלמינגו', '🦩', 5],
  ['parrot', 'תוכי', '🦜', 5], ['camel', 'גמל', '🐪', 5], ['leopard', 'ברדלס', '🐆', 5],
  ['gorilla', 'גורילה', '🦍', 5], ['rhino', 'קרנף', '🦏', 5], ['hippo', 'היפופוטם', '🦛', 5],
  ['raccoon', 'דביבון', '🦝', 5], ['sloth', 'עצלן', '🦥', 5], ['otter', 'לוטרה', '🦦', 5],
  ['beaver', 'בונה (חיה)', '🦫', 5], ['avocado', 'אבוקדו', '🥑', 5], ['broccoli', 'ברוקולי', '🥦', 5],
  ['cucumber', 'מלפפון', '🥒', 5], ['pretzel', 'בייגלה', '🥨', 5], ['croissant', 'קרואסון', '🥐', 5],
  ['engineer', 'מהנדס', '👷', 5], ['scientist', 'מדען', '🧑‍🔬', 5], ['detective', 'בלש', '🕵️', 5],
  ['mechanic', 'מכונאי', '🧑‍🔧', 5], ['stadium', 'אצטדיון', '🏟️', 5], ['airport', 'שדה תעופה', '🛫', 5],
  ['factory', 'מפעל', '🏭', 5], ['tunnel', 'מנהרה', '🚇', 5], ['calculator', 'מחשבון', '🧮', 5],
].map(([en, he, emoji, level]) => ({ en, he, emoji, level }));

// English letter names transliterated to Hebrew, so a beginner who can't read
// English yet can still answer "what is this letter called?".
const LETTERS = [
  { l: 'A', name: 'אֵיי' }, { l: 'B', name: 'בִּי' }, { l: 'C', name: 'סִי' },
  { l: 'D', name: 'דִי' }, { l: 'E', name: 'אִי' }, { l: 'F', name: 'אֶף' },
  { l: 'G', name: "גִ'י" }, { l: 'H', name: "אֵייץ'" }, { l: 'I', name: 'אַיי' },
  { l: 'J', name: "גֵ'יי" }, { l: 'K', name: 'קֵיי' }, { l: 'L', name: 'אֶל' },
  { l: 'M', name: 'אֶם' }, { l: 'N', name: 'אֶן' }, { l: 'O', name: 'אוֹ' },
  { l: 'P', name: 'פִּי' }, { l: 'Q', name: 'קְיוּ' }, { l: 'R', name: 'אַר' },
  { l: 'S', name: 'אֶס' }, { l: 'T', name: 'טִי' }, { l: 'U', name: 'יוּ' },
  { l: 'V', name: 'וִי' }, { l: 'W', name: 'דַאבֶּל יוּ' }, { l: 'X', name: 'אֶקְס' },
  { l: 'Y', name: 'וַואי' }, { l: 'Z', name: 'זִי' },
];

// Fast lookup from an English word to its {en, he, emoji, level} record.
const WORD_BY_EN = Object.fromEntries(WORDS.map(w => [w.en, w]));

// a / an is decided by the opening SOUND, not the letter: "a unicorn" (yoo-)
// but "an umbrella" (uh-). Only unambiguous words take part in that question.
const A_AN_TRICKY = ['unicorn', 'uniform', 'european', 'hour'];
const A_AN_VOWEL = WORDS.filter(w =>
  /^[aeio]/.test(w.en) || (w.en.startsWith('u') && !A_AN_TRICKY.includes(w.en)));
const A_AN_CONSONANT = WORDS.filter(w => /^[bcdfghjklmnpqrstvwxyz]/.test(w.en));

// [english, hebrew, emoji] everyday objects for the preposition sentences.
const PREP_NOUNS = [
  ['box', 'הקופסה', '📦'], ['table', 'השולחן', '🪑'], ['bed', 'המיטה', '🛏️'],
  ['tree', 'העץ', '🌳'], ['car', 'המכונית', '🚗'], ['house', 'הבית', '🏠'],
  ['chair', 'הכיסא', '🪑'], ['bag', 'התיק', '🎒'],
];

// Semantic groups (all words exist in WORDS above) for "odd one out".
const CATEGORIES_EN = {
  animals: ['cat', 'dog', 'lion', 'pig', 'cow', 'horse', 'bear', 'monkey', 'fish', 'bird', 'duck', 'rabbit', 'sheep', 'snake', 'frog', 'bee', 'elephant', 'penguin', 'tiger', 'wolf', 'fox', 'owl', 'deer', 'goat', 'camel', 'parrot', 'gorilla', 'hippo'],
  food: ['apple', 'banana', 'bread', 'cake', 'cheese', 'milk', 'pizza', 'egg', 'orange', 'candy', 'soup', 'grapes', 'rice', 'meat', 'carrot', 'tomato', 'potato', 'corn', 'lemon', 'peach', 'honey', 'cookie', 'avocado', 'cucumber'],
  transport: ['car', 'bus', 'train', 'plane', 'boat', 'bicycle', 'van', 'rocket', 'taxi', 'truck', 'motorcycle', 'helicopter', 'ambulance'],
  colors: ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'brown', 'pink'],
  body: ['nose', 'eye', 'ear', 'mouth', 'hand', 'foot', 'hair', 'tooth'],
  clothes: ['hat', 'shoe', 'shirt', 'dress', 'jacket', 'pants', 'sock', 'glove', 'scarf', 'boot'],
  school: ['pencil', 'book', 'teacher', 'school', 'ruler', 'notebook', 'crayon', 'bag'],
  jobs: ['doctor', 'police', 'teacher', 'nurse', 'farmer', 'cook', 'pilot', 'artist', 'singer', 'engineer', 'scientist'],
  nature: ['tree', 'flower', 'moon', 'sun', 'cloud', 'rain', 'snow', 'sky', 'grass', 'stone', 'forest', 'ocean', 'desert', 'mountain'],
  places: ['house', 'school', 'shop', 'park', 'beach', 'farm', 'hospital', 'library', 'museum', 'airport', 'factory', 'stadium'],
  music: ['guitar', 'drum', 'violin', 'piano', 'trumpet'],
};

// Hebrew names for the groups — used by "what are they all?" questions.
const CATEGORY_NAMES_HE = {
  animals: 'חיות', food: 'אוכל', transport: 'כלי תחבורה', colors: 'צבעים',
  body: 'איברי הגוף', clothes: 'בגדים', school: 'בית ספר', jobs: 'מקצועות',
  nature: 'טבע', places: 'מקומות', music: 'כלי נגינה',
};
const CATEGORY_NAMES_EN = {
  animals: 'animals', food: 'food', transport: 'transport', colors: 'colors',
  body: 'body parts', clothes: 'clothes', school: 'school things', jobs: 'jobs',
  nature: 'nature', places: 'places', music: 'instruments',
};

// [english, hebrew] opposite pairs — everyday antonyms for young learners.
// Every word appears exactly ONCE across the whole list, so a distractor can
// never collide with the answer.
const OPPOSITES = [
  ['big', 'small', 'גדול', 'קטן'], ['hot', 'cold', 'חם', 'קר'],
  ['up', 'down', 'למעלה', 'למטה'], ['day', 'night', 'יום', 'לילה'],
  ['happy', 'sad', 'שמח', 'עצוב'], ['fast', 'slow', 'מהר', 'לאט'],
  ['open', 'closed', 'פתוח', 'סגור'], ['old', 'new', 'ישן', 'חדש'],
  ['wet', 'dry', 'רטוב', 'יבש'], ['full', 'empty', 'מלא', 'ריק'],
  ['high', 'low', 'גבוה', 'נמוך'], ['long', 'short', 'ארוך', 'קצר'],
  ['good', 'bad', 'טוב', 'רע'], ['clean', 'dirty', 'נקי', 'מלוכלך'],
  ['yes', 'no', 'כן', 'לא'], ['in', 'out', 'בפנים', 'בחוץ'],
  ['left', 'right', 'שמאל', 'ימין'], ['light', 'dark', 'בהיר', 'כהה'],
  ['near', 'far', 'קרוב', 'רחוק'], ['strong', 'weak', 'חזק', 'חלש'],
  ['hard', 'soft', 'קשה', 'רך'], ['first', 'last', 'ראשון', 'אחרון'],
  ['loud', 'quiet', 'רועש', 'שקט'], ['rich', 'poor', 'עשיר', 'עני'],
  ['front', 'back', 'קדימה', 'אחורה'], ['same', 'different', 'אותו דבר', 'שונה'],
  ['always', 'never', 'תמיד', 'אף פעם'], ['start', 'finish', 'להתחיל', 'לסיים'],
  ['push', 'pull', 'לדחוף', 'למשוך'], ['give', 'take', 'לתת', 'לקחת'],
  ['under', 'over', 'מתחת', 'מעל'], ['inside', 'outside', 'בתוך', 'מחוץ'],
  ['sweet', 'sour', 'מתוק', 'חמוץ'], ['wide', 'narrow', 'רחב', 'צר'],
  ['smooth', 'rough', 'חלק', 'מחוספס'], ['early', 'late', 'מוקדם', 'מאוחר'],
  ['thick', 'thin', 'עבה', 'דק'], ['easy', 'difficult', 'קל', 'קשה (מסובך)'],
];

// [digit, english, hebrew] number names. Beyond 12 they drive the harder
// counting questions at the upper stages.
const NUMBERS = [
  [1, 'one', 'אחת'], [2, 'two', 'שתיים'], [3, 'three', 'שלוש'], [4, 'four', 'ארבע'],
  [5, 'five', 'חמש'], [6, 'six', 'שש'], [7, 'seven', 'שבע'], [8, 'eight', 'שמונה'],
  [9, 'nine', 'תשע'], [10, 'ten', 'עשר'], [11, 'eleven', 'אחת עשרה'], [12, 'twelve', 'שתים עשרה'],
  [13, 'thirteen', 'שלוש עשרה'], [14, 'fourteen', 'ארבע עשרה'], [15, 'fifteen', 'חמש עשרה'],
  [16, 'sixteen', 'שש עשרה'], [17, 'seventeen', 'שבע עשרה'], [18, 'eighteen', 'שמונה עשרה'],
  [19, 'nineteen', 'תשע עשרה'], [20, 'twenty', 'עשרים'], [30, 'thirty', 'שלושים'],
  [40, 'forty', 'ארבעים'], [50, 'fifty', 'חמישים'], [100, 'one hundred', 'מאה'],
];

// [english, hebrew, emoji, -ing form, past form] action verbs. The extra forms
// power the present-continuous and past-tense questions at the upper stages.
const VERBS = [
  ['run', 'לרוץ', '🏃', 'running', 'ran'], ['jump', 'לקפוץ', '🤸', 'jumping', 'jumped'],
  ['eat', 'לאכול', '🍽️', 'eating', 'ate'], ['sleep', 'לישון', '😴', 'sleeping', 'slept'],
  ['sit', 'לשבת', '🪑', 'sitting', 'sat'], ['walk', 'ללכת', '🚶', 'walking', 'walked'],
  ['read', 'לקרוא', '📖', 'reading', 'read'], ['play', 'לשחק', '🧸', 'playing', 'played'],
  ['swim', 'לשחות', '🏊', 'swimming', 'swam'], ['sing', 'לשיר', '🎤', 'singing', 'sang'],
  ['dance', 'לרקוד', '💃', 'dancing', 'danced'], ['drink', 'לשתות', '🥤', 'drinking', 'drank'],
  ['write', 'לכתוב', '✍️', 'writing', 'wrote'], ['cry', 'לבכות', '😢', 'crying', 'cried'],
  ['laugh', 'לצחוק', '😄', 'laughing', 'laughed'], ['fly', 'לעוף', '🕊️', 'flying', 'flew'],
  ['draw', 'לצייר', '🖍️', 'drawing', 'drew'], ['cook', 'לבשל', '🍳', 'cooking', 'cooked'],
  ['climb', 'לטפס', '🧗', 'climbing', 'climbed'], ['ride', 'לרכוב', '🚴', 'riding', 'rode'],
  ['throw', 'לזרוק', '🤾', 'throwing', 'threw'], ['catch', 'לתפוס', '🥎', 'catching', 'caught'],
  ['open', 'לפתוח', '🚪', 'opening', 'opened'], ['close', 'לסגור', '🔒', 'closing', 'closed'],
  ['wash', 'לרחוץ', '🧼', 'washing', 'washed'], ['brush', 'לצחצח', '🪥', 'brushing', 'brushed'],
  ['listen', 'להקשיב', '👂', 'listening', 'listened'], ['speak', 'לדבר', '🗣️', 'speaking', 'spoke'],
  ['help', 'לעזור', '🤝', 'helping', 'helped'], ['buy', 'לקנות', '🛒', 'buying', 'bought'],
  ['give', 'לתת', '🎁', 'giving', 'gave'], ['find', 'למצוא', '🔎', 'finding', 'found'],
  ['build', 'לבנות', '🧱', 'building', 'built'], ['count', 'לספור', '🔢', 'counting', 'counted'],
  ['smile', 'לחייך', '😊', 'smiling', 'smiled'], ['think', 'לחשוב', '🤔', 'thinking', 'thought'],
];

// [english, hebrew] everyday phrases & greetings.
const PHRASES = [
  ['hello', 'שלום (בפגישה)'], ['goodbye', 'להתראות'], ['thank you', 'תודה'], ['please', 'בבקשה'],
  ['sorry', 'סליחה'], ['good morning', 'בוקר טוב'], ['good night', 'לילה טוב'], ['yes', 'כן'],
  ['no', 'לא'], ['how are you?', 'מה שלומך?'], ['I love you', 'אני אוהב אותך'], ['very good', 'טוב מאוד'],
  ['excuse me', 'סליחה (לפנייה)'], ['you are welcome', 'על לא דבר'], ['good afternoon', 'צהריים טובים'],
  ['good evening', 'ערב טוב'], ['see you later', 'נתראה אחר כך'], ['nice to meet you', 'נעים להכיר'],
  ['what is your name?', 'איך קוראים לך?'], ['my name is Dan', 'קוראים לי דן'],
  ['how old are you?', 'בן כמה אתה?'], ['I am seven years old', 'אני בן שבע'],
  ['where are you from?', 'מאיפה אתה?'], ['I am from Israel', 'אני מישראל'],
  ['I am hungry', 'אני רעב'], ['I am thirsty', 'אני צמא'], ['I am tired', 'אני עייף'],
  ['help me, please', 'עזרו לי בבקשה'], ['I do not know', 'אני לא יודע'], ['I understand', 'אני מבין'],
  ['have a nice day', 'שיהיה יום טוב'], ['happy birthday', 'יום הולדת שמח'], ['good luck', 'בהצלחה'],
  ['be careful', 'תיזהר'], ['come here', 'בוא הנה'], ['no problem', 'אין בעיה'],
  ['what time is it?', 'מה השעה?'], ['how much is it?', 'כמה זה עולה?'],
  ['I like it', 'אני אוהב את זה'], ['me too', 'גם אני'],
];

// ── Grammar & conversation pools (the challenging upper stages) ────────────

// Days and months, in order — sequence questions ("what comes after…?").
const DAYS = [
  ['Sunday', 'ראשון'], ['Monday', 'שני'], ['Tuesday', 'שלישי'], ['Wednesday', 'רביעי'],
  ['Thursday', 'חמישי'], ['Friday', 'שישי'], ['Saturday', 'שבת'],
];
const MONTHS = [
  ['January', 'ינואר'], ['February', 'פברואר'], ['March', 'מרץ'], ['April', 'אפריל'],
  ['May', 'מאי'], ['June', 'יוני'], ['July', 'יולי'], ['August', 'אוגוסט'],
  ['September', 'ספטמבר'], ['October', 'אוקטובר'], ['November', 'נובמבר'], ['December', 'דצמבר'],
];

// [english, hebrew] place prepositions — asked as a translation so the answer
// is never ambiguous (a picture can't show "under" vs "next to" reliably).
const PREPOSITIONS = [
  ['in', 'בתוך'], ['on', 'על'], ['under', 'מתחת ל'], ['next to', 'ליד'],
  ['behind', 'מאחורי'], ['in front of', 'לפני'], ['between', 'בין'], ['above', 'מעל'],
];

// [sentence with ___, answer, hebrew clue] — pronouns.
const PRONOUNS = [
  ['Dan is my brother. ___ is eight.', 'He', 'דן — הוא'],
  ['Maya is my sister. ___ is five.', 'She', 'מאיה — היא'],
  ['This is my dog. ___ is very big.', 'It', 'הכלב — זה'],
  ['Dan and Maya are here. ___ are happy.', 'They', 'דן ומאיה — הם'],
  ['My mother and I are home. ___ are together.', 'We', 'אמא ואני — אנחנו'],
  ['___ am a pupil in school.', 'I', 'אני'],
  ['The cat is hungry. Give ___ some food.', 'it', 'לחתול — לו'],
  ['My father works. ___ is a doctor.', 'He', 'אבא — הוא'],
  ['My grandma is old. ___ makes good cake.', 'She', 'סבתא — היא'],
  ['The boys play football. ___ are in the park.', 'They', 'הילדים — הם'],
  ['My friend and I read. ___ like books.', 'We', 'החבר ואני — אנחנו'],
  ['Look at the bird! ___ is very small.', 'It', 'הציפור — זה/זו'],
  ['Noa is my friend. ___ has a red bag.', 'She', 'נועה — היא'],
  ['My brother is tall. ___ plays basketball.', 'He', 'אחי — הוא'],
  ['The teachers are nice. ___ help the children.', 'They', 'המורים — הם'],
  ['___ love my family very much.', 'I', 'אני'],
  ['The house is big. ___ has four rooms.', 'It', 'הבית — הוא'],
  ['Dan and I are brothers. ___ live together.', 'We', 'דן ואני — אנחנו'],
  ['Mom is in the kitchen. ___ is cooking.', 'She', 'אמא — היא'],
  ['My dogs are happy. ___ run in the garden.', 'They', 'הכלבים — הם'],
];
const PRONOUN_OPTIONS = ['He', 'She', 'It', 'They', 'We', 'I'];

// [sentence with ___, answer, hebrew clue] — the verb "to be".
const BE_ITEMS = [
  ['I ___ happy today.', 'am', 'אני'],
  ['She ___ my teacher.', 'is', 'היא'],
  ['They ___ my friends.', 'are', 'הם'],
  ['We ___ in the classroom.', 'are', 'אנחנו'],
  ['The dog ___ black.', 'is', 'הכלב'],
  ['You ___ very kind.', 'are', 'אתה'],
  ['It ___ a beautiful day.', 'is', 'זה'],
  ['My brothers ___ at school.', 'are', 'האחים שלי'],
  ['I ___ eight years old.', 'am', 'אני'],
  ['The cat ___ under the table.', 'is', 'החתול'],
  ['My friends ___ very funny.', 'are', 'החברים שלי'],
  ['You and I ___ a good team.', 'are', 'אתה ואני'],
  ['My name ___ Dan.', 'is', 'השם שלי'],
  ['The books ___ on the desk.', 'are', 'הספרים'],
  ['I ___ not tired.', 'am', 'אני'],
  ['She ___ in the garden now.', 'is', 'היא'],
  ['We ___ ready for school.', 'are', 'אנחנו'],
  ['The weather ___ cold today.', 'is', 'מזג האוויר'],
];

// Question words — "___ is your name?"
const QUESTION_WORDS = [
  ['___ is your name?', 'What', 'מה'],
  ['___ do you live?', 'Where', 'איפה'],
  ['___ is your teacher?', 'Who', 'מי'],
  ['___ old are you?', 'How', 'בן כמה — איך'],
  ['___ is your birthday?', 'When', 'מתי'],
  ['___ do you like ice cream?', 'Why', 'למה'],
  ['___ color is your bag?', 'What', 'איזה'],
  ['___ many brothers do you have?', 'How', 'כמה'],
  ['___ is your favorite food?', 'What', 'מה'],
  ['___ are my shoes?', 'Where', 'איפה'],
  ['___ is knocking on the door?', 'Who', 'מי'],
  ['___ does the film start?', 'When', 'מתי'],
  ['___ are you crying?', 'Why', 'למה'],
  ['___ do you go to school?', 'How', 'איך'],
  ['___ is that girl over there?', 'Who', 'מי'],
  ['___ do you eat breakfast?', 'When', 'מתי'],
  ['___ are you going now?', 'Where', 'לאן'],
  ['___ is in your bag?', 'What', 'מה'],
  ['___ much water do you drink?', 'How', 'כמה'],
  ['___ is the classroom empty?', 'Why', 'למה'],
  ['___ is your best friend?', 'Who', 'מי'],
  ['___ do you play football?', 'When', 'מתי'],
  ['___ is my blue pencil?', 'Where', 'איפה'],
  ['___ are you doing now?', 'What', 'מה'],
  ['___ old is your brother?', 'How', 'בן כמה'],
  ['___ is the dog barking?', 'Why', 'למה'],
  ['___ lives in this house?', 'Who', 'מי'],
  ['___ does the bus come?', 'When', 'מתי'],
  ['___ do you keep your books?', 'Where', 'איפה'],
  ['___ is the name of your school?', 'What', 'מה'],
];
const QUESTION_WORD_OPTIONS = ['What', 'Where', 'Who', 'How', 'When', 'Why'];

// [question, correct reply, hebrew] — pick the answer that fits the question.
const DIALOGUES = [
  ['How are you?', 'I am fine, thank you.', 'מה שלומך?'],
  ['What is your name?', 'My name is Dan.', 'איך קוראים לך?'],
  ['How old are you?', 'I am seven years old.', 'בן כמה אתה?'],
  ['Where do you live?', 'I live in Israel.', 'איפה אתה גר?'],
  ['What is this?', 'It is a book.', 'מה זה?'],
  ['Do you like apples?', 'Yes, I do.', 'אתה אוהב תפוחים?'],
  ['What time is it?', 'It is three o\'clock.', 'מה השעה?'],
  ['Can I have some water?', 'Yes, of course.', 'אפשר מים?'],
  ['Thank you very much!', 'You are welcome.', 'תודה רבה!'],
  ['Good night!', 'Sleep well!', 'לילה טוב!'],
  ['What color is the sky?', 'It is blue.', 'באיזה צבע השמיים?'],
  ['How many legs does a dog have?', 'It has four legs.', 'כמה רגליים לכלב?'],
  ['Where is your school?', 'It is near my house.', 'איפה בית הספר שלך?'],
  ['Do you have a pet?', 'Yes, I have a cat.', 'יש לך חיית מחמד?'],
  ['What is your favorite color?', 'I like green.', 'מה הצבע האהוב עליך?'],
  ['Are you hungry?', 'No, I am not.', 'אתה רעב?'],
  ['Who is your teacher?', 'Her name is Mrs. Cohen.', 'מי המורה שלך?'],
  ['When do you go to sleep?', 'At eight o\'clock.', 'מתי אתה הולך לישון?'],
  ['How do you go to school?', 'I go by bus.', 'איך אתה מגיע לבית הספר?'],
  ['What day is it today?', 'It is Monday.', 'איזה יום היום?'],
  ['Can you help me, please?', 'Yes, of course I can.', 'אתה יכול לעזור לי?'],
  ['Is this your bag?', 'No, it is my sister\'s.', 'זה התיק שלך?'],
  ['Why are you happy?', 'Because it is my birthday.', 'למה אתה שמח?'],
  ['How many brothers do you have?', 'I have two brothers.', 'כמה אחים יש לך?'],
  ['What are you doing?', 'I am reading a book.', 'מה אתה עושה?'],
  ['See you tomorrow!', 'Goodbye, see you!', 'נתראה מחר!'],
  ['Excuse me, where is the door?', 'It is over there.', 'סליחה, איפה הדלת?'],
  ['Do you like school?', 'Yes, I love it.', 'אתה אוהב את בית הספר?'],
  ['What is the weather today?', 'It is sunny and hot.', 'מה מזג האוויר היום?'],
];

// [base, comparative, superlative, hebrew] — degrees of comparison.
const COMPARATIVES = [
  ['big', 'bigger', 'biggest', 'גדול'], ['small', 'smaller', 'smallest', 'קטן'],
  ['tall', 'taller', 'tallest', 'גבוה'], ['fast', 'faster', 'fastest', 'מהיר'],
  ['long', 'longer', 'longest', 'ארוך'], ['strong', 'stronger', 'strongest', 'חזק'],
  ['cold', 'colder', 'coldest', 'קר'], ['old', 'older', 'oldest', 'זקן'],
  ['happy', 'happier', 'happiest', 'שמח'], ['good', 'better', 'best', 'טוב'],
  ['bad', 'worse', 'worst', 'רע'], ['nice', 'nicer', 'nicest', 'נחמד'],
  ['short', 'shorter', 'shortest', 'קצר'], ['young', 'younger', 'youngest', 'צעיר'],
  ['clean', 'cleaner', 'cleanest', 'נקי'], ['warm', 'warmer', 'warmest', 'חמים'],
  ['heavy', 'heavier', 'heaviest', 'כבד'], ['funny', 'funnier', 'funniest', 'מצחיק'],
  ['easy', 'easier', 'easiest', 'קל'], ['quiet', 'quieter', 'quietest', 'שקט'],
];

// Riddles — read a real English clue and pick the word. Answers all exist in
// WORDS, so the option list can show the pictures.
const RIDDLES = [
  ['It is yellow. Monkeys love it.', 'banana'], ['It has four legs and says "moo".', 'cow'],
  ['It is very tall and has a long neck.', 'giraffe'], ['We sleep in it at night.', 'bed'],
  ['It shines in the day and it is hot.', 'sun'], ['It has wings and it sings.', 'bird'],
  ['We use it to open a door.', 'key'], ['It lives in the sea and has eight arms.', 'octopus'],
  ['It is white and cold and falls in winter.', 'snow'], ['We read it before we sleep.', 'book'],
  ['It has stripes and looks like a horse.', 'zebra'], ['It goes to space.', 'rocket'],
  ['It is round and we play football with it.', 'ball'], ['It is the biggest animal in the sea.', 'whale'],
  ['It has many colors and comes after the rain.', 'rainbow'], ['We cut paper with it.', 'scissors'],
  ['It gives light at night in the sky.', 'moon'], ['It is red and grows on a tree.', 'apple'],
  ['It carries many children to school.', 'bus'], ['It makes honey.', 'bee'],
  ['It has two wheels and we ride it.', 'bicycle'], ['It is orange and rabbits eat it.', 'carrot'],
  ['It has a trunk and very big ears.', 'elephant'], ['We wear it on our feet.', 'shoe'],
  ['It is a big cat with orange and black stripes.', 'tiger'],
  ['It flies at night and it is very wise.', 'owl'], ['It lives in the desert and has a hump.', 'camel'],
  ['We use it to write in school.', 'pencil'], ['It is very cold and we put ice cream in it.', 'ice'],
  ['It has many rooms and we live in it.', 'house'], ['It can repeat what you say.', 'parrot'],
  ['It is green and jumps near the water.', 'frog'], ['It is a fruit and it is very big and green outside.', 'watermelon'],
  ['It has no legs and it can be very long.', 'snake'], ['It helps us see the time on our wrist.', 'clock'],
  ['We open it when it rains.', 'umbrella'], ['It is a big bird that cannot fly and it likes the cold.', 'penguin'],
  ['It is sweet and brown and children love to eat it.', 'chocolate'],
  ['It moves slowly and carries its house.', 'turtle'], ['We put our books inside it.', 'bag'],
];

// Short reading passages with a comprehension question (the top stage).
const READINGS = [
  {
    text: 'Tom is seven years old. He has a small dog. The dog is black and white. Every day Tom plays with his dog in the park.',
    q: 'What color is the dog?', a: 'Black and white', wrong: ['Brown', 'Yellow'],
  },
  {
    text: 'Maya loves apples. Every morning she eats one red apple. Today she has two apples: one for her and one for her friend Noa.',
    q: 'How many apples does Maya have today?', a: 'Two', wrong: ['One', 'Five'],
  },
  {
    text: 'It is Monday. Dan goes to school by bus. In school he reads a big book about animals. His favorite animal is the elephant.',
    q: 'How does Dan go to school?', a: 'By bus', wrong: ['By car', 'He walks'],
  },
  {
    text: 'The sun is hot today. The children are at the beach. They swim in the water and build a castle in the sand.',
    q: 'Where are the children?', a: 'At the beach', wrong: ['At school', 'At home'],
  },
  {
    text: 'Grandma has a big garden. In the garden there are many flowers and one old tree. A little bird lives in the tree.',
    q: 'Who lives in the tree?', a: 'A little bird', wrong: ['A big cat', 'Grandma'],
  },
  {
    text: 'Noa is happy. Today is her birthday. She is eight years old. Her mother made a chocolate cake with eight candles.',
    q: 'How old is Noa today?', a: 'Eight', wrong: ['Seven', 'Ten'],
  },
  {
    text: 'It rains a lot in winter. Yoni takes his umbrella and his blue coat. He walks slowly to school with his sister.',
    q: 'What does Yoni take with him?', a: 'An umbrella and a coat', wrong: ['A ball and a bag', 'A book and a pencil'],
  },
  {
    text: 'The cat is under the table. The dog is on the sofa. The bird is in a cage near the window. The house is very quiet.',
    q: 'Where is the cat?', a: 'Under the table', wrong: ['On the sofa', 'Near the window'],
  },
  {
    text: 'Ari has a big family. He has two brothers and one sister. Every Friday they eat dinner together at grandma\'s house.',
    q: 'How many brothers does Ari have?', a: 'Two', wrong: ['One', 'Three'],
  },
  {
    text: 'The zoo is open today. The children look at the lions and the monkeys. The monkeys are very funny. They jump and play all day.',
    q: 'Which animals are funny?', a: 'The monkeys', wrong: ['The lions', 'The birds'],
  },
  {
    text: 'Lior likes to draw. He has many colors, but his favorite color is blue. Today he draws the sea and a small white boat.',
    q: 'What is Lior\'s favorite color?', a: 'Blue', wrong: ['White', 'Green'],
  },
  {
    text: 'In the morning Shira drinks milk and eats bread with cheese. She does not like eggs. After breakfast she goes to school with her father.',
    q: 'What does Shira not like?', a: 'Eggs', wrong: ['Milk', 'Cheese'],
  },
  {
    text: 'The library is near the school. Every Tuesday Nadav takes two books home. He reads them at night before he sleeps.',
    q: 'When does Nadav read?', a: 'At night', wrong: ['In the morning', 'At school'],
  },
  {
    text: 'It is very hot in summer. The family goes to the pool. Yael swims fast, but her little brother plays with a ball in the water.',
    q: 'What does the little brother do?', a: 'He plays with a ball', wrong: ['He swims fast', 'He sleeps'],
  },
  {
    text: 'Our teacher has a big brown dog. Sometimes she brings him to school. All the children want to give him food, but the dog eats only at home.',
    q: 'Where does the dog eat?', a: 'Only at home', wrong: ['At school', 'In the park'],
  },
  {
    text: 'Every Saturday the family walks to the park. Dad takes bread for the birds. The children run and play, and then they all eat lunch under a big tree.',
    q: 'What does Dad take to the park?', a: 'Bread for the birds', wrong: ['A ball', 'A book'],
  },
  {
    text: 'Omer lost his blue pencil. He looked under the table and inside his bag. In the end he found it in his coat pocket.',
    q: 'Where was the pencil?', a: 'In his coat pocket', wrong: ['Under the table', 'Inside his bag'],
  },
  {
    text: 'The little cat was on the roof and could not come down. A firefighter came with a long ladder and helped her. Now the cat sleeps safely at home.',
    q: 'Who helped the cat?', a: 'A firefighter', wrong: ['A doctor', 'A teacher'],
  },
  {
    text: 'Tal has swimming lessons on Wednesday and piano lessons on Sunday. He likes swimming more, because the water is cool and he swims very fast.',
    q: 'When does Tal play the piano?', a: 'On Sunday', wrong: ['On Wednesday', 'On Monday'],
  },
  {
    text: 'It snows in the mountains in winter. The children make a big snowman with a carrot nose and two black stones for the eyes.',
    q: 'What is the snowman\'s nose?', a: 'A carrot', wrong: ['A stone', 'A ball'],
  },
  {
    text: 'Rona works in a big hospital. She helps children who are sick. She always smiles, so the children are not afraid.',
    q: 'Where does Rona work?', a: 'In a hospital', wrong: ['In a school', 'In a shop'],
  },
  {
    text: 'The elephant is the biggest animal on land. It eats grass and leaves, and it drinks water with its long trunk. Elephants live together in a big family.',
    q: 'What does an elephant eat?', a: 'Grass and leaves', wrong: ['Fish and meat', 'Bread and cheese'],
  },
  {
    text: 'Ido opened his birthday present. Inside there was a red bicycle! He rode it all afternoon around the house with his best friend.',
    q: 'What was in the present?', a: 'A red bicycle', wrong: ['A blue ball', 'A new book'],
  },
  {
    text: 'In the morning the market is full of people. Grandma buys tomatoes, cucumbers and one big watermelon. The watermelon is very heavy, so grandpa carries it.',
    q: 'Who carries the watermelon?', a: 'Grandpa', wrong: ['Grandma', 'The children'],
  },
  {
    text: 'Our class went to the museum by bus. We saw old machines and the bones of a real dinosaur. The dinosaur was taller than our teacher!',
    q: 'What did the class see?', a: 'A dinosaur\'s bones', wrong: ['A big ship', 'Many animals'],
  },
  {
    text: 'Yuval reads a book about the moon. He learns that the moon has no water and no air. One day he wants to be an astronaut and fly there.',
    q: 'What does Yuval want to be?', a: 'An astronaut', wrong: ['A pilot', 'A doctor'],
  },
  {
    text: 'The garden behind the house is small but beautiful. In spring it is full of yellow flowers, and many bees come to visit them every morning.',
    q: 'What color are the flowers?', a: 'Yellow', wrong: ['Red', 'White'],
  },
];

// Sentences the child rebuilds from scrambled words (word order).
const ORDER_SENTENCES = [
  'I like ice cream', 'The cat is black', 'She has a red bag', 'We go to school',
  'My father is a doctor', 'The sun is very hot', 'I have two brothers',
  'They play in the park', 'He reads a big book', 'The dog runs very fast',
  'I am eight years old', 'We eat bread and cheese', 'The bird sits on the tree',
  'My mother makes a cake', 'The children are happy',
  'I go to school every day', 'The teacher reads a story', 'We play football in the park',
  'My sister has a small cat', 'The boy drinks cold water', 'I like to read books',
  'The girl sings a nice song', 'My grandma makes good soup', 'The train is very long',
  'We live in a big house', 'The flowers are red and yellow', 'I have a new blue bag',
  'The children eat an apple', 'My friend rides a bicycle', 'The moon is in the sky',
  'We go home after school',
];

// Dolch-style high-frequency ("sight") words in context.
const SIGHT_WORDS = [
  ['and', 'ו…', 'I like cats ___ dogs.'], ['but', 'אבל', 'I am tired ___ happy.'],
  ['with', 'עם', 'I play ___ my friend.'], ['for', 'בשביל', 'This gift is ___ you.'],
  ['because', 'כי', 'I am happy ___ it is my birthday.'],
  ['very', 'מאוד', 'The elephant is ___ big.'], ['also', 'גם', 'I ___ like pizza.'],
  ['every', 'כל', '___ day I go to school.'], ['many', 'הרבה', 'There are ___ stars in the sky.'],
  ['some', 'קצת / כמה', 'Can I have ___ water?'], ['there', 'שם / יש', '___ is a bird in the tree.'],
  ['here', 'כאן', 'Come ___, please.'], ['now', 'עכשיו', 'We eat dinner ___.'],
  ['then', 'אחר כך', 'First we read, ___ we sleep.'], ['again', 'שוב', 'Please say it ___.'],
  ['together', 'ביחד', 'We play ___ every day.'],
  ['always', 'תמיד', 'I ___ brush my teeth before bed.'],
  ['never', 'אף פעם לא', 'She ___ eats fish.'],
  ['sometimes', 'לפעמים', 'We ___ go to the beach.'],
  ['before', 'לפני', 'Wash your hands ___ dinner.'],
  ['after', 'אחרי', 'We play ___ we finish our homework.'],
  ['under', 'מתחת', 'The ball is ___ the bed.'],
  ['about', 'על / אודות', 'This book is ___ animals.'],
  ['too', 'מדי / גם', 'The soup is ___ hot.'],
  ['only', 'רק', 'I have ___ one brother.'],
  ['both', 'שניהם', '___ children are happy.'],
  ['near', 'ליד', 'My school is ___ my house.'],
  ['without', 'בלי', 'I cannot read ___ my glasses.'],
];

// [colored square, english, hebrew] for the colour question.
const COLORS_EN = [
  ['🟥', 'red', 'אדום'], ['🟦', 'blue', 'כחול'], ['🟩', 'green', 'ירוק'], ['🟨', 'yellow', 'צהוב'],
  ['⬛', 'black', 'שחור'], ['⬜', 'white', 'לבן'], ['🟧', 'orange', 'כתום'], ['🟪', 'purple', 'סגול'],
  ['🟫', 'brown', 'חום'], ['🩷', 'pink', 'ורוד'],
];

// Sentence riddles — read the clue, choose the matching word (real reading).
const SENTENCES = [
  { s: 'A ___ says "meow".', a: 'cat', he: 'אומר מיאו' },
  { s: 'A ___ says "woof".', a: 'dog', he: 'אומר האו' },
  { s: 'The ___ shines at night.', a: 'moon', he: 'מאיר בלילה' },
  { s: 'We read a ___.', a: 'book', he: 'קוראים' },
  { s: 'A ___ can fly.', a: 'bird', he: 'יכולה לעוף' },
  { s: 'We drink ___.', a: 'water', he: 'שותים' },
  { s: 'The ___ is hot.', a: 'sun', he: 'חם מאוד' },
  { s: 'A ___ lives in the sea.', a: 'fish', he: 'חי בים' },
  { s: 'We sleep in a ___.', a: 'bed', he: 'ישנים בּ' },
  { s: 'A ___ has stripes.', a: 'zebra', he: 'עם פסים' },
  { s: 'A ___ is very big.', a: 'elephant', he: 'גדול מאוד' },
  { s: 'We eat an ___.', a: 'apple', he: 'אוכלים' },
  { s: 'A ___ has a long neck.', a: 'giraffe', he: 'בעל צוואר ארוך' },
  { s: 'A ___ gives us milk.', a: 'cow', he: 'נותנת לנו חלב' },
  { s: 'We eat ___ for breakfast.', a: 'bread', he: 'אוכלים לארוחת בוקר' },
  { s: 'A ___ has beautiful wings.', a: 'butterfly', he: 'בעל כנפיים יפות' },
  { s: 'The ___ is white in the sky.', a: 'cloud', he: 'לבן בשמיים' },
  { s: 'We wear a ___ on our head.', a: 'hat', he: 'חובשים על הראש' },
  { s: 'A ___ can jump very high.', a: 'kangaroo', he: 'קופץ גבוה מאוד' },
  { s: 'We write with a ___.', a: 'pencil', he: 'כותבים איתו' },
  { s: 'An ___ has eight arms.', a: 'octopus', he: 'בעל שמונה זרועות' },
  { s: 'We open the door with a ___.', a: 'key', he: 'פותחים איתו את הדלת' },
  { s: 'A ___ flies in the sky.', a: 'plane', he: 'טס בשמיים' },
  { s: 'The ___ makes honey.', a: 'bee', he: 'מייצרת דבש' },
  { s: 'A ___ walks very slowly.', a: 'turtle', he: 'הולך לאט מאוד' },
  { s: 'We ride the ___ to school.', a: 'bus', he: 'נוסעים איתו לבית הספר' },
  { s: 'The ___ is the biggest animal in the sea.', a: 'whale', he: 'הכי גדול בים' },
  { s: 'We cut paper with ___.', a: 'scissors', he: 'גוזרים איתם נייר' },
  { s: 'A ___ tells us the time.', a: 'clock', he: 'מראה לנו את השעה' },
  { s: 'We take pictures with a ___.', a: 'camera', he: 'מצלמים איתה' },
  { s: 'A ___ has many books.', a: 'library', he: 'יש בה הרבה ספרים' },
  { s: 'The ___ helps sick people.', a: 'doctor', he: 'עוזר לאנשים חולים' },
  { s: 'A ___ goes to space.', a: 'rocket', he: 'טס לחלל' },
  { s: 'We carry our books in a ___.', a: 'bag', he: 'סוחבים בו ספרים' },
  { s: 'A ___ wears a crown.', a: 'king', he: 'חובש כתר' },
  { s: 'We put flowers in the ___.', a: 'garden', he: 'שמים בה פרחים' },
  { s: 'The ___ teaches us in school.', a: 'teacher', he: 'מלמד בבית הספר' },
  { s: 'A ___ lives in the desert.', a: 'camel', he: 'חי במדבר' },
  { s: 'We play music on a ___.', a: 'piano', he: 'מנגנים עליו' },
  { s: 'A ___ is a very fast cat.', a: 'leopard', he: 'חתול מהיר מאוד' },
  { s: 'We look at the stars with a ___.', a: 'telescope', he: 'מסתכלים בו על הכוכבים' },
];

// Pick a word for the given band: mostly that band's words, some easier
// review. `hard` (a_to_b track) allows long words; the younger track prefers
// short ones (≤6 letters) so the same stage stays age-appropriate.
function pickWord(band, filter = () => true, hard = false) {
  const fits = hard ? filter : (w) => filter(w) && (w.en.length <= 6 || w.level <= 1);
  let own = WORDS.filter(w => w.level === band && fits(w));
  let lower = WORDS.filter(w => w.level < band && fits(w));
  if (!own.length && !lower.length) {           // filter too strict – relax
    own = WORDS.filter(w => w.level === band && filter(w));
    lower = WORDS.filter(w => w.level < band && filter(w));
  }
  const pool = (Math.random() < 0.7 && own.length) ? own : (lower.length ? lower : own);
  return pick(pool.length ? pool : WORDS);
}

function wrongWords(correct, n, filter = () => true) {
  // Distinct English words, Hebrew translations AND emojis, so no matter
  // which field becomes the option text the choices never collide.
  const out = [];
  const seen = new Set([correct.en, correct.he, correct.emoji]);
  for (const w of shuffle(WORDS.filter(filter))) {
    if (seen.has(w.en) || seen.has(w.he) || seen.has(w.emoji)) continue;
    seen.add(w.en); seen.add(w.he); seen.add(w.emoji);
    out.push(w);
    if (out.length === n) break;
  }
  return out;
}

const GENERATORS = {
  // ── Stage 1: the alphabet ─────────────────────────────────────────────
  en_letter_name: () => {
    const letter = pick(LETTERS);
    const wrong = shuffle(LETTERS.filter(x => x.l !== letter.l)).slice(0, 3);
    return {
      type: 'en_letter_name', difficulty: 1, dir: 'rtl',
      question: `מה שמה של האות הזו באנגלית?`,
      displayLetter: letter.l,
      audioText: letter.l, audioLang: 'en',
      answer: letter.name,
      options: shuffle([letter, ...wrong]).map(x => x.name),
      hint: `הקשיבו לצליל 🔊`,
    };
  },
  en_letter_find: () => {
    const letter = pick(LETTERS);
    const distractors = shuffle(LETTERS.filter(x => x.l !== letter.l)).slice(0, 5);
    return {
      type: 'en_letter_find', difficulty: 1, dir: 'rtl',
      question: `מצא את האות ${letter.l} (${letter.name})`,
      displayLetters: shuffle([letter, ...distractors]).map(x => x.l),
      audioText: letter.l, audioLang: 'en',
      answer: letter.l,
      hint: `חפשו את ${letter.l}`,
    };
  },
  en_first_letter: (band, hard) => {
    const word = pickWord(Math.min(band, 2), undefined, hard);
    const first = word.en[0].toUpperCase();
    const wrong = shuffle(LETTERS.filter(x => x.l !== first)).slice(0, 3).map(x => x.l);
    return {
      type: 'en_first_letter', difficulty: 1, dir: 'rtl',
      question: `באיזו אות מתחילה המילה "${word.en}"? (${word.he})`,
      displayImage: word.emoji,
      audioText: word.en, audioLang: 'en',
      answer: first,
      options: shuffle([first, ...wrong]),
      hint: `${word.en} — הקשיבו לצליל הראשון 🔊`,
    };
  },

  // ── Stage 2: vocabulary with pictures + listening ─────────────────────
  en_word_to_pic: (band, hard) => {
    const word = pickWord(band, undefined, hard);
    const wrong = wrongWords(word, 3);
    return {
      type: 'en_word_to_pic', difficulty: 2, dir: 'rtl',
      question: `מה מתאים למילה?`,
      displayWord: word.en,
      audioText: word.en, audioLang: 'en',
      answer: word.emoji,
      options: shuffle([word, ...wrong]).map(w => w.emoji),
      hint: `${word.en} = ${word.he}`,
    };
  },
  en_pic_to_word: (band, hard) => {
    const word = pickWord(band, undefined, hard);
    const wrong = wrongWords(word, 3);
    return {
      type: 'en_pic_to_word', difficulty: 2, dir: 'rtl',
      question: `איזו מילה באנגלית מתאימה לתמונה?`,
      displayImage: word.emoji,
      audioText: word.en, audioLang: 'en',
      answer: word.en,
      options: shuffle([word, ...wrong]).map(w => w.en),
      hint: `בעברית זה ${word.he}`,
    };
  },
  en_listen_pick: (band, hard) => {
    const word = pickWord(band, undefined, hard);
    const wrong = wrongWords(word, 3);
    return {
      type: 'en_listen_pick', difficulty: 2, dir: 'rtl',
      question: `🔊 הקשיבו — מה שמעתם?`,
      audioText: word.en, audioLang: 'en', autoAudio: true,
      answer: word.emoji,
      options: shuffle([word, ...wrong]).map(w => w.emoji),
      hint: `לחצו על 🔊 לשמוע שוב`,
    };
  },

  // ── Stage 3: reading, spelling & translation ──────────────────────────
  en_translate_to_he: (band, hard) => {
    const word = pickWord(band, undefined, hard);
    const wrong = wrongWords(word, 3);
    return {
      type: 'en_translate_to_he', difficulty: 2, dir: 'rtl',
      question: `מה פירוש המילה באנגלית?`,
      displayWord: word.en,
      audioText: word.en, audioLang: 'en',
      answer: word.he,
      options: shuffle([word, ...wrong]).map(w => w.he),
      hint: `רמז: ${word.emoji}`,
    };
  },
  en_translate_to_en: (band, hard) => {
    const word = pickWord(band, undefined, hard);
    const wrong = wrongWords(word, 3);
    return {
      type: 'en_translate_to_en', difficulty: 2, dir: 'rtl',
      question: `איך אומרים "${word.he}" באנגלית?`,
      displayImage: word.emoji,
      audioText: word.en, audioLang: 'en',
      answer: word.en,
      options: shuffle([word, ...wrong]).map(w => w.en),
      hint: `מתחיל באות ${word.en[0].toUpperCase()}`,
    };
  },
  en_missing_letter: (band, hard) => {
    const word = pickWord(band, w => w.en.length >= 3 && !w.en.includes(' ', hard) && !w.en.includes('-'));
    const idx = randInt(0, word.en.length - 1);
    const missing = word.en[idx];
    const display = word.en.split('').map((c, i) => (i === idx ? '_' : c)).join('');
    const wrong = shuffle('abcdefghijklmnoprstuw'.split('').filter(c => c !== missing)).slice(0, 3);
    return {
      type: 'en_missing_letter', difficulty: 3, dir: 'ltr',
      question: `${display}`,
      audioText: word.en, audioLang: 'en',
      displayImage: word.emoji,
      word: word.en,
      answer: missing,
      options: shuffle([missing, ...wrong]),
      hint: `המילה היא "${word.en}" (${word.he})`,
    };
  },

  // ── Stage 4: write the word yourself (vocabulary expansion) ───────────
  en_spell: (band, hard) => {
    const word = pickWord(band, w => w.en.length <= 9 && !w.en.includes(' ', hard) && !w.en.includes('-'));
    return {
      type: 'en_spell', difficulty: 3, dir: 'rtl',
      question: `כתבו באנגלית: ${word.he}`,
      displayImage: word.emoji,
      audioText: word.en, audioLang: 'en', autoAudio: true,
      word: word.en,
      answer: word.en,
      caseInsensitive: true,
      hint: `${word.en.length} אותיות, מתחיל ב-${word.en[0]}`,
      dedupKey: `en_spell|${word.en}`,
    };
  },

  // ── Alphabet & phonics (extra variety) ────────────────────────────────
  en_next_letter: () => {
    const i = randInt(0, LETTERS.length - 2);
    const given = LETTERS[i], answer = LETTERS[i + 1].l;
    const wrong = shuffle(LETTERS.filter(x => x.l !== answer && x.l !== given.l)).slice(0, 3).map(x => x.l);
    return {
      type: 'en_next_letter', difficulty: 1, dir: 'rtl',
      question: `איזו אות באה אחרי ${given.l}?`,
      displayLetter: given.l, audioText: given.l, audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `A B C D... מה בא אחרי ${given.l}?`,
    };
  },
  en_upper_lower: () => {
    const letter = pick(LETTERS);
    const answer = letter.l.toLowerCase();
    const wrong = shuffle(LETTERS.filter(x => x.l !== letter.l)).slice(0, 3).map(x => x.l.toLowerCase());
    return {
      type: 'en_upper_lower', difficulty: 1, dir: 'rtl',
      question: `איזו אות קטנה מתאימה ל-${letter.l}?`,
      displayLetter: letter.l, audioText: letter.l, audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `${letter.l} באותיות קטנות`,
    };
  },
  en_last_letter: (band, hard) => {
    const word = pickWord(Math.min(band, 2), w => /[a-z]$/i.test(w.en), hard);
    const answer = word.en[word.en.length - 1].toUpperCase();
    const wrong = shuffle(LETTERS.filter(x => x.l !== answer)).slice(0, 3).map(x => x.l);
    return {
      type: 'en_last_letter', difficulty: 2, dir: 'rtl',
      question: `באיזו אות מסתיימת המילה "${word.en}"? (${word.he})`,
      displayImage: word.emoji, audioText: word.en, audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `${word.en} — הקשיבו לסוף המילה 🔊`,
    };
  },

  // ── Numbers, colours, verbs, opposites, categories ────────────────────
  en_number_word: () => {
    const n = randInt(1, 10);
    const num = NUMBERS.find(x => x[0] === n);
    const wrong = shuffle(NUMBERS.filter(x => x[0] !== n)).slice(0, 3).map(x => x[1]);
    return {
      type: 'en_number_word', difficulty: 2, dir: 'rtl',
      question: `איך אומרים באנגלית את המספר ${n}?`,
      displayLetter: String(n),
      answer: num[1], options: shuffle([num[1], ...wrong]),
      hint: `${n} = ${num[2]}`,
    };
  },
  en_count: () => {
    const n = randInt(2, 5);
    const emoji = pick(['🍎', '⭐', '🐟', '🎈', '🚗', '🐶', '🌸', '⚽']);
    const num = NUMBERS.find(x => x[0] === n);
    const wrong = shuffle(NUMBERS.filter(x => x[0] !== n && x[0] <= 8)).slice(0, 3).map(x => x[1]);
    return {
      type: 'en_count', difficulty: 2, dir: 'rtl',
      question: `כמה יש כאן? ספרו באנגלית`,
      displayImage: emoji.repeat(n),
      answer: num[1], options: shuffle([num[1], ...wrong]),
      hint: `${n} = ${num[1]}`,
      dedupKey: `en_count|${n}`,
    };
  },
  en_color: () => {
    const c = pick(COLORS_EN);
    const wrong = shuffle(COLORS_EN.filter(x => x[1] !== c[1])).slice(0, 3).map(x => x[1]);
    return {
      type: 'en_color', difficulty: 2, dir: 'rtl',
      question: `מה הצבע הזה באנגלית?`,
      displayImage: c[0],
      answer: c[1], options: shuffle([c[1], ...wrong]),
      hint: `${c[2]} = ${c[1]}`,
      dedupKey: `en_color|${c[1]}`,
    };
  },
  en_verb: () => {
    const v = pick(VERBS);
    const wrong = shuffle(VERBS.filter(x => x[0] !== v[0])).slice(0, 3).map(x => x[0]);
    return {
      type: 'en_verb', difficulty: 2, dir: 'rtl',
      question: `איזו פעולה רואים בתמונה?`,
      displayImage: v[2],
      answer: v[0], options: shuffle([v[0], ...wrong]),
      hint: `${v[1]} = ${v[0]}`,
      dedupKey: `en_verb|${v[0]}`,
    };
  },
  en_opposite: () => {
    const p = pick(OPPOSITES);
    const flip = pick([true, false]);
    const given = flip ? p[1] : p[0], answer = flip ? p[0] : p[1];
    const givenHe = flip ? p[3] : p[2];
    const others = shuffle(OPPOSITES.flatMap(x => [x[0], x[1]]).filter(w => w !== given && w !== answer)).slice(0, 3);
    return {
      type: 'en_opposite', difficulty: 3, dir: 'rtl',
      question: `מה ההפך של "${given}"? (${givenHe})`,
      audioText: given, audioLang: 'en',
      answer, options: shuffle([answer, ...others]),
      hint: `מחפשים את ההפך מ-${givenHe}`,
    };
  },
  en_odd_one_out: () => {
    const cats = Object.keys(CATEGORIES_EN);
    const catA = pick(cats), catB = pick(cats.filter(c => c !== catA));
    const emojiOf = en => (WORD_BY_EN[en] ? WORD_BY_EN[en].emoji : '❓');
    // Some words belong to two groups (teacher is a job AND a school thing),
    // so the odd one must not also be in group A — otherwise the same picture
    // would appear twice and BOTH answers would be "right".
    const inA = new Set(CATEGORIES_EN[catA]);
    const oddPool = CATEGORIES_EN[catB].filter(w => !inA.has(w));
    if (!oddPool.length) return GENERATORS.en_odd_one_out();
    const odd = pick(oddPool);
    const answer = emojiOf(odd);
    // Distinct pictures only (two words can share an emoji).
    const three = [];
    const seen = new Set([answer]);
    for (const w of shuffle(CATEGORIES_EN[catA])) {
      const e = emojiOf(w);
      if (seen.has(e)) continue;
      seen.add(e);
      three.push(e);
      if (three.length === 3) break;
    }
    if (three.length < 3) return GENERATORS.en_odd_one_out();
    return {
      type: 'en_odd_one_out', difficulty: 3, dir: 'rtl',
      question: `מה לא שייך לקבוצה?`,
      answer, options: shuffle([...three, answer]),
      hint: `שלושה מאותה קבוצה, אחד שונה`,
    };
  },
  en_plural: (band, hard) => {
    const irregular = ['fish', 'sheep', 'mouse'];
    const word = pickWord(band, w => /^[a-z]+$/i.test(w.en) && !irregular.includes(w.en), hard);
    const answer = word.en + 's';
    const wrong = [word.en, word.en + 'es', word.en + 'z'].filter(w => w !== answer).slice(0, 3);
    return {
      type: 'en_plural', difficulty: 3, dir: 'rtl',
      question: `יחיד: one ${word.en}. רבים: two ___?`,
      displayImage: word.emoji, audioText: word.en, audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `ברוב המילים פשוט מוסיפים s בסוף`,
    };
  },

  // ── Reading, sentences & harder spelling (stages 3-6) ─────────────────
  en_scramble: (band, hard) => {
    const word = pickWord(band, w => w.en.length >= 3 && w.en.length <= 6 && /^[a-z]+$/i.test(w.en), hard);
    let letters = shuffle(word.en.split(''));
    let guard = 0;
    while (letters.join('') === word.en && guard++ < 10) letters = shuffle(word.en.split(''));
    return {
      type: 'en_scramble', difficulty: 3, dir: 'rtl',
      question: `סדרו את האותיות למילה נכונה (${word.he}):`,
      displayWord: letters.join(' ').toUpperCase(),
      displayImage: word.emoji, audioText: word.en, audioLang: 'en',
      word: word.en, answer: word.en, caseInsensitive: true,
      hint: `${word.en.length} אותיות, מתחיל ב-${word.en[0]}`,
      dedupKey: `en_scramble|${word.en}`,
    };
  },
  en_sentence_fill: () => {
    const sen = pick(SENTENCES);
    const answerWord = WORD_BY_EN[sen.a];
    const wrong = wrongWords(answerWord, 3);
    return {
      type: 'en_sentence_fill', difficulty: 4, dir: 'ltr',
      question: sen.s.replace('___', '_____'),
      answer: sen.a,
      options: shuffle([sen.a, ...wrong.map(w => w.en)]),
      hint: `(${sen.he}) ${answerWord ? answerWord.emoji : ''}`,
      dedupKey: `en_sentence_fill|${sen.a}`,
    };
  },
  // ── Phonological awareness (GEPF Pre-Foundation, research-verified) ──────
  // Rhyme families (CVC onset-rime) — audio + picture, no reading required.
  en_rhyme: () => {
    const FAMILIES = [
      [['cat', '🐱'], ['hat', '🎩'], ['bat', '🦇']],
      [['dog', '🐶'], ['frog', '🐸'], ['log', '🪵']],
      [['sun', '☀️'], ['run', '🏃'], ['bun', '🥯']],
      [['cake', '🍰'], ['snake', '🐍']],
      [['star', '⭐'], ['car', '🚗'], ['jar', '🫙']],
      [['moon', '🌙'], ['spoon', '🥄']],
      [['bee', '🐝'], ['tree', '🌳'], ['three', '3️⃣']],
      [['mouse', '🐭'], ['house', '🏠']],
      [['goat', '🐐'], ['boat', '⛵'], ['coat', '🧥']],
      [['fish', '🐟'], ['dish', '🍽️']],
      [['bear', '🐻'], ['pear', '🍐'], ['chair', '🪑']],
      [['king', '🤴'], ['ring', '💍']],
      [['sock', '🧦'], ['clock', '🕐'], ['rock', '🪨']],
      [['bed', '🛏️'], ['red', '🔴'], ['bread', '🍞']],
      [['duck', '🦆'], ['truck', '🚚']],
      [['whale', '🐋'], ['snail', '🐌'], ['mail', '✉️']],
      [['nose', '👃'], ['rose', '🌹']],
      [['train', '🚂'], ['rain', '🌧️'], ['chain', '⛓️']],
      [['light', '💡'], ['night', '🌃'], ['kite', '🪁']],
      [['door', '🚪'], ['four', '4️⃣']],
      [['phone', '📱'], ['bone', '🦴']],
      [['crown', '👑'], ['clown', '🤡']],
      [['pen', '🖊️'], ['ten', '🔟'], ['hen', '🐔']],
      [['ball', '⚽'], ['wall', '🧱']],
      [['snow', '❄️'], ['bow', '🎀']],
      [['pig', '🐷'], ['wig', '💇']],
    ];
    const family = pick(FAMILIES);
    const [target, correct] = shuffle(family).slice(0, 2);
    const wrong = shuffle(FAMILIES.filter(f => f !== family)).slice(0, 2).map(f => pick(f));
    const options = shuffle([correct, ...wrong]);
    const optionImages = {};
    for (const [w, e] of options) optionImages[w] = e;
    return {
      type: 'en_rhyme', difficulty: 2, dir: 'rtl',
      question: `איזו מילה מתחרזת עם "${target[0]}"?`,
      displayImage: target[1],
      audioText: `${target[0]}. ${options.map(o => o[0]).join(', ')}`,
      audioLang: 'en',
      answer: correct[0],
      options: options.map(o => o[0]),
      optionImages,
      hint: `מקשיבים לסוף המילה: ${target[0]}`,
      dedupKey: `en_rhyme|${target[0]}|${correct[0]}`,
    };
  },
  // Opening sound: hear a word, pick the picture that starts the same.
  // Unambiguous single consonants only — no digraphs (ch/sh/th).
  en_sound_start: (band, hard) => {
    const clear = 'bdfghjlmnprstw';
    const candidates = WORDS.filter(w => clear.includes(w.en[0]) && /^[a-z]+$/.test(w.en));
    const target = pick(candidates);
    const sameSound = candidates.filter(w => w.en[0] === target.en[0] && w.en !== target.en);
    if (!sameSound.length) return GENERATORS.en_rhyme();   // rare pool gap
    const correct = pick(sameSound);
    const wrong = [];
    const seen = new Set([target.en[0]]);
    for (const w of shuffle(candidates)) {
      if (wrong.length === 2) break;
      if (seen.has(w.en[0])) continue;
      seen.add(w.en[0]);
      wrong.push(w);
    }
    const options = shuffle([correct, ...wrong]);
    return {
      type: 'en_sound_start', difficulty: 2, dir: 'rtl',
      question: `איזו תמונה מתחילה באותו צליל כמו "${target.en}"?`,
      displayImage: target.emoji,
      audioText: `${target.en}. ${options.map(o => o.en).join(', ')}`,
      audioLang: 'en',
      answer: correct.emoji,
      options: options.map(o => o.emoji),
      hint: `${target.en} מתחיל בצליל של האות ${target.en[0].toUpperCase()}`,
      dedupKey: `en_sound_start|${target.en}|${correct.en}`,
    };
  },
  // Sentence ↔ picture matching (A1 written reception, Pre-A1 Starters style).
  en_sentence_pic: () => {
    const SCENES = [
      { s: 'The cat is black.', ok: '🐈‍⬛', near: ['🐈', '🐕'] },
      { s: 'The dog has a ball.', ok: '🐶⚽', near: ['🐱⚽', '🐶🦴'] },
      { s: 'I see two birds.', ok: '🐦🐦', near: ['🐦', '🐦🐦🐦'] },
      { s: 'The ball is red.', ok: '🔴⚽', near: ['🔵⚽', '🔴🎈'] },
      { s: 'The girl eats an apple.', ok: '👧🍎', near: ['👦🍎', '👧🍌'] },
      { s: 'The boy reads a book.', ok: '👦📖', near: ['👧📖', '👦⚽'] },
      { s: 'The fish is in the water.', ok: '🐟💧', near: ['🐟🔥', '🐦💧'] },
      { s: 'I see three stars.', ok: '⭐⭐⭐', near: ['⭐⭐', '⭐'] },
      { s: 'The baby is sleeping.', ok: '👶😴', near: ['👶😀', '👧😴'] },
      { s: 'The car is blue.', ok: '🔵🚗', near: ['🔴🚗', '🔵🚌'] },
      { s: 'The monkey eats a banana.', ok: '🐵🍌', near: ['🐵🍎', '🐶🍌'] },
      { s: 'The bird is on the tree.', ok: '🐦🌳', near: ['🐟🌳', '🐦🏠'] },
      { s: 'The girl has a red balloon.', ok: '👧🔴🎈', near: ['👦🔴🎈', '👧🔵🎈'] },
      { s: 'The elephant is very big.', ok: '🐘', near: ['🐭', '🐝'] },
      { s: 'I have five apples.', ok: '🍎🍎🍎🍎🍎', near: ['🍎🍎🍎', '🍎🍎🍎🍎'] },
      { s: 'The sun is yellow.', ok: '🟡☀️', near: ['🔵☀️', '🟡🌙'] },
      { s: 'The boy plays football.', ok: '👦⚽', near: ['👧⚽', '👦🏀'] },
      { s: 'The dog is sleeping.', ok: '🐶😴', near: ['🐱😴', '🐶🏃'] },
      { s: 'The teacher writes on the board.', ok: '🧑‍🏫✍️', near: ['🧑‍🏫📖', '👦✍️'] },
      { s: 'I drink milk.', ok: '🥛', near: ['🧃', '🍵'] },
      { s: 'Two cats are playing.', ok: '🐱🐱', near: ['🐱', '🐶🐶'] },
      { s: 'The bus is yellow.', ok: '🟡🚌', near: ['🔴🚌', '🟡🚗'] },
      { s: 'The girl rides a bicycle.', ok: '👧🚲', near: ['👦🚲', '👧🛴'] },
      { s: 'The cat drinks water.', ok: '🐱💧', near: ['🐶💧', '🐱🥛'] },
      { s: 'There are three stars and one moon.', ok: '⭐⭐⭐🌙', near: ['⭐⭐🌙', '⭐⭐⭐☀️'] },
      { s: 'The boy is happy.', ok: '👦😀', near: ['👦😢', '👧😀'] },
    ];
    const scene = pick(SCENES);
    if (pick([true, false])) {
      return {
        type: 'en_sentence_pic', difficulty: 4, dir: 'ltr',
        question: scene.s,
        audioText: scene.s, audioLang: 'en',
        answer: scene.ok,
        options: shuffle([scene.ok, ...scene.near]),
        hint: `קוראים לאט ובודקים שכל מילה מתאימה לתמונה`,
        dedupKey: `en_sentence_pic|${scene.s}`,
      };
    }
    // No English audio here — reading the correct sentence aloud would give
    // the answer away. The Hebrew question is read by the universal TTS.
    const wrongSentences = shuffle(SCENES.filter(x => x !== scene)).slice(0, 2).map(x => x.s);
    return {
      type: 'en_sentence_pic', difficulty: 4, dir: 'rtl',
      question: `איזה משפט מתאר את התמונה?`,
      displayImage: scene.ok,
      answer: scene.s,
      options: shuffle([scene.s, ...wrongSentences]),
      hint: `מסתכלים על התמונה וקוראים כל משפט`,
      dedupKey: `en_sentence_pic|pic|${scene.s}`,
    };
  },
  en_phrase: () => {
    const p = pick(PHRASES);
    if (pick([true, false])) {
      const wrong = shuffle(PHRASES.filter(x => x[0] !== p[0])).slice(0, 3).map(x => x[0]);
      return {
        type: 'en_phrase', difficulty: 3, dir: 'rtl',
        question: `איך אומרים "${p[1]}" באנגלית?`,
        answer: p[0], options: shuffle([p[0], ...wrong]),
        hint: `ביטוי נפוץ באנגלית`,
      };
    }
    const wrong = shuffle(PHRASES.filter(x => x[1] !== p[1])).slice(0, 3).map(x => x[1]);
    return {
      type: 'en_phrase', difficulty: 3, dir: 'rtl',
      question: `מה הפירוש של "${p[0]}"?`,
      audioText: p[0], audioLang: 'en',
      answer: p[1], options: shuffle([p[1], ...wrong]),
      hint: `ביטוי נפוץ באנגלית`,
    };
  },

  // ── Grammar (upper stages: real English rules, not just vocabulary) ──────
  // a / an — the child hears the word and decides by its opening SOUND.
  en_a_an: () => {
    const vowel = pick([true, false]);
    const word = pick(vowel ? A_AN_VOWEL : A_AN_CONSONANT);
    const answer = vowel ? 'an' : 'a';
    return {
      type: 'en_a_an', difficulty: 3, dir: 'rtl',
      question: `מה מתאים לפני "${word.en}"? (${word.he})`,
      displayImage: word.emoji,
      audioText: `${answer} ${word.en}`, audioLang: 'en',
      answer, options: ['a', 'an'],
      hint: `לפני צליל של תנועה (a, e, i, o) אומרים an`,
      dedupKey: `en_a_an|${word.en}`,
    };
  },
  // Place prepositions, asked as a translation so the answer is unambiguous
  // (a picture can't reliably show "under" vs "next to").
  en_preposition: () => {
    const p = pick(PREPOSITIONS);
    const [nounEn, nounHe, emoji] = pick(PREP_NOUNS);
    const wrong = shuffle(PREPOSITIONS.filter(x => x[0] !== p[0])).slice(0, 3).map(x => x[0]);
    return {
      type: 'en_preposition', difficulty: 3, dir: 'rtl',
      question: `החתול ${p[1]} ${nounHe} — The cat is ___ the ${nounEn}.`,
      displayImage: emoji,
      answer: p[0], options: shuffle([p[0], ...wrong]),
      hint: `"${p[1]}" באנגלית`,
      dedupKey: `en_preposition|${p[0]}|${nounEn}`,
    };
  },
  en_pronoun: () => {
    const [sentence, answer, he] = pick(PRONOUNS);
    const wrong = shuffle(PRONOUN_OPTIONS.filter(x => x.toLowerCase() !== answer.toLowerCase())).slice(0, 3);
    return {
      type: 'en_pronoun', difficulty: 4, dir: 'ltr',
      question: sentence.replace('___', '_____'),
      answer, options: shuffle([answer, ...wrong]),
      hint: `${he}`,
      dedupKey: `en_pronoun|${sentence}`,
    };
  },
  en_be: () => {
    const [sentence, answer, he] = pick(BE_ITEMS);
    return {
      type: 'en_be', difficulty: 4, dir: 'ltr',
      question: sentence.replace('___', '_____'),
      answer, options: shuffle(['am', 'is', 'are']),
      hint: `${he} — am / is / are`,
      dedupKey: `en_be|${sentence}`,
    };
  },
  en_verb_ing: () => {
    const v = pick(VERBS);
    const [base, he, emoji, ing] = v;
    // Plausible wrong forms: the naive "+ing", the third person, the base and
    // the past — always enough distinct ones left for four options.
    const wrong = [...new Set([`${base}ing`, `${base}s`, base, `${base}ed`])]
      .filter(w => w !== ing).slice(0, 3);
    return {
      type: 'en_verb_ing', difficulty: 4, dir: 'rtl',
      question: `Look! The boy is ___ (${he})`,
      displayImage: emoji,
      audioText: base, audioLang: 'en',
      answer: ing, options: shuffle([ing, ...wrong]),
      hint: `${base} + ing — לפעמים משנים את סוף המילה`,
      dedupKey: `en_verb_ing|${base}`,
    };
  },
  en_past_tense: () => {
    const [base, he, emoji, , past] = pick(VERBS);
    const wrong = [...new Set([`${base}ed`, `${base}d`, `${base}s`, base])]
      .filter(w => w !== past).slice(0, 3);
    return {
      type: 'en_past_tense', difficulty: 5, dir: 'rtl',
      question: `Yesterday I ___ . (${he} — אתמול)`,
      displayImage: emoji,
      audioText: base, audioLang: 'en',
      answer: past, options: shuffle([past, ...wrong]),
      hint: `זמן עבר של "${base}"`,
      dedupKey: `en_past_tense|${base}`,
    };
  },
  en_comparative: () => {
    const [base, comp, sup, he] = pick(COMPARATIVES);
    const superlative = pick([true, false]);
    const answer = superlative ? sup : comp;
    const wrong = [...new Set([superlative ? comp : sup, `${base}er`, `${base}est`, `more ${base}`])]
      .filter(w => w !== answer).slice(0, 3);
    return {
      type: 'en_comparative', difficulty: 5, dir: 'rtl',
      question: superlative
        ? `איך אומרים באנגלית "הכי ${he}"?`
        : `איך אומרים באנגלית "יותר ${he}"?`,
      audioText: base, audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: superlative
        ? `${base} → the ___ (הכי)`
        : `${base} → ___ than (יותר מ…)`,
      dedupKey: `en_comparative|${base}|${answer}`,
    };
  },
  en_question_word: () => {
    const [sentence, answer, he] = pick(QUESTION_WORDS);
    const wrong = shuffle(QUESTION_WORD_OPTIONS.filter(x => x !== answer)).slice(0, 3);
    return {
      type: 'en_question_word', difficulty: 4, dir: 'ltr',
      question: sentence.replace('___', '_____'),
      answer, options: shuffle([answer, ...wrong]),
      hint: `${he}`,
      dedupKey: `en_question_word|${sentence}`,
    };
  },
  // Real conversation: hear a question, choose the reply that fits.
  en_reply: () => {
    const [q, reply, he] = pick(DIALOGUES);
    const wrong = shuffle(DIALOGUES.filter(x => x[1] !== reply)).slice(0, 2).map(x => x[1]);
    return {
      type: 'en_reply', difficulty: 4, dir: 'ltr',
      question: q,
      audioText: q, audioLang: 'en',
      answer: reply, options: shuffle([reply, ...wrong]),
      hint: `(${he}) איזו תשובה מתאימה לשאלה?`,
      dedupKey: `en_reply|${q}`,
    };
  },
  en_day: () => {
    const i = randInt(0, DAYS.length - 1);
    const after = pick([true, false]);
    const j = after ? (i + 1) % DAYS.length : (i + DAYS.length - 1) % DAYS.length;
    const answer = DAYS[j][0];
    const wrong = shuffle(DAYS.filter(d => d[0] !== answer && d[0] !== DAYS[i][0])).slice(0, 3).map(d => d[0]);
    return {
      type: 'en_day', difficulty: 3, dir: 'rtl',
      question: after
        ? `איזה יום בא אחרי ${DAYS[i][0]}? (יום ${DAYS[i][1]})`
        : `איזה יום בא לפני ${DAYS[i][0]}? (יום ${DAYS[i][1]})`,
      audioText: DAYS[i][0], audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday`,
      dedupKey: `en_day|${DAYS[i][0]}|${after}`,
    };
  },
  en_month: () => {
    const i = randInt(0, MONTHS.length - 1);
    const ask = pick(['next', 'translate']);
    if (ask === 'translate') {
      const answer = MONTHS[i][0];
      const wrong = shuffle(MONTHS.filter(m => m[0] !== answer)).slice(0, 3).map(m => m[0]);
      return {
        type: 'en_month', difficulty: 3, dir: 'rtl',
        question: `איך אומרים את החודש ${MONTHS[i][1]} באנגלית?`,
        answer, options: shuffle([answer, ...wrong]),
        hint: `חודשים באנגלית מתחילים באות גדולה`,
        dedupKey: `en_month|tr|${answer}`,
      };
    }
    const j = (i + 1) % MONTHS.length;
    const answer = MONTHS[j][0];
    const wrong = shuffle(MONTHS.filter(m => m[0] !== answer && m[0] !== MONTHS[i][0])).slice(0, 3).map(m => m[0]);
    return {
      type: 'en_month', difficulty: 4, dir: 'rtl',
      question: `איזה חודש בא אחרי ${MONTHS[i][0]}? (${MONTHS[i][1]})`,
      audioText: MONTHS[i][0], audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `January, February, March, April, May, June…`,
      dedupKey: `en_month|next|${MONTHS[i][0]}`,
    };
  },
  // Reading a real clock and saying the time IN ENGLISH.
  en_time: () => {
    const h = randInt(1, 12);
    const half = pick([true, false]);
    const hourWord = NUMBERS.find(x => x[0] === h)[1];
    const answer = half ? `half past ${hourWord}` : `${hourWord} o'clock`;
    const others = shuffle(NUMBERS.filter(x => x[0] <= 12 && x[0] !== h)).slice(0, 2)
      .map(x => (half ? `half past ${x[1]}` : `${x[1]} o'clock`));
    const flipped = half ? `${hourWord} o'clock` : `half past ${hourWord}`;
    return {
      type: 'en_time', difficulty: 4, dir: 'rtl',
      question: `מה השעה? (עונים באנגלית)`,
      displayClock: { h, m: half ? 30 : 0 },
      answer, options: shuffle([answer, flipped, ...others]),
      hint: half ? `חצי אחרי השעה = half past` : `שעה עגולה = o'clock`,
      dedupKey: `en_time|${h}|${half}`,
    };
  },
  // English riddles — reading comprehension in one sentence.
  en_riddle: () => {
    const [clue, answerWord] = pick(RIDDLES);
    const word = WORD_BY_EN[answerWord];
    const wrong = wrongWords(word || { en: answerWord, he: '', emoji: '' }, 3);
    const options = shuffle([answerWord, ...wrong.map(w => w.en)]);
    const optionImages = {};
    if (word) optionImages[word.en] = word.emoji;
    for (const w of wrong) optionImages[w.en] = w.emoji;
    return {
      type: 'en_riddle', difficulty: 5, dir: 'ltr',
      question: clue,
      audioText: clue, audioLang: 'en',
      answer: answerWord, options, optionImages,
      hint: `קוראים את החידה לאט — כל מילה היא רמז`,
      dedupKey: `en_riddle|${answerWord}`,
    };
  },
  // "cat, dog, cow — what are they all?" (classification in English)
  en_category_name: () => {
    const cats = Object.keys(CATEGORY_NAMES_EN).filter(c => CATEGORIES_EN[c]?.length >= 3);
    const cat = pick(cats);
    const three = shuffle(CATEGORIES_EN[cat]).slice(0, 3);
    const answer = CATEGORY_NAMES_EN[cat];
    const wrong = shuffle(cats.filter(c => c !== cat)).slice(0, 3).map(c => CATEGORY_NAMES_EN[c]);
    return {
      type: 'en_category_name', difficulty: 4, dir: 'rtl',
      question: `${three.join(', ')} — מה משותף לכולם? (באנגלית)`,
      audioText: three.join(', '), audioLang: 'en',
      answer, options: shuffle([answer, ...wrong]),
      hint: `כולם מאותה קבוצה`,
      dedupKey: `en_category_name|${cat}|${three.join('|')}`,
    };
  },
  // Word order — rebuild a real sentence from scrambled words.
  en_word_order: () => {
    const sentence = pick(ORDER_SENTENCES);
    const words = sentence.split(' ');
    const scrambleOnce = () => {
      let s = shuffle(words).join(' ');
      let guard = 0;
      while (s === sentence && guard++ < 10) s = shuffle(words).join(' ');
      return s;
    };
    const wrong = new Set();
    let guard = 0;
    while (wrong.size < 2 && guard++ < 20) {
      const s = scrambleOnce();
      if (s !== sentence) wrong.add(s);
    }
    return {
      type: 'en_word_order', difficulty: 5, dir: 'rtl',
      question: `איזה משפט בנוי נכון?`,
      displayWord: shuffle(words).join(' • '),
      answer: sentence, options: shuffle([sentence, ...wrong]),
      hint: `באנגלית קודם מי עושה, אחר כך מה עושים`,
      dedupKey: `en_word_order|${sentence}`,
    };
  },
  // Pure listening + spelling: no picture, no written word — just the sound.
  en_listen_spell: (band, hard) => {
    const word = pickWord(band, w => w.en.length <= 10 && /^[a-z]+$/i.test(w.en), hard);
    return {
      type: 'en_listen_spell', difficulty: 5, dir: 'rtl',
      question: `🔊 הקשיבו וכתבו את המילה באנגלית`,
      audioText: word.en, audioLang: 'en', autoAudio: true,
      word: word.en, answer: word.en, caseInsensitive: true,
      hint: `${word.he} — ${word.en.length} אותיות, מתחיל ב-${word.en[0]}`,
      dedupKey: `en_listen_spell|${word.en}`,
    };
  },
  // Short passage + comprehension question (the hardest reading question).
  en_reading: () => {
    const r = pick(READINGS);
    return {
      type: 'en_reading', difficulty: 5, dir: 'ltr',
      question: `${r.text}\n\n${r.q}`,
      audioText: r.text, audioLang: 'en',
      answer: r.a, options: shuffle([r.a, ...r.wrong]),
      hint: `קוראים את הקטע פעמיים ומחפשים את המשפט שעונה על השאלה`,
      dedupKey: `en_reading|${r.q}`,
    };
  },
  // High-frequency "sight" words inside a real sentence.
  en_sight_word: () => {
    const [word, he, sentence] = pick(SIGHT_WORDS);
    const wrong = shuffle(SIGHT_WORDS.filter(x => x[0] !== word)).slice(0, 3).map(x => x[0]);
    return {
      type: 'en_sight_word', difficulty: 4, dir: 'ltr',
      question: sentence.replace('___', '_____'),
      answer: word, options: shuffle([word, ...wrong]),
      hint: `${he}`,
      dedupKey: `en_sight_word|${sentence}`,
    };
  },
  // Bigger numbers (11-100) — the counting ladder above en_number_word.
  en_number_big: () => {
    const pool = NUMBERS.filter(x => x[0] > 10);
    const num = pick(pool);
    const wrong = shuffle(NUMBERS.filter(x => x[0] !== num[0])).slice(0, 3).map(x => x[1]);
    return {
      type: 'en_number_big', difficulty: 3, dir: 'rtl',
      question: `איך אומרים באנגלית את המספר ${num[0]}?`,
      displayLetter: String(num[0]),
      answer: num[1], options: shuffle([num[1], ...wrong]),
      hint: `${num[0]} = ${num[2]}`,
      dedupKey: `en_number_big|${num[0]}`,
    };
  },
};

// Stage plans – 15 questions each, mixing many question types so a session
// never feels repetitive. Higher stages lean on typing (spell/scramble),
// grammar and reading, so they are genuinely harder: stages 7-8 are real
// grammar (tenses, comparison, pronouns) and reading comprehension.
const STAGE_PLANS = {
  1: ['en_letter_name', 'en_letter_name', 'en_letter_find', 'en_letter_find',
      'en_next_letter', 'en_next_letter', 'en_upper_lower', 'en_upper_lower',
      'en_first_letter', 'en_first_letter', 'en_word_to_pic', 'en_word_to_pic',
      'en_number_word', 'en_count', 'en_listen_pick'],
  2: ['en_word_to_pic', 'en_word_to_pic', 'en_pic_to_word', 'en_pic_to_word',
      'en_listen_pick', 'en_listen_pick', 'en_color', 'en_verb',
      'en_number_word', 'en_count', 'en_first_letter', 'en_last_letter',
      'en_odd_one_out', 'en_rhyme', 'en_sound_start'],
  3: ['en_pic_to_word', 'en_translate_to_he', 'en_translate_to_he',
      'en_translate_to_en', 'en_translate_to_en', 'en_missing_letter',
      'en_missing_letter', 'en_opposite', 'en_verb', 'en_scramble',
      'en_scramble', 'en_spell', 'en_odd_one_out', 'en_rhyme', 'en_day'],
  4: ['en_translate_to_he', 'en_translate_to_en', 'en_missing_letter',
      'en_opposite', 'en_opposite', 'en_plural', 'en_scramble', 'en_spell',
      'en_sentence_fill', 'en_phrase', 'en_odd_one_out', 'en_sentence_pic',
      'en_a_an', 'en_number_big', 'en_category_name'],
  5: ['en_spell', 'en_scramble', 'en_sentence_fill', 'en_sentence_fill',
      'en_translate_to_en', 'en_missing_letter', 'en_opposite', 'en_plural',
      'en_phrase', 'en_sentence_pic', 'en_pronoun', 'en_be',
      'en_preposition', 'en_sight_word', 'en_time'],
  6: ['en_spell', 'en_spell', 'en_scramble', 'en_sentence_fill',
      'en_missing_letter', 'en_opposite', 'en_plural', 'en_phrase',
      'en_verb_ing', 'en_question_word', 'en_reply', 'en_riddle',
      'en_sight_word', 'en_word_order', 'en_listen_spell'],
  // Stage 7 – דקדוק ראשון: the rules themselves (tenses, comparison, pronouns).
  7: ['en_verb_ing', 'en_past_tense', 'en_past_tense', 'en_comparative',
      'en_comparative', 'en_pronoun', 'en_be', 'en_question_word', 'en_a_an',
      'en_preposition', 'en_plural', 'en_sight_word', 'en_reply', 'en_month',
      'en_spell'],
  // Stage 8 – קריאה והבנה: passages, riddles, word order, pure listening.
  8: ['en_reading', 'en_reading', 'en_riddle', 'en_riddle', 'en_word_order',
      'en_word_order', 'en_listen_spell', 'en_listen_spell', 'en_past_tense',
      'en_comparative', 'en_reply', 'en_sentence_fill', 'en_question_word',
      'en_month', 'en_spell'],
};

export const ENGLISH_STAGES = 8;

// WORDS carry levels 1-5, so vocabulary difficulty tops out at band 5 even
// though the stage ladder (grammar + reading question mix) goes to 8.
const MAX_WORD_BAND = 5;

// Alphabet-teaching types — hidden by the parents' "ABC" toggle. English then
// stays fully active, taught through pictures and audio only (words, sounds,
// rhymes, listening) — same swap pattern as the mul/div toggle in math.
export const ABC_TYPES = [
  'en_letter_name', 'en_letter_find', 'en_next_letter', 'en_upper_lower',
  'en_first_letter', 'en_last_letter',
];
const NO_ABC_SWAPS = [
  'en_word_to_pic', 'en_listen_pick', 'en_rhyme', 'en_count',
  'en_color', 'en_verb', 'en_odd_one_out',
];

/**
 * `track` makes the same stage age-appropriate: an a_to_b child (rising 2nd
 * grader) draws vocabulary one band higher and gets long words, while the
 * younger track prefers short words at the same stage.
 * `hideLetters` (parent toggle) swaps alphabet questions for picture/audio
 * vocabulary — the session keeps its full length.
 */
export function generateEnglishExercises(stage = 1, reviewExercises = [], track = null, hideLetters = false) {
  const s = Math.min(Math.max(1, Number(stage) || 1), ENGLISH_STAGES);
  // Long words are unlocked by the prep track OR by the stage itself: a child
  // who reached stage 4 has earned the full vocabulary even with no track
  // (otherwise dropping a track would silently shrink their English).
  const hard = track === 'a_to_b' || s >= 4;
  const band = Math.min(s + (hard ? 1 : 0), MAX_WORD_BAND);
  let plan = [...STAGE_PLANS[s]];
  if (hideLetters) {
    let i = 0;
    plan = plan.map(t => (ABC_TYPES.includes(t) ? NO_ABC_SWAPS[i++ % NO_ABC_SWAPS.length] : t));
  }
  const reviewCount = Math.min(reviewExercises.length, 3);
  for (let i = 0; i < reviewCount && plan.length; i++) plan.shift();

  const exercises = [];
  const seen = new Set();
  const keyOf = (ex) => ex.dedupKey || `${ex.type}|${ex.question}|${ex.answer}`;
  for (const r of reviewExercises.slice(0, reviewCount)) {
    exercises.push({ ...r, isReview: true });
    seen.add(keyOf(r));
  }
  for (const type of plan) {
    let ex = GENERATORS[type](band, hard);
    let key = keyOf(ex);
    let attempts = 0;
    while (seen.has(key) && attempts < 25) { ex = GENERATORS[type](band, hard); key = keyOf(ex); attempts++; }
    seen.add(key);
    exercises.push(ex);
  }
  return shuffle(exercises).map((ex, i) => ({ ...ex, id: i + 1 }));
}
