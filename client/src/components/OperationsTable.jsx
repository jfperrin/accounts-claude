import { Table, Switch, Button, Space, Popconfirm, Tag, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const fmt = (v) => v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export default function OperationsTable({ operations, onPoint, onEdit, onDelete }) {
  const columns = [
    {
      title: 'Date', dataIndex: 'date', width: 110,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
      defaultSortOrder: 'ascend',
    },
    { title: 'Libellé', dataIndex: 'label' },
    { title: 'Banque', dataIndex: ['bankId', 'label'], render: (v) => <Tag>{v}</Tag> },
    {
      title: 'Montant', dataIndex: 'amount', width: 130, align: 'right',
      render: (v) => (
        <span style={{ color: v < 0 ? '#f5222d' : '#52c41a', fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{fmt(v)}
        </span>
      ),
    },
    {
      title: 'Pointé', dataIndex: 'pointed', width: 80, align: 'center',
      render: (v, r) => (
        <Tooltip title={v ? 'Dé-pointer' : 'Pointer'}>
          <Switch size="small" checked={v} onChange={() => onPoint(r._id)} />
        </Tooltip>
      ),
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} />
          <Popconfirm title="Supprimer ?" onConfirm={() => onDelete(r._id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      dataSource={operations}
      columns={columns}
      rowKey="_id"
      size="small"
      rowClassName={(r) => r.pointed ? 'op-pointed' : ''}
      pagination={{ pageSize: 20 }}
    />
  );
}
