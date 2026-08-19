import { useState } from 'react';
import { HistoryIcon, LayoutTemplateIcon, PlusIcon, Trash2Icon } from 'lucide-react';

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
  useAuditoria,
  usePlantillas,
  useGuardarPlantilla,
  useEliminarPlantilla,
} from '@/modules/fotos/hooks/useAdminFotos';
import type { NodoPlantillaNuevo, TipoNodoPlantilla } from '@/modules/fotos/types';

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
 * Administración de Fotos: plantillas (§20) y auditoría (§23).
 *
 * Las dos juntas porque son lo mismo —configurar el módulo, no trabajar
 * dentro de una carpeta— y porque las dos son de administrador. La
 * importación por Excel NO está aquí: se hace DENTRO de la carpeta destino,
 * que es donde tiene sentido elegir a dónde va.
 */
export function AdminFotos() {
  const [pestana, setPestana] = useState<'plantillas' | 'auditoria'>(
    'plantillas',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Fotos"
        description="Las plantillas de estructura y el registro de quién hizo qué."
      />

      <div className="flex gap-1 border-b border-border">
        {(
          [
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

      {pestana === 'plantillas' ? <Plantillas /> : <Auditoria />}
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
