import { useNavigate } from 'react-router-dom';
import { ClipboardListIcon, UploadCloudIcon, ChevronRightIcon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { ProgresoImportacion } from '@/components/shared/ProgresoImportacion';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useImportaciones } from '@/hooks/useImportaciones';
import { formatFecha } from '@/lib/format';

export function Importaciones() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useImportaciones();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importaciones"
        description="Historial de archivos importados y su estado de completitud."
        actions={
          <Button onClick={() => navigate('/importar')}>
            <UploadCloudIcon />
            Nueva importación
          </Button>
        }
      />

      {isLoading && <TableSkeleton rows={6} cols={4} />}

      {isError && (
        <EmptyState
          icon={ClipboardListIcon}
          title="No se pudieron cargar las importaciones"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={ClipboardListIcon}
          title="Aún no hay importaciones"
          description="Sube tu primer archivo Excel para empezar a registrar cotizaciones."
          action={
            <Button onClick={() => navigate('/importar')}>
              <UploadCloudIcon />
              Importar Excel
            </Button>
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((imp) => (
                <TableRow
                  key={imp.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/importaciones/${imp.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {imp.nombreArchivo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFecha(imp.fechaImportacion)}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={imp.estado} />
                  </TableCell>
                  <TableCell>
                    <ProgresoImportacion
                      completas={imp.filasCompletas}
                      total={imp.totalFilas}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <ChevronRightIcon className="size-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
