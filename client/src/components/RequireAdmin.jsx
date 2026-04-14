import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

export default function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
