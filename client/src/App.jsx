import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';

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
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="recurring" element={<RecurringPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
