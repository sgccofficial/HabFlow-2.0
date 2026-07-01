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
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
