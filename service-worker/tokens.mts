declare const self: ServiceWorkerGlobalScope;

import { log } from './logger.mts';
import sendTokensForStorage from './sendTokensForStorage.mts';

let access = '';
let refresh = '';

export default {
  get access() { return access },
  set access(val) { sendTokensForStorage({ access: access = val }) },
  get refresh() { return refresh },
  set refresh(val) { sendTokensForStorage({ refresh: refresh = val }) },
};

// exported for testability
export function onMessage({ data, origin }: ExtendableMessageEvent) {
  if (origin !== location.origin) return;

  log('received tokens from storage via app');

  if (data.access) access = data.access;
  if (data.refresh) refresh = data.refresh;
}
self.addEventListener('message', onMessage);
