import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, FileSpreadsheetIcon, FileTextIcon } from 'lucide-react';

import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import {
  useFichaEquipo,
  useExportarReporte,
} from '@/modules/equipos/hooks/useReportes';
import type { SeccionFicha } from '@/modules/equipos/types';

/** Un dato de la cabecera. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className="text-sm text-foreground">{valor}</p>
    </div>
  );
}

/**
 * Una sección de la ficha.
 *
 * Las columnas y las filas vienen del backend ya en texto, así que esto
 * pinta lo que le den sin saber de qué sección se trata: la de campos
 * tiene dos columnas y la de historial cuatro, y es el mismo componente.
 */
function Seccion({ seccion }: { seccion: SeccionFicha }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">
        {seccion.titulo}
      </h2>
      {seccion.filas.length === 0 ? (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {seccion.vacio}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {seccion.columnas.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {seccion.filas.map((fila, i) => (
                <TableRow key={i}>
                  {fila.map((celda, j) => (
                    <TableCell
                      key={j}
                      className={j === 0 ? 'font-medium' : undefined}
                    >
                      {celda}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/**
 * La ficha de un equipo: el reporte individual.
 *
 * Todo lo suyo en una pantalla —características, incidencias,
 * cotizaciones, órdenes e historial— y los dos botones de exportar. El
 * texto lo arma el backend para que el Excel, el PDF y esta pantalla
 * digan exactamente lo mismo.
 */
export function FichaEquipo() {
  const { id, equipoId } = useParams<{ id: string; equipoId: string }>();
  const organizacionId = Number(id);
  const { data, isError } = useFichaEquipo(Number(equipoId));
  const exportar = useExportarReporte();

  if (isError)
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No se pudo cargar la ficha"
        description="Puede que el equipo se haya eliminado. Vuelve al inventario."
      />
    );

  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Cargando ficha…
      </div>
    );

  const { equipo, secciones } = data;
  const nombre = equipo.codigoInterno ?? `Equipo ${equipo.id}`;

  return (
    <div className="space-y-6">
      <Link
        to={`/equipos/${organizacionId}/inventario`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" />
        Volver al inventario
      </Link>

      <article className="space-y-6 rounded-xl border border-border bg-card p-6">
        <header className="border-b border-border pb-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ficha de equipo
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {equipo.organizacion.nombre} · {equipo.ubicacion}
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Código interno" valor={equipo.codigoInterno ?? '—'} />
          <Dato etiqueta="Ubicación" valor={equipo.ubicacion} />
          <Dato etiqueta="Registrado por" valor={equipo.creadoPor ?? '—'} />
          <Dato
            etiqueta="Última modificación"
            valor={new Date(equipo.actualizadoEn).toLocaleDateString('es-PE')}
          />
        </div>

        {secciones.map((s) => (
          <Seccion key={s.titulo} seccion={s} />
        ))}
      </article>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={exportar.isPending}
          onClick={() =>
            exportar.mutate({
              tipo: 'ficha',
              equipoId: equipo.id,
              formato: 'excel',
            })
          }
        >
          <FileSpreadsheetIcon />
          Exportar a Excel
        </Button>
        <Button
          variant="outline"
          disabled={exportar.isPending}
          onClick={() =>
            exportar.mutate({
              tipo: 'ficha',
              equipoId: equipo.id,
              formato: 'pdf',
            })
          }
        >
          <FileTextIcon />
          Exportar a PDF
        </Button>
      </div>
    </div>
  );
}
