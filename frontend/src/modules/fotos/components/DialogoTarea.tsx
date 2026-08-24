import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import {
  useCrearTarea,
  useEditarTarea,
  useAsignables,
} from '@/modules/fotos/hooks/useTareas';
import type {
  EstadoTarea,
  PrioridadTarea,
  Tarea,
} from '@/modules/fotos/types';

const ESTADOS: { valor: EstadoTarea; etiqueta: string }[] = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'COMPLETADA', etiqueta: 'Completada' },
];

const PRIORIDADES: { valor: PrioridadTarea; etiqueta: string }[] = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'MEDIA', etiqueta: 'Media' },
  { valor: 'ALTA', etiqueta: 'Alta' },
];

/**
 * El formulario completo de una tarea (§13).
 *
 * §13 pide título, descripción, estado, prioridad, fecha y responsable. La
 * alta rápida del panel solo pide el título —en obra se apunta lo que hay
 * que hacer y se detalla después—, así que este diálogo es el que expone el
 * resto, y el MISMO sirve para crear y para editar: es el mismo formulario
 * con los campos llenos o vacíos.
 *
 * ⚠️ Cambiar el estado a COMPLETADA aquí registra fecha y autor igual que
 * la casilla del panel: el backend rellena las tres columnas por los dos
 * caminos. Si solo lo hiciera el check, editar el estado desde aquí dejaría
 * una tarea «completada» sin saber por quién.
 *
 * Como `DialogoAlbum`, el estado arranca de la tarea y no se sincroniza con
 * un efecto: quien lo monta le pone un `key` distinto por tarea.
 */
export function DialogoTarea({
  carpetaId,
  tarea,
  abierto,
  onCerrar,
}: {
  carpetaId: number;
  /** null = crear una nueva. */
  tarea: Tarea | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const crear = useCrearTarea();
  const editar = useEditarTarea();
  const { data: asignables } = useAsignables(abierto);

  const editando = tarea !== null;
  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
  const [estado, setEstado] = useState<EstadoTarea>(tarea?.estado ?? 'PENDIENTE');
  const [prioridad, setPrioridad] = useState<PrioridadTarea | ''>(
    tarea?.prioridad ?? '',
  );
  const [fecha, setFecha] = useState(tarea?.fecha ?? '');
  const [responsableId, setResponsableId] = useState<string>(
    tarea?.responsable ? String(tarea.responsable.id) : '',
  );

  const guardar = () => {
    const limpio = titulo.trim();
    if (!limpio) return;

    const payload = {
      titulo: limpio,
      descripcion: descripcion.trim() || null,
      estado,
      prioridad: prioridad === '' ? null : prioridad,
      fecha: fecha || null,
      responsableId: responsableId === '' ? null : Number(responsableId),
    };

    if (editando)
      editar.mutate({ id: tarea.id, payload }, { onSuccess: onCerrar });
    else crear.mutate({ carpetaId, payload }, { onSuccess: onCerrar });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Los cambios se registran en la bitácora con el valor anterior.'
              : 'Solo el título es obligatorio: lo demás se puede completar después.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Título <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Revisar estado estructural"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Descripción <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Chasis, anclajes y soldaduras"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Estado
              </label>
              <Select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoTarea)}
              >
                {ESTADOS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Prioridad{' '}
                <span className="text-muted-foreground">(opcional)</span>
              </label>
              <Select
                value={prioridad}
                onChange={(e) =>
                  setPrioridad(e.target.value as PrioridadTarea | '')
                }
              >
                <option value="">Sin prioridad</option>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Responsable{' '}
                <span className="text-muted-foreground">(opcional)</span>
              </label>
              <Select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {(asignables ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Fecha <span className="text-muted-foreground">(opcional)</span>
              </label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* El día del trabajo, no el de creación: se apunta hoy lo que toca
              hacer el jueves, y el listado se ordena por eso. */}
          <p className="text-xs text-muted-foreground">
            La fecha es el día al que corresponde el trabajo, no el de hoy.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={!titulo.trim() || crear.isPending || editar.isPending}
          >
            {editando ? 'Guardar' : 'Crear tarea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
