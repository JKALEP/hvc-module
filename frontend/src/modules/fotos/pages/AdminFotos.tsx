import { useState } from 'react';
import { FolderIcon, HistoryIcon, LayoutTemplateIcon, PlusIcon, Trash2Icon, WrenchIcon, XIcon } from 'lucide-react';

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
import type { TipoCampoFotos } from '@/modules/fotos/types';
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
  TAREA_COMPLETADA: 'Tarea completada',
  TAREA_REABIERTA: 'Tarea reabierta',
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
  { valor: 'TAREA', etiqueta: 'Tarea' },
  { valor: 'ALBUM', etiqueta: 'Álbum' },
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
    'campos' | 'plantillas' | 'auditoria'
  >('campos');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Fotos"
        description="Los datos que se piden de cada equipo, las plantillas de estructura y el registro de quién hizo qué."
      />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['campos', 'Campos de equipo', WrenchIcon],
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
    <div className="surface p-4">
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
    </div>
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

      <div className="surface p-4">
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
      </div>

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
          <div key={c.id} className="surface p-4">
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
          </div>
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
  const [tipoNodo, setTipoNodo] = useState<TipoNodoPlantilla>('TAREA');

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
