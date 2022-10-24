import onActivate from './onActivate.mts';


describe('ServiceWorker::onActivate()', () => {
  const calls = new Map();
  const globalSelf = global.self;

  class ActivateEvent extends Event {
    constructor(...args) { super('activate', ...args); }

    waitUntil(promise) {
      calls.set('waitUntil', promise);
      return Promise.resolve(promise);
    }
  }

  before(() => {
    global.self = {
      clients: {
        claim: async function MOCK_claim(...args) {
          calls.set('claim', args);
        },
        matchAll: async function MOCK_matchAll(...args) {
          calls.set('matchAll', args);
        },
      }
    };
  });
  afterEach(() => {
    calls.clear();
  });
  after(() => {
    global.self = globalSelf;
  });

  it('should claim all clients', async () => {
    await onActivate(new ActivateEvent());

    expect(calls.has('waitUntil'));
    expect(calls.has('claim'));
    expect(calls.has('matchAll'));
  });
});
