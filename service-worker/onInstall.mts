declare const self: ServiceWorkerGlobalScope;


export default function onInstall(event: ExtendableEvent) {
  event.waitUntil(self.skipWaiting());
}
