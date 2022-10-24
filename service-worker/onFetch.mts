declare const self: ServiceWorkerGlobalScope;

import apiOrigin from '../api/origin.mts';
import baseRequestOptions from './baseRequestOptions.mts';
import { log, warn } from './logger.mts';
import refreshTokens from './refreshTokens.mts';
import tokens from './tokens.mts';


// [1] Browser bugs cause ServiceWorker's AbortController(s) to result in a Network Failure error instead
// of a cancellation.
// https://bugs.chromium.org/p/chromium/issues/detail?id=1377650
// https://bugzilla.mozilla.org/show_bug.cgi?id=1796998

export default async function onFetch(event: FetchEvent) {
  const { request } = event;
  const reqURL = new URL(request.url);

  if (reqURL.origin !== apiOrigin) return; // [2]
  if (reqURL.pathname === '/auth/login') return; // [2]
  // [2] Step aside (allow original request to continue as it was)

  return event
    .respondWith(
      handleRequest(request)
        .catch((error) => {
          warn(error);

          throw error;
        })
    );
}

/**
 * Separating the handler from the listener is necessary to facilitate a re-try in case of session
 * expiry; otherwise, it can create an endless request re-try loop. When the request fails due to an
 * expired session, this refreshes the session, and then re-tries the original request.
 */
async function handleRequest(request: Request): Promise<Response> {
  log(`making protected request to ${request.url} with token ${tokens.access}`);

  const ctrl = new AbortController(); // [1]

  if (!tokens.access) {
    log('awaiting access token prior to making protected request');
    await refreshTokens(ctrl);
  }

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${tokens.access}`)

  return fetch(
    new Request(request, {
      ...baseRequestOptions,
      headers,
      signal: ctrl.signal, // [1]
    })
  )
    .then((rsp) => {
      if (rsp.status === 401) { // the access token was expired/invalid
        log('protected request to', request.url, 'failed due to expired session; trying to refresh session');

        return refreshTokens(ctrl)
          .then(() => {
            log('session refresh succeeded; re-trying request to', request.url);
            return handleRequest(request);
          });
      }

      return rsp;
    });
}
