import { Row, Col, Card, Statistic, Typography } from 'antd';
import { BankOutlined } from '@ant-design/icons';

function getBalance(operations, bankId) {
  return operations.filter((o) => o.bankId?._id === bankId || o.bankId === bankId)
    .reduce((sum, o) => sum + o.amount, 0);
}

export default function BankBalances({ banks, operations }) {
  const total = operations.reduce((sum, o) => sum + o.amount, 0);

  return (
    <Row gutter={[16, 16]}>
      {banks.map((bank) => {
        const balance = getBalance(operations, bank._id);
        return (
          <Col key={bank._id} xs={24} sm={12} md={8} lg={6}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <Statistic
                title={<span><BankOutlined style={{ marginRight: 6 }} />{bank.label}</span>}
                value={balance}
                precision={2}
                suffix="€"
                valueStyle={{ color: balance >= 0 ? '#52c41a' : '#f5222d', fontWeight: 700 }}
              />
            </Card>
          </Col>
        );
      })}
      {banks.length > 1 && (
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 10, background: '#6366f1', boxShadow: '0 2px 8px rgba(99,102,241,.3)' }}>
            <Statistic
              title={<Typography.Text style={{ color: 'rgba(255,255,255,.8)' }}>Total</Typography.Text>}
              value={total} precision={2} suffix="€"
              valueStyle={{ color: '#fff', fontWeight: 700 }}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
