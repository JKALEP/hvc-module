import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * Etiqueta de estado o contador.
 *
 * ⚠️ **Los colores salen de tokens semánticos, no de la paleta de Tailwind.**
 * Antes las tres variantes de estado se escribían con `emerald-*`, `amber-*`
 * y `red-*`, cada una con su pareja `dark:`. Eso tenía dos problemas: el
 * color de «correcto» estaba escrito aquí y no en el sistema, así que
 * cambiarlo obligaba a buscarlo por el código; y había que acordarse de
 * escribir el par claro/oscuro cada vez —bastaba olvidar uno para que el
 * modo oscuro quedara roto en silencio—.
 *
 * Con tokens, `.dark` ya redefine cada familia, así que **las variantes
 * `dark:` desaparecen**: nueve clases menos que mantener a la par.
 *
 * La variante *soft* es la normal: fondo tenue y texto oscuro del mismo
 * matiz. **El borde al 15 %** es lo que evita que se vean como manchas —
 * define el contorno sin competir con el relleno—.
 */
const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        // ── Neutras ──
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-foreground',

        // ── Semánticas, en variante soft ──
        success:
          'border-success/15 bg-success-soft text-success-soft-foreground',
        warning:
          'border-warning/15 bg-warning-soft text-warning-soft-foreground',
        info: 'border-info/15 bg-info-soft text-info-soft-foreground',
        destructive:
          'border-destructive/15 bg-destructive-soft text-destructive-soft-foreground',

        /** El acento de marca. Para destacar sin significar «correcto». */
        brand: 'border-brand/15 bg-brand-soft text-brand-soft-foreground',
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
