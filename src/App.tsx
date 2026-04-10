import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PluginProvider } from './plugin/PluginContext.tsx';
import { pluginRegistry } from './plugin/PluginRegistry.ts';
import { DataModeProvider } from './shared/api-client.ts';
import { Sidebar } from './shared/layout/Sidebar.tsx';
import { PageLayout } from './shared/layout/PageLayout.tsx';
import { Header } from './shared/layout/Header.tsx';

const DashboardPage = lazy(() => import('./dashboard/pages/DashboardPage.tsx'));
const AppList = lazy(() => import('./app/pages/AppList.tsx'));
const AppDetail = lazy(() => import('./app/pages/AppDetail.tsx'));
const VersionList = lazy(() => import('./version/pages/VersionList.tsx'));

function LoadingSpinner() {
  return <div className="spinner">Loading...</div>;
}

export function App() {
  const pluginPages = pluginRegistry.getPages();

  return (
    <DataModeProvider value="mock">
      <BrowserRouter>
        <PluginProvider>
          <div className="app-layout">
            <Sidebar />
            <div className="app-main">
              <Header />
              <PageLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/apps" element={<AppList />} />
                    <Route path="/apps/:appId" element={<AppDetail />} />
                    <Route path="/apps/:appId/versions" element={<VersionList />} />

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
              </PageLayout>
            </div>
          </div>
        </PluginProvider>
      </BrowserRouter>
    </DataModeProvider>
  );
}
