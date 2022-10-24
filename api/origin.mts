// Assumes the api and app are served from adjacent subdomains (eg `api.localhost` and
// `app.localhost`, or `api.example.com` and `app.example.com`)
export default ((base) => {
  const url = new URL(base);
  url.hostname = url.hostname.replace('app.', 'api.');

  return url.origin;
})(location.origin);
