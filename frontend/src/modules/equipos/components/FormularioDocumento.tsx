import { useState } from 'react';
import { SaveIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { ETIQUETA_DOCUMENTO } from '@/modules/equipos/lib/documentos';
import type {
  TipoDocumento,
  EquipoFila,
  Incidencia,
  GuardarDocumentoPayload,
} from '@/modules/equipos/types';

/**
 * La cabecera de una cotización u orden de compra nueva.
 *
 * Solo pide proveedor y a qué se refiere. **Las líneas no se piden
 * aquí**: se escriben después en la vista del documento, que es donde se
 * ven sumar. Pedirlas en un diálogo obligaría a tener el presupuesto
 * completo antes de poder guardar nada.
 */
export function FormularioDocumento({
  tipo,
  organizacionId,
  equipos,
  incidencias,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  tipo: TipoDocumento;
  organizacionId: number;
  equipos: EquipoFila[];
  incidencias: Incidencia[];
  ocupado: boolean;
  onGuardar: (datos: GuardarDocumentoPayload) => void;
  onCerrar: () => void;
}) {
  const [proveedor, setProveedor] = useState('');
  const [equipoId, setEquipoId] = useState<number | null>(null);
  const [incidenciaId, setIncidenciaId] = useState<number | null>(null);

  const etiqueta = ETIQUETA_DOCUMENTO[tipo].singular;

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva {etiqueta.toLowerCase()}</DialogTitle>
          <DialogDescription>
            El código se asigna solo. Las líneas y el total se escriben después,
            en el documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Proveedor<span className="text-destructive"> *</span>
            </label>
            <Input
              className="h-9"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="A quién se le pide"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Equipo
              </label>
              <Select
                className="h-9"
                value={equipoId ?? ''}
                onChange={(e) =>
                  setEquipoId(
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              >
                <option value="">Ninguno</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigoInterno ?? `Equipo ${e.id}`} · {e.nodo.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Incidencia
              </label>
              <Select
                className="h-9"
                value={incidenciaId ?? ''}
                onChange={(e) =>
                  setIncidenciaId(
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              >
                <option value="">Ninguna</option>
                {incidencias.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.codigo} · {i.tipo}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={proveedor.trim() === '' || ocupado}
            onClick={() =>
              onGuardar({
                organizacionId,
                proveedor: proveedor.trim(),
                equipoId,
                incidenciaId,
                lineas: [],
              })
            }
          >
            {ocupado ? <Spinner /> : <SaveIcon />}
            Crear y abrir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
