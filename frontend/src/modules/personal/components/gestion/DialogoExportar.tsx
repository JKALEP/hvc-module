import { useState } from 'react';
import { DownloadIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { useExportarExcel } from '@/modules/personal/hooks/useFichas';
import { MESES } from '@/modules/personal/lib/sctr';
import type { TipoPersonal } from '@/modules/personal/types';

type Alcance = 'AMBOS' | TipoPersonal;

/**
 * Exporta la lista con el formato del archivo original, para que el
 * documento siga sirviendo para el trámite SCTR.
 */
export function DialogoExportar({
  anio,
  mes,
  tipoActual,
  onCerrar,
}: {
  anio: number;
  mes: number;
  tipoActual: TipoPersonal;
  onCerrar: () => void;
}) {
  const exportar = useExportarExcel();
  const [alcance, setAlcance] = useState<Alcance>(tipoActual);

  const descargar = () => {
    exportar.mutate(
      {
        anio,
        mes,
        tipo: alcance === 'AMBOS' ? undefined : alcance,
      },
      { onSuccess: () => onCerrar() },
    );
  };

  const opciones: { valor: Alcance; titulo: string; detalle: string }[] = [
    {
      valor: 'CONTRATISTA',
      titulo: 'Solo contratistas',
      detalle: 'Una hoja: OPERATIVO',
    },
    {
      valor: 'SUPERVISOR',
      titulo: 'Solo supervisores',
      detalle: 'Una hoja: SUPERVISORES',
    },
    {
      valor: 'AMBOS',
      titulo: 'Los dos en un solo libro',
      detalle: 'Dos hojas: OPERATIVO + SUPERVISORES, como el archivo original',
    },
  ];

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Exportar {MESES[mes - 1]} {anio}
          </DialogTitle>
          <DialogDescription>
            El archivo sale con el mismo formato del original: fila de grupo
            combinada y con su color, los encabezados en su orden, el NUM. IDENT
            como texto y las fechas en dd/mm/aaaa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {opciones.map((o) => (
            <label
              key={o.valor}
              className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
            >
              <input
                type="radio"
                checked={alcance === o.valor}
                onChange={() => setAlcance(o.valor)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {o.titulo}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {o.detalle}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={descargar} disabled={exportar.isPending}>
            {exportar.isPending ? <Spinner /> : <DownloadIcon />}
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
