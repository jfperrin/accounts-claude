import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Appbar, FAB, List, IconButton, Snackbar } from 'react-native-paper';
import { useAuth }        from '../hooks/useAuth';
import { useBanks }       from '../hooks/useBanks';
import { BankForm }       from '../components/banks/BankForm';
import { ConfirmDialog }  from '../components/common/ConfirmDialog';
import { EmptyState }     from '../components/common/EmptyState';
import { Screen }         from '../components/common/Screen';
import { palette }        from '../theme';
import type { Bank }      from '../types';

export function BanksScreen() {
  const { user }  = useAuth();
  const { banks, refresh, create, update, remove } = useBanks(user!._id);

  const [formOpen,  setFormOpen]  = useState(false);
  const [editBank,  setEditBank]  = useState<Bank | null>(null);
  const [deleteBank, setDeleteBank] = useState<Bank | null>(null);
  const [snack,     setSnack]     = useState('');

  useEffect(() => { refresh(); }, []);

  const handleSubmit = async (label: string) => {
    if (editBank) {
      await update(editBank._id, label);
      setSnack('Banque modifiée');
    } else {
      await create(label);
      setSnack('Banque créée');
    }
    setEditBank(null);
  };

  const handleDelete = async () => {
    if (!deleteBank) return;
    await remove(deleteBank._id);
    setDeleteBank(null);
    setSnack('Banque supprimée');
  };

  const openEdit = (bank: Bank) => { setEditBank(bank); setFormOpen(true); };
  const openNew  = () => { setEditBank(null); setFormOpen(true); };

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Banques" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <Screen>
        {banks.length === 0 ? (
          <EmptyState icon="bank-outline" title="Aucune banque" subtitle="Ajoutez votre premier compte bancaire" />
        ) : (
          <FlatList
            data={banks}
            keyExtractor={(b) => b._id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <List.Item
                title={item.label}
                style={styles.item}
                left={(p) => <List.Icon {...p} icon="bank" color={palette.indigo500} />}
                right={() => (
                  <>
                    <IconButton icon="pencil-outline"    onPress={() => openEdit(item)}      iconColor={palette.gray400} />
                    <IconButton icon="trash-can-outline" onPress={() => setDeleteBank(item)} iconColor={palette.red500} />
                  </>
                )}
              />
            )}
          />
        )}
      </Screen>

      <FAB icon="plus" style={styles.fab} onPress={openNew} />

      <BankForm
        visible={formOpen}
        bank={editBank}
        onSubmit={handleSubmit}
        onDismiss={() => { setFormOpen(false); setEditBank(null); }}
      />

      <ConfirmDialog
        visible={!!deleteBank}
        title="Supprimer la banque"
        message={`Supprimer "${deleteBank?.label}" ?`}
        onConfirm={handleDelete}
        onDismiss={() => setDeleteBank(null)}
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
  item:        { backgroundColor: palette.white, borderRadius: 8, marginBottom: 8 },
  fab:         { position: 'absolute', right: 16, bottom: 16, backgroundColor: palette.indigo500 },
});
