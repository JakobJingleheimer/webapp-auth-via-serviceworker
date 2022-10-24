import { err, log } from './service-worker/logger.mts';
import { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME } from './service-worker/TOKEN_NAMES.mjs';


export default async function setupServiceWorker(navigator: Partial<Navigator>) {
  if (!navigator.serviceWorker) {
    err('browser does not support ServiceWorkers');
    return; // things are b0rked
  }

  navigator.serviceWorker.register('/service-worker.js', {
    scope: '/',
    type: 'module',
  }).catch(err);

  navigator.serviceWorker.addEventListener('message',
    ({ data: { access, refresh }, origin }: MessageEvent<Record<string, string>>) => {
      if (origin !== location.origin) return;

      log('storing tokens received from SW', { access, refresh });

      // Since tokens are set individually, individual messages are triggered for each assignment
      // Only one of `access` OR `refresh` contain a new value (the other is `undefined`).
      // An empty string (`''`) is used to signal that the value should be voided.

      if (access) {
        localStorage.setItem(ACCESS_TOKEN_NAME, access);

        // If you're using a JWT to contain user permissions, and that needs to be surfaced to the
        // app as well as to the ServiceWorker. If you're using React context, you're in for a bit
        // of pain because it requires the context to be provided to a react component. But there's
        // a simple and not-too-bad way to address that:
        //
        // * read from LocalStorage in whatever module initialises your app's state. Using messaging
        //   (eg `postMessage()` et al) will not work because the app's event listener hasn't
        //   registered yet.
        // * for updates to the the token, trigger a custom event, like so:

        // const event = new CustomEvent<Record<string, any>>('access-update', {
        //   detail: getPermissionsFromAccessToken(access),
        // });
        //
        // window.dispatchEvent(event);
      }
      else if (access === '') localStorage.removeItem(ACCESS_TOKEN_NAME);

      if (refresh) localStorage.setItem(REFRESH_TOKEN_NAME, refresh);
      else if (refresh === '') localStorage.removeItem(REFRESH_TOKEN_NAME);
    }
  );

  return navigator.serviceWorker.ready.then((registration) => {
    log('initial tokens sync: app → SW');

    // If you're emailing a "magic link", you'll need something like this:

    // const loginToken = new URLSearchParams(location.search).get('token');
    //
    // if (loginToken) {
    //   log('login token detected', loginToken);
    //
    //   localStorage.removeItem(ACCESS_TOKEN_NAME);
    //   localStorage.setItem(REFRESH_TOKEN_NAME, loginToken);
    //
    //   window.history.replaceState({}, document.title, './');
    // }

    registration.active?.postMessage({
      access: localStorage.getItem(ACCESS_TOKEN_NAME),
      refresh: localStorage.getItem(REFRESH_TOKEN_NAME),
    });
  });
}
