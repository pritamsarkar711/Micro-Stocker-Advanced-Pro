import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoading } from '@/components/layout/PageLoading';
import { AppProvider } from '@/state/AppState';
import { AuthProvider } from '@/state/AuthState';
import { AuthGate } from '@/components/auth/AuthGate';
import { AccountGate } from '@/components/auth/AccountGate';
import { PremiumGate } from '@/components/auth/PremiumGate';
import { AdminGate } from '@/components/auth/AdminGate';
import { LicenseProvider } from '@/state/LicenseState';
import { ToastProvider } from '@/state/ToastState';
import { LibraryProvider } from '@/state/library';
import { BankProvider } from '@/state/bank';
import { ReleasesProvider } from '@/state/releases';

const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })));
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const PreparePage = lazy(() => import('@/pages/PreparePage').then((m) => ({ default: m.PreparePage })));
const ExportPage = lazy(() => import('@/pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const UpscalePage = lazy(() => import('@/pages/UpscalePage').then((m) => ({ default: m.UpscalePage })));
const VideoUpscalePage = lazy(() => import('@/pages/VideoUpscalePage').then((m) => ({ default: m.VideoUpscalePage })));
const BgRemovePage = lazy(() => import('@/pages/BgRemovePage').then((m) => ({ default: m.BgRemovePage })));
const ConvertPage = lazy(() => import('@/pages/ConvertPage').then((m) => ({ default: m.ConvertPage })));
const EarningsPage = lazy(() => import('@/pages/EarningsPage').then((m) => ({ default: m.EarningsPage })));
const SubmissionsPage = lazy(() => import('@/pages/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })));
const PlannerPage = lazy(() => import('@/pages/PlannerPage').then((m) => ({ default: m.PlannerPage })));
const PlatformsPage = lazy(() => import('@/pages/PlatformsPage').then((m) => ({ default: m.PlatformsPage })));
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
          <AuthGate>
          <LicenseProvider>
          <AccountGate>
          <LibraryProvider>
            <BankProvider>
              <ReleasesProvider>
                <HashRouter>
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      <Route element={<AppShell />}>
                        <Route path="subscription" element={<SubscriptionPage />} />
                        <Route element={<PremiumGate><Outlet /></PremiumGate>}>
                        <Route index element={<OverviewPage />} />
                        <Route path="library" element={<LibraryPage />} />
                        <Route path="prepare" element={<PreparePage />} />
                        <Route path="export" element={<ExportPage />} />
                        <Route path="upscale" element={<UpscalePage />} />
                        <Route path="video-upscale" element={<VideoUpscalePage />} />
                        <Route path="bg-remove" element={<BgRemovePage />} />
                        <Route path="convert" element={<ConvertPage />} />
                        <Route path="planner" element={<PlannerPage />} />
                        <Route path="plan" element={<SubmissionsPage />} />
                        <Route path="platforms" element={<PlatformsPage />} />
                        <Route path="releases" element={<ReleasesPage />} />
                        <Route path="bank" element={<BankPage />} />
                        <Route path="admin" element={<AdminGate><AdminPage /></AdminGate>} />
                        <Route path="cloud" element={<AdminGate><CloudPage /></AdminGate>} />
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
                </HashRouter>
              </ReleasesProvider>
            </BankProvider>
          </LibraryProvider>
          </AccountGate>
          </LicenseProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </AppProvider>
  );
}
