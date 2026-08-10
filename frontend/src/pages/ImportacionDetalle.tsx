import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ClipboardListIcon, SaveIcon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { ProgresoImportacion } from '@/components/shared/ProgresoImportacion';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { TablaEdicionFilas } from '@/components/shared/TablaEdicionFilas';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useImportacion } from '@/hooks/useImportacion';
import { formatFecha } from '@/lib/format';

export function ImportacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const importacionId = Number(id);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useImportacion(importacionId);

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate('/importaciones')}
        >
          <ArrowLeftIcon />
          Volver a importaciones
        </Button>

        <PageHeader
          title={data?.nombreArchivo ?? 'Detalle de importación'}
          description={
            data
              ? `Importado el ${formatFecha(data.fechaImportacion)}`
              : 'Cargando…'
          }
          actions={
            data && (
              <div className="flex items-center gap-3">
                <ProgresoImportacion
                  completas={data.filasCompletas}
                  total={data.totalFilas}
                />
                <EstadoBadge estado={data.estado} />
              </div>
            )
          }
        />
      </div>

      {isLoading && <TableSkeleton rows={6} cols={7} />}

      {isError && (
        <EmptyState
          icon={ClipboardListIcon}
          title="No se pudo cargar la importación"
          description="Puede que ya no exista o que el backend no esté disponible."
          action={
            <Button onClick={() => navigate('/importaciones')}>
              Volver a importaciones
            </Button>
          }
        />
      )}

      {data && data.productos.length > 0 && (
        <TablaEdicionFilas
          importacionId={importacionId}
          productos={data.productos}
          renderFooter={({ guardarTodo, guardando, hayCambios }) => (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Completa código, precio, proveedor y RUC en las filas
                pendientes. Al completarse todas, el estado pasa a{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Completo
                </span>
                .
              </p>
              <Button
                onClick={guardarTodo}
                disabled={guardando || !hayCambios}
              >
                {guardando ? <Spinner /> : <SaveIcon />}
                Guardar cambios
              </Button>
            </div>
          )}
        />
      )}

      {data && data.productos.length === 0 && (
        <EmptyState
          icon={ClipboardListIcon}
          title="Esta importación no tiene filas"
        />
      )}
    </div>
  );
}
