import React from 'react';
import { FlatList } from 'react-native';
import { OperationItem } from './OperationItem';
import { EmptyState }    from '@/components/common/EmptyState';
import type { Operation, Bank } from '@/types';

interface Props {
  operations: Operation[];
  banks:      Bank[];
  onPoint:    (id: string) => void;
  onEdit:     (op: Operation) => void;
  onDelete:   (id: string) => void;
}

function getBankLabel(op: Operation, banks: Bank[]): string {
  if (typeof op.bankId === 'object') return (op.bankId as Bank).label;
  return banks.find((b) => b._id === op.bankId)?.label ?? '—';
}

export function OperationsList({ operations, banks, onPoint, onEdit, onDelete }: Props) {
  if (!operations.length) {
    return <EmptyState icon="bank-transfer" title="Aucune opération" subtitle="Ajoutez votre première opération" />;
  }

  return (
    <FlatList
      data={operations}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <OperationItem
          operation={item}
          bankLabel={getBankLabel(item, banks)}
          onPoint={() => onPoint(item._id)}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item._id)}
        />
      )}
      scrollEnabled={false}
    />
  );
}
