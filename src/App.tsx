import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PluginProvider } from './extensibility/plugin/PluginContext.tsx';
import { pluginRegistry } from './extensibility/plugin/PluginRegistry.ts';
import {
  DataModeProviderComponent,
  CommandLogProvider,
  useDataMode,
  useToggleMode,
  useCommandLog,
} from './shared/api-client.tsx';
import { workspace } from './workspace/workspaceInstance.ts';
import { repositoryFor } from './app-catalog/app/infrastructure/App.api.ts';
import { ThemeProvider, useTheme } from './shared/components/ThemeProvider.tsx';
import { Sidebar } from './shared/layout/Sidebar.tsx';
import { Header } from './shared/layout/Header.tsx';
import { CommandLogModal } from './shared/components/CommandLogModal.tsx';

const DashboardPage = lazy(() => import('./dashboard/pages/DashboardPage.tsx'));
const AppList = lazy(() => import('./app-catalog/app/pages/AppList.tsx'));
const VersionList = lazy(() => import('./release/version/pages/VersionList.tsx'));
const BuildList = lazy(() => import('./release/build/pages/BuildList.tsx'));
const ReviewList = lazy(() => import('./customer-relations/review/pages/ReviewList.tsx'));
const TestFlightPage = lazy(() => import('./release/testflight/pages/TestFlightPage.tsx'));
const CodeSigningPage = lazy(() => import('./developer-tools/code-signing/pages/CodeSigningPage.tsx'));
const SubmissionPage = lazy(() => import('./release/submission/pages/SubmissionPage.tsx'));
const XcodeCloudPage = lazy(() => import('./developer-tools/xcode-cloud/pages/XcodeCloudPage.tsx'));
const ReportsPage = lazy(() => import('./analytics/report/pages/ReportsPage.tsx'));
const SimulatorPage = lazy(() => import('./developer-tools/simulator/pages/SimulatorPage.tsx'));
const UserPage = lazy(() => import('./developer-tools/user/pages/UserPage.tsx'));
const IrisPage = lazy(() => import('./extensibility/iris/pages/IrisPage.tsx'));
const IAPPage = lazy(() => import('./monetization/iap/pages/IAPPage.tsx'));
const SubscriptionPage = lazy(() => import('./monetization/subscription/pages/SubscriptionPage.tsx'));
const AppInfoPage = lazy(() => import('./app-catalog/app-info/pages/AppInfoPage.tsx'));
const ScreenshotPage = lazy(() => import('./app-catalog/screenshot/pages/ScreenshotPage.tsx'));
const PluginsPage = lazy(() => import('./extensibility/plugin/pages/PluginsPage.tsx'));

function LoadingSpinner() {
  return <div className="loading"><span className="spinner" /><span>Loading...</span></div>;
}

/** Bridges the React-land DataMode context to the module-level workspace
 *  singleton. Lives inside the React tree so it can read the context, but
 *  does not own the workspace state — it just forwards mode changes to
 *  `workspace.switchMode(repo)`. */
function WorkspaceModeBridge() {
  const mode = useDataMode();
  useEffect(() => {
    let cancelled = false;
    repositoryFor(mode).then((repo) => {
      if (!cancelled) workspace.switchMode(repo);
    });
    return () => { cancelled = true; };
  }, [mode]);
  return null;
}

function AppShell() {
  const mode = useDataMode();
  const toggleMode = useToggleMode();
  const { entries: commandLogEntries } = useCommandLog();
  const { toggleTheme } = useTheme();

  const [commandLogOpen, setCommandLogOpen] = useState(false);

  const pluginPages = pluginRegistry.getPages();

  return (
    <BrowserRouter>
      <PluginProvider>
        <div className="app">
          <Sidebar />
          <div className="main">
            <Header
              mode={mode}
              onToggleMode={toggleMode}
              onToggleTheme={toggleTheme}
              onRefresh={() => window.location.reload()}
              onOpenCommandLog={() => setCommandLogOpen(true)}
              onToggleSidebar={() => {
                document.getElementById('sidebar')?.classList.toggle('open');
              }}
            />
            <div className="content">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/apps" element={<AppList />} />
                  <Route path="/versions" element={<VersionList />} />
                  <Route path="/apps/:appId/versions" element={<VersionList />} />
                  <Route path="/builds" element={<BuildList />} />
                  <Route path="/reviews" element={<ReviewList />} />
                  <Route path="/testflight" element={<TestFlightPage />} />
                  <Route path="/code-signing" element={<CodeSigningPage />} />
                  <Route path="/submissions" element={<SubmissionPage />} />
                  <Route path="/xcode-cloud" element={<XcodeCloudPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/simulators" element={<SimulatorPage />} />
                  <Route path="/users" element={<UserPage />} />
                  <Route path="/iris" element={<IrisPage />} />
                  <Route path="/iap" element={<IAPPage />} />
                  <Route path="/subscriptions" element={<SubscriptionPage />} />
                  <Route path="/app-info" element={<AppInfoPage />} />
                  <Route path="/screenshots" element={<ScreenshotPage />} />
                  <Route path="/plugins" element={<PluginsPage />} />

                  {pluginPages.map((page) => {
                    const LazyComponent = lazy(page.component);
                    return (
                      <Route
                        key={page.path}
                        path={page.path}
                        element={
                          <Suspense fallback={<LoadingSpinner />}>
                            <LazyComponent />
                          </Suspense>
                        }
                      />
                    );
                  })}
                </Routes>
              </Suspense>
            </div>
          </div>
        </div>

        <CommandLogModal
          isOpen={commandLogOpen}
          onClose={() => setCommandLogOpen(false)}
          entries={commandLogEntries}
        />
      </PluginProvider>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <DataModeProviderComponent>
        <WorkspaceModeBridge />
        <CommandLogProvider>
          <AppShell />
        </CommandLogProvider>
      </DataModeProviderComponent>
    </ThemeProvider>
  );
}
