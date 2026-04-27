import { DEFAULT_COLOR } from '@/lib/categoryColors';

export default function CategoryBadge({ category, categories = [], onRemove }) {
  if (!category) return null;

  const cat = categories.find((c) => c.label === category);
  const col = cat?.color ?? DEFAULT_COLOR;

  if (onRemove) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
        style={{ backgroundColor: `${col}20`, color: col }}
        title="Cliquer pour retirer la catégorie"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col }} />
        {category}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${col}20`, color: col }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col }} />
      {category}
    </span>
  );
}
