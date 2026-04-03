import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { AuthProvider } from './store/AuthContext';
import App from './App';

dayjs.locale('fr');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={frFR} theme={{
      token: {
        colorPrimary: '#6366f1',
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, sans-serif",
        colorBgLayout: '#f0f2f5',
      },
      components: {
        Layout: { siderBg: '#1e1e2e', triggerBg: '#2a2a3e' },
        Menu: { darkItemBg: '#1e1e2e', darkItemSelectedBg: '#6366f1', darkSubMenuItemBg: '#16162a' },
      },
    }}>
      <AntApp>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
