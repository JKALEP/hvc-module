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
import { Textarea } from '@/shared/ui/textarea';
import type {
  Incidencia,
  EquipoFila,
  GuardarIncidenciaPayload,
} from '@/modules/equipos/types';

/** Campo con etiqueta. Privado del formulario. */
function Campo({
  label,
  requerido,
  children,
}: {
  label: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {requerido && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Abrir o editar una incidencia.
 *
 * `tipo` y `prioridad` son campos de texto libre con sugerencias, no
 * desplegables cerrados: cada organización usa su propio vocabulario y
 * HVC todavía no fijó su catálogo. Las sugerencias salen de lo que ya se
 * escribió antes, así que la lista se va formando sola sin obligar a
 * nadie a configurarla.
 */
export function FormularioIncidencia({
  equipos,
  equipoFijo,
  incidencia,
  tiposUsados,
  prioridadesUsadas,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  equipos: EquipoFila[];
  /** Si se abre desde un equipo concreto, viene elegido y no se cambia. */
  equipoFijo?: number;
  incidencia?: Incidencia;
  tiposUsados: string[];
  prioridadesUsadas: string[];
  ocupado: boolean;
  onGuardar: (datos: GuardarIncidenciaPayload) => void;
  onCerrar: () => void;
}) {
  const [equipoId, setEquipoId] = useState<number | null>(
    incidencia?.equipoId ?? equipoFijo ?? null,
  );
  const [tipo, setTipo] = useState(incidencia?.tipo ?? '');
  const [prioridad, setPrioridad] = useState(incidencia?.prioridad ?? '');
  const [descripcion, setDescripcion] = useState(incidencia?.descripcion ?? '');
  const [observacion, setObservacion] = useState(incidencia?.observacion ?? '');
  const [recomendacion, setRecomendacion] = useState(
    incidencia?.recomendacion ?? '',
  );

  const falta =
    equipoId === null || tipo.trim() === '' || descripcion.trim() === '';

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {incidencia ? `Editar ${incidencia.codigo}` : 'Nueva incidencia'}
          </DialogTitle>
          <DialogDescription>
            Lo que le pasó a un equipo y qué se recomienda hacer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Equipo" requerido>
            <Select
              className="h-9"
              value={equipoId ?? ''}
              disabled={equipoFijo !== undefined || incidencia !== undefined}
              onChange={(e) =>
                setEquipoId(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Elegir…</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigoInterno ?? `Equipo ${e.id}`} · {e.nodo.nombre}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Tipo" requerido>
            <Input
              list="tipos-incidencia"
              className="h-9"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Correctivo"
            />
            <datalist id="tipos-incidencia">
              {tiposUsados.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>

          <Campo label="Prioridad">
            <Input
              list="prioridades-incidencia"
              className="h-9"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              placeholder="Alta"
            />
            <datalist id="prioridades-incidencia">
              {prioridadesUsadas.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Campo>

          <div className="sm:col-span-2">
            <Campo label="Descripción" requerido>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Qué se detectó."
              />
            </Campo>
          </div>

          <div className="sm:col-span-2">
            <Campo label="Observación">
              <Textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
              />
            </Campo>
          </div>

          <div className="sm:col-span-2">
            <Campo label="Recomendación">
              <Textarea
                value={recomendacion}
                onChange={(e) => setRecomendacion(e.target.value)}
                rows={2}
                placeholder="Qué debería hacerse."
              />
            </Campo>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={falta || ocupado}
            onClick={() =>
              onGuardar({
                equipoId: equipoId as number,
                tipo: tipo.trim(),
                prioridad: prioridad.trim() || null,
                descripcion: descripcion.trim(),
                observacion: observacion.trim() || null,
                recomendacion: recomendacion.trim() || null,
                responsableId: null,
              })
            }
          >
            {ocupado ? <Spinner /> : <SaveIcon />}
            {incidencia ? 'Guardar cambios' : 'Abrir incidencia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
