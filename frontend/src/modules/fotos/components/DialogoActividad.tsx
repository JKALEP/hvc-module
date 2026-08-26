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
  useCrearActividad,
  useEditarActividad,
  useAsignables,
} from '@/modules/fotos/hooks/useActividades';
import type {
  EstadoActividad,
  PrioridadActividad,
  TipoEvidencia,
  Actividad,
} from '@/modules/fotos/types';

const ESTADOS: { valor: EstadoActividad; etiqueta: string }[] = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'COMPLETADA', etiqueta: 'Completada' },
];

const PRIORIDADES: { valor: PrioridadActividad; etiqueta: string }[] = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'MEDIA', etiqueta: 'Media' },
  { valor: 'ALTA', etiqueta: 'Alta' },
];

/**
 * Qué evidencia se le pide a la actividad (Fase 3).
 *
 * Las etiquetas dicen lo que se ESPERA, no el nombre del enum: «Una foto»
 * comunica; «UNA», no. Es la misma lista, con los mismos textos, que la
 * pantalla de administración del catálogo.
 */
const EVIDENCIAS: { valor: TipoEvidencia; etiqueta: string }[] = [
  { valor: 'NINGUNA', etiqueta: 'No se pide foto' },
  { valor: 'UNA', etiqueta: 'Una foto' },
  { valor: 'ANTES_DESPUES', etiqueta: 'Antes y después' },
];

/**
 * El formulario completo de una actividad (§13).
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
 * una actividad «completada» sin saber por quién.
 *
 * Como `DialogoAlbum`, el estado arranca de la actividad y no se sincroniza con
 * un efecto: quien lo monta le pone un `key` distinto por actividad.
 */
export function DialogoActividad({
  cicloId,
  actividad,
  abierto,
  onCerrar,
}: {
  /** La visita a la que se añade. Una actividad es de un ciclo, no de la carpeta. */
  cicloId: number;
  /** null = crear una nueva. */
  actividad: Actividad | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const crear = useCrearActividad();
  const editar = useEditarActividad();
  const { data: asignables } = useAsignables(abierto);

  const editando = actividad !== null;
  const [titulo, setTitulo] = useState(actividad?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(actividad?.descripcion ?? '');
  const [estado, setEstado] = useState<EstadoActividad>(actividad?.estado ?? 'PENDIENTE');
  const [prioridad, setPrioridad] = useState<PrioridadActividad | ''>(
    actividad?.prioridad ?? '',
  );
  // El defecto al crear es UNA, el mismo que el servidor: una actividad de
  // inspección escrita a mano casi siempre quiere su foto.
  const [evidencia, setEvidencia] = useState<TipoEvidencia>(
    actividad?.evidencia ?? 'UNA',
  );
  const [fecha, setFecha] = useState(actividad?.fecha ?? '');
  const [responsableId, setResponsableId] = useState<string>(
    actividad?.responsable ? String(actividad.responsable.id) : '',
  );

  const guardar = () => {
    const limpio = titulo.trim();
    if (!limpio) return;

    const payload = {
      titulo: limpio,
      descripcion: descripcion.trim() || null,
      estado,
      prioridad: prioridad === '' ? null : prioridad,
      evidencia,
      fecha: fecha || null,
      responsableId: responsableId === '' ? null : Number(responsableId),
    };

    if (editando)
      editar.mutate({ id: actividad.id, payload }, { onSuccess: onCerrar });
    else crear.mutate({ cicloId, payload }, { onSuccess: onCerrar });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar actividad' : 'Nueva actividad'}</DialogTitle>
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
                onChange={(e) => setEstado(e.target.value as EstadoActividad)}
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
                  setPrioridad(e.target.value as PrioridadActividad | '')
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
                Evidencia fotográfica
              </label>
              <Select
                value={evidencia}
                onChange={(e) => setEvidencia(e.target.value as TipoEvidencia)}
              >
                {EVIDENCIAS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </Select>
              {/* Lo importante que hay que decir aquí: no bloquea nada. */}
              <p className="text-xs text-muted-foreground">
                Se avisa si falta, pero no impide dar la actividad por
                completada.
              </p>
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
            {editando ? 'Guardar' : 'Crear actividad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
