import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FoldersIcon,
  MessageCircleIcon,
  SearchIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TarjetaCarpeta } from '@/modules/fotos/components/TarjetaCarpeta';
import { RutaSedes } from '@/modules/fotos/components/RutaSedes';
import { DialogoNombre } from '@/shared/components/DialogoNombre';
import { DialogoCompartir } from '@/modules/fotos/components/DialogoCompartir';
import { PanelSubida } from '@/modules/fotos/components/PanelSubida';
import { PanelActividades } from '@/modules/fotos/components/PanelActividades';
import { SelectorDeCiclo } from '@/modules/fotos/components/SelectorDeCiclo';
import { TipoDeSistema } from '@/modules/fotos/components/TipoDeSistema';
import { useCiclos } from '@/modules/fotos/hooks/useCiclos';
import { CamposDeEquipo } from '@/modules/fotos/components/CamposDeEquipo';
import { FormularioEquipo } from '@/modules/fotos/components/FormularioEquipo';
import { HiloComentarios } from '@/modules/fotos/components/HiloComentarios';
import { DialogoImportar } from '@/modules/fotos/components/DialogoImportar';
import { AccionesDeCarpeta } from '@/modules/fotos/components/AccionesDeCarpeta';
import { CrearEstructura } from '@/modules/fotos/components/CrearEstructura';
import { FiltrosDeGaleria } from '@/modules/fotos/components/FiltrosDeGaleria';
import {
  GaleriaDeFotos,
} from '@/modules/fotos/components/GaleriaFotos';
import { PestanasFicha } from '@/modules/fotos/components/PestanasFicha';
import { PanelFotos } from '@/modules/fotos/components/PanelFotos';
import { AvisoArchivada } from '@/modules/fotos/components/AvisoArchivada';
import { EtiquetaSeccion } from '@/modules/fotos/components/EtiquetaSeccion';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
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
import { useAutores, useGaleria } from '@/modules/fotos/hooks/useFotos';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { esAdminFotos } from '@/shared/lib/modulos';
import { alcanza } from '@/modules/fotos/lib/permisos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/shared/lib/constants';
import type {
  CarpetaListada,
  FiltrosGaleria,
  Orden,
} from '@/modules/fotos/types';

const SIN_FILTROS: FiltrosGaleria = {
  subidaPorId: null,
  desde: '',
  hasta: '',
};

const GRID_CARPETAS = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

type Dialogo =
  | { tipo: 'nueva-carpeta' }
  | { tipo: 'equipo' }
  | { tipo: 'renombrar'; carpeta: CarpetaListada }
  | { tipo: 'compartir'; carpeta?: { id: number; nombre: string } };

/**
 * Explorador de Fotos.
 *
 * REGLA DE JERARQUÍA: una Carpeta pura (`tipo === 'CARPETA'`) solo puede
 * contener más carpetas o equipos — nunca álbumes ni comentarios. Toda la
 * ficha (info + comentarios + pestañas) se monta ÚNICAMENTE cuando
 * `carpetaActual.tipo === 'EQUIPO'`.
 *
 * DISTRIBUCIÓN de la ficha del equipo: en vez de todo apilado en una sola
 * columna, es un grid de 2 columnas — info del equipo a la izquierda,
 * comentarios SIEMPRE visibles a la derecha (ya no detrás de una pestaña)
 * — y debajo, a todo el ancho, las pestañas Álbumes / Fotos / Actividades.
 */
export function Fotos({ seccion }: { seccion?: 'propias' | 'compartidas' } = {}) {
  const { id } = useParams();
  const sedeId = id ? Number(id) : null;
  const { usuario } = useAuth();
  const admin = esAdminFotos(usuario);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [importando, setImportando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosGaleria>(SIN_FILTROS);
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState<Orden>('nombre');
  const q = useDebounce(texto, SEARCH_DEBOUNCE_MS);
  const buscando = q.trim() !== '';

  const { data, isError } = useCarpeta(sedeId, { q, orden });
  const esEquipo = data?.carpetaActual?.tipo === 'EQUIPO';

  // ⚠️ La visita elegida se guarda como `number | null` y NO se inicializa
  // con el ciclo en curso: al montar todavía no hay ciclos cargados. `null`
  // significa «la más reciente», que es la que el backend manda primero, y
  // así el valor por defecto sale del dato en vez de un efecto que lo
  // corrija después —lo mismo que hacen los grupos abiertos del sidebar—.
  const { data: ciclos } = useCiclos(sedeId, { habilitado: esEquipo });
  const [cicloElegido, setCicloElegido] = useState<number | null>(null);
  const ciclo =
    (ciclos ?? []).find((c) => c.id === cicloElegido) ?? ciclos?.[0] ?? null;
  // La galeria es del CICLO desde la Fase 4, no de la carpeta. Con `?? 0`
  // el hook se desactiva solo mientras no hay visita elegida.
  const galeria = useGaleria(ciclo?.id ?? 0, filtros);
  const { data: autores } = useAutores(ciclo?.id ?? 0, ciclo !== null);

  const crear = useCrearCarpeta();
  const editar = useEditarCarpeta();
  const archivar = useArchivarCarpeta();
  const eliminar = useEliminarCarpeta();

  const cargando = !data && !isError;
  const cerrar = () => setDialogo(null);
  const fotosDelCiclo = galeria.data?.pages.flatMap((p) => p.fotos) ?? [];
  const totalFotos = galeria.data?.pages[0]?.totalFotos ?? 0;
  const secciones = seccion
    ? (data?.secciones ?? []).filter((s) => s.clave === seccion)
    : (data?.secciones ?? []);

  const totalCarpetas = secciones.reduce((t, s) => t + s.carpetas.length, 0);
  const hayFiltro =
    filtros.subidaPorId !== null || filtros.desde !== '' || filtros.hasta !== '';

  const accionesDe = (c: CarpetaListada) => ({
    renombrar: alcanza(c.permiso, 'EDICION') && !c.cerrada,
    compartir: alcanza(c.permiso, 'TOTAL'),
    archivar: admin,
    eliminar: alcanza(c.permiso, 'TOTAL') && !c.cerrada,
  });

  const puedeBorrarFoto = (f: { subidaPor: { id: number } | null }) =>
    admin || (f.subidaPor?.id === usuario?.id && !data?.ramaCerrada);

  return (
    <div className="space-y-6">
      <RutaSedes
        ancestros={data?.ancestros ?? []}
        actual={data?.carpetaActual?.nombre ?? null}
      />

      {/* ── Bloque «Carpetas» ── */}
      <PanelFotos className="space-y-4">
        <PageHeader
          title={data?.carpetaActual?.nombre ?? 'Fotos'}
          description={
            sedeId === null
              ? 'Explora las carpetas para llegar a sus equipos.'
              : data
                ? `${totalCarpetas} carpeta(s) / equipo(s)`
                : undefined
          }
          actions={
            data && (
              <AccionesDeCarpeta
                data={data}
                carpetaId={sedeId}
                onNuevaCarpeta={() => setDialogo({ tipo: 'nueva-carpeta' })}
                onAnadirEquipo={() => setDialogo({ tipo: 'equipo' })}
                onCompartir={() =>
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
              />
            )
          }
        />

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-2">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar carpetas en todo lo que ves…"
              className="h-9 border-none bg-transparent pl-8 shadow-none focus-visible:ring-0"
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

        {data?.ramaCerrada && (
          <AvisoArchivada>
            Esta carpeta está archivada. Se puede consultar y descargar,
            pero nadie puede subir fotos ni crear carpetas dentro. Un
            administrador de Fotos puede reabrirla.
          </AvisoArchivada>
        )}

        {cargando && (
          <div className={GRID_CARPETAS}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
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

        {secciones.map((bloque) => (
          <section key={bloque.clave} className="space-y-3">
            <EtiquetaSeccion>{bloque.etiqueta}</EtiquetaSeccion>
            <div className={GRID_CARPETAS}>
              {bloque.carpetas.map((c) => (
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

        {buscando && data && data.secciones.length === 0 && (
          <EmptyState
            icon={SearchIcon}
            title={`Ninguna carpeta coincide con «${q.trim()}»`}
            description="Se busca en todas las carpetas a las que tienes acceso, por nombre."
          />
        )}

        {!buscando &&
          sedeId === null &&
          seccion &&
          data &&
          data.secciones.length > 0 &&
          secciones.length === 0 && (
            <EmptyState
              icon={FoldersIcon}
              title="Tu acceso no separa las carpetas así"
              description="Con tu nivel alcanzas todo el árbol, así que se muestran juntas en «Carpetas» en vez de repartidas entre propias y compartidas."
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
      </PanelFotos>
      {/* ── Fin bloque «Carpetas» ── */}

      {/* ── Bloque «Ficha del equipo» ──
          Fila 1: info del equipo (izquierda) + comentarios SIEMPRE visibles
          (derecha). Fila 2: pestañas Álbumes / Fotos / Actividades, ancho
          completo. Todo pensado para caber sin scroll en una pantalla
          normal — nada nuevo, solo reordenado. */}
      {sedeId !== null && data && esEquipo && !buscando && (
        <div className="space-y-4">
          {/* Qué visita se está mirando, arriba del todo: lo de abajo
              —actividades y, en fases siguientes, evidencia y observaciones—
              pertenece a UNA de ellas. */}
          <SelectorDeCiclo
            carpetaId={sedeId}
            ciclos={ciclos}
            cicloId={ciclo?.id ?? null}
            onElegir={setCicloElegido}
            permiso={data.permiso}
            ramaCerrada={data.ramaCerrada}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {/* Describe la MÁQUINA, no la visita: por eso va con la ficha
                  del equipo y no con el selector de ciclo. */}
              <TipoDeSistema
                carpetaId={sedeId}
                tipoSistema={data.carpetaActual?.tipoSistema ?? null}
                puedeEditar={data.puedeEscribir}
              />
              <CamposDeEquipo carpetaId={sedeId} puedeEditar={data.puedeEscribir} />
            </div>

            <Card className="flex max-h-[26rem] flex-col overflow-hidden">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                <h2 className="flex shrink-0 items-center gap-2 font-medium text-foreground">
                  <MessageCircleIcon className="size-4" />
                  Comentarios
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <HiloComentarios
                    entidad="carpeta"
                    entidadId={sedeId}
                    permiso={data.permiso}
                    ramaCerrada={data.ramaCerrada}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <PanelFotos>
            <PestanasFicha
              contenidoFotos={
                <div className="space-y-4">
                  {/* Con el ciclo cerrado no hay donde subir: el backend lo
                      rechaza, asi que el formulario no se pinta. */}
                  {data.puedeEscribir && ciclo && ciclo.cerradoEn === null && (
                    <PanelSubida cicloId={ciclo.id} />
                  )}
                  {/* Crear estructura sigue siendo de la CARPETA, no de la
                      visita: importar un Excel o estampar una plantilla crea
                      carpetas y actividades, no fotos. */}
                  {data.puedeEscribir && (
                    <CrearEstructura
                      carpetaId={sedeId}
                      onImportar={() => setImportando(true)}
                    />
                  )}

                  <FiltrosDeGaleria
                    filtros={filtros}
                    onCambiar={setFiltros}
                    autores={autores ?? []}
                    totalFotos={totalFotos}
                  />

                  <GaleriaDeFotos
                    fotos={fotosDelCiclo}
                    cargando={galeria.isLoading}
                    hayMas={Boolean(galeria.hasNextPage)}
                    cargandoMas={galeria.isFetchingNextPage}
                    onCargarMas={() => void galeria.fetchNextPage()}
                    puedeBorrar={puedeBorrarFoto}
                    permiso={data.permiso}
                    ramaCerrada={data.ramaCerrada}
                    vacio={{
                      titulo: hayFiltro
                        ? 'Ninguna foto con esos filtros'
                        : 'Sin fotos',
                      descripcion: hayFiltro
                        ? 'Prueba a ampliar el rango de fechas o a quitar el filtro por autor.'
                        : data.puedeEscribir
                          ? 'Sube las primeras con el formulario de arriba.'
                          : 'Todavía no hay fotos aquí.',
                    }}
                  />
                </div>
              }
              contenidoActividades={
                ciclo ? (
                  <PanelActividades
                    cicloId={ciclo.id}
                    cicloCerrado={ciclo.cerradoEn !== null}
                    permiso={data.permiso}
                    ramaCerrada={data.ramaCerrada}
                  />
                ) : null
              }
            />
          </PanelFotos>
        </div>
      )}
      {/* ── Fin bloque «Ficha» ── */}

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
        <FormularioEquipo
          nombreDestino={data?.carpetaActual?.nombre ?? 'esta carpeta'}
          ocupado={crear.isPending}
          onCrear={({ nombre, valores, tipoSistemaId, actividades }) =>
            crear.mutate(
              {
                nombre,
                parentId: sedeId,
                tipo: 'EQUIPO',
                valores,
                tipoSistemaId,
                actividades,
              },
              { onSuccess: cerrar },
            )
          }
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