import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WidgetView } from './components/WidgetView.tsx';
import './index.css';

const isWidget = window.location.hash === '#/widget';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWidget ? <WidgetView /> : <App />}
  </StrictMode>,
);
