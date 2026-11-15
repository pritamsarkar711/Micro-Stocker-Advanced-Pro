import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AppProvider } from '@/state/AppState';
import { ToastProvider } from '@/state/ToastState';
import { OverviewPage } from '@/pages/OverviewPage';
import { CloudPage } from '@/pages/CloudPage';
import { ResponsiveLabPage } from '@/pages/ResponsiveLabPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AboutPage } from '@/pages/AboutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * HashRouter (not BrowserRouter) on purpose: the packaged desktop app is loaded
 * from `file://`, where path-based routing would break on refresh/deep links.
 */
export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="cloud" element={<CloudPage />} />
              <Route path="responsive" element={<ResponsiveLabPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AppProvider>
  );
}
