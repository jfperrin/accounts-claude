// AlertDialog built on top of the existing Dialog primitive.
// Mirrors the shadcn/ui AlertDialog API so AdminPage can import it as-is.
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from './dialog';

const AlertDialog       = Dialog;
const AlertDialogContent  = DialogContent;
const AlertDialogHeader   = DialogHeader;
const AlertDialogFooter   = DialogFooter;
const AlertDialogTitle    = DialogTitle;
const AlertDialogDescription = DialogDescription;

// Simple wrapper buttons matching shadcn AlertDialog API
const AlertDialogAction = ({ className, ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 ${className ?? ''}`}
    {...props}
  />
);

const AlertDialogCancel = ({ className, ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${className ?? ''}`}
    {...props}
  />
);

export {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
};
