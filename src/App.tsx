import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoading } from '@/components/layout/PageLoading';
import { AppProvider } from '@/state/AppState';
import { ToastProvider } from '@/state/ToastState';
import { LibraryProvider } from '@/state/library';
import { BankProvider } from '@/state/bank';
import { ReleasesProvider } from '@/state/releases';


/**
 * Route-level code splitting: each page is its own chunk, so the first paint
 * only downloads the shell plus the page you actually open. Keeps the packaged
 * app snappy and the charts/Supabase code out of the startup budget.
 */
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ExportPage = lazy(() => import('@/pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const PreparePage = lazy(() => import('@/pages/PreparePage').then((m) => ({ default: m.PreparePage })));
const UpscalePage = lazy(() => import('@/pages/UpscalePage').then((m) => ({ default: m.UpscalePage })));
const PlatformsPage = lazy(() => import('@/pages/PlatformsPage').then((m) => ({ default: m.PlatformsPage })));
const PlannerPage = lazy(() => import('@/pages/PlannerPage').then((m) => ({ default: m.PlannerPage })));
const ReleasesPage = lazy(() => import('@/pages/ReleasesPage').then((m) => ({ default: m.ReleasesPage })));
const EarningsPage = lazy(() => import('@/pages/EarningsPage').then((m) => ({ default: m.EarningsPage })));
const BankPage = lazy(() => import('@/pages/BankPage').then((m) => ({ default: m.BankPage })));
const CloudPage = lazy(() => import('@/pages/CloudPage').then((m) => ({ default: m.CloudPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

/**
 * HashRouter (not BrowserRouter) on purpose: the packaged desktop app is loaded
 * from `file://`, where path-based routing would break on refresh/deep links.
 */
export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <LibraryProvider>
          <BankProvider>
            <ReleasesProvider>
          <HashRouter>
            <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="prepare" element={<PreparePage />} />
                <Route path="export" element={<ExportPage />} />
                <Route path="upscale" element={<UpscalePage />} />
                <Route path="platforms" element={<PlatformsPage />} />
                <Route path="plan" element={<PlannerPage />} />
                <Route path="releases" element={<ReleasesPage />} />
                <Route path="earnings" element={<EarningsPage />} />
                <Route path="bank" element={<BankPage />} />
                <Route path="cloud" element={<CloudPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Routes>
            </Suspense>
          </HashRouter>
            </ReleasesProvider>
          </BankProvider>
        </LibraryProvider>
      </ToastProvider>
    </AppProvider>
  );
}
