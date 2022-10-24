import * as ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

import Routes from './Routes.jsx';

import setupServiceWorker from './setupServiceWorker.mts';


/**
 * Force the application to wait for the ServiceWorker to fully initialise before loading the app
 * (to ensure no network requests are made before the ServiceWorker is available to process them).
 */
await setupServiceWorker(navigator);

ReactDOM.render(
  <BrowserRouter>
    <Routes />
  </BrowserRouter>,
  document.getElementById('app'),
);
