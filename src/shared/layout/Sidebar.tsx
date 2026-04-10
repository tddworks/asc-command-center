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
      { path: '/versions', label: 'Versions' },
      { path: '/builds', label: 'Builds' },
      { path: '/submissions', label: 'Submissions' },
    ],
  },
  {
    section: 'Metadata',
    items: [
      { path: '/screenshots', label: 'Screenshots' },
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
];

export function Sidebar() {
  const registry = usePluginRegistry();
  const pluginItems = registry.getSidebarItems();

  return (
    <nav className="sidebar">
      {coreItems.map(({ section, items }) => (
        <div key={section} className="sidebar-section">
          <h4 className="sidebar-section-title">{section}</h4>
          <ul>
            {items.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
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

      <div className="sidebar-section">
        <h4 className="sidebar-section-title">System</h4>
        <ul>
          <li>
            <NavLink to="/plugins" className={({ isActive }) => isActive ? 'active' : ''}>
              Plugins
            </NavLink>
          </li>
          <li>
            <NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''}>
              Reports
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}
