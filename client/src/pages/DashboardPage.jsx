import { useEffect, useState } from 'react';
import { Card, Select, Button, Space, Typography, Divider, App, Empty } from 'antd';
import { PlusOutlined, DownloadOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as periodsApi from '../api/periods';
import * as operationsApi from '../api/operations';
import * as banksApi from '../api/banks';
import BankBalances from '../components/BankBalances';
import OperationsTable from '../components/OperationsTable';
import OperationForm from '../components/OperationForm';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function DashboardPage() {
  const [periods, setPeriods] = useState([]);
  const [banks, setBanks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);
  const { message } = App.useApp();

  useEffect(() => {
    Promise.all([periodsApi.list(), banksApi.list()]).then(([p, b]) => { setPeriods(p); setBanks(b); });
  }, []);

  useEffect(() => {
    const period = periods.find((p) => p.month === month && p.year === year);
    setSelectedPeriod(period || null);
    if (period) loadOperations(period._id);
    else setOperations([]);
  }, [periods, month, year]);

  const loadOperations = (periodId) => operationsApi.list(periodId).then(setOperations);

  const ensurePeriod = async () => {
    let period = selectedPeriod;
    if (!period) {
      period = await periodsApi.create({ month, year });
      setPeriods((prev) => [...prev, period]);
      setSelectedPeriod(period);
    }
    return period;
  };

  const handleImport = async () => {
    const period = await ensurePeriod();
    const { imported } = await operationsApi.importRecurring(period._id);
    message.success(`${imported} opération(s) importée(s)`);
    loadOperations(period._id);
  };

  const handleFormFinish = async (values) => {
    const period = await ensurePeriod();
    if (editOp) {
      await operationsApi.update(editOp._id, values);
    } else {
      await operationsApi.create({ ...values, periodId: period._id });
    }
    setFormOpen(false);
    setEditOp(null);
    loadOperations(period._id);
  };

  const handlePoint = async (id) => {
    await operationsApi.point(id);
    loadOperations(selectedPeriod._id);
  };

  const handleDelete = async (id) => {
    await operationsApi.remove(id);
    loadOperations(selectedPeriod._id);
  };

  const openAdd = () => { setEditOp(null); setFormOpen(true); };
  const openEdit = (op) => { setEditOp(op); setFormOpen(true); };

  return (
    <>
      <Card bordered={false} style={{ marginBottom: 16, borderRadius: 10 }}>
        <Space wrap>
          <CalendarOutlined style={{ fontSize: 18, color: '#6366f1' }} />
          <Select
            value={month}
            onChange={setMonth}
            style={{ width: 140 }}
            options={MONTHS.map((label, i) => ({ value: i + 1, label }))}
          />
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 90 }}
            options={YEARS.map((y) => ({ value: y, label: `${y}` }))}
          />
          <Button icon={<DownloadOutlined />} onClick={handleImport}>
            Importer récurrentes
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Nouvelle opération
          </Button>
        </Space>
      </Card>

      {banks.length > 0 && (
        <>
          <BankBalances banks={banks} operations={operations} />
          <Divider />
        </>
      )}

      {operations.length === 0 ? (
        <Empty description="Aucune opération pour cette période" style={{ marginTop: 48 }} />
      ) : (
        <Card bordered={false} style={{ borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Typography.Text strong>{MONTHS[month - 1]} {year}</Typography.Text>
            <Typography.Text type="secondary">{operations.length} opération(s)</Typography.Text>
          </div>
          <OperationsTable
            operations={operations}
            onPoint={handlePoint}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </Card>
      )}

      <OperationForm
        open={formOpen}
        operation={editOp}
        banks={banks}
        onFinish={handleFormFinish}
        onCancel={() => { setFormOpen(false); setEditOp(null); }}
      />

      <style>{`.op-pointed td { opacity: 0.5; }`}</style>
    </>
  );
}
