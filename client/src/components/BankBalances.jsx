import { useState } from 'react';
import { Row, Col, Card, Statistic, Typography, InputNumber, Divider } from 'antd';
import { BankOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';

function getUnpointedSum(operations, bankId) {
  return operations
    .filter((o) => !o.pointed && (o.bankId?._id === bankId || o.bankId === bankId))
    .reduce((sum, o) => sum + o.amount, 0);
}

function BankCard({ bank, operations, initialBalance, onSaveBalance }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBalance ?? null);

  const unpointedSum = getUnpointedSum(operations, bank._id);
  const projected = initialBalance != null ? initialBalance + unpointedSum : null;

  const handleSave = () => {
    setEditing(false);
    if (draft !== initialBalance) onSaveBalance(bank._id, draft ?? 0);
  };

  return (
    <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.06)', height: '100%' }}>
      <Typography.Text strong style={{ fontSize: 14 }}>
        <BankOutlined style={{ marginRight: 6, color: '#6366f1' }} />{bank.label}
      </Typography.Text>
      <Divider style={{ margin: '10px 0' }} />

      <div style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Solde actuel</Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {editing ? (
            <>
              <InputNumber
                autoFocus
                value={draft}
                onChange={setDraft}
                precision={2}
                suffix="€"
                style={{ flex: 1 }}
                onPressEnter={handleSave}
                onBlur={handleSave}
              />
              <CheckOutlined style={{ color: '#52c41a', cursor: 'pointer' }} onClick={handleSave} />
            </>
          ) : (
            <>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {initialBalance != null ? `${initialBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '—'}
              </Typography.Text>
              <EditOutlined style={{ color: '#aaa', cursor: 'pointer', fontSize: 12 }} onClick={() => { setDraft(initialBalance ?? 0); setEditing(true); }} />
            </>
          )}
        </div>
      </div>

      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Prévisionnel (−&nbsp;non pointées)</Typography.Text>
        <div style={{ marginTop: 2 }}>
          {projected != null ? (
            <Typography.Text strong style={{ fontSize: 20, color: projected >= 0 ? '#52c41a' : '#f5222d' }}>
              {projected.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">Saisir un solde</Typography.Text>
          )}
        </div>
      </div>
    </Card>
  );
}

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
          <Card size="small" variant="borderless" style={{ borderRadius: 10, background: '#6366f1', boxShadow: '0 2px 8px rgba(99,102,241,.3)', height: '100%' }}>
            <Statistic
              title={<Typography.Text style={{ color: 'rgba(255,255,255,.8)' }}>Total prévisionnel</Typography.Text>}
              value={totalProjected}
              precision={2}
              suffix="€"
              styles={{ content: { color: '#fff', fontWeight: 700 } }}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
