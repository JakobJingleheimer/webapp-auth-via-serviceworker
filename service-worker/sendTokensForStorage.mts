declare const self: ServiceWorkerGlobalScope;

import { log } from './logger.mts';


/**
 * Only the app is able to access WebStorage, so send the new tokens to it/them to persist.
 * WebStorage is preferred over other storages to which the ServiceWorker has direct access because
 * WebStorage is synchronous, ensuring storage operations are handled in the proper sequence
 * (avoiding a race condition wherein an outdated storage request is processed _after_ a newer one).
 * @param tokens Data to send (a flat, plain object)
 */
export default function sendTokensForStorage(tokens: Record<'access' | 'refresh', string>) {
  log('notifying app of new tokens', tokens);
  // Send to all clients in order to avoid an incomplete update, wherein a particular client
  // (browser tab) is frozen when the ServiceWorker notifies it of the new tokens (and the new
  // tokens never get stored).
  //
  // Since WebStorage is synchronous, a race condition is precluded, so at worst, we end up with a
  // few extraneous storage operations.
  return self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage(tokens));
  });
}
