import { cn } from '@/shared/lib/utils';

/**
 * Campo multilínea, con exactamente la misma piel que el `Input`.
 *
 * Existe porque no había primitiva: doce archivos escribían `<textarea>`
 * crudo con sus clases a mano, así que el multilínea era el único control
 * del sistema que no compartía foco, fondo ni radio con el resto — cada uno
 * se parecía a lo que hubiera escrito quien lo puso.
 *
 * Se copia de `input.tsx` a propósito, con las dos únicas diferencias que
 * pide el sistema: alto mínimo y que crezca con el contenido. Si algún día
 * cambia el foco o el borde de los campos, hay que cambiarlo en los dos —
 * son el mismo control con distinta altura, no dos componentes.
 *
 * Las dos decisiones heredadas del `Input` que conviene no deshacer:
 *
 * - **`text-base md:text-sm`**, no `text-sm`: por debajo de 16px iOS hace
 *   zoom automático al enfocar y descoloca la página.
 * - **`bg-transparent`**: hereda el fondo de su contenedor en vez de
 *   recortar un rectángulo del color equivocado sobre una card o una zona
 *   `muted`.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
