# client2 — Redesign sans antd Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer `client2/` — clone fonctionnel de `client/` avec Tailwind CSS v4 + shadcn/ui à la place d'Ant Design.

**Architecture:** Vite 6 + React 19 SPA dans `client2/`. La couche API, le routing et la logique métier sont copiés verbatim depuis `client/`. Les composants UI sont réécrits avec les patterns shadcn/ui (Radix UI primitives + Tailwind v4). Les toasts sonner remplacent `message` antd.

**Tech Stack:** Vite 6, React 19, Tailwind CSS v4 + @tailwindcss/vite, shadcn/ui (Radix UI), Lucide React, sonner, class-variance-authority, clsx, tailwind-merge, react-router-dom 7, axios, dayjs, Vitest 4 + Testing Library

---

## File Map

```
client2/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── index.css                    CSS tokens (Tailwind v4 + @theme inline)
    ├── main.jsx                     Entry point + Toaster
    ├── App.jsx                      Routing + PrivateRoute
    ├── lib/utils.js                 cn() helper
    ├── api/                         copie exacte de client/src/api/
    ├── store/AuthContext.jsx         copie exacte de client/src/store/
    ├── components/
    │   ├── ui/button.jsx
    │   ├── ui/input.jsx
    │   ├── ui/label.jsx
    │   ├── ui/badge.jsx
    │   ├── ui/separator.jsx
    │   ├── ui/avatar.jsx
    │   ├── ui/switch.jsx
    │   ├── ui/tooltip.jsx
    │   ├── ui/select.jsx
    │   ├── ui/dialog.jsx
    │   ├── ui/table.jsx
    │   ├── layout/AppShell.jsx
    │   ├── BankBalances.jsx
    │   ├── OperationsTable.jsx
    │   └── OperationForm.jsx
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── DashboardPage.jsx
    │   ├── BanksPage.jsx
    │   └── RecurringPage.jsx
    └── tests/
        ├── setup.js
        ├── LoginPage.test.jsx
        ├── BankBalances.test.jsx
        └── OperationsTable.test.jsx
```

---

## Task 1 : Scaffold — package.json, vite.config.js, index.html

**Files:**
- Create: `client2/package.json`
- Create: `client2/vite.config.js`
- Create: `client2/index.html`

- [ ] **Step 1 : Créer `client2/package.json`**

```json
{
  "name": "accounts-client2",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@radix-ui/react-avatar": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-select": "latest",
    "@radix-ui/react-separator": "latest",
    "@radix-ui/react-switch": "latest",
    "@radix-ui/react-tooltip": "latest",
    "axios": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "dayjs": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest",
    "sonner": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@tailwindcss/vite": "latest",
    "@testing-library/dom": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@vitejs/plugin-react": "latest",
    "@vitest/coverage-v8": "latest",
    "happy-dom": "latest",
    "tailwindcss": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2 : Créer `client2/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
  },
});
```

- [ ] **Step 3 : Créer `client2/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <title>Gestion de Comptes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4 : Installer les dépendances**

```bash
cd client2 && yarn install
```

Résultat attendu : `node_modules/` créé, pas d'erreur.

- [ ] **Step 5 : Commit**

```bash
git add client2/package.json client2/vite.config.js client2/index.html
git commit -m "feat(client2): scaffold vite + tailwind v4 + shadcn stack"
```

---

## Task 2 : CSS design tokens + lib/utils.js

**Files:**
- Create: `client2/src/index.css`
- Create: `client2/src/lib/utils.js`

- [ ] **Step 1 : Créer `client2/src/index.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-sidebar: var(--sidebar);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

:root {
  --background: oklch(0.984 0.003 247.858);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --border: oklch(0.922 0.006 264.532);
  --input: oklch(0.922 0.006 264.532);
  --ring: oklch(0.511 0.262 277.014);
  --primary: oklch(0.511 0.262 277.014);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.968 0.007 264.542);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --sidebar: oklch(0.141 0.005 285.823);
  --radius: 0.5rem;
}

* {
  border-color: var(--border);
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2 : Créer `client2/src/lib/utils.js`**

```js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3 : Commit**

```bash
git add client2/src/index.css client2/src/lib/utils.js
git commit -m "feat(client2): tailwind v4 design tokens + cn() helper"
```

---

## Task 3 : Copier la couche API et AuthContext

**Files:**
- Create: `client2/src/api/client.js` (copie)
- Create: `client2/src/api/auth.js` (copie)
- Create: `client2/src/api/banks.js` (copie)
- Create: `client2/src/api/operations.js` (copie)
- Create: `client2/src/api/periods.js` (copie)
- Create: `client2/src/api/recurringOperations.js` (copie)
- Create: `client2/src/store/AuthContext.jsx` (copie)

- [ ] **Step 1 : Copier les fichiers**

```bash
mkdir -p client2/src/api client2/src/store
cp client/src/api/client.js client2/src/api/
cp client/src/api/auth.js client2/src/api/
cp client/src/api/banks.js client2/src/api/
cp client/src/api/operations.js client2/src/api/
cp client/src/api/periods.js client2/src/api/
cp client/src/api/recurringOperations.js client2/src/api/
cp client/src/store/AuthContext.jsx client2/src/store/
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/api/ client2/src/store/
git commit -m "feat(client2): copy API layer and AuthContext verbatim"
```

---

## Task 4 : Composants UI shadcn — batch 1 (Button, Input, Label, Badge, Separator)

**Files:**
- Create: `client2/src/components/ui/button.jsx`
- Create: `client2/src/components/ui/input.jsx`
- Create: `client2/src/components/ui/label.jsx`
- Create: `client2/src/components/ui/badge.jsx`
- Create: `client2/src/components/ui/separator.jsx`

- [ ] **Step 1 : Créer `client2/src/components/ui/button.jsx`**

```jsx
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-card hover:bg-muted text-foreground',
        ghost: 'hover:bg-muted text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8 text-base',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2 : Créer `client2/src/components/ui/input.jsx`**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 3 : Créer `client2/src/components/ui/label.jsx`**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
```

- [ ] **Step 4 : Créer `client2/src/components/ui/badge.jsx`**

```jsx
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-muted text-muted-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 5 : Créer `client2/src/components/ui/separator.jsx`**

```jsx
import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

- [ ] **Step 6 : Commit**

```bash
git add client2/src/components/ui/
git commit -m "feat(client2): shadcn ui batch 1 — button, input, label, badge, separator"
```

---

## Task 5 : Composants UI shadcn — batch 2 (Avatar, Switch, Tooltip)

**Files:**
- Create: `client2/src/components/ui/avatar.jsx`
- Create: `client2/src/components/ui/switch.jsx`
- Create: `client2/src/components/ui/tooltip.jsx`

- [ ] **Step 1 : Créer `client2/src/components/ui/avatar.jsx`**

```jsx
import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
```

- [ ] **Step 2 : Créer `client2/src/components/ui/switch.jsx`**

```jsx
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
```

- [ ] **Step 3 : Créer `client2/src/components/ui/tooltip.jsx`**

```jsx
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background animate-in fade-in-0 zoom-in-95',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

- [ ] **Step 4 : Commit**

```bash
git add client2/src/components/ui/avatar.jsx client2/src/components/ui/switch.jsx client2/src/components/ui/tooltip.jsx
git commit -m "feat(client2): shadcn ui batch 2 — avatar, switch, tooltip"
```

---

## Task 6 : Composant Select (Radix)

**Files:**
- Create: `client2/src/components/ui/select.jsx`

- [ ] **Step 1 : Créer `client2/src/components/ui/select.jsx`**

```jsx
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton,
};
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/components/ui/select.jsx
git commit -m "feat(client2): shadcn Select component (Radix)"
```

---

## Task 7 : Composant Dialog (Radix)

**Files:**
- Create: `client2/src/components/ui/dialog.jsx`

- [ ] **Step 1 : Créer `client2/src/components/ui/dialog.jsx`**

```jsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-xl',
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Fermer</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1.5', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
};
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/components/ui/dialog.jsx
git commit -m "feat(client2): shadcn Dialog component (Radix)"
```

---

## Task 8 : Composant Table

**Files:**
- Create: `client2/src/components/ui/table.jsx`

- [ ] **Step 1 : Créer `client2/src/components/ui/table.jsx`**

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/components/ui/table.jsx
git commit -m "feat(client2): shadcn Table component"
```

---

## Task 9 : AppShell layout

**Files:**
- Create: `client2/src/components/layout/AppShell.jsx`

- [ ] **Step 1 : Créer `client2/src/components/layout/AppShell.jsx`**

```jsx
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, RefreshCw, LogOut, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { key: '/banks', icon: Building2, label: 'Banques' },
  { key: '/recurring', icon: RefreshCw, label: 'Opérations récurrentes' },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-sidebar text-white transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 border-b border-white/10 py-4',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight">Comptes</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-card px-6 shadow-xs">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold text-foreground">{user?.username}</span>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/components/layout/AppShell.jsx
git commit -m "feat(client2): AppShell — sidebar collapsible + header"
```

---

## Task 10 : LoginPage — test puis implémentation

**Files:**
- Create: `client2/src/tests/setup.js`
- Create: `client2/src/tests/LoginPage.test.jsx`
- Create: `client2/src/pages/LoginPage.jsx`

- [ ] **Step 1 : Créer `client2/src/tests/setup.js`**

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 2 : Écrire le test `client2/src/tests/LoginPage.test.jsx`**

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth', () => ({
  config: vi.fn().mockResolvedValue({ googleEnabled: false }),
  login: vi.fn(),
  register: vi.fn(),
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();
vi.mock('../store/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

const Wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('affiche les onglets Connexion et Inscription', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByText('Inscription')).toBeInTheDocument();
  });

  it('soumet le formulaire de connexion', async () => {
    mockLogin.mockResolvedValue({ _id: '1', username: 'alice' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText("Nom d'utilisateur"), 'alice');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({ username: 'alice', password: 'pass1234' })
    );
  });

  it("bascule vers l'onglet inscription et change le bouton submit", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await userEvent.click(screen.getByText('Inscription'));
    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Google si googleEnabled est false", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() => expect(authApi.config).toHaveBeenCalled());
    expect(screen.queryByText('Continuer avec Google')).not.toBeInTheDocument();
  });

  it('affiche le bouton Google si googleEnabled est true', async () => {
    authApi.config.mockResolvedValue({ googleEnabled: true });
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(screen.getByText('Continuer avec Google')).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 3 : Lancer le test — vérifier qu'il échoue**

```bash
cd client2 && yarn test src/tests/LoginPage.test.jsx
```

Résultat attendu : FAIL — `LoginPage` module not found.

- [ ] **Step 4 : Implémenter `client2/src/pages/LoginPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { config as fetchConfig } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      tab === 'login' ? await login(form) : await register(form);
    } catch (err) {
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -right-20 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_65%)]" />

      {/* Card */}
      <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl">
        {/* Brand */}
        <div className="mb-9 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Gestion de Comptes</h1>
          <p className="text-sm text-slate-500">Gérez vos finances en toute sérénité</p>
        </div>

        {googleError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Échec de la connexion Google
          </div>
        )}

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full gap-2"
              size="lg"
              onClick={() => { window.location.href = '/api/auth/google'; }}
            >
              <Chrome className="h-4 w-4" />
              Continuer avec Google
            </Button>
            <div className="relative mb-4 flex items-center gap-3">
              <span className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400">ou</span>
              <span className="flex-1 border-t border-slate-200" />
            </div>
          </>
        )}

        {/* Tab toggle */}
        <div className="mb-7 flex gap-1 rounded-xl bg-slate-100 p-1">
          {[['login', 'Connexion'], ['register', 'Inscription']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTab(key); setForm({ username: '', password: '' }); }}
              className={cn_inline(
                'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                tab === key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Nom d'utilisateur</Label>
            <Input
              id="username"
              autoFocus
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="mt-2 h-11 w-full text-base shadow-md shadow-indigo-500/30"
            disabled={loading}
          >
            {loading ? 'Chargement…' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// inline helper (cn n'est pas importé ici pour garder l'import minimal)
function cn_inline(...classes) {
  return classes.filter(Boolean).join(' ');
}
```

> Note: remplacer `cn_inline` par l'import `cn` de `@/lib/utils` si tu préfères la cohérence.

- [ ] **Step 5 : Lancer le test — vérifier qu'il passe**

```bash
cd client2 && yarn test src/tests/LoginPage.test.jsx
```

Résultat attendu : 5 tests PASS.

- [ ] **Step 6 : Commit**

```bash
git add client2/src/tests/setup.js client2/src/tests/LoginPage.test.jsx client2/src/pages/LoginPage.jsx
git commit -m "feat(client2): LoginPage avec tests (shadcn + sonner)"
```

---

## Task 11 : BankBalances — test puis implémentation

**Files:**
- Create: `client2/src/tests/BankBalances.test.jsx`
- Create: `client2/src/components/BankBalances.jsx`

- [ ] **Step 1 : Écrire le test `client2/src/tests/BankBalances.test.jsx`**

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import BankBalances from '../components/BankBalances';

const banks = [
  { _id: '1', label: 'BNP' },
  { _id: '2', label: 'Société Générale' },
];

const ops = [
  { _id: 'a', bankId: { _id: '1' }, amount: -300, pointed: false },
  { _id: 'b', bankId: { _id: '1' }, amount: -100, pointed: true },
  { _id: 'c', bankId: { _id: '2' }, amount: -200, pointed: false },
];

describe('BankBalances', () => {
  it('affiche le nom de chaque banque', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getByText('BNP')).toBeInTheDocument();
    expect(screen.getByText('Société Générale')).toBeInTheDocument();
  });

  it('affiche — quand aucun solde saisi', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('affiche le prévisionnel = solde saisi − ops non pointées', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />
    );
    // BNP: 1000 - 300 = 700
    const bnpCard = screen.getByTestId('bank-card-1');
    expect(bnpCard.textContent).toContain('700');
    // SG: 500 - 200 = 300
    const sgCard = screen.getByTestId('bank-card-2');
    expect(sgCard.textContent).toContain('300');
  });

  it('affiche le total prévisionnel quand plusieurs banques ont un solde', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />
    );
    expect(screen.getByText('Total prévisionnel')).toBeInTheDocument();
    // (1000 - 300) + (500 - 200) = 1000
    expect(screen.getByTestId('total-card').textContent).toMatch(/1[.,\s]?000/);
  });

  it("n'affiche pas le total avec une seule banque", () => {
    render(
      <BankBalances banks={[banks[0]]} operations={ops} periodBalances={{ '1': 1000 }} />
    );
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it("n'affiche pas le total si aucun solde n'est saisi", () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it('appelle onSaveBalance au clic sur le crayon puis blur', async () => {
    const onSaveBalance = vi.fn();
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000 }} onSaveBalance={onSaveBalance} />
    );

    await userEvent.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '1500');
    await userEvent.tab();

    await waitFor(() =>
      expect(onSaveBalance).toHaveBeenCalledWith('1', 1500)
    );
  });
});
```

- [ ] **Step 2 : Lancer le test — vérifier qu'il échoue**

```bash
cd client2 && yarn test src/tests/BankBalances.test.jsx
```

Résultat attendu : FAIL — `BankBalances` module not found.

- [ ] **Step 3 : Implémenter `client2/src/components/BankBalances.jsx`**

```jsx
import { memo, useState } from 'react';
import { Building2, Pencil, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const fmt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur = (v) => `${fmt(v)} €`;

function getUnpointedSum(operations, bankId) {
  return operations
    .filter((o) => !o.pointed && (o.bankId?._id === bankId || o.bankId === bankId))
    .reduce((sum, o) => sum + o.amount, 0);
}

const BankCard = memo(function BankCard({ bank, operations, initialBalance, onSaveBalance }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBalance ?? null);

  const unpointedSum = getUnpointedSum(operations, bank._id);
  const projected = initialBalance != null ? initialBalance + unpointedSum : null;

  const handleSave = () => {
    setEditing(false);
    const val = parseFloat(draft) || 0;
    if (val !== initialBalance) onSaveBalance?.(bank._id, val);
  };

  return (
    <div
      data-testid={`bank-card-${bank._id}`}
      className="rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 className="h-4 w-4 text-indigo-600" />
        {bank.label}
      </div>
      <Separator className="my-3" />

      <div className="mb-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solde actuel</p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="number"
                autoFocus
                role="spinbutton"
                step="0.01"
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-700">
                <Check className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-foreground">
                {initialBalance != null ? fmtEur(initialBalance) : '—'}
              </span>
              <button
                aria-label="modifier"
                onClick={() => { setDraft(initialBalance ?? 0); setEditing(true); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévisionnel</p>
        {projected != null ? (
          <span className={cn('text-2xl font-bold', projected >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {fmtEur(projected)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Saisir un solde</span>
        )}
      </div>
    </div>
  );
});

export default function BankBalances({ banks, operations, periodBalances = {}, onSaveBalance }) {
  const totalInitial = banks.reduce((s, b) => s + (periodBalances[b._id] ?? 0), 0);
  const totalUnpointed = operations.filter((o) => !o.pointed).reduce((s, o) => s + o.amount, 0);
  const totalProjected = totalInitial + totalUnpointed;
  const hasBalances = banks.some((b) => periodBalances[b._id] != null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {banks.map((bank) => (
        <BankCard
          key={bank._id}
          bank={bank}
          operations={operations}
          initialBalance={periodBalances[bank._id] ?? null}
          onSaveBalance={onSaveBalance}
        />
      ))}
      {banks.length > 1 && hasBalances && (
        <div
          data-testid="total-card"
          className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 shadow-lg shadow-indigo-500/30"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">Total prévisionnel</p>
          <span className="text-2xl font-extrabold text-white">
            {totalProjected.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4 : Lancer le test — vérifier qu'il passe**

```bash
cd client2 && yarn test src/tests/BankBalances.test.jsx
```

Résultat attendu : 7 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add client2/src/tests/BankBalances.test.jsx client2/src/components/BankBalances.jsx
git commit -m "feat(client2): BankBalances component avec tests"
```

---

## Task 12 : OperationsTable — test puis implémentation

**Files:**
- Create: `client2/src/tests/OperationsTable.test.jsx`
- Create: `client2/src/components/OperationsTable.jsx`

- [ ] **Step 1 : Écrire le test `client2/src/tests/OperationsTable.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OperationsTable from '../components/OperationsTable';

const ops = [
  { _id: '1', label: 'Loyer', amount: -800, date: '2025-04-05', pointed: false, bankId: { _id: 'b1', label: 'BNP' } },
  { _id: '2', label: 'Salaire', amount: 2500, date: '2025-04-28', pointed: true, bankId: { _id: 'b1', label: 'BNP' } },
];

describe('OperationsTable', () => {
  it('affiche les opérations', () => {
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Loyer')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
  });

  it('appelle onPoint avec l\'id de l\'opération', async () => {
    const onPoint = vi.fn();
    render(<OperationsTable operations={ops} onPoint={onPoint} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]);
    expect(onPoint).toHaveBeenCalledWith('1');
  });

  it('reflète l\'état pointé initial', () => {
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked();
  });

  it('appelle onEdit au clic sur le bouton éditer', async () => {
    const onEdit = vi.fn();
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: /éditer/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(ops[0]);
  });
});
```

- [ ] **Step 2 : Lancer le test — vérifier qu'il échoue**

```bash
cd client2 && yarn test src/tests/OperationsTable.test.jsx
```

Résultat attendu : FAIL.

- [ ] **Step 3 : Implémenter `client2/src/components/OperationsTable.jsx`**

```jsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const fmt = (v) => v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const ROWS_PER_PAGE = 20;

export default function OperationsTable({ operations, onPoint, onEdit, onDelete }) {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sorted = [...operations].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const rows = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const confirmDelete = () => {
    onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Banque</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="text-center">Pointé</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((op) => (
            <TableRow key={op._id} className={cn(op.pointed && 'opacity-50')}>
              <TableCell className="text-muted-foreground">{dayjs(op.date).format('DD/MM/YYYY')}</TableCell>
              <TableCell className="font-medium">{op.label}</TableCell>
              <TableCell>
                <Badge variant="secondary">{op.bankId?.label}</Badge>
              </TableCell>
              <TableCell className={cn('text-right font-semibold', op.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {op.amount > 0 ? '+' : ''}{fmt(op.amount)}
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={op.pointed} onCheckedChange={() => onPoint(op._id)} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => onEdit(op)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="supprimer" onClick={() => setDeleteTarget(op._id)}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l'opération ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4 : Lancer le test — vérifier qu'il passe**

```bash
cd client2 && yarn test src/tests/OperationsTable.test.jsx
```

Résultat attendu : 4 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add client2/src/tests/OperationsTable.test.jsx client2/src/components/OperationsTable.jsx
git commit -m "feat(client2): OperationsTable avec tests (shadcn Table + Switch)"
```

---

## Task 13 : OperationForm (Dialog)

**Files:**
- Create: `client2/src/components/OperationForm.jsx`

- [ ] **Step 1 : Implémenter `client2/src/components/OperationForm.jsx`**

```jsx
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const empty = () => ({ label: '', bankId: '', date: dayjs().format('YYYY-MM-DD'), amount: '' });

export default function OperationForm({ open, operation, banks, onFinish, onCancel }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (open) {
      setForm(operation
        ? {
            label: operation.label,
            bankId: operation.bankId?._id ?? operation.bankId ?? '',
            date: dayjs(operation.date).format('YYYY-MM-DD'),
            amount: String(operation.amount),
          }
        : empty()
      );
    }
  }, [open, operation]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.label || !form.bankId || !form.date || form.amount === '') return;
    onFinish({
      label: form.label,
      bankId: form.bankId,
      date: new Date(form.date).toISOString(),
      amount: parseFloat(form.amount),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{operation ? "Modifier l'opération" : 'Nouvelle opération'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="op-label">Libellé</Label>
            <Input id="op-label" autoFocus value={form.label} onChange={set('label')} required />
          </div>

          <div className="space-y-1.5">
            <Label>Banque</Label>
            <Select value={form.bankId} onValueChange={(v) => setForm((f) => ({ ...f, bankId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une banque" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-date">Date</Label>
            <Input id="op-date" type="date" value={form.date} onChange={set('date')} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-amount">Montant (€, négatif = débit)</Label>
            <Input
              id="op-amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/components/OperationForm.jsx
git commit -m "feat(client2): OperationForm dialog"
```

---

## Task 14 : DashboardPage

**Files:**
- Create: `client2/src/pages/DashboardPage.jsx`

- [ ] **Step 1 : Implémenter `client2/src/pages/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { CalendarDays, Download, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import * as banksApi from '@/api/banks';
import BankBalances from '@/components/BankBalances';
import OperationsTable from '@/components/OperationsTable';
import OperationForm from '@/components/OperationForm';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function DashboardPage() {
  const [periods, setPeriods] = useState([]);
  const [banks, setBanks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    Promise.all([periodsApi.list(), banksApi.list()]).then(([p, b]) => { setPeriods(p); setBanks(b); });
  }, []);

  useEffect(() => {
    const period = periods.find((p) => p.month === month && p.year === year);
    setSelectedPeriod(period ?? null);
    if (period) loadOperations(period._id);
    else setOperations([]);
  }, [periods, month, year]);

  const loadOperations = (periodId) => operationsApi.list(periodId).then(setOperations);

  const ensurePeriod = async () => {
    let period = selectedPeriod;
    if (!period) {
      period = await periodsApi.create({ month, year });
      setPeriods((prev) => [...prev, period]);
      setSelectedPeriod(period);
    }
    return period;
  };

  const handleSaveBalance = async (bankId, value) => {
    const period = await ensurePeriod();
    const current = { ...(period.balances ?? {}) };
    current[bankId] = value;
    const updated = await periodsApi.updateBalances(period._id, current);
    setPeriods((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setSelectedPeriod(updated);
  };

  const handleImport = async () => {
    const period = await ensurePeriod();
    const { imported } = await operationsApi.importRecurring(period._id);
    toast.success(`${imported} opération(s) importée(s)`);
    loadOperations(period._id);
  };

  const handleFormFinish = async (values) => {
    const period = await ensurePeriod();
    if (editOp) await operationsApi.update(editOp._id, values);
    else await operationsApi.create({ ...values, periodId: period._id });
    setFormOpen(false);
    setEditOp(null);
    loadOperations(period._id);
  };

  const handlePoint = async (id) => {
    await operationsApi.point(id);
    loadOperations(selectedPeriod._id);
  };

  const handleDelete = async (id) => {
    await operationsApi.remove(id);
    loadOperations(selectedPeriod._id);
  };

  const openEdit = (op) => { setEditOp(op); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-indigo-600" />
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleImport} className="gap-2">
          <Download className="h-4 w-4" />
          Importer récurrentes
        </Button>
        <Button onClick={() => { setEditOp(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle opération
        </Button>
      </div>

      {/* Bank balances */}
      {banks.length > 0 && (
        <>
          <BankBalances
            banks={banks}
            operations={operations}
            periodBalances={selectedPeriod?.balances ?? {}}
            onSaveBalance={handleSaveBalance}
          />
          <Separator />
        </>
      )}

      {/* Operations */}
      {operations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Aucune opération pour cette période</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-foreground">{MONTHS[month - 1]} {year}</span>
            <span className="text-sm text-muted-foreground">{operations.length} opération(s)</span>
          </div>
          <OperationsTable
            operations={operations}
            onPoint={handlePoint}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      <OperationForm
        open={formOpen}
        operation={editOp}
        banks={banks}
        onFinish={handleFormFinish}
        onCancel={() => { setFormOpen(false); setEditOp(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/pages/DashboardPage.jsx
git commit -m "feat(client2): DashboardPage"
```

---

## Task 15 : BanksPage

**Files:**
- Create: `client2/src/pages/BanksPage.jsx`

- [ ] **Step 1 : Implémenter `client2/src/pages/BanksPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function BanksPage() {
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { bank? }
  const [label, setLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.list().then(setBanks);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setLabel(''); setModal({}); };
  const openEdit = (bank) => { setLabel(bank.label); setModal({ bank }); };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      modal.bank ? await api.update(modal.bank._id, { label }) : await api.create({ label });
      toast.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    await api.remove(deleteTarget);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Banques</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.map((bank) => (
              <TableRow key={bank._id}>
                <TableCell className="font-medium">{bank.label}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(bank)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="supprimer"
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(bank._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal?.bank ? 'Modifier la banque' : 'Nouvelle banque'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="bank-label">Libellé</Label>
              <Input id="bank-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la banque ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={onDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/pages/BanksPage.jsx
git commit -m "feat(client2): BanksPage"
```

---

## Task 16 : RecurringPage

**Files:**
- Create: `client2/src/pages/RecurringPage.jsx`

- [ ] **Step 1 : Implémenter `client2/src/pages/RecurringPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/recurringOperations';
import * as banksApi from '@/api/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const fmtEur = (v) => v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const empty = () => ({ label: '', bankId: '', dayOfMonth: '', amount: '' });

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { item? }
  const [form, setForm] = useState(empty());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => Promise.all([api.list(), banksApi.list()]).then(([ops, b]) => { setItems(ops); setBanks(b); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty()); setModal({}); };
  const openEdit = (item) => {
    setForm({
      label: item.label,
      bankId: item.bankId?._id ?? item.bankId ?? '',
      dayOfMonth: String(item.dayOfMonth),
      amount: String(item.amount),
    });
    setModal({ item });
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val?.target?.value ?? val }));

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        label: form.label,
        bankId: form.bankId,
        dayOfMonth: Number(form.dayOfMonth),
        amount: parseFloat(form.amount),
      };
      modal.item ? await api.update(modal.item._id, payload) : await api.create(payload);
      toast.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    await api.remove(deleteTarget);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Opérations récurrentes</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Banque</TableHead>
              <TableHead className="text-center">Jour</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item._id}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell><Badge variant="secondary">{item.bankId?.label}</Badge></TableCell>
                <TableCell className="text-center text-muted-foreground">{item.dayOfMonth}</TableCell>
                <TableCell className={cn('text-right font-semibold', item.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                  {item.amount > 0 ? '+' : ''}{fmtEur(item.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="supprimer"
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(item._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.item ? 'Modifier' : 'Nouvelle opération récurrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rec-label">Libellé</Label>
              <Input id="rec-label" autoFocus value={form.label} onChange={set('label')} required />
            </div>
            <div className="space-y-1.5">
              <Label>Banque</Label>
              <Select value={form.bankId} onValueChange={set('bankId')}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jour du mois</Label>
                <Select value={form.dayOfMonth} onValueChange={set('dayOfMonth')}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-amount">Montant (€)</Label>
                <Input id="rec-amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={onDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add client2/src/pages/RecurringPage.jsx
git commit -m "feat(client2): RecurringPage"
```

---

## Task 17 : App.jsx + main.jsx — câblage final

**Files:**
- Create: `client2/src/App.jsx`
- Create: `client2/src/main.jsx`

- [ ] **Step 1 : Créer `client2/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="recurring" element={<RecurringPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2 : Créer `client2/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/store/AuthContext';
import App from '@/App';
import './index.css';

dayjs.locale('fr');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3 : Commit**

```bash
git add client2/src/App.jsx client2/src/main.jsx
git commit -m "feat(client2): App routing + main entry point avec Toaster"
```

---

## Task 18 : Vérification finale — tests + build

- [ ] **Step 1 : Lancer tous les tests**

```bash
cd client2 && yarn test
```

Résultat attendu : tous les tests PASS (LoginPage ×5, BankBalances ×7, OperationsTable ×4).

- [ ] **Step 2 : Vérifier le build de production**

```bash
cd client2 && yarn build
```

Résultat attendu : `dist/` créé sans erreur ni warning TypeScript/import.

- [ ] **Step 3 : Lancer en dev et vérifier visuellement**

```bash
cd client2 && yarn dev
```

Ouvrir http://localhost:5174, vérifier :
- [ ] Page login s'affiche avec fond sombre + glow
- [ ] Connexion fonctionne, sidebar s'affiche
- [ ] Navigation entre les 3 pages
- [ ] Sidebar collapsible
- [ ] Sélecteurs mois/année sur le dashboard
- [ ] Ajout/édition/suppression d'opération via Dialog
- [ ] Switch "Pointé" fonctionne (ligne s'estompe)
- [ ] Toast sonner apparaît après import récurrentes
- [ ] BanksPage : CRUD via Dialog
- [ ] RecurringPage : CRUD via Dialog

- [ ] **Step 4 : Commit final**

```bash
git add -A
git commit -m "feat(client2): redesign complet sans antd — shadcn/ui + Tailwind v4"
```
