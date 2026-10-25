// Daily practice reminder for the web version. There is no server, so the
// reminder is (a) a calendar file the parent imports once — works on every
// phone and computer regardless of the browser — and (b) a nudge inside the
// app (banner + browser notification) whenever it is open past the chosen time.

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const pad = (n) => String(n).padStart(2, '0');
const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** iCalendar text for a weekly-repeating reminder (Israel time, with DST rules). */
export function buildReminderIcs({ time = '17:00', days = [0, 1, 2, 3, 4], url = 'https://kidslearn.fun/app/', names = '' } = {}) {
  const [hh, mm] = time.split(':').map(Number);
  const now = new Date();
  // First occurrence: today if its weekday is selected, else the next selected day.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
  const want = new Set(days.length ? days : [0, 1, 2, 3, 4]);
  for (let i = 0; i < 7 && !want.has(start.getDay()); i++) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const byday = [...want].sort().map(d => DAY_CODES[d]).join(',');
  const who = names ? ` — ${names}` : '';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KidsLearn//Daily Reminder//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Jerusalem',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0300',
    'TZNAME:IDT',
    'DTSTART:19700327T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=FR;BYMONTHDAY=23,24,25,26,27,28,29',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0200',
    'TZNAME:IST',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:kidslearn-daily-${now.getTime()}@kidslearn.fun`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Jerusalem:${local(start)}`,
    `DTEND;TZID=Asia/Jerusalem:${local(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    `SUMMARY:${icsEscape(`⭐ KidsLearn — זמן תרגול${who}`)}`,
    `DESCRIPTION:${icsEscape(`כמה דקות של תרגול יומי ב-KidsLearn.\n${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:KidsLearn',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadTextFile(text, filename, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Is the reminder "ringing" right now (enabled, today selected, time passed)? */
export function reminderDue(reminder, now = new Date()) {
  if (!reminder?.enabled) return false;
  const days = reminder.days && reminder.days.length ? reminder.days : [0, 1, 2, 3, 4];
  if (!days.includes(now.getDay())) return false;
  const [hh, mm] = String(reminder.time || '17:00').split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotifyPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

const NOTIFIED_KEY = 'kidslearn:reminder:notified';

/** One browser notification per day while the app is open past the reminder time. */
export function maybeNotify(text) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(NOTIFIED_KEY) === today) return false;
    localStorage.setItem(NOTIFIED_KEY, today);
  } catch {}
  try {
    new Notification('⭐ KidsLearn', { body: text, lang: 'he', dir: 'rtl' });
    return true;
  } catch { return false; }
}
