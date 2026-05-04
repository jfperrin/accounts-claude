import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import AppShell from '@/components/layout/AppShell';
import RequireAdmin from '@/components/RequireAdmin';
import CookieConsentBanner from '@/components/CookieConsent';

// Code-splitting par route : chaque page devient un chunk dédié, ce qui sort
// notamment recharts (utilisé par HomePage et CategoriesPage) du bundle initial.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const OperationsPage = lazy(() => import('@/pages/OperationsPage'));
const BanksPage = lazy(() => import('@/pages/BanksPage'));
const RecurringPage = lazy(() => import('@/pages/RecurringPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const ToSPage = lazy(() => import('@/pages/ToSPage'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <CookieConsentBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/cgu" element={<ToSPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
            <Route index element={<HomePage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="banks" element={<BanksPage />} />
            <Route path="recurring" element={<RecurringPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
