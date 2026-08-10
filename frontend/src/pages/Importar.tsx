import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileUpIcon, SaveIcon, XIcon, UploadCloudIcon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { ProgresoImportacion } from '@/components/shared/ProgresoImportacion';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { TablaEdicionFilas } from '@/components/shared/TablaEdicionFilas';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSubirExcel, useEliminarImportacion } from '@/hooks/useImportacionMutations';
import { useImportacion } from '@/hooks/useImportacion';
import { QUERY_KEYS } from '@/lib/constants';
import { formatFecha } from '@/lib/format';

export function Importar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importacionId, setImportacionId] = useState<number | null>(null);

  const subir = useSubirExcel();
  const cancelarMut = useEliminarImportacion();
  const { data, isLoading } = useImportacion(importacionId ?? undefined);

  const onArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    subir.mutate(file, {
      onSuccess: (imp) => {
        // Sembramos el detalle en caché para evitar un refetch/parpadeo.
        qc.setQueryData(QUERY_KEYS.importacion(imp.id), imp);
        setImportacionId(imp.id);
      },
    });
    e.target.value = ''; // permite volver a subir el mismo archivo
  };

  const cancelar = () => {
    if (importacionId === null) return;
    cancelarMut.mutate(importacionId, {
      onSuccess: () => setImportacionId(null),
    });
  };

  // ── Pantalla 1: subir archivo ──
  if (importacionId === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Importar Excel"
          description="Sube un requerimiento en Excel. Se leerán las columnas Descripción, Unidad, Detalles y Referencias."
        />

        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileUpIcon className="size-7" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Selecciona un archivo Excel
              </p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Formatos .xlsx o .xls. El código, precio, proveedor y RUC los
                completarás después.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onArchivo}
            />
            <Button
              size="lg"
              disabled={subir.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {subir.isPending ? <Spinner /> : <UploadCloudIcon />}
              {subir.isPending ? 'Procesando…' : 'Subir archivo'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Pantalla 2: revisión / edición de filas ──
  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisar importación"
        description="Edita las filas, completa los datos y guarda. Puedes duplicar una fila para agregar otro proveedor."
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

      {data && (
        <p className="text-sm text-muted-foreground">
          Archivo:{' '}
          <span className="font-medium text-foreground">
            {data.nombreArchivo}
          </span>{' '}
          · {formatFecha(data.fechaImportacion)}
        </p>
      )}

      {isLoading && <TableSkeleton rows={5} cols={8} />}

      {data && (
        <TablaEdicionFilas
          importacionId={importacionId}
          productos={data.productos}
          onGuardado={() => navigate('/importaciones')}
          renderFooter={({ guardarTodo, guardando }) => (
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={cancelar}
                disabled={cancelarMut.isPending || guardando}
              >
                {cancelarMut.isPending ? <Spinner /> : <XIcon />}
                Cancelar
              </Button>
              <Button onClick={guardarTodo} disabled={guardando}>
                {guardando ? <Spinner /> : <SaveIcon />}
                Guardar
              </Button>
            </div>
          )}
        />
      )}
    </div>
  );
}
