import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (!localStorage.getItem('wiped_accounts_checkup')) {
  localStorage.removeItem('habitflow_accounts');
  localStorage.removeItem('habitflow_current_user');
  localStorage.setItem('wiped_accounts_checkup', 'true');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=' + Date.now()).then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
      });
    }).catch(err => console.error('SW init failed:', err));
    
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        window.location.reload();
        refreshing = true;
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
