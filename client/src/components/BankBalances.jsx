import { memo, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, InputNumber, Divider } from 'antd';
import { BankOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';

function getUnpointedSum(operations, bankId) {
  return operations
    .filter((o) => !o.pointed && (o.bankId?._id === bankId || o.bankId === bankId))
    .reduce((sum, o) => sum + o.amount, 0);
}

const BankCard = memo(function BankCard({ bank, operations, initialBalance, onSaveBalance }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBalance ?? null);

  const unpointedSum = getUnpointedSum(operations, bank._id);
  const projected = initialBalance != null ? initialBalance + unpointedSum : null;

  const handleSave = () => {
    setEditing(false);
    if (draft !== initialBalance) onSaveBalance(bank._id, draft ?? 0);
  };

  return (
    <Card size="small" variant="borderless" style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,.06)', height: '100%', border: '1px solid #ebebf5' }}>
      <Typography.Text strong style={{ fontSize: 14, color: '#2d2d44' }}>
        <BankOutlined style={{ marginRight: 6, color: '#6366f1' }} />{bank.label}
      </Typography.Text>
      <Divider style={{ margin: '10px 0', borderColor: '#f0f0f8' }} />

      <div style={{ marginBottom: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Solde actuel</Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {editing ? (
            <>
              <InputNumber
                autoFocus value={draft} onChange={setDraft} precision={2} suffix="€"
                style={{ flex: 1 }} onPressEnter={handleSave} onBlur={handleSave}
              />
              <CheckOutlined style={{ color: '#16a34a', cursor: 'pointer' }} onClick={handleSave} />
            </>
          ) : (
            <>
              <Typography.Text strong style={{ fontSize: 17, color: '#0d0d1c' }}>
                {initialBalance != null ? `${initialBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}
              </Typography.Text>
              <EditOutlined style={{ color: '#b0b0c8', cursor: 'pointer', fontSize: 12 }} onClick={() => { setDraft(initialBalance ?? 0); setEditing(true); }} />
            </>
          )}
        </div>
      </div>

      <div>
        <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Prévisionnel</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {projected != null ? (
            <Typography.Text strong style={{ fontSize: 22, color: projected >= 0 ? '#16a34a' : '#dc2626' }}>
              {projected.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Saisir un solde</Typography.Text>
          )}
        </div>
      </div>
    </Card>
  );
});

export default function BankBalances({ banks, operations, periodBalances = {}, onSaveBalance }) {
  const totalInitial = banks.reduce((s, b) => s + (periodBalances[b._id] ?? 0), 0);
  const totalUnpointed = operations.filter((o) => !o.pointed).reduce((s, o) => s + o.amount, 0);
  const totalProjected = totalInitial + totalUnpointed;
  const hasBalances = banks.some((b) => periodBalances[b._id] != null);

  return (
    <Row gutter={[16, 16]}>
      {banks.map((bank) => (
        <Col key={bank._id} xs={24} sm={12} md={8} lg={6}>
          <BankCard
            bank={bank}
            operations={operations}
            initialBalance={periodBalances[bank._id] ?? null}
            onSaveBalance={onSaveBalance}
          />
        </Col>
      ))}
      {banks.length > 1 && hasBalances && (
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card size="small" variant="borderless" style={{ borderRadius: 14, background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)', boxShadow: '0 4px 20px rgba(99,102,241,.35)', height: '100%', border: 'none' }}>
            <Statistic
              title={<Typography.Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total prévisionnel</Typography.Text>}
              value={totalProjected}
              precision={2}
              suffix="€"
              styles={{ content: { color: '#fff', fontWeight: 800, fontSize: 22 } }}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
