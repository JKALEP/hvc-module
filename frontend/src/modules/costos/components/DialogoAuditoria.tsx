import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Spinner } from '@/shared/ui/spinner';
import { ListaEventos } from './ListaEventos';
import { useAuditoriaEntidad } from '@/modules/costos/hooks/useAuditoria';
import { ETIQUETA_ENTIDAD } from '@/modules/costos/lib/auditoria';
import type { EntidadCostos } from '@/modules/costos/types';

/**
 * La bitácora de UNA fila, sin salir de donde se estaba (§64).
 *
 * Existe para poder preguntar «¿quién desactivó este proveedor?» desde
 * la propia lista de proveedores, que es donde surge la pregunta. La
 * pantalla de auditoría completa sigue estando para lo demás.
 */
export function DialogoAuditoria({
  entidad,
  entidadId,
  nombre,
  onCerrar,
}: {
  entidad: EntidadCostos;
  entidadId: number;
  /** Cómo se llama la fila, para que el título diga algo. */
  nombre: string;
  onCerrar: () => void;
}) {
  const { data, isError } = useAuditoriaEntidad(entidad, entidadId, true);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de {nombre}</DialogTitle>
          <DialogDescription>
            {ETIQUETA_ENTIDAD[entidad]} #{entidadId} — de lo más reciente
            hacia atrás.
          </DialogDescription>
        </DialogHeader>

        {!data && !isError && (
          <div className="flex justify-center p-8">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        )}

        {isError && (
          <p className="p-4 text-sm text-destructive">
            No se pudo cargar el historial.
          </p>
        )}

        {data && <ListaEventos eventos={data} mostrarEntidad={false} />}
      </DialogContent>
    </Dialog>
  );
}
