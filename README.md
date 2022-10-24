# Web App ServiceWorker

```
                                             ┌────────────────┐
                                             │ 3rd party APIs │
┌─────┐ Network requests ┌───────────────┐ ⇄ └────────────────┘
│ SPA │        ⇄         │ ServiceWorker │
└─────┘ Network response └───────────────┘ ⇄ ┌────────────────┐
                                             │  Internal API  │
                                             └────────────────┘
```

The ServiceWorker automatically handles authentication with internal APIs, including decorating requests, session refresh, and queuing & re-trying requests that failed due to session expiry. This is (almost entirely) transparent to the SPA (aside from the SPA's responsibility to persist tokens).

The ServiceWorker is shared by all "clients" of the app (aka browser tabs), so this ensures no tab becomes desynchronised (in terms of authentication).

Tokens are stored in `LocalStorage` because it is synchronous in order to preclude race conditions. Browsers permit only the main thread (the SPA) to access WebStorage, so the SPA and ServiceWorker post messages to each other on:

* app init (to supply persisted tokens from storage to the ServiceWorker)
* session refresh (to persist the new tokens in storage)
* unrecoverable session expiry (to remove the invalid tokens from storage)

```
┌─────┐ Persisted tokens  ┌───────────────┐ Current tokens ┌────────────────┐
│ SPA │         ⇄         │ ServiceWorker │       ⇄        │  Internal API  │
└─────┘ Tokens to persist └───────────────┘   New tokens   └────────────────┘
```
The ServiceWorker maintains an in-memory cache of the tokens it most recently received (either from the internal API or from the SPA on app init).

## Credits

Developed for and published with permission from [Orbiit](https://www.orbiit.ai).
