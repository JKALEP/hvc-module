import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { useExportar } from '@/modules/costos/hooks/useExportar';

/**
 * Bajar un documento en Excel o PDF (§69).
 *
 * Los dos formatos como dos botones y no un desplegable: son dos
 * intenciones distintas y ninguna es «la normal». El Excel se abre para
 * seguir trabajando con los números; el PDF se manda o se archiva.
 *
 * `ruta` sin el formato: lo añade cada botón. El nombre del archivo lo
 * decide el SERVIDOR —viene en `Content-Disposition`— porque es quien
 * sabe el número de pedido; `nombre` es solo el respaldo por si esa
 * cabecera no llegara.
 */
export function BotonesExportar({
  ruta,
  nombre,
  size = 'sm',
}: {
  /** Ruta del backend sin `?formato=`. */
  ruta: string;
  nombre: string;
  size?: 'sm' | 'default';
}) {
  const exportar = useExportar();
  const enCurso = exportar.isPending ? exportar.variables?.ruta : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size={size}
        disabled={exportar.isPending}
        onClick={() =>
          exportar.mutate({
            ruta: `${ruta}?formato=excel`,
            nombre: `${nombre}.xlsx`,
          })
        }
      >
        {enCurso === `${ruta}?formato=excel` ? (
          <Spinner />
        ) : (
          <FileSpreadsheetIcon />
        )}
        Excel
      </Button>
      <Button
        variant="outline"
        size={size}
        disabled={exportar.isPending}
        onClick={() =>
          exportar.mutate({
            ruta: `${ruta}?formato=pdf`,
            nombre: `${nombre}.pdf`,
          })
        }
      >
        {enCurso === `${ruta}?formato=pdf` ? <Spinner /> : <FileTextIcon />}
        PDF
      </Button>
    </div>
  );
}
