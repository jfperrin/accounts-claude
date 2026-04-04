import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, FAB, Divider, IconButton, Appbar, Snackbar } from 'react-native-paper';
import dayjs from 'dayjs';
import { useAuth }         from '../hooks/useAuth';
import { useBanks }        from '../hooks/useBanks';
import { usePeriods }      from '../hooks/usePeriods';
import { useOperations }   from '../hooks/useOperations';
import { useRecurring }    from '../hooks/useRecurring';
import { Screen }          from '../components/common/Screen';
import { BankBalances }    from '../components/banks/BankBalances';
import { OperationsList }  from '../components/operations/OperationsList';
import { OperationForm }   from '../components/operations/OperationForm';
import { palette }         from '../theme';
import type { Operation }  from '../types';

const CURRENT_YEAR  = dayjs().year();
const CURRENT_MONTH = dayjs().month() + 1;

const MONTH_NAMES = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function prevMonth(month: number, year: number) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

function nextMonth(month: number, year: number) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export function DashboardScreen() {
  const { user, logout }  = useAuth();
  const userId            = user!._id;

  const [month,   setMonth]   = useState(CURRENT_MONTH);
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp,   setEditOp]  = useState<Operation | null>(null);
  const [snack,    setSnack]   = useState('');

  const banksHook  = useBanks(userId);
  const periodsHook = usePeriods(userId);
  const opsHook    = useOperations(userId);
  const recurHook  = useRecurring(userId);

  const currentPeriod = periodsHook.periods.find((p) => p.month === month && p.year === year) ?? null;

  const load = useCallback(async () => {
    await Promise.all([
      banksHook.refresh(),
      periodsHook.refresh(),
      recurHook.refresh(),
    ]);
  }, [month, year]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (currentPeriod) opsHook.refresh(currentPeriod._id);
    else               opsHook.refresh('__none__');
  }, [currentPeriod?._id]);

  const handleSaveBalance = async (bankId: string, value: number) => {
    const period = await periodsHook.getOrCreate(month, year, userId);
    await periodsHook.saveBalances(period._id, { ...period.balances, [bankId]: value });
  };

  const handleOperationSubmit = async (values: any) => {
    const period = await periodsHook.getOrCreate(month, year, userId);
    const amount = parseFloat(String(values.amount).replace(',', '.'));
    const data   = { label: values.label, bankId: values.bankId, date: new Date(values.date).toISOString(), amount, periodId: period._id };

    if (editOp) {
      await opsHook.update(editOp._id, { label: data.label, amount: data.amount, date: data.date, bankId: data.bankId });
      setSnack('Opération modifiée');
    } else {
      await opsHook.create(data);
      if (!currentPeriod) await periodsHook.refresh();
      setSnack('Opération créée');
    }
    setEditOp(null);
  };

  const handleImportRecurring = async () => {
    const period = await periodsHook.getOrCreate(month, year, userId);
    const count  = await opsHook.importRecurring(period._id, recurHook.items, month, year);
    setSnack(`${count.length} opération(s) importée(s)`);
    if (!currentPeriod) await periodsHook.refresh();
  };

  const openEdit = (op: Operation) => { setEditOp(op); setFormOpen(true); };
  const openNew  = () => { setEditOp(null); setFormOpen(true); };

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Tableau de bord" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="logout" onPress={logout} />
      </Appbar.Header>

      <Screen>
        {/* Period selector — mois et année sur une ligne */}
        <View style={styles.navRow}>
          <IconButton
            icon="chevron-left"
            style={styles.navBtn}
            onPress={() => { const p = prevMonth(month, year); setMonth(p.month); setYear(p.year); }}
          />
          <Text variant="titleMedium" style={styles.navLabel}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <IconButton
            icon="chevron-right"
            style={styles.navBtn}
            onPress={() => { const n = nextMonth(month, year); setMonth(n.month); setYear(n.year); }}
          />
        </View>

        {/* Import récurrents */}
        <Button
          mode="outlined"
          icon="import"
          onPress={handleImportRecurring}
          style={styles.importBtn}
          contentStyle={styles.importContent}
        >
          Importer les opérations récurrentes
        </Button>

        <Divider style={styles.divider} />

        {/* Balances */}
        {banksHook.banks.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>Soldes</Text>
            <BankBalances
              banks={banksHook.banks}
              operations={opsHook.operations}
              period={currentPeriod}
              onSave={handleSaveBalance}
            />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Operations */}
        <Text variant="titleSmall" style={styles.sectionTitle}>Opérations</Text>
        <OperationsList
          operations={opsHook.operations}
          banks={banksHook.banks}
          onPoint={opsHook.togglePoint}
          onEdit={openEdit}
          onDelete={opsHook.remove}
        />
      </Screen>

      <FAB icon="plus" style={styles.fab} onPress={openNew} />

      <OperationForm
        visible={formOpen}
        operation={editOp}
        banks={banksHook.banks}
        onSubmit={handleOperationSubmit}
        onDismiss={() => { setFormOpen(false); setEditOp(null); }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2500}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  appbar:        { backgroundColor: palette.white },
  appbarTitle:   { fontWeight: '700', color: palette.gray900 },
  navRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  navBtn:        { margin: 0 },
  navLabel:      { minWidth: 200, textAlign: 'center', fontWeight: '700', color: palette.gray900 },
  importBtn:     { marginVertical: 8, borderColor: palette.indigo500 },
  importContent: { paddingVertical: 4 },
  divider:       { marginVertical: 12 },
  sectionTitle:  { color: palette.gray500, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 },
  fab:           { position: 'absolute', right: 16, bottom: 16, backgroundColor: palette.indigo500 },
});
