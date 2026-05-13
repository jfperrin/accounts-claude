import { cn } from '@/lib/utils';

// État vide réutilisable.
// - variant="page" : page entière vide (titre en serif, padding généreux)
// - variant="card" : intégré dans un widget de tableau de bord (compact, sans titre)
// `actions` reçoit les CTA en tant que children (idéalement <Button> de shadcn).
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  variant = 'page',
  className,
}) {
  if (variant === 'card') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center text-muted-foreground', className)}>
        {Icon && <Icon className="mb-3 h-10 w-10 opacity-30" aria-hidden />}
        {title && <p className="text-sm font-medium text-foreground">{title}</p>}
        {description && <p className="mt-1 max-w-xs text-xs">{description}</p>}
        {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-md py-16 text-center', className)}>
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" aria-hidden />
        </div>
      )}
      {title && <h2 className="font-serif text-2xl font-semibold mb-2">{title}</h2>}
      {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
      {actions && <div className="flex flex-col sm:flex-row gap-2 justify-center">{actions}</div>}
    </div>
  );
}
