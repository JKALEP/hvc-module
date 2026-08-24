/**
 * Encabezado uppercase que agrupa un bloque de carpetas
 * ("Propias", "Compartidas", etc.). Repetido igual en `Fotos.tsx`
 * y `Portal.tsx`; ahora es una sola pieza.
 */
export function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}