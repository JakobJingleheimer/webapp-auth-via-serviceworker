import * as td from 'testdouble';

import apiOrigin from '../api/origin.mts';
import loggerMock from './logger.mock.mjs';


describe('ServiceWorker::onFetch()', () => {
  const globalFetch = global.fetch;

  const accessToken = 'abc123.def456.ghi789';
  const refreshToken = 'rst987.uvw654.xyz321';
  const newAccessToken = `new_${accessToken}`;
  const newRefreshToken = `new_${refreshToken}`;
  const tokens = { access: '', refresh: '' };

  const initialUrl = `${apiOrigin}/foo`;
  const refreshUrl = `${apiOrigin}/auth/refresh`;
  let onFetch;       // dynamic import after module mocking
  let refreshTokens; // dynamic import after module mocking

  let callCount = 0;
  /**
   * @type Map<URL['href'], { request: Request, response: Response }>
   */
  const fetchCalls = new Map();

  class FetchEvent extends Event {
    _substitutedResponse;

    constructor(type, init) {
      super(type, init);
      this.request = init.request;
    }

    respondWith(result) {
      this._substitutedResponse = result;
      return Promise.resolve(this._substitutedResponse); // [A]
    }

    waitUntil(promise) {
      return Promise.resolve(promise); // [A]
    }

    // [A] Promise.resolve(rejection) still rejects
  }

  async function triggerFetch(url) {
    const request = new Request(url);
    const event = new FetchEvent('fetch', { request });

    const result = await onFetch(event).catch((err) => err);

    return {
      call: fetchCalls.get(url),
      event,
      initialRequest: request,
      result,
    };
  }

  function MOCK_fetch(request) {
    if (callCount > 4) {
      console.error(new Error(
        'Terminating due to excessive request chain length (infinite loop suspected).'
      ));
      process.exit(1);
    }

    const { signal = {}, url } = request;

    ++callCount;

    const response = (
      fetchCalls.get(url)?.response
      ?? (signal.aborted
        ? new DOMException(signal.reason, 'AbortError')
        : new Response(undefined, { status: 200 })
      )
    );

    const settle = signal.aborted
      ? 'reject'
      : 'resolve';

    fetchCalls.set(url, { request, response });

    return Promise[settle](response); // fetch always resolves unless there's a network problem
  }

  before(async () => {
    await td.replaceEsm('./logger.mts', loggerMock);
    await td.replaceEsm('./tokens.mts', undefined, tokens);

    global.fetch = MOCK_fetch;

    await import('./onFetch.mts').then((m) => { onFetch = m.default; });
    await import('./refreshTokens.mts').then((m) => { refreshTokens = m.default; });
  });
  afterEach(() => {
    fetchCalls.clear();
    callCount = 0;

    tokens.access = '';
    tokens.refresh = '';
  });
  after(() => {
    global.fetch = globalFetch;
    td.reset();
  });

  async function expectCallToBeCancelled({ event, response }) {
    expect(response).to.be.an.instanceof(DOMException);
    expect(response.name).to.equal('AbortError');
    // ensure it's the correct reason
    expect(response.message).to.include('token');
    expect(response.message).to.include('missing');

    if (event) {
      const substitutedResponse = await event._substitutedResponse.catch((err) => err);
      expect(substitutedResponse).to.equal(response);
    }
  }

  function shouldIgnoreCall(url) {
    it('should ignore the request', async () => {
      const { call, result } = await triggerFetch(url);

      expect(call, '`fetch()` should not be called within ServiceWorker')
        .to.be.undefined;
      expect(result, 'handler returning `undefined` defers to default handling')
        .to.be.undefined;
    });
  }

  describe('making an external request', () => {
    shouldIgnoreCall('http://www.example.com/foo');
  });

  describe('making an internal request', () => {
    describe('to authenticate', () => {
      shouldIgnoreCall(`${apiOrigin}/auth/login`);
    });

    describe('to not authenticate', () => {
      function shouldRefreshSessionAndRetry({ initiallyFail }) {
        it('should try to refresh the session', async () => {
          tokens.refresh = refreshToken;

          if (initiallyFail) {
            tokens.access = accessToken;

            fetchCalls.set(initialUrl, {
              response: new Response(undefined, {
                status: 401,
              }),
            });

            // For an initial failure, we need to inject a subsequent success for the initial
            // request, but AFTER the refresh and BEFORE the re-try, so mock the refresh to
            // overwrite the subsequent success.
            await td.replaceEsm('./refreshTokens.mts', undefined, async function MOCK_refreshTokens() {
              fetchCalls.set(initialUrl, {
                response: new Response(undefined, {
                  status: 200,
                }),
              });
              return refreshTokens(new AbortController());
            });
            await import('./onFetch.mts')
              .then((m) => { onFetch = m.default; });
          }

          fetchCalls.set(refreshUrl, {
            response: new Response(JSON.stringify({
              access: newAccessToken,
              refresh: newRefreshToken,
            }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          });

          await triggerFetch(initialUrl);
          const { request: initialRequest } = fetchCalls.get(initialUrl);
          const { request: refreshRequest } = fetchCalls.get(refreshUrl);

          expect(fetchCalls.size).to.equal(2); // initial & refresh
          expect(refreshRequest.headers.get('Authorization')).to.equal(`Bearer ${refreshToken}`);

          expect(initialRequest.headers.get('Authorization')).to.equal(`Bearer ${newAccessToken}`);

          expect(tokens.access).to.equal(newAccessToken);
          expect(tokens.refresh).to.equal(newRefreshToken);

          // ! cleanup: restore refreshToken to its actual implementation
          if (initiallyFail) await td.replaceEsm('./refreshTokens.mts', undefined, refreshTokens);
          // ! re-import onFetch so it receives the restoration
          await import('./onFetch.mts').then((m) => { onFetch = m.default; });
        });
      }

      describe('with a valid access token', () => {
        it('should attach the access token and continue the request', async () => {
          tokens.access = accessToken;
          const url = `${apiOrigin}/foo`;

          fetchCalls.set(url, {
            response: new Response(JSON.stringify({"data": []}), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            })
          });

          const { call: { request } } = await triggerFetch(url);

          expect(request.headers.get('Authorization')).to.equal(`Bearer ${accessToken}`);
        });
      });

      describe('with no access token', () => {
        shouldRefreshSessionAndRetry({ initiallyFail: false });
      });

      describe('with an invalid access token', () => {
        shouldRefreshSessionAndRetry({ initiallyFail: true });
      });

      describe('and the protected request would fail', () => {
        it('should capture the request and cancel it', async () => {
          const { event, result: failure } = await triggerFetch(initialUrl);

          await expectCallToBeCancelled({ event, response: failure });
        });
      });
    });
  });

  describe('refreshing the session', () => {
    describe('the refresh token is', () => {
      describe('present and valid', () => {
        it('should request new tokens', async () => {
          tokens.refresh = refreshToken;

          fetchCalls.set(refreshUrl, {
            response: new Response(JSON.stringify({
              access: newAccessToken,
              refresh: newRefreshToken,
            }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }),
          });

          await refreshTokens({ origin: apiOrigin, refreshToken });
          const { request } = fetchCalls.get(refreshUrl);

          expect(request.headers.get('Authorization')).to.equal(`Bearer ${refreshToken}`);

          expect(tokens.access).to.equal(newAccessToken);
          expect(tokens.refresh).to.equal(newRefreshToken);
        });
      });

      describe('present and invalid', () => {
        it('should try to refresh and subsequently cancel the initial request', async () => {
          tokens.refresh = refreshToken;
          const statusText = 'expired refresh token';

          fetchCalls.set(refreshUrl, {
            response: new Response(undefined, { status: 401, statusText })
          });

          const failure = await refreshTokens({
            initialRequest: new Request(initialUrl),
            origin: apiOrigin,
            refreshToken,
          })
            .catch((err) => err);

          // [1]
          // const { response: initialRequestResponse } = fetchCalls.get(initialUrl);
          // expect(fetchCalls.size).to.equal(2); // refresh & initial (but cancelled)
          expect(fetchCalls.size, 'fetch call count').to.equal(1); // refresh
          expect(failure).to.include(statusText);
        });
      });

      describe('not present', () => {
        it('should abort and cancel the initial request', async () => {
          fetchCalls.set(refreshUrl, )
          const failure = await refreshTokens(new AbortController())
            .catch((err) => err);

          // [1]
          // const { response: initialRequestResponse } = fetchCalls.get(initialUrl);
          // expect(fetchCalls.size).to.equal(2); // refresh & initial (both cancelled)
          // await expectCallToBeCancelled({ request: refreshResponse });
          // await expectCallToBeCancelled({ initialRequestResponse });
          expect(fetchCalls.size, 'fetch call count').to.equal(1); // the aborted request
          expect(failure.message).to.include('aborted');
          expect(failure.message).to.include('refresh token');
        });
      });
    });
  });
});
