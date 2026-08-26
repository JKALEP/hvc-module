import { useState, useRef, useEffect } from 'react';
import { PencilIcon, Trash2Icon, SendIcon, MoreHorizontalIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
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
  ramaCerrada?: boolean;
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
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const puedeEscribir = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeModerar = !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada;

  // ── Scroll suave al final ──
  const scrollAlFinal = () => {
    if (listaRef.current) {
      listaRef.current.scrollTo({
        top: listaRef.current.scrollHeight,
        behavior: 'smooth', // 👈 Animación suave como WhatsApp
      });
    }
  };

  // Al montar o cuando cambian los comentarios, hacer scroll suave
  useEffect(() => {
    // Esperar a que el DOM se actualice (nuevos comentarios renderizados)
    requestAnimationFrame(() => {
      scrollAlFinal();
    });
  }, [comentarios]);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    comentar.mutate(
      { entidad, entidadId, texto: limpio },
      {
        onSuccess: () => {
          setTexto('');
          // Esperar a que el nuevo comentario se renderice y luego scroll suave
          requestAnimationFrame(() => {
            scrollAlFinal();
          });
        },
      },
    );
  };

  const guardarEdicion = (id: number) => {
    const limpio = borrador.trim();
    if (!limpio) return;
    editar.mutate({ id, texto: limpio }, { onSuccess: () => setEditando(null) });
  };

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatearDia = (fecha: string) => {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatearHora = (fecha: string) => {
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!comentarios && !isError) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Lista de comentarios con scroll */}
      <div ref={listaRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {isError && (
          <p className="text-center text-sm text-muted-foreground">
            No se pudieron cargar los comentarios.
          </p>
        )}

        {comentarios?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Sin comentarios todavía.
          </p>
        )}

        {comentarios?.map((c, index) => {
          const esMio = usuario?.id === c.autor?.id;
          const nombreMostrado = c.autorNombre || 'Anónimo';

          const fechaAnterior =
            index > 0 ? comentarios[index - 1].creadoEn : null;
          const mostrarFecha =
            !fechaAnterior ||
            new Date(c.creadoEn).toDateString() !==
              new Date(fechaAnterior).toDateString();

          const puedeAccion = esMio ? puedeEscribir : puedeModerar;

          return (
            <div key={c.id}>
              {mostrarFecha && (
                <div className="my-2 text-center text-xs text-muted-foreground">
                  {formatearDia(c.creadoEn)}
                </div>
              )}

              <div
                className={`flex flex-col ${esMio ? 'items-end' : 'items-start'}`}
              >
                {!esMio && (
                  <span className="mb-0.5 text-xs font-medium text-muted-foreground">
                    {nombreMostrado}
                  </span>
                )}

                {editando === c.id ? (
                  <div className="flex w-full max-w-[80%] gap-2">
                    <Input
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && guardarEdicion(c.id)
                      }
                      autoFocus
                      className="flex-1"
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
                  <div
                    className={`relative max-w-[80%] rounded-2xl px-4 py-2 ${
                      esMio
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm break-words pr-6">
                      {c.texto}
                    </p>

                    <div
                      className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                        esMio ? 'justify-end' : 'justify-start'
                      } ${
                        esMio
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <span>{formatearHora(c.creadoEn)}</span>
                      {c.editadoEn && <span>· editado</span>}
                    </div>

                    {/* Botón de tres puntos (⋮) */}
                    {puedeAccion && (
                      <div className="absolute top-1 right-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
                          onClick={() =>
                            setMenuAbierto(menuAbierto === c.id ? null : c.id)
                          }
                          aria-label="Opciones"
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                        </Button>

                        {/* Menú con íconos visibles */}
                        {menuAbierto === c.id && (
                          <div
                            ref={menuRef}
                            className={`absolute z-10 mt-1 flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-lg ${
                              esMio ? 'right-0' : 'left-0'
                            }`}
                          >
                            {esMio && puedeEscribir && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-foreground hover:bg-muted"
                                aria-label="Editar comentario"
                                title="Editar comentario"
                                onClick={() => {
                                  setEditando(c.id);
                                  setBorrador(c.texto);
                                  setMenuAbierto(null);
                                }}
                              >
                                <PencilIcon className="size-3.5" />
                              </Button>
                            )}
                            {(esMio ? puedeEscribir : puedeModerar) && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                aria-label="Eliminar comentario"
                                title="Eliminar comentario"
                                onClick={() => {
                                  eliminar.mutate(c.id);
                                  setMenuAbierto(null);
                                }}
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input fijo abajo */}
      {puedeEscribir && (
        <div className="mt-3 flex shrink-0 gap-2 border-t border-border pt-3">
          <Input
            placeholder="Escribe un comentario…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            className="flex-1"
          />
          <Button
            onClick={enviar}
            disabled={!texto.trim() || comentar.isPending}
            className="active:translate-y-0 transition-all"
          >
            <SendIcon className="size-4" />
            Comentar
          </Button>
        </div>
      )}
    </div>
  );
}