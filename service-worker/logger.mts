export const log: Console['log'] = (...args) => console.log('⚙ [ServiceWorker]:', ...args);
export const err: Console['error'] = (...args) => console.error('⚙ [ServiceWorker]:', ...args);
export const warn: Console['warn'] = (...args) => console.warn('⚙ [ServiceWorker]:', ...args);
