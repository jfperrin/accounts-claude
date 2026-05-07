import { HelpCircle } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';

// Petite icône d'aide qui ouvre un tooltip détaillé. Utilisable dans les
// en-têtes de carte. Suppose un <TooltipProvider /> en amont.
export default function InfoTip({ children, side = 'top', className = '' }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Informations"
          className={`inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs whitespace-normal text-xs leading-relaxed"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
