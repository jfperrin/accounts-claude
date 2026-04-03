import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';

export default function OperationForm({ open, operation, banks, onFinish, onCancel }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(operation
        ? { ...operation, bankId: operation.bankId?._id, date: dayjs(operation.date) }
        : { date: dayjs(), pointed: false }
      );
    }
  }, [open, operation, form]);

  const handleFinish = (values) => {
    onFinish({ ...values, date: values.date.toISOString(), bankId: values.bankId });
  };

  return (
    <Modal
      open={open}
      title={operation ? 'Modifier l\'opération' : 'Nouvelle opération'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 16 }}>
        <Form.Item name="label" label="Libellé" rules={[{ required: true }]}><Input autoFocus /></Form.Item>
        <Form.Item name="bankId" label="Banque" rules={[{ required: true }]}>
          <Select options={banks.map((b) => ({ value: b._id, label: b.label }))} />
        </Form.Item>
        <Form.Item name="date" label="Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="amount" label="Montant (€, négatif = débit)" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} step={0.01} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
