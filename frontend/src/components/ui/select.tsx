import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Select nativo con el mismo aspecto que <Input>.
 * Se usa el elemento nativo a propósito: no agrega dependencias, funciona
 * en móvil y es accesible por teclado sin código extra.
 */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          'flex h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-background py-1 pr-8 pl-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          className,
        )}
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { Select };
