import { useMemo, useState } from 'react';
import { speakHebrew } from '../lib/tts';

// Hands-on counters (מונים): the pictures of a counting / visual add / visual
// sub question become tappable tokens. The child can COUNT them (each tap
// gets the next number and is read aloud), CROSS OUT tokens to subtract
// ("מוחקים 3 כוכבים — כמה נשארו?"), and ADD tokens to build up to a sum.
// Plain arithmetic questions ("5 + 3 = ?") get the same panel with stars,
// behind a "🧮 עזרה עם כוכבים" button, so a child who is not ready for digits
// alone can still work it out with pictures.

const MAX_TOKENS = 40;
const STAR = '⭐';

// Everything that is not a letter/digit and is short counts as a picture token.
const isPictureToken = (t) => t && t.length <= 8 && !/[0-9A-Za-zא-ת?=:+\-×]/.test(t);

// Types whose displayShape is a decoration, not something to count.
const SKIP_TYPES = new Set(['pattern', 'ordinal_position', 'compare_quantities_options', 'geo_identify', 'geo_sides', 'geo_corners', 'geo_count_sides_compare', 'clock_reading', 'money_count', 'pictogram_read', 'days_of_week']);

/**
 * Build the token groups for an exercise, or null when the question has
 * nothing to count. `auto` says whether the panel opens by itself.
 */
export function countersFor(ex) {
  if (!ex) return null;
  if (!SKIP_TYPES.has(ex.type) && ex.displayShape && !ex.displayClock) {
    // "🍎 🍎 🍎  +  🍎 🍎" / several lines → one group per line or per "+" segment
    const groups = [];
    for (const line of String(ex.displayShape).split('\n')) {
      for (const segment of line.split('+')) {
        const tokens = segment.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length) continue;
        // Emoji rows may come without spaces ("🍎🍎🍎") — split by code point.
        const flat = tokens.length === 1 && [...tokens[0]].length > 1 && isPictureToken([...tokens[0]][0])
          ? [...tokens[0]].filter(c => !/[️‍]/.test(c))
          : tokens;
        if (!flat.every(isPictureToken)) return null;
        groups.push(flat);
      }
    }
    const total = groups.reduce((n, g) => n + g.length, 0);
    if (!total || total > MAX_TOKENS) return null;
    const mode = ex.type === 'visual_sub' ? 'cross' : 'count';
    return { groups, mode, auto: true, addEmoji: groups[0][0] };
  }
  // Plain arithmetic within 20: "5 + 3 = ?", "9 - 4 = ?", "4 + ? = 10"
  if (ex.dir === 'ltr' && typeof ex.question === 'string') {
    let m = ex.question.match(/^(\d{1,2})\s*([+\-])\s*(\d{1,2})\s*=\s*\?$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[3]);
      if (a > 20 || b > 20 || a + b > MAX_TOKENS) return null;
      if (m[2] === '+') return { groups: [Array(a).fill(STAR), Array(b).fill(STAR)], mode: 'count', auto: false, addEmoji: STAR };
      if (b > a) return null;
      return { groups: [Array(a).fill(STAR)], mode: 'cross', auto: false, addEmoji: STAR, removeTarget: b };
    }
    m = ex.question.match(/^(\d{1,2})\s*\+\s*\?\s*=\s*(\d{1,2})$/);
    if (m) {
      const a = Number(m[1]), target = Number(m[2]);
      if (target > 20 || a > target) return null;
      return { groups: [Array(a).fill(STAR)], mode: 'add', auto: false, addEmoji: STAR, target };
    }
  }
  return null;
}

const MODES = [
  { id: 'count', icon: '👆', label: 'סופרים' },
  { id: 'cross', icon: '✖️', label: 'מוחקים' },
];

export default function Counters({ exercise, open: openProp, disabled }) {
  const model = useMemo(() => countersFor(exercise), [exercise]);
  const [open, setOpen] = useState(!!(model && (model.auto || openProp)));
  const [mode, setMode] = useState(model?.mode === 'cross' ? 'cross' : 'count');
  const [tokens, setTokens] = useState(() => initialTokens(model));
  const [nextCount, setNextCount] = useState(1);

  if (!model) return null;

  function initialTokens(m) {
    if (!m) return [];
    const out = [];
    m.groups.forEach((g, gi) => g.forEach((e, i) => out.push({ id: `${gi}-${i}`, emoji: e, group: gi, crossed: false, count: null })));
    return out;
  }

  function reset() {
    setTokens(initialTokens(model));
    setNextCount(1);
  }

  function tap(id) {
    if (disabled) return;
    setTokens(ts => ts.map(t => {
      if (t.id !== id) return t;
      if (mode === 'cross') return { ...t, crossed: !t.crossed, count: null };
      if (t.crossed) return t;
      if (t.count === null) {
        const n = nextCount;
        setNextCount(n + 1);
        speakHebrew(String(n));                  // "אחת, שתיים, שלוש…" as the child taps
        return { ...t, count: n };
      }
      return t;
    }));
  }

  function addToken() {
    if (disabled || tokens.length >= MAX_TOKENS) return;
    const group = Math.max(0, model.groups.length - 1);
    setTokens(ts => [...ts, { id: `x-${Date.now()}-${ts.length}`, emoji: model.addEmoji, group, crossed: false, count: null }]);
  }

  function removeLast() {
    if (disabled || !tokens.length) return;
    setTokens(ts => ts.slice(0, -1));
  }

  const total = tokens.length;
  const crossed = tokens.filter(t => t.crossed).length;
  const left = total - crossed;
  const counted = tokens.filter(t => t.count !== null).length;
  const groups = model.groups.map((_, gi) => tokens.filter(t => t.group === gi));

  if (!open) {
    return (
      <button type="button" className="counters-open" onClick={() => setOpen(true)}>
        🧮 עזרה עם כוכבים — לספור, להוסיף ולמחוק
      </button>
    );
  }

  return (
    <div className="counters" dir="rtl">
      <div className="counters-head">
        <div className="counters-modes">
          {MODES.map(m => (
            <button
              key={m.id} type="button"
              className={`counters-mode ${mode === m.id ? 'on' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <div className="counters-status">
          {mode === 'cross'
            ? <>סך הכול <b>{total}</b> · נמחקו <b>{crossed}</b> · נשארו <b className="big">{left}</b></>
            : <>נספרו <b className="big">{counted}</b> מתוך <b>{left}</b>{model.target ? <> · היעד: <b>{model.target}</b></> : null}</>}
        </div>
      </div>

      <div className="counters-board">
        {groups.map((g, gi) => (
          <div key={gi} className="counters-group">
            {gi > 0 && <span className="counters-plus">+</span>}
            <div className="counters-row">
              {g.map(t => (
                <button
                  key={t.id} type="button"
                  className={`counter-token ${t.crossed ? 'crossed' : ''} ${t.count !== null ? 'counted' : ''}`}
                  onClick={() => tap(t.id)}
                  aria-label={t.crossed ? 'מחוק' : t.count !== null ? `נספר ${t.count}` : 'לחצו'}
                >
                  <span className="counter-emoji">{t.emoji}</span>
                  {t.count !== null && <span className="count-badge">{t.count}</span>}
                  {t.crossed && <span className="cross-mark">✖</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="counters-actions">
        <button type="button" className="counters-btn" onClick={addToken} disabled={disabled || tokens.length >= MAX_TOKENS}>➕ עוד {model.addEmoji}</button>
        <button type="button" className="counters-btn" onClick={removeLast} disabled={disabled || !tokens.length}>➖ להוריד {model.addEmoji}</button>
        <button type="button" className="counters-btn" onClick={reset}>↺ מהתחלה</button>
        {!model.auto && <button type="button" className="counters-btn ghost" onClick={() => setOpen(false)}>סגירה</button>}
      </div>
      <div className="counters-hint">
        {mode === 'cross'
          ? `לוחצים על ${model.addEmoji} כדי למחוק אותו, ורואים כמה נשארו.${model.removeTarget ? ` נסו למחוק ${model.removeTarget}.` : ''}`
          : `לוחצים על כל ${model.addEmoji} בתורו — המספר נאמר בקול. אפשר להוסיף ${model.addEmoji} עם ➕.`}
      </div>
    </div>
  );
}
