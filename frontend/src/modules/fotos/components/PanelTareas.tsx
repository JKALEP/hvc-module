import { useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';


import { PanelFotos } from '@/modules/fotos/components/PanelFotos';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { BotonesExportar } from '@/modules/fotos/components/BotonesExportar';
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
import { DialogoTarea } from './DialogoTarea';
import { FotosDeTarea } from './FotosDeTarea';
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
  portal = false,
}: {
  carpetaId: number;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  /** Portal del cliente (§22): lee por otras rutas y nunca escribe. */
  portal?: boolean;
}) {
  const { usuario } = useAuth();
  const { data: tareas, isError } = useTareas(carpetaId, { portal });
  const crear = useCrearTarea();
  const marcar = useMarcarTarea();
  const eliminar = useEliminarTarea();

  const [titulo, setTitulo] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);
  // `undefined` = cerrado · `null` = crear · tarea = editarla. Tres estados
  // de UN diálogo, igual que en `DialogoAlbum`.
  const [enEdicion, setEnEdicion] = useState<Tarea | null | undefined>(
    undefined,
  );

  // ⚠️ En el portal la escritura se apaga SIEMPRE, no se deduce del grado.
  // A un cliente se le puede compartir con EDICION (§10 lo permite), pero
  // `PortalController` no tiene ni una ruta de escritura: pintarle un botón
  // sería prometer algo que responde 404. El grado sigue mandando dentro del
  // módulo interno; aquí manda el portal.
  const puedeEscribir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeModerar = !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada;

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
    <PanelFotos as="section" denso>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium text-foreground">
          {portal ? 'Tareas' : 'Tareas del equipo'}
          {tareas && tareas.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {tareas.filter((t) => t.estado !== 'COMPLETADA').length}{' '}
              pendiente(s) de {tareas.length}
            </span>
          )}
        </h2>

        {/* No en el portal: `PortalController` no tiene ruta de exportación,
            así que el botón prometería un 404. Es el mismo criterio con el
            que 9c apagó ahí toda la escritura. Y no si no hay nada: un
            archivo con cero filas no le sirve a nadie. */}
        {!portal && tareas && tareas.length > 0 && (
          <BotonesExportar
            ruta={`/fotos/carpeta/${carpetaId}/tarea/exportar`}
            nombre="tareas"
          />
        )}
      </div>

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
            portal={portal}
            abierta={abierta === t.id}
            onAlternar={() => setAbierta(abierta === t.id ? null : t.id)}
            onMarcar={() =>
              marcar.mutate({
                id: t.id,
                completada: t.estado !== 'COMPLETADA',
              })
            }
            onEliminar={() => eliminar.mutate(t.id)}
            onEditar={() => setEnEdicion(t)}
          />
        ))}
      </ul>

      {enEdicion !== undefined && (
        <DialogoTarea
          // El `key` hace que arranque con los datos ya dentro. Ver su cabecera.
          key={enEdicion?.id ?? 'nueva'}
          carpetaId={carpetaId}
          tarea={enEdicion}
          abierto
          onCerrar={() => setEnEdicion(undefined)}
        />
      )}

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
          {/* La alta rápida pide solo el título —en obra se apunta y ya—; el
              formulario completo de §13 está a un clic para cuando hace falta
              asignar responsable, prioridad o fecha. */}
          <Button variant="outline" onClick={() => setEnEdicion(null)}>
            Con detalle…
          </Button>
        </div>
      )}
    </PanelFotos>
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
  portal,
  abierta,
  onAlternar,
  onMarcar,
  onEliminar,
  onEditar,
}: {
  tarea: Tarea;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  puedeEscribir: boolean;
  puedeModerar: boolean;
  /** Para distinguir la tarea propia de la ajena al borrar. */
  usuarioId: number | null;
  portal: boolean;
  abierta: boolean;
  onAlternar: () => void;
  onMarcar: () => void;
  onEliminar: () => void;
  onEditar: () => void;
}) {
  const completada = tarea.estado === 'COMPLETADA';

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        {/* El check visual de §13: un clic completa o reabre, y el servidor
            registra fecha/hora y quién fue. Deshabilitado sin EDICION en
            vez de oculto: quien solo mira necesita ver qué está hecho. */}
        {/* En el PORTAL es un INDICADOR, no un botón: un cliente no completa
            tareas, y una casilla deshabilitada invita a pulsarla y a
            preguntarse por qué no pasa nada. Dentro del módulo sí es un
            botón, deshabilitado sin EDICION —quien solo mira necesita ver
            qué está hecho—.

            ⚠️ Se renderiza uno U OTRO, no se oculta con una clase: `cn` usa
            twMerge, que ante `hidden` y `flex` se queda con el ÚLTIMO, así
            que la clase no ganaba y se pintaban los dos. */}
        {portal ? (
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border',
              completada
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input',
            )}
          >
            {completada && <CheckIcon className="size-3.5" />}
          </span>
        ) : (
          <button
            type="button"
            onClick={onMarcar}
            disabled={!puedeEscribir}
            aria-label={
              completada
                ? `Reabrir ${tarea.titulo}`
                : `Completar ${tarea.titulo}`
            }
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
              completada
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input',
              puedeEscribir
                ? 'hover:border-primary'
                : 'cursor-not-allowed opacity-60',
            )}
          >
            {completada && <CheckIcon className="size-3.5" />}
          </button>
        )}

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
            {/* Un solo desplegable para las dos cosas que cuelgan de la
                tarea: sus fotos y su conversación. Dos botones separados
                partirían en dos lo que se mira junto —qué se hizo y qué se
                dijo— y doblarían el ruido en una lista de diez tareas. */}
            {tarea._count.fotos === 0 && tarea._count.comentarios === 0
              ? 'Ver detalle'
              : [
                  tarea._count.fotos > 0 && `${tarea._count.fotos} foto(s)`,
                  tarea._count.comentarios > 0 &&
                    `${tarea._count.comentarios} comentario(s)`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Button>

          {abierta && (
            <div className="mt-2 space-y-3">
              {/* §15: lo que documenta el trabajo va primero, y la
                  conversación debajo. */}
              <FotosDeTarea
                tareaId={tarea.id}
                puedeSubir={puedeEscribir}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
                portal={portal}
              />
              <HiloComentarios
                entidad="tarea"
                entidadId={tarea.id}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
                portal={portal}
              />
            </div>
          )}
        </div>

        {/* Borrar la PROPIA basta con EDICION; la ajena exige TOTAL. Es la
            misma distinción que §5 hace con las fotos, y la misma que hace
            cumplir el service — con `puedeModerar` a secas, quien creó una
            tarea no vería el botón para retirarla. */}
        {puedeEscribir && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Editar ${tarea.titulo}`}
            title={`Editar ${tarea.titulo}`}
            onClick={onEditar}
          >
            <PencilIcon />
          </Button>
        )}

        {(tarea.creadoPor.id === usuarioId ? puedeEscribir : puedeModerar) && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Eliminar ${tarea.titulo}`}
            title={`Eliminar ${tarea.titulo}`}
            onClick={onEliminar}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </li>
  );
}
