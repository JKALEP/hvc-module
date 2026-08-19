import { LoaderCircleIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoaderCircleIcon>) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      role="status"
      aria-label="Cargando"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
