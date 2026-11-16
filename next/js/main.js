import { route, start, upgradeLegacyUrl } from './core/router.js';
import { installGlobalHandlers } from './core/errors.js';
import { chapterIds } from './content/registry.js';
import { mount } from './ui/shell.js';
import { h } from './core/dom.js';
import * as S from './ui/screens.js';
import { backupScreen } from './ui/backupScreen.js';
import { legacyScreen } from './ui/legacyScreen.js';
import * as idb from './storage/idb.js';

installGlobalHandlers();
upgradeLegacyUrl(chapterIds());

route('/home', S.home);
route('/learn', S.learn);
route('/chapter/:id', S.chapter);
route('/practice', S.practice);
route('/progress', S.progress);
route('/more', S.more);
route('/more/backup', backupScreen);
route('/more/import-old', legacyScreen);
route('/more/about', S.about);

// Ask the browser not to evict our data under storage pressure (best effort, no prompt on most browsers).
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }

idb.open().catch((e) => console.error('Storage unavailable', e));
start(() => mount('Not found', h('div', { class: 'card' }, h('p', null, 'That page does not exist.')), h('a', { class: 'btn', href: '#/home' }, 'Go home')));
