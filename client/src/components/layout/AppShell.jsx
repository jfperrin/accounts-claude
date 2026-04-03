import { useState } from 'react';
import { Layout, Menu, Typography, Button, Space, Avatar } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, BankOutlined, RetweetOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../store/AuthContext';

const { Sider, Header, Content } = Layout;

const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tableau de bord' },
  { key: '/banks', icon: <BankOutlined />, label: 'Banques' },
  { key: '/recurring', icon: <RetweetOutlined />, label: 'Opérations récurrentes' },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={220}>
        <div style={{
          padding: collapsed ? '20px 0' : '20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'padding 0.2s',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}>
            <BankOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
          {!collapsed && (
            <Typography.Text strong style={{ color: '#fff', fontSize: 15, letterSpacing: '-0.3px', fontWeight: 700 }}>
              Comptes
            </Typography.Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8, background: 'transparent' }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderBottom: '1px solid #ebebf5',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <Space size={12}>
            <Avatar
              size={32}
              style={{ background: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'default' }}
            >
              {initials}
            </Avatar>
            <Typography.Text style={{ fontWeight: 600, color: '#2d2d44' }}>
              {user?.username}
            </Typography.Text>
            <Button
              icon={<LogoutOutlined />} type="text" onClick={logout}
              style={{ color: '#8b8ca0', fontWeight: 500 }}
            >
              Déconnexion
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
