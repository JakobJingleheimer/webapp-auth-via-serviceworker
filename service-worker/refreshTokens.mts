import apiOrigin from '../api/origin.mts';
import baseRequestOptions from './baseRequestOptions.mts';
import { log } from './logger.mts';
import tokens from './tokens.mts';


/**
 * Track whether a refresh is in-flight (use a promise so subsequent requests can wait for the
 * refresh to settle before re-trying).
 */
let requestTokenRefresh: Promise<void> | null;

export default function refreshTokens(ctrl: AbortController) {
  if (requestTokenRefresh) return requestTokenRefresh; // another request already triggered a refresh

  if (!tokens.refresh) {
    ctrl.abort('token refresh aborted—refresh token missing'); // [1]
  }

  log('getting new access token with refresh token', tokens.refresh);

  requestTokenRefresh = fetch(
    new Request(`${apiOrigin}/auth/refresh`, {
      ...baseRequestOptions,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${tokens.refresh}` },
      method: 'POST',
      signal: ctrl.signal, // [1]
    })
  )
    .then((rsp) => {
      if (!rsp.ok) {
        if (rsp.status === 401) {
          // Void invalid tokens
          tokens.access = '';
          tokens.refresh = '';
        }
        return Promise.reject(`token refresh failed: ${rsp.status} ${rsp.statusText}`);
      }

      return rsp.json();
    })
    .then(({ access, refresh }) => {
      tokens.access = access;
      tokens.refresh = refresh;
    })
    .finally(() => {
      log('token refresh settled—cleaning up');
      requestTokenRefresh = null;
    });

  return requestTokenRefresh;
}
