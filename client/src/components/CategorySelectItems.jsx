import { SelectItem } from '@/components/ui/select';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import { sortCategoriesByHierarchy } from '@/lib/categoryHierarchy';

// Rend la liste des <SelectItem> d'un Select de catégorie, triée par hiérarchie.
// Les sous-catégories (depth=1) sont indentées avec un chevron "↳" pour rester
// lisibles dans le menu fermé du Radix Select (qui n'affiche que la valeur,
// donc ↳ permet de distinguer "Restaurants" d'une racine homonyme).
export default function CategorySelectItems({ categories }) {
  const items = sortCategoriesByHierarchy(categories);
  return items.map(({ cat, depth }) => (
    <SelectItem key={cat._id} value={cat._id}>
      <span className="inline-flex items-center gap-2">
        {depth > 0 && (
          <span className="text-muted-foreground text-xs">↳</span>
        )}
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: cat.color ?? DEFAULT_COLOR }}
        />
        {cat.label}
      </span>
    </SelectItem>
  ));
}
