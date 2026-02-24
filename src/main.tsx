import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WidgetView } from './components/WidgetView.tsx';
import { useStore } from './store.ts';
import './index.css';

const isWidget = window.location.hash === '#/widget';

// Keep both WebView2 instances in sync: when the other window writes to
// localStorage, re-read the store so UI reflects the latest state.
window.addEventListener('storage', (e) => {
  if (e.key === 'calendar-storage') {
    useStore.persist.rehydrate();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWidget ? <WidgetView /> : <App />}
  </StrictMode>,
);
