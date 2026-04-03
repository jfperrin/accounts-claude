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
        borderRadius: 10,
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        colorBgLayout: '#f4f5f9',
        colorBgContainer: '#ffffff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        fontSize: 14,
      },
      components: {
        Layout: { siderBg: '#111122', triggerBg: '#1e1e38' },
        Menu: { darkItemBg: '#111122', darkItemSelectedBg: '#6366f1', darkSubMenuItemBg: '#0d0d1c' },
        Card: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
        Button: { fontWeight: 600 },
        Table: { headerBg: '#f8f8fc' },
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
