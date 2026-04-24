import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { installPluginAPI } from './extensibility/plugin/installPluginAPI.ts';
import { hostSettings } from './extensibility/plugin/settingsClient.ts';
import { hostUI } from './extensibility/plugin/hostUI.tsx';
import './styles/theme.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/utilities.css';

// Install the plugin API before React mounts so plugin scripts that land
// during the first render already see `window.ascPluginAPI`.
installPluginAPI({ settings: hostSettings, ui: hostUI });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
