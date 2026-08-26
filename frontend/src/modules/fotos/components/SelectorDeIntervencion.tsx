import { LockIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { formatFechaCorta } from '@/shared/lib/format';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { ESTADO_A_VARIANTE } from '@/modules/fotos/lib/colores';
import { useEstadosEquipo } from '@/modules/fotos/hooks/useEstadosEquipo';
import {
  useAbrirIntervencion,
  useCerrarIntervencion,
  useReabrirIntervencion,
  useCambiarEstadoIntervencion,
} from '@/modules/fotos/hooks/useIntervenciones';
import type { Intervencion, PermisoCarpeta } from '@/modules/fotos/types';

/** El `<select>` desnudo del sistema. Mismo alto y foco que el `Input`. */
const CLASES_SELECT =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm ' +
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * La cabecera de un equipo: qué intervención se está mirando y cómo quedó.
 *
 * Es lo primero que se ve al abrir un equipo porque todo lo de dentro
 * —actividades, y en fases siguientes evidencia y observaciones— pertenece a
 * UNA intervención, y mirar la lista sin saber cuál se está mirando es el error
 * que este componente existe para hacer imposible.
 *
 * ⚠️ **El estado del equipo se edita solo en la intervención EN CURSO.** Una intervención
 * cerrada es historial: decía «inoperativo» el día que se cerró y eso no se
 * retoca sin reabrirlo. El `<select>` se deshabilita en vez de esconderse,
 * para que el valor siga leyéndose.
 */
export function SelectorDeIntervencion({
  carpetaId,
  intervenciones,
  intervencionId,
  onElegir,
  permiso,
  ramaCerrada,
  portal = false,
}: {
  carpetaId: number;
  /** El historial, del más reciente al más antiguo, como lo manda el backend. */
  intervenciones: Intervencion[] | undefined;
  intervencionId: number | null;
  onElegir: (id: number) => void;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  /** Portal del cliente (§22): se lee, no se escribe. */
  portal?: boolean;
}) {
  const abrir = useAbrirIntervencion();
  const cerrar = useCerrarIntervencion();
  const reabrir = useReabrirIntervencion();
  const cambiarEstado = useCambiarEstadoIntervencion();
  // Solo los activos: un estado retirado no se vuelve a ofrecer, aunque el
  // intervención que ya lo tenía lo conserve.
  const { data: estados } = useEstadosEquipo(true);

  if (!intervenciones)
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );

  const actual = intervenciones.find((c) => c.id === intervencionId) ?? intervenciones[0] ?? null;
  const hayAbierto = intervenciones.some((c) => c.cerradoEn === null);
  const puedeEscribir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const enCurso = actual !== null && actual.cerradoEn === null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <label className="text-sm text-muted-foreground" htmlFor="intervencion">
        Intervención
      </label>
      <select
        id="intervencion"
        className={CLASES_SELECT}
        value={actual?.id ?? ''}
        onChange={(e) => onElegir(Number(e.target.value))}
      >
        {intervenciones.map((c) => (
          <option key={c.id} value={c.id}>
            Intervención {c.numero} · {formatFechaCorta(c.abiertoEn)}
            {c.cerradoEn ? ' (cerrada)' : ' (en curso)'}
          </option>
        ))}
      </select>

      {actual?.cerradoEn && (
        <Badge variant="secondary" className="gap-1">
          <LockIcon className="size-3" />
          Cerrada {formatFechaCorta(actual.cerradoEn)}
        </Badge>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <label className="text-sm text-muted-foreground" htmlFor="estado-equipo">
          Estado
        </label>
        {/* El estado vigente se pinta SIEMPRE como insignia, también en un
            intervención cerrada donde el select está apagado: es el dato que se
            viene a consultar. */}
        {actual?.estado ? (
          <Badge variant={ESTADO_A_VARIANTE[actual.estado.color]}>
            {actual.estado.nombre}
          </Badge>
        ) : (
          <Badge variant="outline">Sin definir</Badge>
        )}
        {puedeEscribir && (
          <select
            id="estado-equipo"
            className={CLASES_SELECT}
            value={actual?.estado?.id ?? ''}
            disabled={!enCurso || cambiarEstado.isPending || !actual}
            onChange={(e) =>
              actual &&
              cambiarEstado.mutate({
                intervencionId: actual.id,
                estadoId: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">— Sin definir —</option>
            {(estados ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        )}

        {puedeEscribir && enCurso && actual && (
          <Button
            variant="outline"
            size="sm"
            disabled={cerrar.isPending}
            onClick={() => cerrar.mutate(actual.id)}
          >
            <LockIcon className="size-4" />
            Cerrar intervencion
          </Button>
        )}

        {/* Reabrir vive junto a la intervención cerrada que se está mirando, y solo se
            ofrece si no hay otro en curso: con uno abierto el backend lo
            rechaza, y un botón que contesta 400 es peor que no tenerlo. */}
        {puedeEscribir && actual?.cerradoEn && !hayAbierto && (
          <Button
            variant="outline"
            size="sm"
            disabled={reabrir.isPending}
            onClick={() => reabrir.mutate(actual.id)}
          >
            <RotateCcwIcon className="size-4" />
            Reabrir
          </Button>
        )}

        {puedeEscribir && !hayAbierto && (
          <Button
            size="sm"
            disabled={abrir.isPending}
            onClick={() =>
              abrir.mutate(carpetaId, {
                // Al abrir se salta a la intervención nueva: es donde se va a
                // trabajar, y dejar la pantalla en la anterior invita a
                // escribir en el sitio equivocado.
                onSuccess: (c) => onElegir(c.id),
              })
            }
          >
            <PlusIcon className="size-4" />
            Nueva intervención
          </Button>
        )}
      </div>
    </div>
  );
}
