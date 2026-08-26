import { useState } from 'react';
import { ActivityIcon, FolderIcon, HistoryIcon, LayersIcon, LayoutTemplateIcon, ListChecksIcon, PlusIcon, Trash2Icon, WrenchIcon, XIcon } from 'lucide-react';


import { PanelFotos } from '@/modules/fotos/components/PanelFotos';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import { formatActualizado } from '@/shared/lib/format';
import {
  useCamposEquipo,
  useCrearCampoEquipo,
  useEditarCampoEquipo,
  useEliminarCampoEquipo,
  useAgregarOpcionCampo,
  useEliminarOpcionCampo,
  useColoresDeCarpeta,
  useCambiarColorDeCarpeta,
} from '@/modules/fotos/hooks/useCamposEquipo';
import {
  COLOR_A_CLASES,
  COLOR_POR_DEFECTO,
  ETIQUETA_COLOR,
} from '@/modules/fotos/lib/colores';
import type { ColorEstado, TipoEvidencia, TipoCampoFotos } from '@/modules/fotos/types';
import { ESTADO_A_VARIANTE, ETIQUETA_COLOR_ESTADO } from '@/modules/fotos/lib/colores';
import {
  useSistemas,
  useCrearFamiliaSistema,
  useEditarFamiliaSistema,
  useEliminarFamiliaSistema,
  useCrearTipoSistema,
  useEditarTipoSistema,
  useEliminarTipoSistema,
  useCatalogoActividades,
  useCrearDefinicionActividad,
  useEditarDefinicionActividad,
  useEliminarDefinicionActividad,
} from '@/modules/fotos/hooks/useCatalogoFotos';
import {
  useEstadosEquipo,
  useCrearEstadoEquipo,
  useEditarEstadoEquipo,
  useEliminarEstadoEquipo,
} from '@/modules/fotos/hooks/useEstadosEquipo';
import {
  useAuditoria,
  usePlantillas,
  useGuardarPlantilla,
  useEliminarPlantilla,
} from '@/modules/fotos/hooks/useAdminFotos';
import type { NodoPlantillaNuevo, TipoNodoPlantilla } from '@/modules/fotos/types';
import { BotonesExportar } from '@/modules/fotos/components/BotonesExportar';

/** Las acciones de §23, en lenguaje de usuario. ÚNICO sitio. */
const ETIQUETA_ACCION: Record<string, string> = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  ELIMINACION: 'Eliminación',
  MOVIMIENTO: 'Movimiento',
  ARCHIVADO: 'Archivado',
  REAPERTURA: 'Reapertura',
  // ⚠️ Históricas: nada nuevo las escribe desde la Fase 0, pero siguen en
  // filas ya grabadas y sin etiqueta saldrían crudas en la tabla.
  TAREA_COMPLETADA: 'Actividad completada',
  TAREA_REABIERTA: 'Actividad reabierta',
  ACTIVIDAD_COMPLETADA: 'Actividad completada',
  ACTIVIDAD_REABIERTA: 'Actividad reabierta',
  SUBIDA_FOTO: 'Subida de fotos',
  DESCARGA_FOTO: 'Descarga',
  CLASIFICACION: 'Clasificación',
  COMPARTIR: 'Compartir',
  CAMBIO_PERMISO: 'Cambio de permiso',
  REVOCAR_ACCESO: 'Revocar acceso',
  INVITACION_ENVIADA: 'Invitación enviada',
  INVITACION_ACEPTADA: 'Invitación aceptada',
  IMPORTACION_EXCEL: 'Importación Excel',
  CREACION_DESDE_PLANTILLA: 'Creado desde plantilla',
  EQUIPO_CREADO_DESDE_FOTOS: 'Equipo creado desde Fotos',
};

const TIPOS_NODO: { valor: TipoNodoPlantilla; etiqueta: string }[] = [
  { valor: 'ACTIVIDAD', etiqueta: 'Actividad' },
  { valor: 'CARPETA', etiqueta: 'Carpeta' },
];

/**
 * Administración de Fotos: campos de equipo (Fase 1b), plantillas (§20) y
 * auditoría (§23).
 *
 * Las tres juntas porque son lo mismo —configurar el módulo, no trabajar
 * dentro de una carpeta— y porque las tres son de administrador. La
 * importación por Excel NO está aquí: se hace DENTRO de la carpeta destino,
 * que es donde tiene sentido elegir a dónde va.
 */
export function AdminFotos() {
  const [pestana, setPestana] = useState<
    'campos' | 'sistemas' | 'catalogo' | 'estados' | 'plantillas' | 'auditoria'
  >('campos');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Fotos"
        description="El vocabulario del módulo —tipos de sistema, catálogo de actividades, estados y campos de equipo—, las plantillas de estructura y el registro de quién hizo qué."
      />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['campos', 'Campos de equipo', WrenchIcon],
            ['sistemas', 'Tipos de sistema', LayersIcon],
            ['catalogo', 'Catálogo de actividades', ListChecksIcon],
            ['estados', 'Estados de equipo', ActivityIcon],
            ['plantillas', 'Plantillas', LayoutTemplateIcon],
            ['auditoria', 'Auditoría', HistoryIcon],
          ] as const
        ).map(([clave, texto, Icono]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors',
              pestana === clave
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icono className="size-4" />
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'campos' && <CamposDeEquipoAdmin />}
      {pestana === 'sistemas' && <TiposDeSistema />}
      {pestana === 'catalogo' && <CatalogoDeActividades />}
      {pestana === 'estados' && <EstadosDeEquipo />}
      {pestana === 'plantillas' && <Plantillas />}
      {pestana === 'auditoria' && <Auditoria />}
    </div>
  );
}

/**
 * El color de cada tipo de carpeta en el explorador (Fase 1c).
 *
 * Vive en la pestaña de campos porque es lo mismo: cómo se ve y qué se pide
 * de un equipo. Una pestaña propia para dos desplegables sería tres clics
 * para llegar a un ajuste que se toca una vez al año.
 *
 * ⚠️ La paleta es cerrada —dos colores— aunque la elección sea configurable.
 * Tailwind solo genera las clases que ve escritas, así que ampliarla es
 * tocar código: el enum de la base, los tokens de `index.css` y
 * `COLOR_A_CLASES`. Se dice aquí para que nadie busque un botón de «añadir
 * color» que no puede existir.
 */
function ColoresDelExplorador() {
  const { data: colores } = useColoresDeCarpeta();
  const cambiar = useCambiarColorDeCarpeta();

  const filas: { tipo: 'CARPETA' | 'EQUIPO'; etiqueta: string }[] = [
    { tipo: 'CARPETA', etiqueta: 'Carpeta normal' },
    { tipo: 'EQUIPO', etiqueta: 'Carpeta de equipo' },
  ];

  return (
    <PanelFotos denso>
      <h2 className="mb-1 font-medium text-foreground">
        Color en el explorador
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Tiñe el icono de la tarjeta, para distinguir un equipo de un vistazo.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {filas.map(({ tipo, etiqueta }) => {
          const actual = colores?.[tipo] ?? COLOR_POR_DEFECTO[tipo];
          return (
            <div key={tipo} className="flex items-center gap-3">
              {/* La misma muestra que verá en el explorador: el icono con su
                  color, no un cuadrado de muestra que no se parece a nada. */}
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  COLOR_A_CLASES[actual],
                )}
              >
                {tipo === 'EQUIPO' ? (
                  <WrenchIcon className="size-5" />
                ) : (
                  <FolderIcon className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block text-sm font-medium text-foreground">
                  {etiqueta}
                </label>
                <Select
                  value={actual}
                  disabled={cambiar.isPending}
                  onChange={(e) =>
                    cambiar.mutate({ tipo, color: e.target.value })
                  }
                >
                  {(
                    Object.keys(ETIQUETA_COLOR) as (keyof typeof ETIQUETA_COLOR)[]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {ETIQUETA_COLOR[c]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </PanelFotos>
  );
}

/* ─────────────────── Campos de equipo (Fase 1b) ─────────────────── */

const TIPOS_CAMPO: { valor: TipoCampoFotos; etiqueta: string }[] = [
  { valor: 'TEXTO', etiqueta: 'Texto' },
  { valor: 'TEXTO_LARGO', etiqueta: 'Texto largo' },
  { valor: 'NUMERO', etiqueta: 'Número' },
  { valor: 'FECHA', etiqueta: 'Fecha' },
  { valor: 'BOOLEANO', etiqueta: 'Sí / No' },
  { valor: 'LISTA', etiqueta: 'Lista de opciones' },
  { valor: 'FOTO', etiqueta: 'Imagen' },
];

const ETIQUETA_TIPO = Object.fromEntries(
  TIPOS_CAMPO.map((t) => [t.valor, t.etiqueta]),
) as Record<TipoCampoFotos, string>;

/**
 * El catálogo de estados de equipo (§7).
 *
 * ⚠️ Los tres que trae el sistema —Operativo, Operativo con observaciones,
 * Inoperativo— son DATOS sembrados por la migración, no constantes: HVC
 * puede renombrarlos, reordenarlos, retirar uno o añadir un cuarto sin que
 * nadie toque código. Lo único cerrado es la PALETA, porque Tailwind solo
 * genera las clases que ve escritas.
 *
 * Retirar (`activo`) y eliminar son dos cosas distintas y las dos existen:
 * retirado deja de ofrecerse pero las intervenciones que ya lo tenían lo conservan
 * —son historial—; eliminar solo cabe si no lo usa ninguno, y el backend lo
 * rechaza con un mensaje que ya dice cuántos son.
 */
function EstadosDeEquipo() {
  const { data: estados, isError } = useEstadosEquipo();
  const crear = useCrearEstadoEquipo();
  const editar = useEditarEstadoEquipo();
  const eliminar = useEliminarEstadoEquipo();

  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<ColorEstado>('VERDE');

  const anadir = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    crear.mutate(
      { nombre: limpio, color, orden: (estados?.length ?? 0) + 1 },
      { onSuccess: () => setNombre('') },
    );
  };

  if (!estados && !isError)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  return (
    <PanelFotos as="section">
      <h2 className="mb-1 font-medium text-foreground">Estados de equipo</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        En qué condición quedó el equipo tras cada intervención. Se elige dentro del
        intervención en curso y se ve en la tarjeta del explorador sin entrar.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          className="w-56"
          placeholder="Nombre del estado…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Select
          className="w-64"
          value={color}
          onChange={(e) => setColor(e.target.value as ColorEstado)}
        >
          {(Object.keys(ETIQUETA_COLOR_ESTADO) as ColorEstado[]).map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_COLOR_ESTADO[c]}
            </option>
          ))}
        </Select>
        <Button onClick={anadir} disabled={!nombre.trim() || crear.isPending}>
          <PlusIcon className="size-4" />
          Añadir
        </Button>
      </div>

      {estados?.length === 0 && (
        <EmptyState
          icon={ActivityIcon}
          title="Sin estados"
          description="Añade al menos uno para poder calificar una intervención."
        />
      )}

      <ul className="space-y-2">
        {(estados ?? []).map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2"
          >
            <Badge variant={ESTADO_A_VARIANTE[e.color]}>{e.nombre}</Badge>
            {!e.activo && (
              <span className="text-xs text-muted-foreground">Retirado</span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {e._count?.intervenciones ?? 0} intervención(es)
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Select
                className="w-56"
                value={e.color}
                onChange={(ev) =>
                  editar.mutate({
                    id: e.id,
                    payload: { color: ev.target.value as ColorEstado },
                  })
                }
              >
                {(Object.keys(ETIQUETA_COLOR_ESTADO) as ColorEstado[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {ETIQUETA_COLOR_ESTADO[c]}
                    </option>
                  ),
                )}
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  editar.mutate({ id: e.id, payload: { activo: !e.activo } })
                }
              >
                {e.activo ? 'Retirar' : 'Reactivar'}
              </Button>
              {/* Solo si nadie lo usa. Con intervenciones detrás el backend contesta
                  400 diciendo cuántos, y ofrecer un botón que responde 400 es
                  peor que no ofrecerlo — el mismo criterio que el borrado de
                  un álbum con fotos. */}
              {(e._count?.intervenciones ?? 0) === 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${e.nombre}`}
                  onClick={() => eliminar.mutate(e.id)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PanelFotos>
  );
}

/**
 * Familias y tipos de sistema (§ Fase 2).
 *
 * ⚠️ Dos niveles y no una lista plana: con un solo desplegable de «Split»,
 * «VRF», «Inyector», «Extractor»… nadie encuentra nada en obra. La familia es
 * un dato administrable, no un enum: HVC puede añadir la tercera sin que
 * nadie toque código.
 */
function TiposDeSistema() {
  const { data: familias, isError } = useSistemas();
  const crearFamilia = useCrearFamiliaSistema();
  const editarFamilia = useEditarFamiliaSistema();
  const eliminarFamilia = useEliminarFamiliaSistema();
  const crearTipo = useCrearTipoSistema();
  const editarTipo = useEditarTipoSistema();
  const eliminarTipo = useEliminarTipoSistema();

  const [nombreFamilia, setNombreFamilia] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<Record<number, string>>({});

  if (!familias && !isError)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  return (
    <PanelFotos as="section">
      <h2 className="mb-1 font-medium text-foreground">Tipos de sistema</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Qué clase de equipo es cada uno. De aquí sale la preselección del
        checklist: el catálogo de actividades se asocia a estos tipos.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          className="w-64"
          placeholder="Nueva familia (p. ej. Refrigeración)…"
          value={nombreFamilia}
          onChange={(e) => setNombreFamilia(e.target.value)}
        />
        <Button
          disabled={!nombreFamilia.trim() || crearFamilia.isPending}
          onClick={() =>
            crearFamilia.mutate(
              { nombre: nombreFamilia.trim(), orden: (familias?.length ?? 0) + 1 },
              { onSuccess: () => setNombreFamilia('') },
            )
          }
        >
          <PlusIcon className="size-4" />
          Añadir familia
        </Button>
      </div>

      {familias?.length === 0 && (
        <EmptyState
          icon={LayersIcon}
          title="Sin familias"
          description="Añade una para poder crear tipos de sistema dentro."
        />
      )}

      <div className="space-y-4">
        {(familias ?? []).map((f) => (
          <div key={f.id} className="rounded-md border border-border/60 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{f.nombre}</span>
              {!f.activo && (
                <span className="text-xs text-muted-foreground">Retirada</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    editarFamilia.mutate({
                      id: f.id,
                      payload: { activo: !f.activo },
                    })
                  }
                >
                  {f.activo ? 'Retirar' : 'Reactivar'}
                </Button>
                {/* Solo si está vacía: con tipos dentro el backend contesta
                    400 y ofrecer el botón sería prometer un error. */}
                {(f.tipos ?? []).length === 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${f.nombre}`}
                    onClick={() => eliminarFamilia.mutate(f.id)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            <ul className="space-y-1">
              {(f.tipos ?? []).map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-sm"
                >
                  <span>{t.nombre}</span>
                  {!t.activo && (
                    <span className="text-xs text-muted-foreground">
                      Retirado
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t._count?.carpetas ?? 0} equipo(s) ·{' '}
                    {t._count?.actividades ?? 0} actividad(es)
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        editarTipo.mutate({
                          id: t.id,
                          payload: { activo: !t.activo },
                        })
                      }
                    >
                      {t.activo ? 'Retirar' : 'Reactivar'}
                    </Button>
                    {(t._count?.carpetas ?? 0) === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${t.nombre}`}
                        onClick={() => eliminarTipo.mutate(t.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex gap-2">
              <Input
                className="w-56"
                placeholder="Nuevo tipo…"
                value={nuevoTipo[f.id] ?? ''}
                onChange={(e) =>
                  setNuevoTipo((s) => ({ ...s, [f.id]: e.target.value }))
                }
              />
              <Button
                variant="outline"
                disabled={!(nuevoTipo[f.id] ?? '').trim() || crearTipo.isPending}
                onClick={() =>
                  crearTipo.mutate(
                    {
                      familiaId: f.id,
                      nombre: (nuevoTipo[f.id] ?? '').trim(),
                      orden: (f.tipos?.length ?? 0) + 1,
                    },
                    {
                      onSuccess: () =>
                        setNuevoTipo((s) => ({ ...s, [f.id]: '' })),
                    },
                  )
                }
              >
                <PlusIcon className="size-4" />
                Añadir tipo
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PanelFotos>
  );
}

/**
 * El catálogo de actividades estándar (§ Fase 2).
 *
 * ⚠️ Lo que se define aquí es una PROPUESTA. Al dar de alta un equipo se
 * preselecciona lo de su tipo de sistema y quien lo crea lo ajusta; y lo que
 * acaba en una intervención es una COPIA del nombre. Por eso renombrar o borrar
 * aquí no cambia ni una inspección ya hecha — y por eso el borrado no está
 * bloqueado como el de un tipo de sistema, donde sí hay filas apuntando.
 */
/**
 * Cómo se lee cada tipo de evidencia. Los MISMOS textos que el diálogo de una
 * actividad: si divergen, la propuesta y lo propuesto dejan de parecer lo
 * mismo. `Record` completo, así que añadir un tipo no compila hasta nombrarlo.
 */
const ETIQUETA_EVIDENCIA: Record<TipoEvidencia, string> = {
  NINGUNA: 'No se pide foto',
  UNA: 'Una foto',
  ANTES_DESPUES: 'Antes y después',
};

function CatalogoDeActividades() {
  const { data: catalogo, isError } = useCatalogoActividades();
  const { data: familias } = useSistemas();
  const crear = useCrearDefinicionActividad();
  const editar = useEditarDefinicionActividad();
  const eliminar = useEliminarDefinicionActividad();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [evidencia, setEvidencia] = useState<TipoEvidencia>('UNA');

  const todosLosTipos = (familias ?? []).flatMap((f) =>
    (f.tipos ?? []).map((t) => ({ ...t, familiaNombre: f.nombre })),
  );

  if (!catalogo && !isError)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  return (
    <PanelFotos as="section">
      <h2 className="mb-1 font-medium text-foreground">
        Catálogo de actividades
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Lo que se propone al dar de alta un equipo, según su tipo de sistema.
        Se puede añadir o quitar en cada intervención: esto es la propuesta, no la
        obligación.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input
          className="w-64"
          placeholder="Nombre de la actividad…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input
          className="w-72"
          placeholder="Descripción (opcional)…"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <Select
          className="w-44"
          aria-label="Evidencia que se propone"
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value as TipoEvidencia)}
        >
          {Object.entries(ETIQUETA_EVIDENCIA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </Select>
        <Button
          disabled={!nombre.trim() || crear.isPending}
          onClick={() =>
            crear.mutate(
              {
                nombre: nombre.trim(),
                descripcion: descripcion.trim() || null,
                orden: (catalogo?.length ?? 0) + 1,
                evidencia,
              },
              {
                onSuccess: () => {
                  setNombre('');
                  setDescripcion('');
                },
              },
            )
          }
        >
          <PlusIcon className="size-4" />
          Añadir
        </Button>
      </div>

      {catalogo?.length === 0 && (
        <EmptyState
          icon={ListChecksIcon}
          title="Catálogo vacío"
          description="Añade actividades y asígnalas a los tipos de sistema para que se propongan solas."
        />
      )}

      <ul className="space-y-2">
        {(catalogo ?? []).map((d) => (
          <li key={d.id} className="rounded-md border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{d.nombre}</span>
              {!d.activo && (
                <span className="text-xs text-muted-foreground">Retirada</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {/* ⚠️ Cambiarla aquí NO reescribe las actividades ya creadas:
                    la evidencia se COPIA al estamparla, como el nombre. Lo
                    que cambia es lo que se propondrá la próxima vez. */}
                <Select
                  className="w-40"
                  aria-label={`Evidencia de ${d.nombre}`}
                  value={d.evidencia}
                  onChange={(ev) =>
                    editar.mutate({
                      id: d.id,
                      payload: { evidencia: ev.target.value as TipoEvidencia },
                    })
                  }
                >
                  {Object.entries(ETIQUETA_EVIDENCIA).map(([valor, etq]) => (
                    <option key={valor} value={valor}>
                      {etq}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    editar.mutate({ id: d.id, payload: { activo: !d.activo } })
                  }
                >
                  {d.activo ? 'Retirar' : 'Reactivar'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${d.nombre}`}
                  onClick={() => eliminar.mutate(d.id)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>

            {d.descripcion && (
              <p className="mt-1 text-xs text-muted-foreground">
                {d.descripcion}
              </p>
            )}

            {/* La asociación a tipos, con casillas: es M:N porque «Limpieza de
                filtros» aplica a casi todo, y duplicar la definición por tipo
                devolvería el problema de los nombres parecidos. */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {todosLosTipos.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Todavía no hay tipos de sistema a los que asociarla.
                </span>
              )}
              {todosLosTipos.map((t) => {
                const puesto = d.tipos.some((x) => x.id === t.id);
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={puesto}
                      onChange={(e) =>
                        editar.mutate({
                          id: d.id,
                          payload: {
                            tiposSistema: e.target.checked
                              ? [...d.tipos.map((x) => x.id), t.id]
                              : d.tipos
                                  .map((x) => x.id)
                                  .filter((x) => x !== t.id),
                          },
                        })
                      }
                    />
                    {t.familiaNombre} · {t.nombre}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </PanelFotos>
  );
}

/**
 * Qué datos se piden de cada equipo.
 *
 * Sustituye al catálogo de Gestión de Equipos, del que Fotos se desenganchó
 * en la Fase 1a: la información del equipo es ahora propia y la define aquí
 * un ADMIN_GLOBAL, sin tocar código.
 *
 * ⚠️ El TIPO no se puede cambiar después, y por eso el formulario de alta lo
 * pide y el de edición no: cambiar un campo de Texto a Fecha dejaría lo ya
 * capturado en la columna equivocada, y no hay conversión correcta para
 * todos los valores. Para cambiar de tipo se crea otro campo y se retira
 * éste, que conserva lo suyo.
 */
function CamposDeEquipoAdmin() {
  const { data: campos, isError } = useCamposEquipo();
  const crear = useCrearCampoEquipo();
  const editar = useEditarCampoEquipo();
  const eliminar = useEliminarCampoEquipo();
  const agregarOpcion = useAgregarOpcionCampo();
  const quitarOpcion = useEliminarOpcionCampo();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCampoFotos>('TEXTO');
  const [opciones, setOpciones] = useState('');
  const [nuevaOpcion, setNuevaOpcion] = useState<Record<number, string>>({});

  const enviar = () => {
    const lista = opciones
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    crear.mutate(
      {
        nombre: nombre.trim(),
        tipo,
        opciones: tipo === 'LISTA' ? lista : undefined,
      },
      {
        onSuccess: () => {
          setNombre('');
          setOpciones('');
          setTipo('TEXTO');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <ColoresDelExplorador />

      <PanelFotos denso>
        <h2 className="mb-3 font-medium text-foreground">Nuevo campo</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del campo (Marca, Nº de serie…)"
          />
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCampoFotos)}
          >
            {TIPOS_CAMPO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
          <Button
            onClick={enviar}
            disabled={crear.isPending || nombre.trim() === ''}
          >
            {crear.isPending ? <Spinner /> : <PlusIcon />}
            Añadir
          </Button>
        </div>
        {tipo === 'LISTA' && (
          <div className="mt-3 space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Opciones <span className="text-destructive">*</span>
            </label>
            <Input
              value={opciones}
              onChange={(e) => setOpciones(e.target.value)}
              placeholder="Separadas por comas: R-410A, R-32, R-22"
            />
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Todos los campos son opcionales al crear un equipo: nunca bloquean el
          registro en obra.
        </p>
      </PanelFotos>

      {!campos && !isError && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          No se pudieron cargar los campos.
        </p>
      )}

      {campos?.length === 0 && (
        <EmptyState
          icon={WrenchIcon}
          title="Sin campos configurados"
          description="Añade los datos que se pedirán de cada equipo: marca, modelo, número de serie…"
        />
      )}

      <div className="space-y-2">
        {campos?.map((c) => (
          <PanelFotos key={c.id} denso>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {c.nombre}
                  <Badge variant="secondary">{ETIQUETA_TIPO[c.tipo]}</Badge>
                  {!c.activo && <Badge variant="warning">Retirado</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  clave: <code>{c.clave}</code>
                  {c._count ? ` · ${c._count.valores} equipo(s)` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    editar.mutate({ id: c.id, payload: { activo: !c.activo } })
                  }
                  disabled={editar.isPending}
                >
                  {c.activo ? 'Retirar' : 'Reactivar'}
                </Button>
                {/* Solo se ofrece borrar si nadie lo usa: con valores el
                    backend contesta 400, y un botón que siempre falla es peor
                    que no tenerlo. */}
                {c._count?.valores === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => eliminar.mutate(c.id)}
                    disabled={eliminar.isPending}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            </div>

            {c.tipo === 'LISTA' && (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {c.opciones.map((o) => (
                    <span
                      key={o.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs',
                        !o.activo && 'text-muted-foreground line-through',
                      )}
                    >
                      {o.etiqueta}
                      <button
                        type="button"
                        onClick={() => quitarOpcion.mutate(o.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Quitar ${o.etiqueta}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={nuevaOpcion[c.id] ?? ''}
                    onChange={(e) =>
                      setNuevaOpcion((s) => ({ ...s, [c.id]: e.target.value }))
                    }
                    placeholder="Nueva opción"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      agregarOpcion.isPending ||
                      !(nuevaOpcion[c.id] ?? '').trim()
                    }
                    onClick={() =>
                      agregarOpcion.mutate(
                        {
                          id: c.id,
                          etiqueta: (nuevaOpcion[c.id] ?? '').trim(),
                        },
                        {
                          onSuccess: () =>
                            setNuevaOpcion((s) => ({ ...s, [c.id]: '' })),
                        },
                      )
                    }
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </div>
            )}
          </PanelFotos>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── Plantillas (§20) ────────────────────────── */

function Plantillas() {
  const { data: plantillas, isError } = usePlantillas();
  const guardar = useGuardarPlantilla();
  const eliminar = useEliminarPlantilla();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [nodos, setNodos] = useState<NodoPlantillaNuevo[]>([]);
  const [nuevoNodo, setNuevoNodo] = useState('');
  const [tipoNodo, setTipoNodo] = useState<TipoNodoPlantilla>('ACTIVIDAD');

  const limpiar = () => {
    setNombre('');
    setDescripcion('');
    setNodos([]);
    setNuevoNodo('');
  };

  const anadirNodo = () => {
    const texto = nuevoNodo.trim();
    if (!texto) return;
    setNodos((previos) => [...previos, { tipo: tipoNodo, nombre: texto }]);
    setNuevoNodo('');
  };

  const crear = () => {
    if (!nombre.trim()) return;
    guardar.mutate(
      {
        id: null,
        payload: {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          nodos,
        },
      },
      { onSuccess: limpiar },
    );
  };

  if (!plantillas && !isError)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-medium text-foreground">Plantillas guardadas</h2>

        {plantillas?.length === 0 ? (
          <EmptyState
            icon={LayoutTemplateIcon}
            title="Sin plantillas"
            description="Crea una para no volver a teclear el mismo checklist en cada equipo."
          />
        ) : (
          <ul className="space-y-2">
            {plantillas?.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {p.nombre}
                    {!p.activa && <Badge variant="secondary">Desactivada</Badge>}
                  </p>
                  {p.descripcion && (
                    <p className="text-sm text-muted-foreground">
                      {p.descripcion}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {p._count.nodos} elemento(s) · {p.creadoPor?.nombre ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      guardar.mutate({
                        id: p.id,
                        payload: { nombre: p.nombre, activa: !p.activa },
                      })
                    }
                  >
                    {p.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar ${p.nombre}`}
                    title={`Eliminar ${p.nombre}`}
                    onClick={() => eliminar.mutate(p.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground">Nueva plantilla</h2>
        {/* El ejemplo de §20, para que se entienda de qué va sin leer nada. */}
        <p className="text-sm text-muted-foreground">
          Un molde que se estampa sobre un equipo. Por ejemplo «Inspección de
          Equipo»: Estado general, Pernos, Soldaduras, Estructura y un álbum de
          Evidencia fotográfica.
        </p>

        <Input
          placeholder="Nombre de la plantilla"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input
          placeholder="Descripción (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <div className="flex gap-2">
          <Select
            className="w-32"
            value={tipoNodo}
            onChange={(e) => setTipoNodo(e.target.value as TipoNodoPlantilla)}
          >
            {TIPOS_NODO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Añadir elemento…"
            value={nuevoNodo}
            onChange={(e) => setNuevoNodo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadirNodo()}
          />
          <Button variant="outline" onClick={anadirNodo} disabled={!nuevoNodo.trim()}>
            <PlusIcon />
          </Button>
        </div>

        {nodos.length > 0 && (
          <ul className="space-y-1">
            {nodos.map((n, i) => (
              <li
                key={`${n.tipo}-${n.nombre}-${i}`}
                className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline">
                    {TIPOS_NODO.find((t) => t.valor === n.tipo)?.etiqueta}
                  </Badge>
                  {n.nombre}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Quitar ${n.nombre}`}
                  title={`Quitar ${n.nombre}`}
                  onClick={() => setNodos((p) => p.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={crear}
          disabled={!nombre.trim() || nodos.length === 0 || guardar.isPending}
        >
          Crear plantilla
        </Button>
      </section>
    </div>
  );
}

/* ────────────────────────── Auditoría (§23) ────────────────────────── */

function Auditoria() {
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { data, isError } = useAuditoria({ accion, desde, hasta });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Acción
          </label>
          <Select
            className="h-9"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(ETIQUETA_ACCION).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Desde</label>
          <Input
            type="date"
            className="h-9"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Hasta</label>
          <Input
            type="date"
            className="h-9"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        {/* Exporta LO QUE SE ESTÁ VIENDO: los mismos filtros viajan en la
            ruta. Un archivo con más filas que la tabla de al lado parece un
            fallo, y además la bitácora solo crece — el backend tapa en 200
            eventos y lo dice en la cabecera del archivo. */}
        <div className="ml-auto">
          <BotonesExportar
            ruta={`/fotos/auditoria/exportar?${new URLSearchParams(
              Object.entries({ accion, desde, hasta }).filter(([, v]) => v),
            ).toString()}`}
            nombre="auditoria-fotos"
          />
        </div>
      </div>

      {!data && !isError ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : data?.eventos.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Sin eventos"
          description="No hay actividad registrada con esos filtros."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Cuándo</th>
                <th className="px-3 py-2 font-medium">Quién</th>
                <th className="px-3 py-2 font-medium">Acción</th>
                <th className="px-3 py-2 font-medium">Qué</th>
                <th className="px-3 py-2 font-medium">Dónde</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data?.eventos.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatActualizado(e.creadoEn)}
                  </td>
                  {/* `usuarioNombre` y no la relación: dar de baja una cuenta
                      pone la FK a null y la bitácora conserva la firma. */}
                  <td className="px-3 py-2">{e.usuarioNombre ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {ETIQUETA_ACCION[e.accion] ?? e.accion}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {e.descripcion ?? '—'}
                    {e.campoAfectado && (
                      <span className="block text-xs text-muted-foreground">
                        {e.campoAfectado}: {e.valorAnterior ?? '—'} →{' '}
                        {e.valorNuevo ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.carpeta?.nombre ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                    {e.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
