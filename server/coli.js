// KidsLearn Coli — the KidsLearn app store.
//
// Coli is the shop window; KidsLearn Cloud is the loading dock. A developer
// registers an app in the Cloud console (client_id / API key), and from that
// same app page publishes a STORE LISTING here. Publishing is free: no fee,
// no yearly membership, no commission — the only gate is a human review that
// the app is safe for children.
//
// Data lives in coli.json next to cloud.json in the writable data dir, and
// uploaded artwork in coli-media/ beside it (never inside the JSON, so the
// file stays small and fast to read on every storefront request).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { resolveDataDir } from './dataDir.js';
import { listAccounts } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolveDataDir(path.join(__dirname, 'data'));
const COLI_FILE = path.join(DATA_DIR, 'coli.json');
const MEDIA_DIR = path.join(DATA_DIR, 'coli-media');

const MAX_IMAGE_BYTES = 500 * 1024;   // one icon / screenshot
const MAX_SHOTS = 4;
const MAX_LISTINGS_PER_OWNER = 25;

// ── Taxonomy ───────────────────────────────────────────────────────────────
export const CATEGORIES = {
  math:       { label: 'חשבון',           icon: '➗' },
  language:   { label: 'עברית וקריאה',     icon: '✍️' },
  english:    { label: 'אנגלית',           icon: '🔤' },
  science:    { label: 'מדע וטבע',         icon: '🔬' },
  games:      { label: 'משחקים חינוכיים',  icon: '🎮' },
  creativity: { label: 'יצירה וציור',      icon: '🎨' },
  music:      { label: 'מוזיקה',           icon: '🎵' },
  parents:    { label: 'להורים ולמורים',   icon: '👨‍👩‍👧' },
  tools:      { label: 'כלים',             icon: '🛠️' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const AGES = {
  '3-5':  'גן (3–5)',
  '6-8':  'כיתות א׳–ב׳ (6–8)',
  '9-12': 'כיתות ג׳–ו׳ (9–12)',
  '12+':  'חטיבה ומעלה',
};
export const AGE_KEYS = Object.keys(AGES);

// Where the app actually runs. Each is just a link the family clicks.
export const PLATFORMS = {
  web:     { label: 'באתר / דפדפן',   icon: '🌐', hint: 'https://my-app.example.com' },
  android: { label: 'אנדרואיד (APK)', icon: '🤖', hint: 'קישור ישיר ל-APK או לחנות' },
  windows: { label: 'Windows',        icon: '🪟', hint: 'קישור להתקנה (exe / msi)' },
  mac:     { label: 'Mac',            icon: '🍎', hint: 'קישור ל-dmg' },
  ios:     { label: 'iPhone / iPad',  icon: '📱', hint: 'קישור ל-App Store' },
  source:  { label: 'קוד פתוח',       icon: '💻', hint: 'GitHub וכדומה' },
};
export const PLATFORM_KEYS = Object.keys(PLATFORMS);

// What the publisher promises about the app. These are the badges a parent
// scans before letting a child near it, so they are declared per listing and
// shown on the store page — not buried in a policy document.
export const PLEDGES = {
  noAds:       { label: 'בלי פרסומות',                icon: '🚫' },
  noPurchases: { label: 'בלי רכישות בתוך האפליקציה',  icon: '💸' },
  noChat:      { label: 'בלי צ׳אט עם זרים',           icon: '🔒' },
  noData:      { label: 'לא אוסף מידע אישי',          icon: '🛡️' },
};
export const PLEDGE_KEYS = Object.keys(PLEDGES);

export const STATUS = {
  draft:     { label: 'טיוטה',        pill: 'gray'  },
  pending:   { label: 'ממתין לאישור', pill: 'warn'  },
  approved:  { label: 'מפורסם',       pill: 'green' },
  rejected:  { label: 'נדחה',         pill: 'err'   },
  suspended: { label: 'הוסר מהחנות',  pill: 'err'   },
};

// ── Storage ────────────────────────────────────────────────────────────────
function readDb() {
  try {
    const db = JSON.parse(fs.readFileSync(COLI_FILE, 'utf8'));
    return { listings: Array.isArray(db.listings) ? db.listings : [] };
  } catch {
    return { listings: [] };
  }
}

function writeDb(db) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(COLI_FILE, JSON.stringify(db, null, 2));
}

const rand = (n = 9) => crypto.randomBytes(n).toString('base64url');
const nowIso = () => new Date().toISOString();
const normEmail = (e) => String(e || '').trim().toLowerCase();
const clean = (s, max) => String(s ?? '').trim().slice(0, max);

// ── Admin ──────────────────────────────────────────────────────────────────
// Someone has to say "yes, this is safe for a 6-year-old". That someone is the
// family that owns this KidsLearn install: KIDSLEARN_ADMIN_EMAIL if set,
// otherwise the very first account that was created (the parent).
export function adminEmails() {
  const fromEnv = String(process.env.KIDSLEARN_ADMIN_EMAIL || '')
    .split(/[,\s]+/).map(normEmail).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const first = listAccounts()[0];
  return first ? [normEmail(first.email)] : [];
}

export function isAdmin(email) {
  const e = normEmail(email);
  return !!e && adminEmails().includes(e);
}

// ── Links & slugs ──────────────────────────────────────────────────────────
/** http(s) only — a store link is something a child's browser will open. */
export function safeUrl(raw) {
  const s = clean(raw, 400);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.toString();
  } catch {
    return '';
  }
}

function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, '-')   // keep Hebrew letters readable
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'app';
}

function uniqueSlug(db, name, selfId = null) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (db.listings.some(l => l.slug === slug && l.id !== selfId)) slug = `${base}-${n++}`;
  return slug;
}

// ── Media (icon + screenshots) ─────────────────────────────────────────────
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Magic bytes must agree with the declared type: a .png that is really HTML
 *  would be served from our own origin, and that is an XSS, not a picture. */
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && buf.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

/** Accepts a data: URL from the upload form and returns a stored file name. */
export function saveMedia(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(String(dataUrl || '').trim());
  if (!m) return { error: 'קובץ תמונה לא תקין' };
  const declared = m[1].toLowerCase();
  if (!MIME_EXT[declared]) return { error: 'אפשר להעלות PNG, JPG, WEBP או GIF בלבד' };
  let buf;
  try { buf = Buffer.from(m[2], 'base64'); } catch { return { error: 'קובץ תמונה לא תקין' }; }
  if (!buf.length) return { error: 'קובץ תמונה ריק' };
  if (buf.length > MAX_IMAGE_BYTES) return { error: `תמונה גדולה מדי (עד ${Math.round(MAX_IMAGE_BYTES / 1024)}KB)` };
  const real = sniff(buf);
  if (!real || real !== declared) return { error: 'הקובץ אינו תמונה תקינה' };
  const file = `${rand(12)}.${MIME_EXT[real]}`;
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, file), buf);
  } catch {
    return { error: 'שמירת התמונה נכשלה' };
  }
  return { ok: true, file };
}

/** Resolve a stored file name to a path on disk (or '' — never escapes the dir). */
export function mediaPath(file) {
  const name = path.basename(String(file || ''));
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif)$/.test(name)) return '';
  const full = path.join(MEDIA_DIR, name);
  return fs.existsSync(full) ? full : '';
}

export const MEDIA_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

function dropMedia(...files) {
  for (const f of files.flat()) {
    const p = mediaPath(f);
    if (p) { try { fs.unlinkSync(p); } catch {} }
  }
}

// ── Views ──────────────────────────────────────────────────────────────────
const iconUrl = (l) => (l.iconFile ? `/coli/media/${l.iconFile}` : '');

/** What the storefront and the JSON API are allowed to see: no owner email. */
export function publicView(l) {
  if (!l) return null;
  return {
    slug: l.slug,
    name: l.name,
    tagline: l.tagline || '',
    description: l.description || '',
    category: l.category,
    categoryLabel: CATEGORIES[l.category]?.label || '',
    ages: l.ages || [],
    emoji: l.emoji || CATEGORIES[l.category]?.icon || '🧩',
    icon: iconUrl(l),
    screenshots: (l.shots || []).map(f => `/coli/media/${f}`),
    links: l.links || {},
    platforms: PLATFORM_KEYS.filter(k => (l.links || {})[k]),
    version: l.version || '',
    changelog: l.changelog || '',
    price: l.price === 'paid' ? (l.priceNote || 'בתשלום') : 'חינם',
    free: l.price !== 'paid',
    pledges: (l.pledges || []).filter(p => PLEDGE_KEYS.includes(p)),
    publisher: l.publisher || '',
    publishedAt: l.publishedAt || null,
    updatedAt: l.updatedAt || null,
    featured: !!l.featured,
    stats: { views: l.stats?.views || 0, opens: l.stats?.opens || 0 },
  };
}

// ── Publisher API (called from the Cloud console) ──────────────────────────
export function listingForApp(appId, owner = null) {
  const l = readDb().listings.find(x => x.appId === appId);
  if (!l) return null;
  if (owner && l.owner !== normEmail(owner)) return null;
  return l;
}

export function listingsByOwner(owner) {
  const email = normEmail(owner);
  return readDb().listings.filter(l => l.owner === email);
}

/** Create or update the listing attached to a Cloud app. */
export function saveListing({ app, owner, patch = {}, icon = '', shots = [], dropShots = [], dropIcon = false }) {
  const email = normEmail(owner);
  if (!app || app.owner !== email) return { error: 'האפליקציה לא נמצאה בחשבון הזה' };

  const db = readDb();
  let l = db.listings.find(x => x.appId === app.id);
  const isNew = !l;
  if (isNew) {
    if (db.listings.filter(x => x.owner === email).length >= MAX_LISTINGS_PER_OWNER) {
      return { error: `הגעתם למקסימום ${MAX_LISTINGS_PER_OWNER} אפליקציות בחנות` };
    }
    l = {
      id: 'lst_' + rand(9),
      appId: app.id,
      clientId: app.clientId,
      owner: email,
      slug: '',
      status: 'draft',
      createdAt: nowIso(),
      stats: { views: 0, opens: 0 },
      links: {},
      ages: [],
      shots: [],
      pledges: [],
    };
    db.listings.push(l);
  }

  const name = clean(patch.name ?? l.name ?? app.name, 60);
  if (name.length < 2) return { error: 'שם האפליקציה חייב להיות לפחות 2 תווים' };
  l.name = name;
  if (!l.slug) l.slug = uniqueSlug(db, name, l.id);

  if (patch.tagline !== undefined) l.tagline = clean(patch.tagline, 90);
  if (patch.description !== undefined) l.description = clean(patch.description, 3000);
  if (patch.publisher !== undefined) l.publisher = clean(patch.publisher, 60);
  if (patch.version !== undefined) l.version = clean(patch.version, 20);
  if (patch.changelog !== undefined) l.changelog = clean(patch.changelog, 500);
  if (patch.emoji !== undefined) l.emoji = [...clean(patch.emoji, 8)].slice(0, 2).join('');
  if (patch.category !== undefined) {
    l.category = CATEGORY_KEYS.includes(patch.category) ? patch.category : (l.category || 'games');
  }
  if (patch.ages !== undefined) {
    const wanted = (Array.isArray(patch.ages) ? patch.ages : [patch.ages]).filter(a => AGE_KEYS.includes(a));
    l.ages = wanted;
  }
  if (patch.pledges !== undefined) {
    const wanted = (Array.isArray(patch.pledges) ? patch.pledges : [patch.pledges]).filter(p => PLEDGE_KEYS.includes(p));
    l.pledges = wanted;
  }
  if (patch.price !== undefined) l.price = patch.price === 'paid' ? 'paid' : 'free';
  if (patch.priceNote !== undefined) l.priceNote = clean(patch.priceNote, 40);
  if (patch.links !== undefined) {
    const links = {};
    for (const k of PLATFORM_KEYS) {
      const u = safeUrl((patch.links || {})[k]);
      if (u) links[k] = u;
    }
    l.links = links;
  }

  // Artwork
  if (dropIcon && l.iconFile) { dropMedia(l.iconFile); l.iconFile = ''; }
  if (icon) {
    const r = saveMedia(icon);
    if (r.error) return { error: r.error };
    if (l.iconFile) dropMedia(l.iconFile);
    l.iconFile = r.file;
  }
  if (dropShots.length) {
    const removed = (l.shots || []).filter(f => dropShots.includes(f));
    l.shots = (l.shots || []).filter(f => !dropShots.includes(f));
    dropMedia(removed);
  }
  for (const s of shots) {
    if ((l.shots || []).length >= MAX_SHOTS) break;
    const r = saveMedia(s);
    if (r.error) return { error: r.error };
    l.shots = [...(l.shots || []), r.file];
  }

  // Editing a published listing sends it back through review — a store that
  // waves through "just a small update" is a store that stops being safe.
  if (l.status === 'approved') l.status = 'pending';
  if (l.status === 'rejected') l.status = 'draft';
  l.updatedAt = nowIso();
  writeDb(db);
  return { ok: true, listing: l, created: isNew };
}

/** Everything a listing must have before a human will look at it. */
export function missingForSubmit(l) {
  if (!l) return ['הטופס עוד לא נשמר'];
  const missing = [];
  if (!l.name || l.name.length < 2) missing.push('שם האפליקציה');
  if (!l.tagline) missing.push('משפט תיאור קצר');
  if (!l.description || l.description.length < 30) missing.push('תיאור מפורט (לפחות 30 תווים)');
  if (!CATEGORY_KEYS.includes(l.category)) missing.push('קטגוריה');
  if (!(l.ages || []).length) missing.push('גיל מתאים');
  if (!Object.keys(l.links || {}).length) missing.push('קישור אחד לפחות להורדה או להפעלה');
  if (!l.publisher) missing.push('שם המפרסם');
  return missing;
}

export function submitListing(appId, owner) {
  const db = readDb();
  const l = db.listings.find(x => x.appId === appId && x.owner === normEmail(owner));
  if (!l) return { error: 'האפליקציה לא נמצאה' };
  const missing = missingForSubmit(l);
  if (missing.length) return { error: 'חסרים פרטים: ' + missing.join(', ') };
  l.status = 'pending';
  l.submittedAt = nowIso();
  l.reviewNote = '';
  writeDb(db);
  return { ok: true, listing: l };
}

export function unpublishListing(appId, owner) {
  const db = readDb();
  const l = db.listings.find(x => x.appId === appId && x.owner === normEmail(owner));
  if (!l) return { error: 'האפליקציה לא נמצאה' };
  l.status = 'draft';
  l.publishedAt = null;
  writeDb(db);
  return { ok: true };
}

export function deleteListing(appId, owner) {
  const db = readDb();
  const l = db.listings.find(x => x.appId === appId && (!owner || x.owner === normEmail(owner)));
  if (!l) return { error: 'האפליקציה לא נמצאה' };
  dropMedia(l.iconFile || [], l.shots || []);
  db.listings = db.listings.filter(x => x !== l);
  writeDb(db);
  return { ok: true };
}

// ── Review queue (admin) ───────────────────────────────────────────────────
export function reviewQueue() {
  const order = { pending: 0, approved: 1, draft: 2, rejected: 3, suspended: 4 };
  return readDb().listings
    .slice()
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || String(b.submittedAt || b.updatedAt || '').localeCompare(String(a.submittedAt || a.updatedAt || '')));
}

export function pendingCount() {
  return readDb().listings.filter(l => l.status === 'pending').length;
}

export function decideListing(id, admin, { approve, note = '', featured = null }) {
  if (!isAdmin(admin)) return { error: 'רק מנהל החנות יכול לאשר אפליקציות' };
  const db = readDb();
  const l = db.listings.find(x => x.id === id);
  if (!l) return { error: 'האפליקציה לא נמצאה' };
  l.status = approve ? 'approved' : (l.status === 'approved' ? 'suspended' : 'rejected');
  l.reviewNote = clean(note, 300);
  l.reviewedAt = nowIso();
  l.reviewedBy = normEmail(admin);
  if (approve && !l.publishedAt) l.publishedAt = nowIso();
  if (featured !== null) l.featured = !!featured;
  writeDb(db);
  return { ok: true, listing: l };
}

// ── Storefront ─────────────────────────────────────────────────────────────
const matches = (l, q) =>
  `${l.name} ${l.tagline || ''} ${l.description || ''} ${l.publisher || ''} ${CATEGORIES[l.category]?.label || ''}`
    .toLowerCase().includes(q);

export function browse({ q = '', category = '', age = '', free = false, sort = 'featured', limit = 200 } = {}) {
  const term = String(q || '').trim().toLowerCase();
  let list = readDb().listings.filter(l => l.status === 'approved');
  if (category && CATEGORY_KEYS.includes(category)) list = list.filter(l => l.category === category);
  if (age && AGE_KEYS.includes(age)) list = list.filter(l => (l.ages || []).includes(age));
  if (free) list = list.filter(l => l.price !== 'paid');
  if (term) list = list.filter(l => matches(l, term));

  const byNew = (a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
  const byPop = (a, b) => (b.stats?.opens || 0) - (a.stats?.opens || 0);
  if (sort === 'new') list.sort(byNew);
  else if (sort === 'popular') list.sort(byPop);
  else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || byPop(a, b) || byNew(a, b));

  return list.slice(0, limit).map(publicView);
}

export function categoryCounts() {
  const live = readDb().listings.filter(l => l.status === 'approved');
  return CATEGORY_KEYS.map(key => ({
    key, ...CATEGORIES[key],
    count: live.filter(l => l.category === key).length,
  }));
}

export function bySlug(slug) {
  const l = readDb().listings.find(x => x.slug === String(slug || '') && x.status === 'approved');
  return l ? publicView(l) : null;
}

export function recordView(slug) {
  const db = readDb();
  const l = db.listings.find(x => x.slug === String(slug || '') && x.status === 'approved');
  if (!l) return null;
  l.stats = l.stats || { views: 0, opens: 0 };
  l.stats.views = (l.stats.views || 0) + 1;
  writeDb(db);
  return l;
}

/** Returns the outbound URL for a platform, counting the open on the way. */
export function openLink(slug, platform) {
  const db = readDb();
  const l = db.listings.find(x => x.slug === String(slug || '') && x.status === 'approved');
  if (!l) return '';
  const url = (l.links || {})[platform];
  if (!url) return '';
  l.stats = l.stats || { views: 0, opens: 0 };
  l.stats.opens = (l.stats.opens || 0) + 1;
  writeDb(db);
  return url;
}

export function storeStats() {
  const list = readDb().listings;
  const live = list.filter(l => l.status === 'approved');
  return {
    apps: live.length,
    pending: list.filter(l => l.status === 'pending').length,
    developers: new Set(live.map(l => l.owner)).size,
    opens: live.reduce((n, l) => n + (l.stats?.opens || 0), 0),
  };
}

export const COLI_LIMITS = { MAX_IMAGE_BYTES, MAX_SHOTS, MAX_LISTINGS_PER_OWNER };
