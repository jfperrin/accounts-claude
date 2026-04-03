import { useEffect, useState } from 'react';
import { Table, Button, Popconfirm, Modal, Form, Select, InputNumber, Typography, App, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import * as api from '../api/periods';

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const CURRENT_YEAR = new Date().getFullYear();

export default function PeriodsPage() {
  const [periods, setPeriods] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = () => api.list().then(setPeriods);
  useEffect(() => { load(); }, []);

  const onFinish = async (values) => {
    try {
      await api.create(values);
      message.success('Période créée');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.message || 'Cette période existe déjà');
    }
  };

  const onDelete = async (id) => {
    await api.remove(id);
    load();
  };

  const columns = [
    {
      title: 'Période', key: 'label',
      render: (_, r) => <Tag color="blue">{MONTHS[r.month - 1]} {r.year}</Tag>,
      sorter: (a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month),
    },
    { title: 'Mois', dataIndex: 'month', width: 80, align: 'center' },
    { title: 'Année', dataIndex: 'year', width: 90, align: 'center' },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, r) => (
        <Popconfirm
          title="Supprimer cette période ?"
          description="Les opérations associées seront également supprimées."
          onConfirm={() => onDelete(r._id)}
          okText="Supprimer"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Périodes</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
          Ajouter
        </Button>
      </div>
      <Table dataSource={periods} columns={columns} rowKey="_id" pagination={false} defaultSortOrder="descend" />
      <Modal
        open={open} title="Nouvelle période"
        onCancel={() => setOpen(false)} onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ year: CURRENT_YEAR }}
          style={{ marginTop: 16 }}>
          <Form.Item name="month" label="Mois" rules={[{ required: true }]}>
            <Select options={MONTHS.map((label, i) => ({ value: i + 1, label }))} autoFocus />
          </Form.Item>
          <Form.Item name="year" label="Année" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={2000} max={2100} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
