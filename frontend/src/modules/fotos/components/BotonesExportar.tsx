import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { descargarArchivo } from '@/shared/services/descarga';
import { getErrorMessage } from '@/shared/services/api';

/**
 * Bajar algo de Fotos en Excel o PDF (§69).
 *
 * Es una acción imperativa —se pulsa y pasa algo—, no una consulta: el
 * archivo se genera en el momento y no queda copia, así que no hay nada que
 * cachear. Por eso `useMutation`, y el `isPending` lo lleva la librería.
 *
 * ⚠️ **Es un gemelo del `BotonesExportar` de Costos, y la duplicación es
 * deliberada.** Lo que de verdad se comparte —`descargarArchivo`— ya vive en
 * `shared/services/descarga.ts`, que es donde tiene que estar; lo que se
 * repite son estos dos botones y el `useMutation` que los mueve. Por la
 * convención del proyecto, un componente que usan DOS módulos debería subir a
 * `shared/`, y subirlo obligaría a reescribir los imports de Costos — que es
 * un módulo cerrado y verificado que no se toca. Cuando se levante esa
 * congelación, estos dos archivos se funden en uno en `shared/components/`.
 *
 * Los dos formatos como dos botones y no un desplegable, mismo criterio que
 * allá: son dos intenciones distintas y ninguna es «la normal». El Excel se
 * abre para seguir trabajando; el PDF se manda o se archiva.
 *
 * El nombre del archivo lo decide el SERVIDOR —viene en
 * `Content-Disposition`, ya desinfectado— y `nombre` es solo el respaldo por
 * si esa cabecera no llegara.
 */
export function BotonesExportar({
  ruta,
  nombre,
  size = 'sm',
}: {
  /** Ruta del backend SIN `?formato=`; lo añade cada botón. */
  ruta: string;
  nombre: string;
  size?: 'sm' | 'default';
}) {
  const exportar = useMutation({
    mutationFn: ({ ruta, nombre }: { ruta: string; nombre: string }) =>
      descargarArchivo(ruta, nombre),
    onSuccess: (nombre) => toast.success(`Se descargó ${nombre}`),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo generar el archivo')),
  });

  // El separador depende de si la ruta ya trae filtros: exportar «lo que
  // estoy viendo» significa que la ruta puede llegar con `?estado=…`, y
  // añadirle otro `?` la rompería en silencio.
  const uno = ruta.includes('?') ? '&' : '?';
  const con = (formato: string) => `${ruta}${uno}formato=${formato}`;
  const enCurso = exportar.isPending ? exportar.variables?.ruta : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size={size}
        disabled={exportar.isPending}
        onClick={() =>
          exportar.mutate({ ruta: con('excel'), nombre: `${nombre}.xlsx` })
        }
      >
        {enCurso === con('excel') ? <Spinner /> : <FileSpreadsheetIcon />}
        Excel
      </Button>
      <Button
        variant="outline"
        size={size}
        disabled={exportar.isPending}
        onClick={() =>
          exportar.mutate({ ruta: con('pdf'), nombre: `${nombre}.pdf` })
        }
      >
        {enCurso === con('pdf') ? <Spinner /> : <FileTextIcon />}
        PDF
      </Button>
    </div>
  );
}
