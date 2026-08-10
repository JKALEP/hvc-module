import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success:
          'border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400',
        warning:
          'border-amber-600/25 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-500',
        destructive:
          'border-red-600/20 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
