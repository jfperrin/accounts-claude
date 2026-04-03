import { useEffect, useState } from 'react';
import { Table, Button, Space, Popconfirm, Modal, Form, Input, Typography, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import * as api from '../api/banks';

export default function BanksPage() {
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { bank? }
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = () => api.list().then(setBanks);
  useEffect(() => { load(); }, []);

  const openAdd = () => { form.resetFields(); setModal({}); };
  const openEdit = (bank) => { form.setFieldsValue(bank); setModal({ bank }); };

  const onFinish = async (values) => {
    try {
      modal.bank ? await api.update(modal.bank._id, values) : await api.create(values);
      message.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      message.error(err.message || 'Erreur');
    }
  };

  const onDelete = async (id) => {
    await api.remove(id);
    load();
  };

  const columns = [
    { title: 'Libellé', dataIndex: 'label', key: 'label' },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Supprimer ?" onConfirm={() => onDelete(r._id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Banques</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Ajouter</Button>
      </div>
      <Table dataSource={banks} columns={columns} rowKey="_id" pagination={false} />
      <Modal
        open={!!modal} title={modal?.bank ? 'Modifier la banque' : 'Nouvelle banque'}
        onCancel={() => setModal(null)} onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="label" label="Libellé" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
