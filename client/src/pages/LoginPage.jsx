import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Tabs, Typography, Divider, Alert, App } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)', borderRadius: 12 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          💰 Gestion de Comptes
        </Typography.Title>

        {googleError && (
          <Alert message="Échec de la connexion Google" type="error" showIcon style={{ marginBottom: 16 }} />
        )}

        {googleEnabled && (
          <>
            <Button
              block size="large" icon={<GoogleOutlined />}
              onClick={() => { window.location.href = '/api/auth/google'; }}
              style={{ marginBottom: 16, borderColor: '#4285f4', color: '#4285f4' }}
            >
              Continuer avec Google
            </Button>
            <Divider plain style={{ color: '#aaa', fontSize: 12 }}>ou</Divider>
          </>
        )}

        <Tabs activeKey={tab} onChange={(k) => { setTab(k); form.resetFields(); }} items={[
          { key: 'login', label: 'Connexion' },
          { key: 'register', label: 'Inscription' },
        ]} />
        <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="username" label="Nom d'utilisateur" rules={[{ required: true }]}>
            <Input size="large" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mot de passe" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ marginTop: 8 }}>
            {tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
