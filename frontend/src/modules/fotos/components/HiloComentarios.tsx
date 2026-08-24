import { useState } from 'react';
import { PencilIcon, Trash2Icon, SendIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { formatActualizado } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import {
  useComentarios,
  useComentar,
  useEditarComentario,
  useEliminarComentario,
} from '@/modules/fotos/hooks/useComentarios';
import { alcanza } from '@/modules/fotos/lib/permisos';
import type {
  EntidadComentable,
  PermisoCarpeta,
} from '@/modules/fotos/types';

/**
 * El hilo de comentarios de §14, el MISMO para las cuatro entidades.
 *
 * Un solo componente y no uno por entidad porque el comentario es el mismo
 * objeto en los cuatro sitios: lo único que cambia es de qué cuelga, y eso
 * es un par de props. Es el mismo criterio que sigue el backend con una
 * tabla de dueño polimórfico en vez de cuatro tablas iguales.
 *
 * ⚠️ Lo que puede hacer cada quien NO se calcula aquí: `permiso` llega
 * resuelto del servidor. Este componente solo decide qué pintar con él, y
 * las dos reglas que aplica son las mismas que hace cumplir el service —de
 * lo contrario ofrecería botones que responden 403—:
 *
 *   · comentar y editar exigen EDICION (§14 le da al cliente VISUALIZAR);
 *   · editar es SOLO lo propio, por mucho grado que se tenga.
 */
export function HiloComentarios({
  entidad,
  entidadId,
  permiso,
  ramaCerrada = false,
  portal = false,
}: {
  entidad: EntidadComentable;
  entidadId: number;
  permiso: PermisoCarpeta | null;
  /** En una rama archivada se lee pero no se escribe. */
  ramaCerrada?: boolean;
  /** Portal del cliente (§22): lee por otras rutas y nunca escribe. */
  portal?: boolean;
}) {
  const { usuario } = useAuth();
  const { data: comentarios, isError } = useComentarios(
    entidad,
    entidadId,
    true,
    portal,
  );
  const comentar = useComentar();
  const editar = useEditarComentario();
  const eliminar = useEliminarComentario();

  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState('');

  // ⚠️ En el portal la escritura se apaga SIEMPRE, no se deduce del grado.
  // A un cliente se le puede compartir con EDICION (§10 lo permite), pero
  // `PortalController` no tiene ni una ruta de escritura: pintarle un botón
  // sería prometer algo que responde 404. El grado sigue mandando dentro del
  // módulo interno; aquí manda el portal.
  const puedeEscribir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeModerar = !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada;

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    comentar.mutate(
      { entidad, entidadId, texto: limpio },
      { onSuccess: () => setTexto('') },
    );
  };

  const guardarEdicion = (id: number) => {
    const limpio = borrador.trim();
    if (!limpio) return;
    editar.mutate({ id, texto: limpio }, { onSuccess: () => setEditando(null) });
  };

  // El estado se deriva de los datos y no de `isLoading`: una consulta que
  // reintenta deja de estar «cargando» sin haber traído nada, y entonces
  // «Sin comentarios» afirmaría algo que no se sabe.
  if (!comentarios && !isError)
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-3">
      {/* Si la consulta falló, decirlo. Antes no se pintaba NADA —ni el
          vacío, porque `comentarios` es undefined— y un hilo mudo parece un
          hilo sin comentarios. Fue justo lo que escondió que el portal
          llamaba a la ruta interna y recibía un 403. */}
      {isError && (
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar los comentarios.
        </p>
      )}

      {comentarios?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin comentarios todavía.
        </p>
      )}

      {comentarios?.map((c) => {
        const esMio = usuario?.id === c.autor?.id;
        return (
          <div key={c.id} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {/* `autorNombre` y no `autor.nombre`: dar de baja una cuenta
                    pone la FK a null y el comentario conserva su firma. */}
                {c.autorNombre}
              </p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {formatActualizado(c.creadoEn)}
                {c.editadoEn && ' · editado'}
              </p>
            </div>

            {editando === c.id ? (
              <div className="mt-2 flex gap-2">
                <Input
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEdicion(c.id)}
                  autoFocus
                />
                <Button size="sm" onClick={() => guardarEdicion(c.id)}>
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                {c.texto}
              </p>
            )}

            {editando !== c.id && (puedeEscribir || puedeModerar) && (
              <div className="mt-2 flex gap-1">
                {/* Editar SOLO lo propio: nadie reescribe lo que dijo otro,
                    y el backend lo rechaza con 403 aunque seas admin. */}
                {esMio && puedeEscribir && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Editar comentario de ${c.autorNombre}`}
                    title={`Editar comentario de ${c.autorNombre}`}
                    onClick={() => {
                      setEditando(c.id);
                      setBorrador(c.texto);
                    }}
                  >
                    <PencilIcon />
                  </Button>
                )}
                {/* Borrar: el propio con EDICION, el ajeno exige TOTAL. */}
                {(esMio ? puedeEscribir : puedeModerar) && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar comentario de ${c.autorNombre}`}
                    title={`Eliminar comentario de ${c.autorNombre}`}
                    onClick={() => eliminar.mutate(c.id)}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {puedeEscribir && (
        <div className="flex gap-2">
          <Input
            placeholder="Escribe un comentario…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
          />
          <Button onClick={enviar} disabled={!texto.trim() || comentar.isPending}>
            <SendIcon />
            Comentar
          </Button>
        </div>
      )}
    </div>
  );
}
