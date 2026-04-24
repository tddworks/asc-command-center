import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { installPluginAPI } from './extensibility/plugin/installPluginAPI.ts';
import { stubSettings, stubUI } from './extensibility/plugin/stubs.tsx';
import './styles/theme.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';

// Install the plugin API before React mounts so plugin scripts that land
// during the first render already see `window.ascPluginAPI`. Settings + UI
// start as stubs and get upgraded as tasks #37 and #39 land — the API
// shape itself is stable from day one.
installPluginAPI({ settings: stubSettings, ui: stubUI });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
