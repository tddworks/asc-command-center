import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { usePluginRegistry } from '../../extensibility/plugin/PluginContext.tsx';
import { workspace } from '../../workspace/workspaceInstance.ts';
import { AppIcon } from '../components/AppIcon.tsx';
import { AppPickerModal } from '../components/AppPickerModal.tsx';

function SelectedAppCard() {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!workspace.hydrated) return null;

  const { apps, currentApp } = workspace;

  return (
    <>
      <div className="selected-app-block">
        <div className="nav-section-title">Selected App</div>
        <button
          type="button"
          className="sidebar-select-button"
          onClick={() => setPickerOpen(true)}
        >
          {currentApp ? (
            <>
              <span className="ss-leading"><AppIcon app={currentApp} size={32} /></span>
              <span className="ss-labels">
                <span className="ss-primary">{currentApp.name}</span>
              </span>
            </>
          ) : (
            <span className="ss-primary ss-placeholder">No app selected</span>
          )}
          <svg className="ss-chevron" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="5 8 8 5 11 8"/>
            <polyline points="5 12 8 15 11 12"/>
          </svg>
        </button>
      </div>

      <AppPickerModal
        open={pickerOpen}
        apps={apps}
        selectedId={currentApp?.id ?? null}
        onSelect={(id) => { void workspace.selectApp(id); }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const ObservedSelectedAppCard = observer(SelectedAppCard);

export const Sidebar = observer(function Sidebar() {
  const registry = usePluginRegistry();
  const pluginItems = registry.getSidebarItems();

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="ASC" style={{width:'36px',height:'36px',borderRadius:'var(--radius)',flexShrink:0}} />
        <div>
          <h1>ASC Manager</h1>
          <p>App Store Connect</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Overview */}
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/" end>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </NavLink>
        </div>

        {/* Selected-app header card (app + version + status) */}
        <ObservedSelectedAppCard />

        {/* App Catalog (core) */}
        <div className="nav-section">
          <div className="nav-section-title">App Catalog</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/app-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            App Info
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/screenshots">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            Screenshots
          </NavLink>
        </div>

        {/* Release (core) */}
        <div className="nav-section">
          <div className="nav-section-title">Release</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/versions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            Versions
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/builds">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Builds
            <span className="badge">3</span>
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/testflight">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
            TestFlight
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/submissions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
            Submissions
          </NavLink>
        </div>

        {/* Monetization */}
        <div className="nav-section">
          <div className="nav-section-title">Monetization</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/iap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            In-App Purchases
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/subscriptions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>
            Subscriptions
          </NavLink>
        </div>

        {/* Customer Relations */}
        <div className="nav-section">
          <div className="nav-section-title">Customer Relations</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/reviews">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Reviews
          </NavLink>
        </div>

        {/* Analytics */}
        <div className="nav-section">
          <div className="nav-section-title">Analytics</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/reports">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            Reports
          </NavLink>
        </div>

        {/* Developer Tools (generics — deferred in the context map) */}
        <div className="nav-section">
          <div className="nav-section-title">Developer Tools</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/xcode-cloud">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
            Xcode Cloud
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/code-signing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Code Signing
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/users">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Users & Roles
          </NavLink>
        </div>

        {/* Extensibility */}
        <div className="nav-section">
          <div className="nav-section-title">Extensibility</div>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/iris">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Iris
          </NavLink>
          <NavLink className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} to="/plugins">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6m0 0l3-3m-3 3l-3-3"/><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M9 15h6"/></svg>
            Plugins
          </NavLink>
        </div>

        {/* Plugin sidebar items */}
        {pluginItems.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-title">Plugin Widgets</div>
            {pluginItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="auth-status">
          <div className="auth-dot"></div>
          <div className="auth-info">
            <span>Checking...</span>
            asc auth check
          </div>
        </div>
      </div>
    </aside>
  );
});
