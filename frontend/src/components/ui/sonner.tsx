import { Toaster as Sonner } from 'sonner';

// Wrapper del Toaster de sonner. richColors da verde=éxito / rojo=error automáticamente.
function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:shadow-lg',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
