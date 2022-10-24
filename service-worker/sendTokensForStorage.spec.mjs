import * as td from 'testdouble';

import loggerMock from './logger.mock.mjs';


describe('ServiceWorker::sendTokensForStorage()', () => {
  const globalSelf = global.self;
  const calls = new Map();

  function makeClients(count = 3) {
    const clients = new Array(3);
    for (const idx of clients.keys()) {
      clients[idx] = {
        postMessage: function MOCK_postMessage(arg1) {
          calls.set(`client ${idx} postMessage`, arg1);
        },
      };
    }
    return clients;
  }

  let sendTokensForStorage;

  before(async () => {
    global.self = {
      clients: {
        matchAll: async function MOCK_matchAll() {
          return makeClients();
        },
      },
    };

    await td.replaceEsm('./logger.mts', loggerMock);

    await import('./sendTokensForStorage.mts').then((m) => { sendTokensForStorage = m.default; });
  });
  afterEach(() => {
    calls.clear();
  });
  after(() => {
    global.self = globalSelf;
    td.reset();
  });

  it('should notify all clients', async () => {
    let tokens = { access: 'foo' };
    await sendTokensForStorage(tokens);
    expect(calls.size).to.equal(3);
    expect(calls.get('client 1 postMessage')).to.equal(tokens);
    expect(calls.get('client 2 postMessage')).to.equal(tokens);
    expect(calls.get('client 2 postMessage')).to.equal(tokens);

    tokens = { refresh: 'bar' };
    await sendTokensForStorage(tokens);
    expect(calls.size).to.equal(3);
    expect(calls.get('client 1 postMessage')).to.equal(tokens);
    expect(calls.get('client 2 postMessage')).to.equal(tokens);
    expect(calls.get('client 2 postMessage')).to.equal(tokens);
  });
});
