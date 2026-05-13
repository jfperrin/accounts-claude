import { DEFAULT_COLOR } from '@/lib/categoryColors';

// Affiche un badge pour une catégorie identifiée par son id. Le libellé et la
// couleur sont récupérés dans la liste des catégories passée en prop. Si l'id
// est inconnu (catégorie supprimée par exemple), le badge n'est pas rendu.
//
// `source` : 'auto' (inférée par hint à l'import) → bordure pointillée discrète
// signalant que l'attribution est une suggestion à valider. 'manual' ou null →
// rendu plein, validé. Aligné DESIGN.md (sobre, pas de sparkle/émoji).
export default function CategoryBadge({ categoryId, categories = [], source = null, onRemove }) {
  if (!categoryId) return null;

  const cat = categories.find((c) => c._id === categoryId);
  if (!cat) return null;
  const col = cat.color ?? DEFAULT_COLOR;

  const isAuto = source === 'auto';
  const tooltip = isAuto ? 'Catégorie suggérée automatiquement' : undefined;
  const ariaLabel = isAuto ? `${cat.label} (suggérée automatiquement)` : undefined;
  const style = isAuto
    ? { backgroundColor: `${col}14`, color: col, borderColor: `${col}66` }
    : { backgroundColor: `${col}20`, color: col };
  const className = `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
    isAuto ? 'border border-dashed' : ''
  }`;

  if (onRemove) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className={`${className} w-fit cursor-pointer transition-opacity hover:opacity-70`}
        style={style}
        title={tooltip ?? 'Cliquer pour retirer la catégorie'}
        aria-label={ariaLabel}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col }} />
        {cat.label}
      </button>
    );
  }

  return (
    <span className={className} style={style} title={tooltip} aria-label={ariaLabel}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col }} />
      {cat.label}
    </span>
  );
}
