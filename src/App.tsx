import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AppProvider } from '@/state/AppState';
import { ToastProvider } from '@/state/ToastState';
import { LibraryProvider } from '@/state/library';
import { OverviewPage } from '@/pages/OverviewPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { ExportPage } from '@/pages/ExportPage';
import { UpscalePage } from '@/pages/UpscalePage';
import { PlatformsPage } from '@/pages/PlatformsPage';
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
        <LibraryProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="export" element={<ExportPage />} />
                <Route path="upscale" element={<UpscalePage />} />
                <Route path="platforms" element={<PlatformsPage />} />
                <Route path="cloud" element={<CloudPage />} />
                <Route path="responsive" element={<ResponsiveLabPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </LibraryProvider>
      </ToastProvider>
    </AppProvider>
  );
}
