import { useState } from 'react';
import { CheckIcon, HistoryIcon, PencilIcon, Trash2Icon } from 'lucide-react';

import { PanelFotos } from '@/modules/fotos/components/PanelFotos';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import { formatActualizado } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { alcanza } from '@/modules/fotos/lib/permisos';
import {
  useObservaciones,
  useCrearObservacion,
  useEditarObservacion,
  useResolverObservacion,
  useEliminarObservacion,
} from '@/modules/fotos/hooks/useObservaciones';
import type { Observacion, PermisoCarpeta } from '@/modules/fotos/types';

/**
 * Lo que queda pendiente en el equipo (§8, Fase 5).
 *
 * ⚠️ La lista mezcla a propósito las levantadas EN esta intervención con las
 * ARRASTRADAS de intervenciónes anteriores, y las distingue con una insignia. Son la
 * misma clase de cosa —trabajo pendiente en este equipo— y separarlas en dos
 * listas obligaría a mirar dos sitios para responder «¿qué falta aquí?», que
 * es justo la pregunta.
 *
 * Lo que sí se separa es lo RESUELTO: baja al final y en gris, porque ya no
 * hay nada que hacer con ello.
 */
export function PanelObservaciones({
  intervencionId,
  intervencionCerrada,
  permiso,
  ramaCerrada,
  portal = false,
}: {
  intervencionId: number;
  /**
   * ⚠️ Solo apaga LEVANTAR una observación nueva.
   *
   * Resolver una arrastrada NO depende de esto: la observación es del equipo,
   * no de la intervención, y congelarla con su intervención la dejaría abierta para
   * siempre — que es exactamente el caso para el que existe el arrastre.
   */
  intervencionCerrada: boolean;
  permiso: PermisoCarpeta | null;
  ramaCerrada: boolean;
  /** Portal del cliente (§22): lee, nunca escribe. */
  portal?: boolean;
}) {
  const { usuario } = useAuth();
  const { data: observaciones, isError } = useObservaciones(intervencionId);
  const crear = useCrearObservacion();
  const editar = useEditarObservacion();
  const resolver = useResolverObservacion();
  const eliminar = useEliminarObservacion();

  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState('');

  const puedeEscribir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeModerar = !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada;
  const puedeLevantar = puedeEscribir && !intervencionCerrada;

  const registrar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    crear.mutate({ intervencionId, texto: limpio }, { onSuccess: () => setTexto('') });
  };

  // `!data && !isError` y no `isLoading`: una consulta que reintenta deja de
  // estar «cargando» sin haber traído nada, y ahí la pantalla no sabe.
  if (!observaciones && !isError)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );

  const pendientes = (observaciones ?? []).filter(
    (o) => o.estado === 'PENDIENTE',
  );
  const resueltas = (observaciones ?? []).filter(
    (o) => o.estado === 'RESUELTA',
  );

  const fila = (o: Observacion) => {
    const esMia = o.creadoPor?.id === usuario?.id;
    const puedeBorrar = esMia ? puedeEscribir : puedeModerar;
    const resuelta = o.estado === 'RESUELTA';

    return (
      <li
        key={o.id}
        className={cn(
          'rounded-md border border-border/60 px-3 py-2',
          resuelta && 'opacity-60',
        )}
      >
        <div className="flex flex-wrap items-start gap-2">
          {puedeEscribir && (
            <button
              type="button"
              aria-label={resuelta ? 'Volver a abrir' : 'Dar por resuelta'}
              title={resuelta ? 'Volver a abrir' : 'Dar por resuelta'}
              disabled={resolver.isPending}
              onClick={() =>
                resolver.mutate({ id: o.id, resuelta: !resuelta })
              }
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                resuelta
                  ? 'border-success bg-success-soft text-success-soft-foreground'
                  : 'border-input hover:border-ring',
              )}
            >
              {resuelta && <CheckIcon className="size-3.5" />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            {editando === o.id ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-48 flex-1"
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!borrador.trim() || editar.isPending}
                  onClick={() =>
                    editar.mutate(
                      { id: o.id, texto: borrador.trim() },
                      { onSuccess: () => setEditando(null) },
                    )
                  }
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <p
                className={cn(
                  'text-sm text-foreground',
                  resuelta && 'line-through',
                )}
              >
                {o.texto}
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {/* La insignia que da sentido a la pantalla: «esto lleva tres
                  intervenciones abierta» no es lo mismo que «esto salió hoy». */}
              {o.arrastrada && !resuelta && (
                <Badge variant="warning" className="gap-1">
                  <HistoryIcon className="size-3" />
                  Arrastrada de la intervención {o.intervencionOrigen.numero}
                  {(o.intervencionesAbierta ?? 0) > 1 &&
                    ` · ${o.intervencionesAbierta} intervenciones`}
                </Badge>
              )}
              <span>{o.creadoPor?.nombre}</span>
              <span>{formatActualizado(o.creadoEn)}</span>
              {resuelta && o.resueltaPor && (
                <span>
                  Resuelta por {o.resueltaPor.nombre}
                  {o.intervencionResuelta && ` en la intervención ${o.intervencionResuelta.numero}`}
                </span>
              )}
            </div>
          </div>

          {puedeEscribir && editando !== o.id && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Corregir el texto"
                onClick={() => {
                  setEditando(o.id);
                  setBorrador(o.texto);
                }}
              >
                <PencilIcon />
              </Button>
              {/* Borrar NO es resolver: se borra lo que se anotó por error.
                  Lo atendido se resuelve, que deja quién y cuándo. */}
              {puedeBorrar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={esMia ? 'Eliminar la mía' : 'Eliminar la de otro'}
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(o.id)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <PanelFotos as="section" denso>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium text-foreground">
          Observaciones
          {pendientes.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {pendientes.length} pendiente(s)
            </span>
          )}
        </h2>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          No se pudieron cargar las observaciones.
        </p>
      )}

      {observaciones?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nada pendiente en este equipo.
        </p>
      )}

      <ul className="space-y-2">
        {pendientes.map(fila)}
        {resueltas.map(fila)}
      </ul>

      {/* ⚠️ Levantar una observación pide la intervención ABIERTA; resolver una
          arrastrada, no. Por eso el aviso habla solo de registrar. */}
      {puedeLevantar && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Registrar observación…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && registrar()}
          />
          <Button
            onClick={registrar}
            disabled={!texto.trim() || crear.isPending}
          >
            {crear.isPending && <Spinner />}
            Registrar
          </Button>
        </div>
      )}

      {puedeEscribir && intervencionCerrada && (
        <p className="mt-3 text-xs text-muted-foreground">
          Esta intervención está cerrada: no se registran observaciones nuevas, pero
          las que siguen pendientes se pueden resolver desde aquí.
        </p>
      )}
    </PanelFotos>
  );
}
