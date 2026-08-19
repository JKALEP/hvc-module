import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArchiveIcon,
  FolderPlusIcon,
  FoldersIcon,
  SearchIcon,
  FileSpreadsheetIcon,
  Share2Icon,
  WrenchIcon,
  XIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TarjetaCarpeta } from '@/modules/fotos/components/TarjetaCarpeta';
import { RutaSedes } from '@/modules/fotos/components/RutaSedes';
import { DialogoNombre } from '@/shared/components/DialogoNombre';
import { DialogoCompartir } from '@/modules/fotos/components/DialogoCompartir';
import { PanelSubida } from '@/modules/fotos/components/PanelSubida';
import { PanelTareas } from '@/modules/fotos/components/PanelTareas';
import { HiloComentarios } from '@/modules/fotos/components/HiloComentarios';
import { DialogoImportar } from '@/modules/fotos/components/DialogoImportar';
import {
  usePlantillas,
  useAplicarPlantilla,
} from '@/modules/fotos/hooks/useAdminFotos';
import { SelectorEquipo } from '@/modules/fotos/components/SelectorEquipo';
import { GaleriaAlbumes } from '@/modules/fotos/components/GaleriaAlbumes';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  useArchivarCarpeta,
  useCarpeta,
  useCrearCarpeta,
  useEditarCarpeta,
  useEliminarCarpeta,
} from '@/modules/fotos/hooks/useCarpetas';
import { useAutores, useGaleria } from '@/modules/fotos/hooks/useAlbumes';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { esAdminFotos, nivelFotosDe } from '@/shared/lib/modulos';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/shared/lib/constants';
import type { CarpetaListada, FiltrosGaleria, Orden } from '@/modules/fotos/types';

const SIN_FILTROS: FiltrosGaleria = { subidaPorId: null, desde: '', hasta: '' };

type Dialogo =
  | { tipo: 'nueva-carpeta' }
  | { tipo: 'equipo' }
  | { tipo: 'renombrar'; carpeta: CarpetaListada }
  | { tipo: 'compartir'; carpeta?: { id: number; nombre: string } };

/**
 * Explorador de Fotos.
 *
 * Una carpeta muestra sus subcarpetas Y sus fotos: ya no hay álbum al que
 * entrar, así que la galería vive aquí mismo. Subir es la acción, y el
 * lote se crea solo.
 */
export function Fotos() {
  const { id } = useParams();
  const sedeId = id ? Number(id) : null;
  const { usuario } = useAuth();
  const admin = esAdminFotos(usuario);
  // El atajo de registrar equipos (§12) pide EDITOR_GLOBAL o más. La
  // decisión la vuelve a tomar el backend; aquí solo se evita ofrecer un
  // botón que responde 403.
  const nivel = nivelFotosDe(usuario);
  const puedeCrearEquipos =
    usuario?.rol === 'SUPERADMIN' ||
    nivel === 'EDITOR_GLOBAL' ||
    nivel === 'ADMIN_GLOBAL';

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  // Solo las ACTIVAS: una plantilla desactivada sigue existiendo para el
  // administrador pero ya no se ofrece en obra.
  const { data: plantillas } = usePlantillas(true);
  const aplicar = useAplicarPlantilla();
  const [importando, setImportando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosGaleria>(SIN_FILTROS);
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState<Orden>('nombre');
  // El buscador no dispara una consulta por tecla: espera a que se pare de
  // escribir, igual que los demás buscadores del proyecto.
  const q = useDebounce(texto, SEARCH_DEBOUNCE_MS);
  const buscando = q.trim() !== '';

  const { data, isError } = useCarpeta(sedeId, { q, orden });
  const galeria = useGaleria(sedeId ?? 0, filtros);
  const { data: autores } = useAutores(sedeId ?? 0, sedeId !== null);

  const crear = useCrearCarpeta();
  const editar = useEditarCarpeta();
  const archivar = useArchivarCarpeta();
  const eliminar = useEliminarCarpeta();

  // Sin datos y sin error todavía no se sabe nada: no es una carpeta vacía.
  const cargando = !data && !isError;
  const cerrar = () => setDialogo(null);
  const albumes = galeria.data?.pages.flatMap((p) => p.albumes) ?? [];
  const totalFotos = galeria.data?.pages[0]?.totalFotos ?? 0;
  const totalCarpetas = (data?.secciones ?? []).reduce(
    (t, s) => t + s.carpetas.length,
    0,
  );
  const hayFiltro =
    filtros.subidaPorId !== null || filtros.desde !== '' || filtros.hasta !== '';

  /**
   * Las acciones se resuelven POR TARJETA, no una vez para todas.
   *
   * El permiso de cada hija puede no ser el de la carpeta que se está
   * mirando: una restricción de §7 la baja y ser su propietario (§6) la
   * sube. Con un único objeto para toda la lista se pintaban botones que el
   * backend rechaza con 403.
   */
  const accionesDe = (c: CarpetaListada) => ({
    renombrar: alcanza(c.permiso, 'EDICION') && !c.cerrada,
    compartir: alcanza(c.permiso, 'TOTAL'),
    // Archivar sigue siendo del administrador global: la especificación no
    // habla de archivado y se conserva la regla de v2.
    archivar: admin,
    eliminar: alcanza(c.permiso, 'TOTAL') && !c.cerrada,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <RutaSedes
          ancestros={data?.ancestros ?? []}
          actual={data?.carpetaActual?.nombre ?? null}
        />

        <PageHeader
          title={data?.carpetaActual?.nombre ?? 'Fotos'}
          description={
            sedeId === null
              ? 'Explora las carpetas para llegar a sus fotos.'
              : data
                ? `${totalCarpetas} carpeta(s) · ${totalFotos} foto(s)`
                : undefined
          }
          actions={
            data && (
              <>
                {data.puedeEscribir && (
                  <Button
                    variant="outline"
                    onClick={() => setDialogo({ tipo: 'nueva-carpeta' })}
                  >
                    <FolderPlusIcon />
                    Nueva carpeta
                  </Button>
                )}
                {/* Solo DENTRO de una carpeta: un equipo vive en una
                    estructura de trabajo (§12), no colgando de la raíz. */}
                {data.puedeEscribir && sedeId !== null && (
                  <Button
                    variant="outline"
                    onClick={() => setDialogo({ tipo: 'equipo' })}
                  >
                    <WrenchIcon />
                    Añadir equipo
                  </Button>
                )}
                {/* §19 y §20: las dos formas de crear estructura de golpe.
                    Solo DENTRO de una carpeta —hay que saber a dónde va— y
                    solo con permiso de escritura. */}
                {data.puedeEscribir && sedeId !== null && (
                  <Button variant="outline" onClick={() => setImportando(true)}>
                    <FileSpreadsheetIcon />
                    Importar Excel
                  </Button>
                )}
                {data.puedeEscribir &&
                  sedeId !== null &&
                  (plantillas ?? []).length > 0 && (
                    <Select
                      className="h-9 w-52"
                      value=""
                      disabled={aplicar.isPending}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        aplicar.mutate({
                          plantillaId: Number(e.target.value),
                          carpetaId: sedeId,
                        });
                      }}
                    >
                      <option value="">Crear desde plantilla…</option>
                      {(plantillas ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Select>
                  )}
                {!data.ramaCerrada && (
                  <Button
                    variant={sedeId === null ? 'default' : 'outline'}
                    onClick={() =>
                      setDialogo({
                        tipo: 'compartir',
                        carpeta: data.carpetaActual
                          ? {
                              id: data.carpetaActual.id,
                              nombre: data.carpetaActual.nombre,
                            }
                          : undefined,
                      })
                    }
                  >
                    <Share2Icon />
                    Compartir
                  </Button>
                )}
              </>
            )
          }
        />

        {/* Buscar y ordenar (§11). La búsqueda recorre TODO el árbol
            visible, no solo esta carpeta: es lo que se espera de un buscador
            cuando justamente no sabes dónde está lo que buscas. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar carpetas en todo lo que ves…"
              className="h-9 pl-8"
            />
          </div>
          <div className="w-48">
            <Select
              className="h-9"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar carpetas"
            >
              <option value="nombre">Nombre (A-Z)</option>
              <option value="nombre-desc">Nombre (Z-A)</option>
              <option value="reciente">Actividad más reciente</option>
              <option value="antiguo">Actividad más antigua</option>
            </Select>
          </div>
          {buscando && (
            <Button variant="ghost" size="sm" onClick={() => setTexto('')}>
              Salir de la búsqueda
            </Button>
          )}
        </div>
      </div>

      {data?.ramaCerrada && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-600/25 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-500">
          <ArchiveIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Esta carpeta está archivada. Se puede consultar y descargar, pero
            nadie puede subir fotos ni crear carpetas dentro. Un administrador
            de Fotos puede reabrirla.
          </p>
        </div>
      )}

      {cargando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={FoldersIcon}
          title="No se pudo abrir esta carpeta"
          description="O no existe, o no tienes acceso a ella. Vuelve a Fotos y navega desde ahí."
        />
      )}

      {(data?.secciones ?? []).map((seccion) => (
        <section key={seccion.clave} className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {seccion.etiqueta}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seccion.carpetas.map((c) => (
              <TarjetaCarpeta
                key={c.id}
                carpeta={c}
                acciones={accionesDe(c)}
                onRenombrar={(carpeta) =>
                  setDialogo({ tipo: 'renombrar', carpeta })
                }
                onCompartir={(carpeta) =>
                  setDialogo({
                    tipo: 'compartir',
                    carpeta: { id: carpeta.id, nombre: carpeta.nombre },
                  })
                }
                onArchivar={(carpeta) =>
                  archivar.mutate({
                    id: carpeta.id,
                    cerrada: !carpeta.cerrada,
                  })
                }
                onEliminar={(carpeta) => eliminar.mutate(carpeta.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Dentro de una carpeta: tareas (solo equipos), comentarios, subida
          y galería. Nada de esto se pinta mientras se busca: una búsqueda
          recorre todo el árbol y no está «dentro» de ninguna carpeta. */}
      {sedeId !== null && data && !buscando && (
        <>
          {/* Las tareas son de los EQUIPOS (§13). En una carpeta corriente
              el backend las rechaza, así que ni se ofrecen ni se piden. */}
          {data.carpetaActual?.tipo === 'EQUIPO' && (
            <PanelTareas
              carpetaId={sedeId}
              permiso={data.permiso}
              ramaCerrada={data.ramaCerrada}
            />
          )}

          {/* Comentarios de la carpeta (§14). En un equipo son los del
              equipo: es la misma entidad, y por eso la misma llamada. */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-medium text-foreground">
              {data.carpetaActual?.tipo === 'EQUIPO'
                ? 'Comentarios del equipo'
                : 'Comentarios de la carpeta'}
            </h2>
            <HiloComentarios
              entidad="carpeta"
              entidadId={sedeId}
              permiso={data.permiso}
              ramaCerrada={data.ramaCerrada}
            />
          </section>

          {data.puedeEscribir && <PanelSubida sedeId={sedeId} />}

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Subido por
              </label>
              <Select
                className="h-9"
                value={
                  filtros.subidaPorId === null ? '' : String(filtros.subidaPorId)
                }
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    subidaPorId:
                      e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              >
                <option value="">Todos</option>
                {(autores ?? []).map((a) => (
                  <option key={a.usuarioId} value={a.usuarioId}>
                    {a.nombre} ({a.albumes})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Desde
              </label>
              <Input
                type="date"
                className="h-9 w-40"
                value={filtros.desde}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, desde: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Hasta
              </label>
              <Input
                type="date"
                className="h-9 w-40"
                value={filtros.hasta}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, hasta: e.target.value }))
                }
              />
            </div>

            {hayFiltro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltros(SIN_FILTROS)}
              >
                <XIcon />
                Limpiar
              </Button>
            )}

            <p className="ml-auto text-sm text-muted-foreground tabular-nums">
              {totalFotos} foto(s)
            </p>
          </div>

          <GaleriaAlbumes
            albumes={albumes}
            cargando={galeria.isLoading}
            hayMas={Boolean(galeria.hasNextPage)}
            cargandoMas={galeria.isFetchingNextPage}
            onCargarMas={() => void galeria.fetchNextPage()}
            puedeBorrar={(f) =>
              admin || (f.subidaPor?.id === usuario?.id && !data.ramaCerrada)
            }
            vacio={{
              titulo: hayFiltro ? 'Ninguna foto con esos filtros' : 'Sin fotos',
              descripcion: hayFiltro
                ? 'Prueba a ampliar el rango de fechas o a quitar el filtro por autor.'
                : data.puedeEscribir
                  ? 'Sube las primeras con el formulario de arriba.'
                  : 'Todavía no hay fotos aquí.',
            }}
          />
        </>
      )}

      {/* Raíz vacía */}
      {/* Búsqueda sin resultados. Va antes que el vacío de la raíz porque
          buscando desde la raíz se cumplirían las dos condiciones, y el
          mensaje que ayuda es este. */}
      {buscando && data && data.secciones.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title={`Ninguna carpeta coincide con «${q.trim()}»`}
          description="Se busca en todas las carpetas a las que tienes acceso, por nombre."
        />
      )}

      {!buscando && sedeId === null && data && data.secciones.length === 0 && (
        <EmptyState
          icon={FoldersIcon}
          title={admin ? 'No hay carpetas todavía' : 'No hay nada para ti aún'}
          description={
            admin
              ? 'Crea la primera con el botón de arriba.'
              : 'Cuando compartan una carpeta contigo, aparecerá aquí.'
          }
        />
      )}

      {/* ── Diálogos ── */}

      {dialogo?.tipo === 'nueva-carpeta' && (
        <DialogoNombre
          titulo="Nueva carpeta"
          descripcion={
            sedeId === null
              ? 'Se creará en el primer nivel.'
              : `Se creará dentro de ${data?.carpetaActual?.nombre ?? 'esta carpeta'}.`
          }
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crear.isPending}
          onConfirmar={(nombre) =>
            crear.mutate({ nombre, parentId: sedeId }, { onSuccess: cerrar })
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'equipo' && (
        <SelectorEquipo
          puedeCrear={puedeCrearEquipos}
          onElegir={(equipo) => {
            // El nombre de la carpeta sale del código del equipo: pedirlo
            // aparte sería dejar que se llamen distinto y nadie sepa cuál es
            // cuál. Se puede renombrar después.
            crear.mutate(
              {
                nombre: `Equipo ${equipo.codigoInterno ?? equipo.id}`,
                parentId: sedeId,
                tipo: 'EQUIPO',
                equipoId: equipo.id,
              },
              { onSuccess: cerrar },
            );
          }}
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'renombrar' && (
        <DialogoNombre
          titulo="Renombrar carpeta"
          etiqueta="Nombre"
          valorInicial={dialogo.carpeta.nombre}
          textoBoton="Guardar"
          ocupado={editar.isPending}
          onConfirmar={(nombre) =>
            editar.mutate(
              { id: dialogo.carpeta.id, payload: { nombre } },
              { onSuccess: cerrar },
            )
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'compartir' && (
        <DialogoCompartir carpetaInicial={dialogo.carpeta} onCerrar={cerrar} />
      )}

      {sedeId !== null && (
        <DialogoImportar
          carpetaId={sedeId}
          carpetaNombre={data?.carpetaActual?.nombre ?? 'esta carpeta'}
          abierto={importando}
          onCerrar={() => setImportando(false)}
        />
      )}
    </div>
  );
}
