import { useState } from 'react';
import {
  CameraOffIcon,
  CheckIcon,
  ListPlusIcon,
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
  useActividades,
  useCrearActividad,
  useMarcarActividad,
  useEliminarActividad,
} from '@/modules/fotos/hooks/useActividades';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { HiloComentarios } from './HiloComentarios';
import { DialogoActividad } from './DialogoActividad';
import { DialogoDesdeCatalogo } from './DialogoDesdeCatalogo';
import { FotosDeActividad } from './FotosDeActividad';
import type {
  EstadoActividad,
  PrioridadActividad,
  PermisoCarpeta,
  Actividad,
} from '@/modules/fotos/types';

const ETIQUETA_ESTADO: Record<EstadoActividad, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

/**
 * Qué le falta a la evidencia de una actividad, en una línea.
 *
 * ⚠️ No dice el TIPO («Antes/después») sino lo que FALTA («Falta el
 * después»): el tipo por sí solo no le sirve a nadie en una lista, y lo que
 * se está buscando al mirar es qué queda por hacer. Misma decisión, y mismos
 * textos, que en la exportación — si divergen, el papel y la pantalla dejan
 * de decir lo mismo.
 */
function ETIQUETA_EVIDENCIA(a: Actividad) {
  if (a.evidencia === 'UNA') return 'Falta la foto';
  if (a.tieneAntes) return 'Falta el después';
  if (a.tieneDespues) return 'Falta el antes';
  return 'Faltan antes y después';
}

/**
 * Tono de la prioridad. NO usa la escalera de `personal/lib/umbrales.ts`:
 * aquélla traduce PORCENTAJES contra un objetivo, y esto es un enum de tres
 * valores sin nada que medir. Es el mismo criterio por el que el mapa
 * ALTA/MEDIA/BAJA de `ListaAlertas` tampoco vive allí.
 */
const VARIANTE_PRIORIDAD: Record<
  PrioridadActividad,
  'secondary' | 'outline' | 'warning'
> = {
  BAJA: 'secondary',
  MEDIA: 'outline',
  ALTA: 'warning',
};

/**
 * Las actividades de un equipo (§13).
 *
 * Solo se pinta dentro de una carpeta de tipo EQUIPO, que es donde §13 las
 * pide y lo único que el backend admite.
 *
 * El permiso LLEGA, no se calcula: `permiso` es el de la carpeta, ya
 * resuelto por el servidor con la cascada de §25. Aquí solo se decide qué
 * botones existen, con la misma tabla que hace cumplir el service.
 */
export function PanelActividades({
  cicloId,
  cicloCerrado,
  permiso,
  ramaCerrada,
  portal = false,
}: {
  /** La visita que se está mirando. Las actividades son suyas, no de la carpeta. */
  cicloId: number;
  /**
   * El segundo candado, y NO es el permiso.
   *
   * Una rama archivada dice «esta obra terminó»; un ciclo cerrado dice «esta
   * visita terminó». Los dos apagan la escritura y pueden darse por
   * separado, así que llegan por separado y el aviso de cada uno es
   * distinto: del archivado no se sale desde aquí, del ciclo sí —reabriendo,
   * que es una decisión con su entrada en la bitácora—.
   */
  cicloCerrado: boolean;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  /** Portal del cliente (§22): lee por otras rutas y nunca escribe. */
  portal?: boolean;
}) {
  const { usuario } = useAuth();
  const { data: actividades, isError } = useActividades(cicloId, { portal });
  const crear = useCrearActividad();
  const marcar = useMarcarActividad();
  const eliminar = useEliminarActividad();

  const [titulo, setTitulo] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);
  // `undefined` = cerrado · `null` = crear · actividad = editarla. Tres estados
  // de UN diálogo, igual que en `DialogoAlbum`.
  const [enEdicion, setEnEdicion] = useState<Actividad | null | undefined>(
    undefined,
  );
  const [desdeCatalogo, setDesdeCatalogo] = useState(false);

  // ⚠️ En el portal la escritura se apaga SIEMPRE, no se deduce del grado.
  // A un cliente se le puede compartir con EDICION (§10 lo permite), pero
  // `PortalController` no tiene ni una ruta de escritura: pintarle un botón
  // sería prometer algo que responde 404. El grado sigue mandando dentro del
  // módulo interno; aquí manda el portal.
  const puedeEscribir =
    !portal && alcanza(permiso, 'EDICION') && !ramaCerrada && !cicloCerrado;
  const puedeModerar =
    !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada && !cicloCerrado;

  const anadir = () => {
    const limpio = titulo.trim();
    if (!limpio) return;
    crear.mutate(
      { cicloId, payload: { titulo: limpio } },
      { onSuccess: () => setTitulo('') },
    );
  };

  if (!actividades && !isError)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );

  return (
    <PanelFotos as="section" denso>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium text-foreground">
          {portal ? 'Actividades' : 'Actividades del equipo'}
          {actividades && actividades.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {actividades.filter((t) => t.estado !== 'COMPLETADA').length}{' '}
              pendiente(s) de {actividades.length}
            </span>
          )}
        </h2>

        {/* No en el portal: `PortalController` no tiene ruta de exportación,
            así que el botón prometería un 404. Es el mismo criterio con el
            que 9c apagó ahí toda la escritura. Y no si no hay nada: un
            archivo con cero filas no le sirve a nadie. */}
        {/* Traer del catálogo (Fase 2). Va arriba, junto a exportar, y no
            abajo con el campo de «Nueva actividad»: aquélla escribe UNA a
            mano y ésta trae varias de golpe, que son dos gestos distintos. */}
        {puedeEscribir && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDesdeCatalogo(true)}
          >
            <ListPlusIcon className="size-4" />
            Del catálogo
          </Button>
        )}

        {!portal && actividades && actividades.length > 0 && (
          <BotonesExportar
            ruta={`/fotos/ciclo/${cicloId}/actividad/exportar`}
            nombre="actividades"
          />
        )}
      </div>

      {/* Un ciclo cerrado se lee entero pero no se toca. Se dice aquí, junto a
          la lista, y no arriba con el selector: es donde alguien va a
          intentar escribir. */}
      {cicloCerrado && !portal && (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Este ciclo está cerrado: se puede consultar, no modificar. Para
          corregir algo hay que reabrirlo, y queda registrado.
        </p>
      )}

      {actividades?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay actividades en esta visita.
        </p>
      )}

      <ul className="space-y-2">
        {actividades?.map((t) => (
          <FilaActividad
            key={t.id}
            actividad={t}
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
        <DialogoActividad
          // El `key` hace que arranque con los datos ya dentro. Ver su cabecera.
          key={enEdicion?.id ?? 'nueva'}
          cicloId={cicloId}
          actividad={enEdicion}
          abierto
          onCerrar={() => setEnEdicion(undefined)}
        />
      )}

      {desdeCatalogo && (
        <DialogoDesdeCatalogo
          cicloId={cicloId}
          yaPuestas={new Set((actividades ?? []).map((a) => a.titulo))}
          onCerrar={() => setDesdeCatalogo(false)}
        />
      )}

      {puedeEscribir && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Nueva actividad…"
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
 * Una actividad. Fuera del render del panel a propósito: declararla dentro la
 * convertiría en un componente nuevo en cada pasada y React remontaría la
 * lista entera —con el hilo de comentarios abierto— al escribir una letra
 * en «Nueva actividad».
 */
function FilaActividad({
  actividad,
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
  actividad: Actividad;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  puedeEscribir: boolean;
  puedeModerar: boolean;
  /** Para distinguir la actividad propia de la ajena al borrar. */
  usuarioId: number | null;
  portal: boolean;
  abierta: boolean;
  onAlternar: () => void;
  onMarcar: () => void;
  onEliminar: () => void;
  onEditar: () => void;
}) {
  const completada = actividad.estado === 'COMPLETADA';

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        {/* El check visual de §13: un clic completa o reabre, y el servidor
            registra fecha/hora y quién fue. Deshabilitado sin EDICION en
            vez de oculto: quien solo mira necesita ver qué está hecho. */}
        {/* En el PORTAL es un INDICADOR, no un botón: un cliente no completa
            actividades, y una casilla deshabilitada invita a pulsarla y a
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
                ? `Reabrir ${actividad.titulo}`
                : `Completar ${actividad.titulo}`
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
            {actividad.titulo}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={completada ? 'secondary' : 'outline'}>
              {ETIQUETA_ESTADO[actividad.estado]}
            </Badge>
            {actividad.prioridad && (
              <Badge variant={VARIANTE_PRIORIDAD[actividad.prioridad]}>
                {actividad.prioridad}
              </Badge>
            )}
            {/* ⚠️ La señal de evidencia (Fase 3). Es un AVISO, no un bloqueo:
                la actividad se completa igual, y el aviso sigue ahí. Se pinta
                en `warning` y no en `destructive` porque «falta documentar»
                no es un fallo del equipo, es trabajo del expediente. */}
            {actividad.faltaEvidencia && (
              <Badge variant="warning" title={ETIQUETA_EVIDENCIA(actividad)}>
                <CameraOffIcon className="size-3" />
                {ETIQUETA_EVIDENCIA(actividad)}
              </Badge>
            )}
            {actividad.responsable && <span>{actividad.responsable.nombre}</span>}
            {actividad.fecha && <span>{formatFechaCorta(actividad.fecha)}</span>}
          </div>

          {/* Lo que §13 pide registrar del check: cuándo y quién. */}
          {completada && actividad.completadaPor && actividad.completadaEn && (
            <p className="mt-1 text-xs text-muted-foreground">
              Completada por {actividad.completadaPor.nombre} ·{' '}
              {formatActualizado(actividad.completadaEn)}
            </p>
          )}

          {actividad.descripcion && (
            <p className="mt-1 text-sm text-muted-foreground">
              {actividad.descripcion}
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
                actividad: sus fotos y su conversación. Dos botones separados
                partirían en dos lo que se mira junto —qué se hizo y qué se
                dijo— y doblarían el ruido en una lista de diez actividades. */}
            {actividad._count.fotos === 0 && actividad._count.comentarios === 0
              ? 'Ver detalle'
              : [
                  actividad._count.fotos > 0 && `${actividad._count.fotos} foto(s)`,
                  actividad._count.comentarios > 0 &&
                    `${actividad._count.comentarios} comentario(s)`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Button>

          {abierta && (
            <div className="mt-2 space-y-3">
              {/* §15: lo que documenta el trabajo va primero, y la
                  conversación debajo. */}
              <FotosDeActividad
                actividadId={actividad.id}
                evidencia={actividad.evidencia}
                puedeSubir={puedeEscribir}
                permiso={permiso}
                ramaCerrada={ramaCerrada}
                portal={portal}
              />
              <HiloComentarios
                entidad="actividad"
                entidadId={actividad.id}
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
            actividad no vería el botón para retirarla. */}
        {puedeEscribir && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Editar ${actividad.titulo}`}
            title={`Editar ${actividad.titulo}`}
            onClick={onEditar}
          >
            <PencilIcon />
          </Button>
        )}

        {(actividad.creadoPor.id === usuarioId ? puedeEscribir : puedeModerar) && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Eliminar ${actividad.titulo}`}
            title={`Eliminar ${actividad.titulo}`}
            onClick={onEliminar}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </li>
  );
}
