import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/shared/lib/utils';

function Input({
  className,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        // ⚠️ `text-base md:text-sm`, no `text-sm` a secas: por debajo de
        // 16px iOS hace ZOOM automático al enfocar un campo, y la página se
        // queda descolocada. En móvil el texto va a 16px y desde `md` baja a
        // los 14px de la interfaz.
        //
        // Y el fondo es TRANSPARENTE, no `bg-background`: así el campo hereda
        // el de su contenedor —blanco sobre una card, gris sobre una zona
        // `muted`— en vez de recortar un rectángulo del color equivocado.
        'flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
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

export { Input };
