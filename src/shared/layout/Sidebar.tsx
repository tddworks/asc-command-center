import { NavLink } from 'react-router-dom';
import { usePluginRegistry } from '../../plugin/PluginContext.tsx';

interface NavItem {
  path: string;
  label: string;
}

const coreItems: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { path: '/', label: 'Dashboard' },
      { path: '/apps', label: 'Apps' },
    ],
  },
  {
    section: 'Release',
    items: [
      { path: '/builds', label: 'Builds' },
      { path: '/submissions', label: 'Submissions' },
    ],
  },
  {
    section: 'Metadata',
    items: [
      { path: '/reviews', label: 'Reviews' },
    ],
  },
  {
    section: 'Infrastructure',
    items: [
      { path: '/testflight', label: 'TestFlight' },
      { path: '/code-signing', label: 'Code Signing' },
      { path: '/xcode-cloud', label: 'Xcode Cloud' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { path: '/reports', label: 'Reports' },
    ],
  },
];

export function Sidebar() {
  const registry = usePluginRegistry();
  const pluginItems = registry.getSidebarItems();

  return (
    <nav className="sidebar">
      <div style={{ padding: '12px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>ASC</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 6 }}>Command Center</span>
      </div>

      {coreItems.map(({ section, items }) => (
        <div key={section} className="sidebar-section">
          <h4 className="sidebar-section-title">{section}</h4>
          <ul>
            {items.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => isActive ? 'active' : ''} end={item.path === '/'}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {pluginItems.length > 0 && (
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Plugins</h4>
          <ul>
            {pluginItems.map((item) => (
              <li key={item.id}>
                <NavLink to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
