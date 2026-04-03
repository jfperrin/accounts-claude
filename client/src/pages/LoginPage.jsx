import { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Divider, Alert, App } from 'antd';
import { GoogleOutlined, AccountBookOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { config as fetchConfig } from '../api/auth';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const { login, register } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      tab === 'login' ? await login(values) : await register(values);
    } catch (err) {
      message.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#07071a',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-5%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-8%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '30%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: 420,
        padding: '48px 44px',
        background: '#ffffff',
        borderRadius: 24,
        boxShadow: '0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
            boxShadow: '0 8px 28px rgba(99,102,241,0.45)',
            marginBottom: 20,
          }}>
            <AccountBookOutlined style={{ color: '#fff', fontSize: 26 }} />
          </div>
          <Typography.Title level={3} style={{ margin: '0 0 6px', fontWeight: 800, color: '#0d0d1c', letterSpacing: '-0.5px' }}>
            Gestion de Comptes
          </Typography.Title>
          <Typography.Text style={{ color: '#8b8ca0', fontSize: 13 }}>
            Gérez vos finances en toute sérénité
          </Typography.Text>
        </div>

        {googleError && (
          <Alert message="Échec de la connexion Google" type="error" showIcon style={{ marginBottom: 16, borderRadius: 10 }} />
        )}

        {googleEnabled && (
          <>
            <Button
              block size="large" icon={<GoogleOutlined />}
              onClick={() => { window.location.href = '/api/auth/google'; }}
              style={{ marginBottom: 16, borderColor: '#e2e2ea', color: '#3d3d56', fontWeight: 600, height: 46 }}
            >
              Continuer avec Google
            </Button>
            <Divider plain style={{ color: '#b0b0c0', fontSize: 12, borderColor: '#eeeef5' }}>ou</Divider>
          </>
        )}

        {/* Custom tab toggle */}
        <div style={{
          display: 'flex', gap: 4,
          background: '#f4f4fb', borderRadius: 12, padding: 4, marginBottom: 28,
        }}>
          {[['login', 'Connexion'], ['register', 'Inscription']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); form.resetFields(); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                transition: 'all 0.2s ease',
                background: tab === key ? '#6366f1' : 'transparent',
                color: tab === key ? '#fff' : '#8b8ca0',
                boxShadow: tab === key ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" label="Nom d'utilisateur" rules={[{ required: true }]}>
            <Input size="large" autoFocus style={{ height: 46, borderRadius: 10, borderColor: '#e2e2ea' }} />
          </Form.Item>
          <Form.Item name="password" label="Mot de passe" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" style={{ height: 46, borderRadius: 10, borderColor: '#e2e2ea' }} />
          </Form.Item>
          <Button
            type="primary" htmlType="submit" block size="large" loading={loading}
            style={{ marginTop: 8, height: 48, borderRadius: 12, fontWeight: 700, fontSize: 15, boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
          >
            {tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
