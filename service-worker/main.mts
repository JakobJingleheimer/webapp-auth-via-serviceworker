declare const self: ServiceWorkerGlobalScope;

import { log } from './logger.mts';
import onInstall from './onInstall.mts';
import onActivate from './onActivate.mts';
import onFetch from './onFetch.mts';

log('main setup');

// ServiceWorker lifecycle events
self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate);

// ServiceWorker "features"
self.addEventListener('fetch', onFetch);
