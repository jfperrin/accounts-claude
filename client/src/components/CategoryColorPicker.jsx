import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORY_COLORS, DEFAULT_COLOR } from '@/lib/categoryColors';

// Pastille colorée cliquable qui ouvre un popover :
//   - grille de couleurs préréglées (CATEGORY_COLORS)
//   - input HTML5 type="color" pour choisir n'importe quelle couleur
// Le popover est rendu via portail dans document.body (position: fixed) pour
// échapper aux conteneurs avec overflow:auto (ex. <Table>) qui le cliperaient.
// onChange est appelé immédiatement à chaque sélection.
export default function CategoryColorPicker({ color, onChange, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const current = color ?? DEFAULT_COLOR;

  const computePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left });
  };

  const handleToggle = () => {
    if (!open) computePos();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inButton = buttonRef.current && buttonRef.current.contains(e.target);
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!inButton && !inPopover) setOpen(false);
    };
    const escHandler = (e) => { if (e.key === 'Escape') setOpen(false); };
    const closeOnScrollResize = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    window.addEventListener('scroll', closeOnScrollResize, true);
    window.addEventListener('resize', closeOnScrollResize);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
      window.removeEventListener('scroll', closeOnScrollResize, true);
      window.removeEventListener('resize', closeOnScrollResize);
    };
  }, [open]);

  const apply = (c) => { onChange(c); setOpen(false); };
  const dotClass = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`${dotClass} rounded-full ring-1 ring-border hover:ring-2 hover:ring-foreground transition-all cursor-pointer`}
        style={{ backgroundColor: current }}
        aria-label="Modifier la couleur"
      />
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-56 rounded-lg border border-border bg-card p-3 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="mb-3 grid grid-cols-6 gap-1.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => apply(c)}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: current.toLowerCase() === c.toLowerCase() ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
                aria-label={c}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="color"
              value={current}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span>Couleur personnalisée</span>
          </label>
        </div>,
        document.body,
      )}
    </>
  );
}
