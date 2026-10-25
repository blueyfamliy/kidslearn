// The app version, baked in at build time from the root package.json
// (see client/vite.config.js). Bump the version there for every release —
// it is shown in the window title and on the home screen so it is always
// clear which build is actually running on the kids' machine.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

// "KidsLearn v1.3.5" — used for the window/tab title.
export const APP_TITLE = `KidsLearn v${APP_VERSION}`;
