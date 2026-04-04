import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Appbar, FAB, Snackbar } from 'react-native-paper';
import { useAuth }         from '../hooks/useAuth';
import { useRecurring }    from '../hooks/useRecurring';
import { useBanks }        from '../hooks/useBanks';
import { RecurringItem }   from '../components/recurring/RecurringItem';
import { RecurringForm }   from '../components/recurring/RecurringForm';
import { ConfirmDialog }   from '../components/common/ConfirmDialog';
import { EmptyState }      from '../components/common/EmptyState';
import { Screen }          from '../components/common/Screen';
import { palette }         from '../theme';
import type { RecurringOperation, Bank } from '../types';

export function RecurringScreen() {
  const { user } = useAuth();
  const userId   = user!._id;

  const { items, refresh, create, update, remove } = useRecurring(userId);
  const { banks, refresh: refreshBanks }           = useBanks(userId);

  const [formOpen,  setFormOpen]  = useState(false);
  const [editItem,  setEditItem]  = useState<RecurringOperation | null>(null);
  const [deleteItem, setDeleteItem] = useState<RecurringOperation | null>(null);
  const [snack,     setSnack]     = useState('');

  useEffect(() => {
    Promise.all([refresh(), refreshBanks()]);
  }, []);

  const getBankLabel = (item: RecurringOperation): string => {
    if (typeof item.bankId === 'object') return (item.bankId as Bank).label;
    return banks.find((b) => b._id === item.bankId)?.label ?? '—';
  };

  const handleSubmit = async (values: any) => {
    const data = {
      label:      values.label,
      bankId:     values.bankId,
      dayOfMonth: parseInt(values.dayOfMonth, 10),
      amount:     parseFloat(String(values.amount).replace(',', '.')),
    };
    if (editItem) {
      await update(editItem._id, data);
      setSnack('Opération modifiée');
    } else {
      await create(data);
      setSnack('Opération créée');
    }
    setEditItem(null);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await remove(deleteItem._id);
    setDeleteItem(null);
    setSnack('Opération supprimée');
  };

  const openEdit = (item: RecurringOperation) => { setEditItem(item); setFormOpen(true); };
  const openNew  = () => { setEditItem(null); setFormOpen(true); };

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Opérations récurrentes" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <Screen>
        {items.length === 0 ? (
          <EmptyState icon="repeat" title="Aucune opération récurrente" subtitle="Ajoutez des opérations à importer chaque mois" />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i._id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <RecurringItem
                item={item}
                bankLabel={getBankLabel(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteItem(item)}
              />
            )}
          />
        )}
      </Screen>

      <FAB icon="plus" style={styles.fab} onPress={openNew} />

      <RecurringForm
        visible={formOpen}
        item={editItem}
        banks={banks}
        onSubmit={handleSubmit}
        onDismiss={() => { setFormOpen(false); setEditItem(null); }}
      />

      <ConfirmDialog
        visible={!!deleteItem}
        title="Supprimer"
        message={`Supprimer "${deleteItem?.label}" ?`}
        onConfirm={handleDelete}
        onDismiss={() => setDeleteItem(null)}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2500}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  appbar:      { backgroundColor: palette.white },
  appbarTitle: { fontWeight: '700', color: palette.gray900 },
  fab:         { position: 'absolute', right: 16, bottom: 16, backgroundColor: palette.indigo500 },
});
