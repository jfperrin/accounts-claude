import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
import App from '@/App';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt';
import './index.css';
import './styles/cookieconsent-theme.css';

dayjs.locale('fr');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
        <PwaUpdatePrompt />
      </ThemeProvider>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </React.StrictMode>
);
