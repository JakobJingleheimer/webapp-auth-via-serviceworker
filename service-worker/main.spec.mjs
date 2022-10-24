import * as td from 'testdouble';

import loggerMock from './logger.mock.mjs';


describe('ServiceWorker::main', () => {
  const globalSelf = global.self;
  const listenerRegistrations = new Map();
  let registrationCount = 0;
  const EVENT_LISTENER_MOCKS = new Map([
    ['install', function MOCK_onInstall() {}],
    ['activate', function MOCK_onActivate() {}],
    ['fetch', function MOCK_onFetch() {}],
  ]);
  function MOCK_addEventListener(eventName, handler) {
    listenerRegistrations.set(eventName, handler);
    ++registrationCount;
  }

  before(async () => {
    await td.replaceEsm('./logger.mts', loggerMock);
    await td.replaceEsm('./onInstall.mts', undefined, EVENT_LISTENER_MOCKS.get('install'));
    await td.replaceEsm('./onActivate.mts', undefined, EVENT_LISTENER_MOCKS.get('activate'));
    await td.replaceEsm('./onFetch.mts', undefined, EVENT_LISTENER_MOCKS.get('fetch'));

    global.self = {
      addEventListener: MOCK_addEventListener,
    };
  });
  afterEach(() => {
    listenerRegistrations.clear();
    registrationCount = 0;
  });
  after(() => {
    global.self = globalSelf;
    td.reset();
  });

  it('should register event listeners', async () => {
    await import('./main.mts');

    for (const [eventName, handler] of EVENT_LISTENER_MOCKS.entries()) {
      expect(listenerRegistrations.get(eventName), eventName).to.equal(handler);
    }
    expect(registrationCount, 'listeners registered').to.equal(3);
  });
});
