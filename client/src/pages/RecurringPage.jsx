import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Popconfirm, Modal, Form, Input, InputNumber, Select, Typography, App, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import * as api from '../api/recurringOperations';
import * as banksApi from '../api/banks';

const MONTHS_DAYS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }));

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = () => Promise.all([api.list(), banksApi.list()]).then(([ops, b]) => { setItems(ops); setBanks(b); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { form.resetFields(); setModal({}); };
  const openEdit = (item) => { form.setFieldsValue({ ...item, bankId: item.bankId?._id }); setModal({ item }); };

  const onFinish = async (values) => {
    try {
      modal.item ? await api.update(modal.item._id, values) : await api.create(values);
      message.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      message.error(err.message || 'Erreur');
    }
  };

  const columns = useMemo(() => [
    { title: 'Libellé', dataIndex: 'label' },
    { title: 'Banque', dataIndex: ['bankId', 'label'], render: (v) => <Tag>{v}</Tag> },
    { title: 'Jour', dataIndex: 'dayOfMonth', width: 70, align: 'center' },
    {
      title: 'Montant', dataIndex: 'amount', width: 120, align: 'right',
      render: (v) => (
        <span style={{ color: v < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </span>
      ),
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Supprimer ?" onConfirm={() => api.remove(r._id).then(load)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ], [openEdit, load]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 800, color: '#0d0d1c' }}>Opérations récurrentes</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Ajouter</Button>
      </div>
      <Table dataSource={items} columns={columns} rowKey="_id" pagination={false} />
      <Modal open={!!modal} title={modal?.item ? 'Modifier' : 'Nouvelle opération récurrente'} onCancel={() => setModal(null)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="label" label="Libellé" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="bankId" label="Banque" rules={[{ required: true }]}>
            <Select options={banks.map((b) => ({ value: b._id, label: b.label }))} />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="dayOfMonth" label="Jour du mois" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={MONTHS_DAYS} />
            </Form.Item>
            <Form.Item name="amount" label="Montant (€)" rules={[{ required: true }]} style={{ flex: 1, marginLeft: 8 }}>
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>
    </>
  );
}
