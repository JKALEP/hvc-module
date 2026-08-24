import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // ⚠️ Overlay al 10 %, no al 50 %. El modal NO oscurece la página:
        // la separa con un micro-desenfoque y deja el contexto legible
        // detrás. `supports-` porque donde no haya `backdrop-filter` el
        // velo claro sigue funcionando por sí solo.
        'fixed inset-0 z-50 bg-black/10 transition-opacity duration-150',
        'supports-[backdrop-filter:blur(0px)]:backdrop-blur-xs',
        'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  showClose?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // `ring-1` en vez de `border`: el anillo no ocupa espacio de
          // layout, así que el contenido no se desplaza 1px respecto a un
          // contenedor sin borde. `bg-popover` es el fondo de lo que
          // flota. El ancho por defecto se queda en `max-w-lg`: 24 de los
          // 75 diálogos ya lo sobrescriben y los pequeños de confirmar y
          // renombrar piden `max-w-md`, no menos.
          // ⚠️ El aire lateral en móvil va en `w-`, NO en `max-w-`.
          // Casi todos los diálogos pasan su propio `max-w-*` por
          // `className`, y `twMerge` —haciendo su trabajo— elimina el de
          // aquí por pertenecer a la misma familia. El resultado era un
          // modal pegado a los dos bordes de la pantalla en móvil. Con
          // `w-[calc(100%_-_2rem)]` el ancho queda siempre 16px por lado
          // por dentro del viewport, y el `max-w` del llamador sigue
          // mandando en pantallas grandes.
          //
          // Los guiones bajos son la sintaxis de Tailwind para espacios en
          // un valor arbitrario: `calc(100%-2rem)` sin espacios es CSS
          // inválido y el navegador lo descarta en silencio.
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10 sm:max-w-lg',
          'transition-all duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-md p-0.5 text-muted-foreground opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Cerrar"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // El pie es una BARRA a sangre: los márgenes negativos compensan
        // el `p-4` del contenedor para que el fondo llegue hasta el borde
        // y el `rounded-b-xl` case con la esquina del diálogo.
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
