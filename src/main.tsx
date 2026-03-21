/**
 * React Application Entry Point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import './styles/globals.css';
import { initializeDefaultTransports } from './lib/api-client';

initializeDefaultTransports();

const appContainer = document.getElementById('app');

if (!appContainer) {
  throw new Error('App mount container "#app" was not found.');
}

ReactDOM.createRoot(appContainer).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
