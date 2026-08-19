import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  SaveIcon,
  ShoppingCartIcon,
} from 'lucide-react';

import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { TablaLineas } from '@/modules/equipos/components/TablaLineas';
import {
  useDocumento,
  useEditarDocumento,
  useOrdenDesdeCotizacion,
  useExportar,
} from '@/modules/equipos/hooks/useDocumentos';
import {
  ETIQUETA_DOCUMENTO,
  ESTADOS_DOCUMENTO,
  estadoDe,
  aBorradores,
} from '@/modules/equipos/lib/documentos';
import type {
  TipoDocumento,
  Cotizacion,
  OrdenCompra,
  LineaBorrador,
} from '@/modules/equipos/types';

/** Un dato de la cabecera: etiqueta arriba, valor abajo. */
function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * El documento en sí, ya cargado.
 *
 * Va aparte y montado con `key={documento.id}` para que el borrador se
 * siembre en el `useState` inicial. Con la carga en el mismo componente
 * habría hecho falta un efecto que copiara los datos al estado, y ese
 * efecto pisaría lo que se esté escribiendo en cada refetch.
 */
function VistaDocumento({
  documento,
  tipo,
  organizacionId,
}: {
  documento: Cotizacion | OrdenCompra;
  tipo: TipoDocumento;
  organizacionId: number;
}) {
  const navegar = useNavigate();
  const editar = useEditarDocumento(organizacionId, tipo);
  const aOrden = useOrdenDesdeCotizacion(organizacionId);
  const exportar = useExportar();

  const [proveedor, setProveedor] = useState(documento.proveedor);
  const [lineas, setLineas] = useState<LineaBorrador[]>(() =>
    aBorradores(documento.lineas),
  );
  const [aEmitir, setAEmitir] = useState(false);

  const etiqueta = ETIQUETA_DOCUMENTO[tipo];
  const badge = estadoDe(tipo, documento.estado);
  const cotizacion = tipo === 'cotizacion' ? (documento as Cotizacion) : null;
  const emitidas = cotizacion?._count.ordenesCompra ?? 0;

  const guardar = () =>
    editar.mutate({
      id: documento.id,
      cambios: {
        proveedor: proveedor.trim(),
        // Una línea sin descripción es un renglón que se agregó y no se
        // llegó a llenar; el backend la rechazaría.
        lineas: lineas.filter((l) => l.descripcion.trim() !== ''),
      },
    });

  return (
    <div className="space-y-6">
      <Link
        to={`/equipos/${organizacionId}/documentos?tipo=${tipo}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a {etiqueta.plural.toLowerCase()}
      </Link>

      <article className="space-y-6 rounded-xl border border-border bg-card p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {etiqueta.singular}
            </p>
            <h1 className="text-2xl font-semibold text-foreground tabular-nums">
              {documento.codigo}
            </h1>
            <p className="text-sm text-muted-foreground">
              {documento.organizacion.nombre}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variante}>{badge.etiqueta}</Badge>
            <Select
              className="h-9 w-40"
              aria-label="Estado del documento"
              value={documento.estado}
              disabled={editar.isPending}
              onChange={(e) =>
                editar.mutate({
                  id: documento.id,
                  cambios: { estado: e.target.value },
                })
              }
            >
              {ESTADOS_DOCUMENTO[tipo].map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </Select>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-0.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Proveedor
            </label>
            <Input
              className="h-9"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>
          <Dato etiqueta="Fecha">
            <span className="tabular-nums">
              {new Date(documento.creadoEn).toLocaleDateString('es-PE')}
            </span>
          </Dato>
          <Dato etiqueta="Equipo">
            {documento.equipo ? (
              <Link
                className="underline underline-offset-2 hover:text-primary"
                to={`/equipos/${organizacionId}/inventario`}
              >
                {documento.equipo.codigoInterno ??
                  `Equipo ${documento.equipo.id}`}
              </Link>
            ) : (
              '—'
            )}
          </Dato>
          <Dato etiqueta="Incidencia">
            {documento.incidencia ? (
              <Link
                className="underline underline-offset-2 hover:text-primary"
                to={`/equipos/${organizacionId}/incidencias?equipo=${documento.equipo?.id ?? ''}`}
              >
                {documento.incidencia.codigo}
              </Link>
            ) : (
              '—'
            )}
          </Dato>
        </div>

        <TablaLineas lineas={lineas} onCambiar={setLineas} />

        <p className="text-xs text-muted-foreground">
          El total se recalcula al escribir. Guarda para que quede en el
          documento: la cifra que vale es la que devuelve el servidor.
        </p>
      </article>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={guardar} disabled={editar.isPending}>
          {editar.isPending ? <Spinner /> : <SaveIcon />}
          Guardar cambios
        </Button>

        <Button
          variant="outline"
          disabled={exportar.isPending}
          onClick={() =>
            exportar.mutate({ tipo, id: documento.id, formato: 'excel' })
          }
        >
          <FileSpreadsheetIcon />
          Exportar a Excel
        </Button>
        <Button
          variant="outline"
          disabled={exportar.isPending}
          onClick={() =>
            exportar.mutate({ tipo, id: documento.id, formato: 'pdf' })
          }
        >
          <FileTextIcon />
          Exportar a PDF
        </Button>

        {cotizacion && (
          <Button
            variant="outline"
            className="ml-auto"
            disabled={aOrden.isPending}
            onClick={() => setAEmitir(true)}
          >
            <ShoppingCartIcon />
            Emitir orden de compra
            {emitidas > 0 &&
              ` (${emitidas} ya emitida${emitidas > 1 ? 's' : ''})`}
          </Button>
        )}

        {tipo === 'orden-compra' && (documento as OrdenCompra).cotizacion && (
          <Link
            className="ml-auto text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            to={`/equipos/${organizacionId}/documentos/cotizacion/${(documento as OrdenCompra).cotizacion!.id}`}
          >
            Viene de {(documento as OrdenCompra).cotizacion!.codigo}
          </Link>
        )}
      </div>

      {aEmitir && cotizacion && (
        <DialogoConfirmar
          titulo={`¿Emitir una orden desde ${cotizacion.codigo}?`}
          mensaje="Se crea una orden de compra nueva con estas mismas líneas."
          detalle="La orden queda independiente: editar la cotización después ya no la cambia. Guarda antes los cambios que tengas sin guardar."
          textoConfirmar="Emitir orden"
          ocupado={aOrden.isPending}
          onCerrar={() => setAEmitir(false)}
          onConfirmar={() =>
            aOrden.mutate(cotizacion.id, {
              onSuccess: (r) => {
                setAEmitir(false);
                navegar(
                  `/equipos/${organizacionId}/documentos/orden-compra/${r.id}`,
                );
              },
            })
          }
        />
      )}
    </div>
  );
}

/**
 * Un documento, en pantalla y editable.
 *
 * No hay «vista» y «edición» separadas: lo que se ve ES el documento y
 * se escribe encima. Los dos botones de exportar generan el Excel o el
 * PDF en el servidor a cada pulsación — el sistema nunca guarda un
 * archivo que pueda quedar desfasado de estas líneas.
 */
export function Documento() {
  const {
    id,
    tipo: tipoUrl,
    docId,
  } = useParams<{ id: string; tipo: string; docId: string }>();
  const organizacionId = Number(id);
  const tipo: TipoDocumento =
    tipoUrl === 'orden-compra' ? 'orden-compra' : 'cotizacion';

  const { data, isError } = useDocumento(tipo, Number(docId));

  if (isError)
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No se pudo cargar el documento"
        description="Puede que se haya eliminado. Vuelve a la lista de documentos."
      />
    );

  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Cargando documento…
      </div>
    );

  return (
    <VistaDocumento
      key={data.id}
      documento={data}
      tipo={tipo}
      organizacionId={organizacionId}
    />
  );
}
