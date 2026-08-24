import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2Icon,
  BoxesIcon,
  ChartPieIcon,
  SettingsIcon,
  FolderPlusIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { ArbolEstructura } from '@/modules/equipos/components/ArbolEstructura';
import { DialogoNombre } from '@/shared/components/DialogoNombre';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import {
  useOrganizaciones,
  useCrearOrganizacion,
  useEditarOrganizacion,
  useEliminarOrganizacion,
  useArbol,
  useCrearNodo,
  useRenombrarNodo,
  useEliminarNodo,
} from '@/modules/equipos/hooks/useEquipos';
import type { Organizacion, NodoEstructura } from '@/modules/equipos/types';

/**
 * Gestión de equipos — Fase 1.
 *
 * Dos columnas: las organizaciones a la izquierda, el árbol de
 * ubicaciones de la elegida a la derecha. Es el primer paso del alta de
 * un cliente nuevo; los campos dinámicos y el registro de equipos vienen
 * en las fases siguientes.
 */
export function Equipos() {
  const navegar = useNavigate();
  const [elegida, setElegida] = useState<number | null>(null);

  const { data: organizaciones, isError } = useOrganizaciones();
  const crear = useCrearOrganizacion();
  const editar = useEditarOrganizacion();
  const eliminar = useEliminarOrganizacion();

  const { data: arbol } = useArbol(elegida);
  const crearNodo = useCrearNodo(elegida ?? 0);
  const renombrarNodo = useRenombrarNodo(elegida ?? 0);
  const eliminarNodo = useEliminarNodo(elegida ?? 0);

  // Una consulta pausada deja de estar «cargando» sin haber traído nada.
  const cargando = !organizaciones && !isError;
  const activa = (organizaciones ?? []).find((o) => o.id === elegida) ?? null;

  /**
   * Qué diálogo está abierto.
   *
   * Un solo estado para los cinco casos en vez de cinco banderas: son
   * mutuamente excluyentes —no se renombra una organización mientras se
   * confirma borrar una ubicación— y como unión discriminada TypeScript
   * garantiza que cada caso lleve el dato que necesita.
   */
  type Dialogo =
    | { tipo: 'nueva-organizacion' }
    | { tipo: 'renombrar-organizacion'; organizacion: Organizacion }
    | { tipo: 'borrar-organizacion'; organizacion: Organizacion }
    | { tipo: 'nueva-ubicacion'; padreId: number | null }
    | { tipo: 'renombrar-ubicacion'; nodo: NodoEstructura }
    | { tipo: 'borrar-ubicacion'; nodo: NodoEstructura };

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de equipos"
        description="Organizaciones cuyo inventario administra HVC. Cada una define su propio árbol de ubicaciones y sus propios campos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navegar('/equipos/reportes')}
            >
              <ChartPieIcon />
              Reportes
            </Button>
            <Button onClick={() => setDialogo({ tipo: 'nueva-organizacion' })}>
              <PlusIcon />
              Nueva organización
            </Button>
          </div>
        }
      />

      {isError && (
        <EmptyState
          icon={Building2Icon}
          title="No se pudieron cargar las organizaciones"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {cargando && <TableSkeleton rows={4} cols={3} />}

      {organizaciones && organizaciones.length === 0 && (
        <EmptyState
          icon={Building2Icon}
          title="Todavía no hay organizaciones"
          description="Crea la primera para empezar a armar su estructura de inventario."
        />
      )}

      {organizaciones && organizaciones.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* ── Organizaciones ── */}
          <div className="space-y-2">
            {organizaciones.map((o) => (
              <div
                key={o.id}
                className={cn(
                  'group flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 transition-colors',
                  elegida === o.id
                    ? 'border-ring/50 bg-muted/40'
                    : 'border-border hover:border-ring/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => setElegida(o.id)}
                  className="min-w-0 flex-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">
                      {o.nombre}
                    </span>
                    {!o.activo && <Badge variant="outline">Inactiva</Badge>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {o.nodos} ubicación(es) · {o.campos} campo(s) · {o.equipos}{' '}
                    equipo(s)
                  </span>
                </button>

                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navegar(`/equipos/${o.id}/campos`)}
                  >
                    <SettingsIcon />
                    Campos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navegar(`/equipos/${o.id}/inventario`)}
                  >
                    <BoxesIcon />
                    Inventario
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      o.activo
                        ? `Desactivar ${o.nombre}`
                        : `Activar ${o.nombre}`
                    }
                    title={
                      o.activo
                        ? 'Desactivar: deja de ofrecerse, sin perder nada'
                        : 'Activar'
                    }
                    onClick={() =>
                      editar.mutate({
                        id: o.id,
                        cambios: { activo: !o.activo },
                      })
                    }
                  >
                    <PowerIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Renombrar ${o.nombre}`}
                    title={`Renombrar ${o.nombre}`}
                    onClick={() =>
                      setDialogo({
                        tipo: 'renombrar-organizacion',
                        organizacion: o,
                      })
                    }
                  >
                    <FolderPlusIcon className="rotate-0" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar ${o.nombre}`}
                    title={`Eliminar ${o.nombre}`}
                    onClick={() =>
                      setDialogo({
                        tipo: 'borrar-organizacion',
                        organizacion: o,
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Estructura de la elegida ── */}
          <div className="rounded-xl border border-border bg-card p-4">
            {!activa ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Elige una organización para ver y armar su estructura.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-foreground">
                      Estructura de {activa.nombre}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Sin límite de niveles: crea las ubicaciones como las
                      organice este cliente.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDialogo({ tipo: 'nueva-ubicacion', padreId: null })
                    }
                  >
                    <FolderPlusIcon />
                    Ubicación de primer nivel
                  </Button>
                </div>

                {arbol && arbol.length === 0 ? (
                  <EmptyState
                    icon={Building2Icon}
                    title="Sin ubicaciones"
                    description="Crea la primera: una sede, una torre, un piso… lo que use este cliente."
                  />
                ) : (
                  <ArbolEstructura
                    onAbrir={(nodoId) =>
                      navegar(`/equipos/${activa.id}/inventario?nodo=${nodoId}`)
                    }
                    nodos={arbol ?? []}
                    onAgregar={(padreId) =>
                      setDialogo({ tipo: 'nueva-ubicacion', padreId })
                    }
                    onRenombrar={(nodo) =>
                      setDialogo({ tipo: 'renombrar-ubicacion', nodo })
                    }
                    onEliminar={(nodo) =>
                      setDialogo({ tipo: 'borrar-ubicacion', nodo })
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Diálogos ──
          Todos del mismo par de componentes compartidos: ningún cuadro
          nativo del navegador queda en el módulo. */}
      {dialogo?.tipo === 'nueva-organizacion' && (
        <DialogoNombre
          titulo="Nueva organización"
          descripcion="La empresa cuyo inventario administra HVC."
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crear.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) => crear.mutate(nombre, { onSuccess: cerrar })}
        />
      )}

      {dialogo?.tipo === 'renombrar-organizacion' && (
        <DialogoNombre
          titulo="Renombrar organización"
          etiqueta="Nombre"
          valorInicial={dialogo.organizacion.nombre}
          textoBoton="Guardar"
          ocupado={editar.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            editar.mutate(
              { id: dialogo.organizacion.id, cambios: { nombre } },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'borrar-organizacion' && (
        <DialogoConfirmar
          titulo={`¿Eliminar "${dialogo.organizacion.nombre}"?`}
          mensaje="Solo se puede eliminar una organización vacía."
          detalle={
            dialogo.organizacion.equipos > 0 ||
            dialogo.organizacion.nodos > 0 ||
            dialogo.organizacion.campos > 0
              ? `Tiene ${dialogo.organizacion.nodos} ubicación(es), ${dialogo.organizacion.campos} campo(s) y ${dialogo.organizacion.equipos} equipo(s). El servidor lo rechazará: desactívala en su lugar y dejará de ofrecerse sin perder nada.`
              : undefined
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminar.isPending}
          onCerrar={cerrar}
          onConfirmar={() =>
            eliminar.mutate(dialogo.organizacion.id, {
              onSuccess: () => {
                if (elegida === dialogo.organizacion.id) setElegida(null);
                cerrar();
              },
            })
          }
        />
      )}

      {dialogo?.tipo === 'nueva-ubicacion' && (
        <DialogoNombre
          titulo={
            dialogo.padreId === null
              ? 'Nueva ubicación de primer nivel'
              : 'Nueva ubicación'
          }
          descripcion="Una sede, una torre, un piso… lo que use este cliente."
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crearNodo.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            crearNodo.mutate(
              { nombre, padreId: dialogo.padreId },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'renombrar-ubicacion' && (
        <DialogoNombre
          titulo="Renombrar ubicación"
          etiqueta="Nombre"
          valorInicial={dialogo.nodo.nombre}
          textoBoton="Guardar"
          ocupado={renombrarNodo.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            renombrarNodo.mutate(
              { id: dialogo.nodo.id, nombre },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'borrar-ubicacion' && (
        <DialogoConfirmar
          titulo={`¿Eliminar "${dialogo.nodo.nombre}"?`}
          mensaje="Solo se puede eliminar una ubicación vacía."
          detalle={
            dialogo.nodo.hijos.length > 0 || dialogo.nodo.equipos > 0
              ? `Tiene ${dialogo.nodo.hijos.length} ubicación(es) dentro y ${dialogo.nodo.equipos} equipo(s). El servidor lo rechazará hasta que los muevas o los borres.`
              : undefined
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminarNodo.isPending}
          onCerrar={cerrar}
          onConfirmar={() =>
            eliminarNodo.mutate(dialogo.nodo.id, { onSuccess: cerrar })
          }
        />
      )}
    </div>
  );
}
