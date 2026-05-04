import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import HomePage from '@/pages/HomePage';
import OperationsPage from '@/pages/OperationsPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import CategoriesPage from '@/pages/CategoriesPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ToSPage from '@/pages/ToSPage';
import RequireAdmin from '@/components/RequireAdmin';
import CookieConsentBanner from '@/components/CookieConsent';

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
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
