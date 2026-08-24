import { ArchiveIcon } from 'lucide-react';

/**
 * El aviso de "carpeta archivada". Antes estaba escrito idéntico, carácter
 * por carácter, en `Fotos.tsx` y `Portal.tsx`. Ahora es uno solo; cada
 * pantalla solo cambia el texto que va dentro, que sí varía según el
 * contexto (interno vs. cliente en el portal).
 */
export function AvisoArchivada({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
      <ArchiveIcon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}