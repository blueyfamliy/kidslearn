// KidsLearn Coli — every route of the store.
//
//   /coli/*            the storefront families browse (public, no login)
//   /api/coli/*        the same catalog as JSON (public, no API key)
//   /cloud/apps/:id/store  the publisher form, inside the Cloud console
//   /cloud/coli/review     the human gate before anything reaches a child
//
// Mounted BEFORE cloudRouter in index.js: the listing form posts artwork as
// base64 and needs a bigger body limit than the 1MB the console allows.
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getApp } from './cloud.js';
import { requireDev, sessionUser } from './cloudRoutes.js';
import { storeFormPage, reviewQueuePage } from './coliConsole.js';
import { homePage, browsePage, listingPage, publishPage, coliErrorPage } from './coliPages.js';
import {
  CATEGORIES, CATEGORY_KEYS, AGES, AGE_KEYS, PLATFORM_KEYS, PLEDGE_KEYS,
  browse, bySlug, categoryCounts, recordView, openLink, storeStats,
  listingForApp, listingsByOwner, saveListing, submitListing, unpublishListing,
  deleteListing, reviewQueue, pendingCount, decideListing, isAdmin,
  mediaPath, MEDIA_TYPES,
} from './coli.js';

export const coliRouter = express.Router();

// Artwork travels inside the form as base64, so this one route needs room.
const listingForm = express.urlencoded({ extended: false, limit: '12mb' });
const smallForm = express.urlencoded({ extended: false, limit: '256kb' });

const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;
const arr = (v) => (v === undefined ? [] : [].concat(v)).filter(Boolean);

// ── Storefront ─────────────────────────────────────────────────────────────
coliRouter.get('/coli', (req, res) => {
  res.send(homePage({
    stats: storeStats(),
    cats: categoryCounts(),
    featured: browse({ sort: 'featured', limit: 8 }).filter(a => a.featured),
    newest: browse({ sort: 'new', limit: 12 }),
    popular: browse({ sort: 'popular', limit: 8 }).filter(a => a.stats.opens > 0),
  }));
});

coliRouter.get('/coli/search', (req, res) => {
  const q = String(req.query.q || '').slice(0, 80);
  const apps = browse({ q, sort: 'featured' });
  res.send(browsePage({
    title: q ? `תוצאות עבור "${q}"` : 'כל האפליקציות',
    subtitle: `${apps.length} אפליקציות`,
    apps, cats: categoryCounts(), q,
  }));
});

coliRouter.get('/coli/category/:key', (req, res) => {
  const key = String(req.params.key || '');
  if (!CATEGORY_KEYS.includes(key)) return res.status(404).send(coliErrorPage('קטגוריה לא נמצאה'));
  const apps = browse({ category: key, sort: 'featured' });
  res.send(browsePage({
    title: `${CATEGORIES[key].icon} ${CATEGORIES[key].label}`,
    subtitle: `${apps.length} אפליקציות בקטגוריה`,
    apps, cats: categoryCounts(), active: key,
  }));
});

coliRouter.get('/coli/kids', (req, res) => {
  const age = AGE_KEYS.includes(String(req.query.age || '')) ? String(req.query.age) : '';
  const apps = browse({ age, sort: 'featured' });
  res.send(browsePage({
    title: 'לפי גיל',
    subtitle: age ? `מתאים ל${AGES[age]}` : 'בחרו גיל כדי לראות רק מה שמתאים',
    apps, cats: categoryCounts(), mode: 'age', active: age,
  }));
});

coliRouter.get('/coli/publish', (req, res) => {
  res.send(publishPage({ stats: storeStats(), baseUrl: baseUrl(req) }));
});

coliRouter.get('/coli/app/:slug', (req, res) => {
  const app = bySlug(req.params.slug);
  if (!app) return res.status(404).send(coliErrorPage('האפליקציה לא נמצאה', 'ייתכן שהוסרה מהחנות או שהקישור שגוי.'));
  recordView(app.slug);
  const related = browse({ category: app.category, limit: 5 }).filter(a => a.slug !== app.slug).slice(0, 4);
  res.send(listingPage({ app, related }));
});

// Counts the click, then hands the family over to the developer's own link.
coliRouter.get('/coli/open/:slug/:platform', (req, res) => {
  const url = openLink(req.params.slug, String(req.params.platform || ''));
  if (!url) return res.status(404).send(coliErrorPage('הקישור לא נמצא', 'ייתכן שהמפרסם הסיר אותו.'));
  res.redirect(302, url);
});

// Uploaded icons and screenshots. Sniffed as real images on the way in
// (see coli.js), served with nosniff so nothing can pretend to be a script.
coliRouter.get('/coli/media/:file', (req, res) => {
  const full = mediaPath(req.params.file);
  if (!full) return res.status(404).end();
  res.set('Content-Type', MEDIA_TYPES[path.extname(full).slice(1)] || 'application/octet-stream');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(full).on('error', () => res.status(404).end()).pipe(res);
});

// ── Public JSON API (no key: the catalog is meant to be shared) ────────────
coliRouter.get('/api/coli/apps', (req, res) => {
  res.json({
    ok: true,
    apps: browse({
      q: String(req.query.q || ''),
      category: String(req.query.category || ''),
      age: String(req.query.age || ''),
      free: String(req.query.free || '') === '1',
      sort: String(req.query.sort || 'featured'),
      limit: Math.min(Number(req.query.limit) || 100, 200),
    }),
  });
});

coliRouter.get('/api/coli/apps/:slug', (req, res) => {
  const app = bySlug(req.params.slug);
  if (!app) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, app });
});

coliRouter.get('/api/coli/categories', (req, res) => {
  res.json({ ok: true, categories: categoryCounts(), ages: AGES, stats: storeStats() });
});

// ── Publisher: the listing form inside the Cloud console ───────────────────
const consoleCtx = (user) => ({ admin: isAdmin(user.email), pending: isAdmin(user.email) ? pendingCount() : 0 });

function ownedApp(req, res) {
  const app = getApp(req.params.id, req.devUser.email);
  if (!app) {
    res.status(404).send(coliErrorPage('האפליקציה לא נמצאה', 'ייתכן שנמחקה, או שהיא שייכת לחשבון אחר.'));
    return null;
  }
  return app;
}

coliRouter.get('/cloud/apps/:id/store', requireDev, (req, res) => {
  const app = ownedApp(req, res);
  if (!app) return;
  res.send(storeFormPage({
    user: req.devUser,
    app,
    listing: listingForApp(app.id, req.devUser.email),
    flash: String(req.query.flash || ''),
    error: String(req.query.error || ''),
    ...consoleCtx(req.devUser),
  }));
});

coliRouter.post('/cloud/apps/:id/store', requireDev, listingForm, (req, res) => {
  const app = ownedApp(req, res);
  if (!app) return;
  const body = req.body || {};

  const links = {};
  for (const k of PLATFORM_KEYS) links[k] = body[`link_${k}`];

  const r = saveListing({
    app,
    owner: req.devUser.email,
    patch: {
      name: body.name,
      tagline: body.tagline,
      publisher: body.publisher,
      description: body.description,
      emoji: body.emoji,
      category: body.category,
      ages: arr(body.ages),
      pledges: PLEDGE_KEYS.filter(k => body[`pledge_${k}`]),
      price: body.price,
      priceNote: body.priceNote,
      version: body.version,
      changelog: body.changelog,
      links,
    },
    icon: String(body.icon || ''),
    shots: arr(body.shots),
    dropShots: arr(body.dropShots),
    dropIcon: !!body.dropIcon,
  });

  if (r.error) {
    return res.status(400).send(storeFormPage({
      user: req.devUser, app, listing: listingForApp(app.id, req.devUser.email),
      error: r.error, ...consoleCtx(req.devUser),
    }));
  }
  const note = r.listing.status === 'pending' && r.listing.submittedAt
    ? 'דף החנות נשמר ונשלח שוב לבדיקה'
    : 'דף החנות נשמר';
  res.redirect(`/cloud/apps/${app.id}/store?flash=${encodeURIComponent(note)}`);
});

coliRouter.post('/cloud/apps/:id/store/submit', requireDev, smallForm, (req, res) => {
  const r = submitListing(req.params.id, req.devUser.email);
  const q = r.error ? `error=${encodeURIComponent(r.error)}` : `flash=${encodeURIComponent('נשלח לאישור! נעדכן כאן ברגע שהאפליקציה תאושר.')}`;
  res.redirect(`/cloud/apps/${req.params.id}/store?${q}`);
});

coliRouter.post('/cloud/apps/:id/store/unpublish', requireDev, smallForm, (req, res) => {
  const r = unpublishListing(req.params.id, req.devUser.email);
  const q = r.error ? `error=${encodeURIComponent(r.error)}` : `flash=${encodeURIComponent('האפליקציה הוסרה מהחנות וחזרה לטיוטה')}`;
  res.redirect(`/cloud/apps/${req.params.id}/store?${q}`);
});

coliRouter.post('/cloud/apps/:id/store/delete', requireDev, smallForm, (req, res) => {
  const r = deleteListing(req.params.id, req.devUser.email);
  if (r.error) return res.redirect(`/cloud/apps/${req.params.id}/store?error=${encodeURIComponent(r.error)}`);
  res.redirect(`/cloud/apps/${req.params.id}?flash=${encodeURIComponent('דף החנות נמחק')}`);
});

// ── Admin: the review queue ────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.redirect('/cloud');
  if (!isAdmin(user.email)) {
    return res.status(403).send(coliErrorPage('אין הרשאה', 'רק מנהל החנות יכול לאשר אפליקציות.'));
  }
  req.devUser = user;
  next();
}

coliRouter.get('/cloud/coli/review', requireAdmin, (req, res) => {
  res.send(reviewQueuePage({
    user: req.devUser,
    listings: reviewQueue(),
    pending: pendingCount(),
    flash: String(req.query.flash || ''),
  }));
});

coliRouter.post('/cloud/coli/review/:id', requireAdmin, smallForm, (req, res) => {
  const body = req.body || {};
  const approve = body.decision === 'approve';
  const r = decideListing(req.params.id, req.devUser.email, {
    approve,
    note: body.note,
    featured: !!body.featured,
  });
  const flash = r.error ? r.error : approve ? 'האפליקציה אושרה ופורסמה בחנות' : 'האפליקציה לא אושרה';
  res.redirect(`/cloud/coli/review?flash=${encodeURIComponent(flash)}`);
});

// A developer's own listings, as JSON — handy for a future "my apps" screen.
coliRouter.get('/api/coli/mine', (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'לא מחובר' });
  res.json({
    ok: true,
    listings: listingsByOwner(user.email).map(l => ({
      appId: l.appId, slug: l.slug, name: l.name, status: l.status,
      reviewNote: l.reviewNote || '', stats: l.stats || {},
    })),
  });
});
