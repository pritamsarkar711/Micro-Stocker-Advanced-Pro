import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoading } from '@/components/layout/PageLoading';
import { AppProvider } from '@/state/AppState';
import { AuthProvider } from '@/state/AuthState';
import { AdminGate } from '@/components/auth/AdminGate';
import { LicenseProvider } from '@/state/LicenseState';
import { ToastProvider } from '@/state/ToastState';
import { LibraryProvider } from '@/state/library';
import { BankProvider } from '@/state/bank';
import { ReleasesProvider } from '@/state/releases';
import { WorkspaceSyncProvider } from '@/state/WorkspaceSync';
import { LaunchGate } from '@/components/launch/LaunchGate';

const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })));
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const MetadataGeneratorPage = lazy(() => import('@/pages/MetadataGeneratorPage').then((m) => ({ default: m.MetadataGeneratorPage })));
const UpscalePage = lazy(() => import('@/pages/UpscalePage').then((m) => ({ default: m.UpscalePage })));
const VideoUpscalePage = lazy(() => import('@/pages/VideoUpscalePage').then((m) => ({ default: m.VideoUpscalePage })));
const BgRemovePage = lazy(() => import('@/pages/BgRemovePage').then((m) => ({ default: m.BgRemovePage })));
const QualityPage = lazy(() => import('@/pages/QualityPage').then((m) => ({ default: m.QualityPage })));
const OptimizePage = lazy(() => import('@/pages/OptimizePage').then((m) => ({ default: m.OptimizePage })));
const ConvertPage = lazy(() => import('@/pages/ConvertPage').then((m) => ({ default: m.ConvertPage })));
const VectorizePage = lazy(() => import('@/pages/VectorizePage').then((m) => ({ default: m.VectorizePage })));
const MotionPage = lazy(() => import('@/pages/MotionPage').then((m) => ({ default: m.MotionPage })));
const BackgroundsPage = lazy(() => import('@/pages/BackgroundsPage').then((m) => ({ default: m.BackgroundsPage })));
const EarningsPage = lazy(() => import('@/pages/EarningsPage').then((m) => ({ default: m.EarningsPage })));
const PlannerPage = lazy(() => import('@/pages/PlannerPage').then((m) => ({ default: m.PlannerPage })));
const ReleasesPage = lazy(() => import('@/pages/ReleasesPage').then((m) => ({ default: m.ReleasesPage })));
const BankPage = lazy(() => import('@/pages/BankPage').then((m) => ({ default: m.BankPage })));
const CloudPage = lazy(() => import('@/pages/CloudPage').then((m) => ({ default: m.CloudPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ContactPage = lazy(() => import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const ReportPage = lazy(() => import('@/pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AuthProvider>
          <LicenseProvider>
          <LibraryProvider>
            <BankProvider>
              <ReleasesProvider>
                <WorkspaceSyncProvider>
                <HashRouter>
                  <LaunchGate>
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      <Route element={<AppShell />}>
                        <Route path="subscription" element={<SubscriptionPage />} />
                        <Route element={<Outlet />}>
                        <Route index element={<OverviewPage />} />
                        <Route path="metadata" element={<MetadataGeneratorPage />} />
                        <Route path="upscale" element={<UpscalePage />} />
                        <Route path="video-upscale" element={<VideoUpscalePage />} />
                        <Route path="bg-remove" element={<BgRemovePage />} />
                        <Route path="quality" element={<QualityPage />} />
                        <Route path="optimize" element={<OptimizePage />} />
                        <Route path="convert" element={<ConvertPage />} />
                        <Route path="vectorize" element={<VectorizePage />} />
                        <Route path="motion" element={<MotionPage />} />
                        <Route path="backgrounds" element={<BackgroundsPage />} />
                        <Route path="planner" element={<PlannerPage />} />
                        <Route path="releases" element={<ReleasesPage />} />
                        <Route path="bank" element={<BankPage />} />
                        <Route path="admin" element={<AdminGate><AdminPage /></AdminGate>} />
                        <Route path="cloud" element={<CloudPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="contact" element={<ContactPage />} />
                        <Route path="report" element={<ReportPage />} />
                        <Route path="about" element={<AboutPage />} />
                        <Route path="earnings" element={<EarningsPage />} />
                        <Route path="404" element={<NotFoundPage />} />
                        <Route path="*" element={<Navigate to="/404" replace />} />
                        </Route>
                      </Route>
                    </Routes>
                  </Suspense>
                  </LaunchGate>
                </HashRouter>
                </WorkspaceSyncProvider>
              </ReleasesProvider>
            </BankProvider>
          </LibraryProvider>
          </LicenseProvider>
        </AuthProvider>
      </ToastProvider>
    </AppProvider>
  );
}
