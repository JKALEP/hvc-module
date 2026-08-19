import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { descargarArchivo } from '@/shared/services/descarga';
import { getErrorMessage } from '@/shared/services/api';

/**
 * Bajar un documento del módulo (§69).
 *
 * Es una acción imperativa —se pulsa y pasa algo—, no una consulta: no
 * hay nada que cachear porque el archivo se genera en el momento y no
 * queda copia. Por eso `useMutation` y no `useQuery`, igual que
 * `useAbrirReporte` en Personal.
 *
 * El `isPending` lo lleva la librería, que es justo lo que hace falta
 * cuando un PDF de veinte ítems tarda un segundo en armarse.
 */
export function useExportar() {
  return useMutation({
    mutationFn: ({ ruta, nombre }: { ruta: string; nombre: string }) =>
      descargarArchivo(ruta, nombre),
    onSuccess: (nombre) => toast.success(`Se descargó ${nombre}`),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo generar el archivo')),
  });
}
