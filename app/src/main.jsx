import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { captureContext } from './lib/context';
import App from './App';
import './index.css';

// What the site's CTA put in the URL (?city&locality&service&plan), kept for the session
// before the router or the sign-in round trip can lose it (FIN-B02).
captureContext(window.location.search);
injectSpeedInsights();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/app">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
