import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WidgetView } from './components/WidgetView.tsx';
import { useStore } from './store.ts';
import './index.css';

const isWidget = window.location.hash === '#/widget';

// Cross-window sync between the main app and the widget.
// Two mechanisms work together for reliability:
//  1. BroadcastChannel — fires immediately within the same browser process (primary)
//  2. storage event    — fires when the other window is in a separate process (fallback)
const syncChannel = new BroadcastChannel('horizon-sync');

// When another window signals a change, rehydrate from localStorage.
let isSyncing = false;
syncChannel.addEventListener('message', () => {
  isSyncing = true;
  useStore.persist.rehydrate();
  isSyncing = false;
});

window.addEventListener('storage', (e) => {
  if (e.key === 'calendar-storage') {
    useStore.persist.rehydrate();
  }
});

// Broadcast to the other window whenever tasks or projects change locally.
useStore.subscribe(
  (state) => ({ tasks: state.tasks, projects: state.projects }),
  () => {
    if (!isSyncing) {
      syncChannel.postMessage('sync');
    }
  },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWidget ? <WidgetView /> : <App />}
  </StrictMode>,
);
