import { useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import { formatActualizado, formatFechaCorta } from '@/shared/lib/format';
import {
  useTareas,
  useCrearTarea,
  useMarcarTarea,
  useEliminarTarea,
} from '@/modules/fotos/hooks/useTareas';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { HiloComentarios } from './HiloComentarios';
import type {
  EstadoTarea,
  PrioridadTarea,
  PermisoCarpeta,
  Tarea,
} from '@/modules/fotos/types';

const ETIQUETA_ESTADO: Record<EstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

/**
 * Tono de la prioridad. NO usa la escalera de `personal/lib/umbrales.ts`:
 * aquélla traduce PORCENTAJES contra un objetivo, y esto es un enum de tres
 * valores sin nada que medir. Es el mismo criterio por el que el mapa
 * ALTA/MEDIA/BAJA de `ListaAlertas` tampoco vive allí.
 */
const VARIANTE_PRIORIDAD: Record<
  PrioridadTarea,
  'secondary' | 'outline' | 'warning'
> = {
  BAJA: 'secondary',
  MEDIA: 'outline',
  ALTA: 'warning',
};

/**
 * Las tareas de un equipo (§13).
 *
 * Solo se pinta dentro de una carpeta de tipo EQUIPO, que es donde §13 las
 * pide y lo único que el backend admite.
 *
 * El permiso LLEGA, no se calcula: `permiso` es el de la carpeta, ya
 * resuelto por el servidor con la cascada de §25. Aquí solo se decide qué
 * botones existen, con la misma tabla que hace cumplir el service.
 */
export function PanelTareas({
  carpetaId,
  permiso,
  ramaCerrada,
}: {
  carpetaId: number;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
}) {
  const { usuario } = useAuth();
  const { data: tareas, isError } = useTareas(carpetaId);
  const crear = useCrearTarea();
  const marcar = useMarcarTarea();
  const eliminar = useEliminarTarea();

  const [titulo, setTitulo] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);

  const puedeEscribir = alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeModerar = alcanza(permiso, 'TOTAL') && !ramaCerrada;

  const anadir = () => {
    const limpio = titulo.trim();
    if (!limpio) return;
    crear.mutate(
      { carpetaId, payload: { titulo: limpio } },
      { onSuccess: () => setTitulo('') },
    );
  };

  if (!tareas && !isError)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 font-medium text-foreground">
        Tareas del equipo
        {tareas && tareas.length > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
            {tareas.filter((t) => t.estado !== 'COMPLETADA').length} pendiente(s)
            de {tareas.length}
          </span>
        )}
      </h2>

      {tareas?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay tareas para este equipo.
        </p>
      )}

      <ul className="space-y-2">
        {tareas?.map((t) => (
          <FilaTarea
            key={t.id}
            tarea={t}
            permiso={permiso}
            ramaCerrada={ramaCerrada}
            puedeEscribir={puedeEscribir}
            puedeModerar={puedeModerar}
            usuarioId={usuario?.id ?? null}
            abierta={abierta === t.id}
            onAlternar={() => setAbierta(abierta === t.id ? null : t.id)}
            onMarcar={() =>
              marcar.mutate({
                id: t.id,
                completada: t.estado !== 'COMPLETADA',
              })
            }
            onEliminar={() => eliminar.mutate(t.id)}
          />
        ))}
      </ul>

      {puedeEscribir && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Nueva tarea…"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadir()}
          />
          <Button onClick={anadir} disabled={!titulo.trim() || crear.isPending}>
            <PlusIcon />
            Añadir
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Una tarea. Fuera del render del panel a propósito: declararla dentro la
 * convertiría en un componente nuevo en cada pasada y React remontaría la
 * lista entera —con el hilo de comentarios abierto— al escribir una letra
 * en «Nueva tarea».
 */
function FilaTarea({
  tarea,
  permiso,
  ramaCerrada,
  puedeEscribir,
  puedeModerar,
  usuarioId,
  abierta,
  onAlternar,
  onMarcar,
  onEliminar,
}: {
  tarea: Tarea;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  puedeEscribir: boolean;
  puedeModerar: boolean;
  /** Para distinguir la tarea propia de la ajena al borrar. */
  usuarioId: number | null;
  abierta: boolean;
  onAlternar: () => void;
  onMarcar: () => void;
  onEliminar: () => void;
}) {
  const completada = tarea.estado === 'COMPLETADA';

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        {/* El check visual de §13: un clic completa o reabre, y el servidor
            registra fecha/hora y quién fue. Deshabilitado sin EDICION en
            vez de oculto: quien solo mira necesita ver qué está hecho. */}
        <button
          type="button"
          onClick={onMarcar}
          disabled={!puedeEscribir}
          aria-label={
            completada ? `Reabrir ${tarea.titulo}` : `Completar ${tarea.titulo}`
          }
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
            completada
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input',
            puedeEscribir ? 'hover:border-primary' : 'cursor-not-allowed opacity-60',
          )}
        >
          {completada && <CheckIcon className="size-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium text-foreground',
              completada && 'text-muted-foreground line-through',
            )}
          >
            {tarea.titulo}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={completada ? 'secondary' : 'outline'}>
              {ETIQUETA_ESTADO[tarea.estado]}
            </Badge>
            {tarea.prioridad && (
              <Badge variant={VARIANTE_PRIORIDAD[tarea.prioridad]}>
                {tarea.prioridad}
              </Badge>
            )}
            {tarea.responsable && <span>{tarea.responsable.nombre}</span>}
            {tarea.fecha && <span>{formatFechaCorta(tarea.fecha)}</span>}
          </div>

          {/* Lo que §13 pide registrar del check: cuándo y quién. */}
          {completada && tarea.completadaPor && tarea.completadaEn && (
            <p className="mt-1 text-xs text-muted-foreground">
              Completada por {tarea.completadaPor.nombre} ·{' '}
              {formatActualizado(tarea.completadaEn)}
            </p>
          )}

          {tarea.descripcion && (
            <p className="mt-1 text-sm text-muted-foreground">
              {tarea.descripcion}
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-1 -ml-2"
            onClick={onAlternar}
          >
            {abierta ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {tarea._count.comentarios === 0
              ? 'Comentar'
              : `${tarea._count.comentarios} comentario(s)`}
          </Button>

          {abierta && (
            <div className="mt-2">
              <HiloComentarios
                entidad="tarea"
                entidadId={tarea.id}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
              />
            </div>
          )}
        </div>

        {/* Borrar la PROPIA basta con EDICION; la ajena exige TOTAL. Es la
            misma distinción que §5 hace con las fotos, y la misma que hace
            cumplir el service — con `puedeModerar` a secas, quien creó una
            tarea no vería el botón para retirarla. */}
        {(tarea.creadoPor.id === usuarioId ? puedeEscribir : puedeModerar) && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Eliminar ${tarea.titulo}`}
            onClick={onEliminar}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </li>
  );
}
