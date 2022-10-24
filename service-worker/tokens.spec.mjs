import * as td from 'testdouble';

import loggerMock from './logger.mock.mjs';


describe('ServiceWorker::tokens{}', () => {
  const globalSelf = global.self;
  const tokenValues1 = {
    access: 'abc123.def456.ghi789',
    refresh: 'rst987.uvw654.xyz321',
  };
  const tokenValues2 = {
    access: `new_${tokenValues1.access}`,
    refresh: `new_${tokenValues1.refresh}`,
  };

  const calls = new Map();
  function MOCK_addEventListener(eventName, handler) {
    calls.set(`addEventListener:${eventName}`, handler);
  }

  let onMessage;
  let tokens;
  let i = 0; // Have to cache-bust the module graph to get a clean slate for each case

  before(async () => {
    global.self = {
      addEventListener: MOCK_addEventListener,
    };

    await td.replaceEsm('./logger.mts', loggerMock);
    await td.replaceEsm('./sendTokensForStorage.mts', undefined, function MOCK_sendTokensForStorage(tokens) {
      calls.set('sendTokensForStorage', tokens);
    });
  });
  beforeEach(async () => {
    await import(`./tokens.mts?${i++}`).then((m) => {
      onMessage = m.onMessage;
      tokens = m.default;
    });
  });
  afterEach(() => {
    calls.clear();
  });
  after(() => {
    global.self = globalSelf;
    td.reset();
  });

  for (const tokenName of ['access', 'refresh']) {
    describe(`${tokenName} token`, () => {
      it('should get and set the current token value', () => {
        let value = tokenValues1[tokenName];
        tokens[tokenName] = value;
        expect(tokens[tokenName]).to.equal(value);

        value = tokenValues2[tokenName];
        tokens[tokenName] = value;
        expect(tokens[tokenName]).to.equal(value);
      });

      it('should trigger notifying clients of new values', async () => {
        const value = tokenValues1[tokenName]
        tokens[tokenName] = value;
        expect(calls.get('sendTokensForStorage')).to.deep.equal({ [tokenName]: value });
      });
    });
  }

  describe('onMessage()', () => {
    it('should register a message listener', async () => {
      expect(calls.get('addEventListener:message')).to.equal(onMessage);
    });

    it('should ignore messages from a different origin', () => {
      const event = Object.assign(new Event('message'), {
        data: tokenValues1,
        origin: 'http://example.com',
      });
      onMessage(event);

      expect(tokens.access).to.equal('');
      expect(tokens.refresh).to.equal('');
    });

    it('should accept messages from its own origin', () => {
      const event = Object.assign(new Event('message'), {
        data: tokenValues1,
        origin: location.origin,
      });
      onMessage(event);

      expect(tokens.access).to.equal(tokenValues1.access);
      expect(tokens.refresh).to.equal(tokenValues1.refresh);
    });

    it('should ignore messages messages with falsy tokens', () => {
      tokens.access = tokenValues1.access;
      tokens.refresh = tokenValues1.refresh;

      for (const value of [null, undefined, false, 0]) {
        onMessage(new Event('message', {
          data: {
            access: value,
            refresh: value,
          },
          origin: location.origin,
        }));

        expect(tokens.access).to.equal(tokenValues1.access);
        expect(tokens.refresh).to.equal(tokenValues1.refresh);
      }
    });
  });
});
