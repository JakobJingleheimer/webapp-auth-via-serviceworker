declare const self: ServiceWorkerGlobalScope;


export default async function onActivate(event: ExtendableEvent) {
  // ServiceWorker needs to await BOTH of these before continuing to avoid an incomplete
  // setup when the app starts doing things.
  return event.waitUntil(Promise.all([
    self.clients.claim(),
    self.clients.matchAll(),
  ])); // claim control of client(s) / tabs running the app
}
