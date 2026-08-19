import { HistoryIcon } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import {
  ETIQUETA_ACCION,
  ETIQUETA_ENTIDAD,
  tonoDeAccion,
} from '@/modules/costos/lib/auditoria';
import { formatFecha } from '@/shared/lib/format';
import type { EventoCostos } from '@/modules/costos/types';

/**
 * La bitácora, tal como quedó escrita (§64).
 *
 * Cada fila dice quién, qué, cuándo y —cuando el proceso lo exige— por
 * qué. Se muestra `usuarioNombre` y no el id: la columna existe
 * precisamente porque borrar una cuenta pone la FK a null, y una
 * auditoría que ya no sabe quién hizo qué no es una auditoría.
 *
 * Un cambio de campo se enseña como `antes → después` en vez de en
 * prosa: es lo que se guardó, y reescribirlo en una frase obligaría a
 * inventar redacciones distintas para cada campo.
 */
export function ListaEventos({
  eventos,
  /** En la vista por entidad la columna sobra: son todos de lo mismo. */
  mostrarEntidad = true,
  vacio = 'No hay movimientos registrados.',
}: {
  eventos: EventoCostos[];
  mostrarEntidad?: boolean;
  vacio?: string;
}) {
  if (eventos.length === 0)
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-8 text-center">
        <HistoryIcon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{vacio}</p>
      </div>
    );

  return (
    <ol className="divide-y divide-border rounded-xl border border-border">
      {eventos.map((e) => (
        <li key={e.id} className="space-y-1 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={tonoDeAccion(e.accion)}>
                {ETIQUETA_ACCION[e.accion]}
              </Badge>
              {mostrarEntidad && (
                <span className="text-xs text-muted-foreground">
                  {ETIQUETA_ENTIDAD[e.entidad]} #{e.entidadId}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {e.usuarioNombre ?? 'Alguien'} · {formatFecha(e.creadoEn)}
            </span>
          </div>

          {e.descripcion && (
            <p className="text-sm text-foreground">{e.descripcion}</p>
          )}

          {e.campoAfectado && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {e.campoAfectado}
              </span>
              : {e.valorAnterior ?? '—'} → {e.valorNuevo ?? '—'}
            </p>
          )}

          {e.motivo && (
            <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Motivo:</span>{' '}
              {e.motivo}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
