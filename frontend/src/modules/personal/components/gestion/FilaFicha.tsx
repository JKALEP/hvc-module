import { useState } from 'react';
import { CopyIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { TableRow, TableCell } from '@/shared/ui/table';
import { cn } from '@/shared/lib/utils';
import { COLUMNAS } from '@/modules/personal/lib/sctr';
import type {
  FichaPersonal,
  DatosFicha,
  Catalogo,
} from '@/modules/personal/types';

/** yyyy-mm-dd para el <input type="date">. */
function aValorFecha(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Una celda editable.
 *
 * Guarda al salir del foco y no en cada tecla: escribir un DNI son ocho
 * pulsaciones y no ocho peticiones. Si el valor no cambió, no llama.
 */
function Celda({
  valor,
  onGuardar,
  opciones,
  tipo,
  ancho,
  invalida,
}: {
  valor: string;
  onGuardar: (nuevo: string) => void;
  opciones?: string[];
  tipo?: 'fecha' | 'numero';
  ancho: string;
  invalida?: boolean;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const mostrado = borrador ?? valor;

  const confirmar = () => {
    if (borrador !== null && borrador !== valor) onGuardar(borrador);
    setBorrador(null);
  };

  const clases = cn(
    'h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm outline-none',
    'hover:border-input focus:border-ring focus:bg-background focus:ring-3 focus:ring-ring/30',
    tipo === 'numero' && 'text-right tabular-nums',
    invalida && 'border-destructive/50 bg-destructive/5',
  );

  // Los campos con catálogo llevan datalist: se elige de la lista, pero
  // también se puede escribir un valor nuevo — el backend guarda texto
  // libre y el catálogo es solo una sugerencia.
  const idLista = opciones ? `lista-${opciones.length}-${opciones[0] ?? ''}` : undefined;

  return (
    <TableCell className={cn('p-0.5', ancho)}>
      <input
        className={clases}
        type={tipo === 'fecha' ? 'date' : 'text'}
        inputMode={tipo === 'numero' ? 'decimal' : undefined}
        value={tipo === 'fecha' ? aValorFecha(mostrado) : mostrado}
        list={idLista}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setBorrador(null);
            e.currentTarget.blur();
          }
        }}
      />
      {opciones && (
        <datalist id={idLista}>
          {opciones.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </TableCell>
  );
}

export function FilaFicha({
  ficha,
  catalogo,
  seleccionada,
  onSeleccionar,
  onCambiar,
  onDuplicar,
  onEliminar,
}: {
  ficha: FichaPersonal;
  catalogo?: Catalogo;
  seleccionada: boolean;
  onSeleccionar: (id: number, marcada: boolean) => void;
  onCambiar: (id: number, cambios: Partial<DatosFicha>) => void;
  onDuplicar: (id: number) => void;
  onEliminar: (id: number) => void;
}) {
  // Una fila duplicada nace con COPIA-N y hay que escribirle el DNI real
  // antes de exportar; se marca para que no pase inadvertida.
  const documentoProvisional = ficha.numeroDocumento.startsWith('COPIA-');

  return (
    <TableRow className={cn(seleccionada && 'bg-muted/50')}>
      <TableCell className="w-8 p-0.5 text-center">
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={(e) => onSeleccionar(ficha.id, e.target.checked)}
          className="size-4 rounded border-input"
          aria-label={`Seleccionar a ${ficha.nombres}`}
        />
      </TableCell>

      {COLUMNAS.map((col) => (
        <Celda
          key={col.clave}
          ancho={col.ancho}
          tipo={col.tipo}
          valor={String(ficha[col.clave] ?? '')}
          opciones={
            col.catalogo
              ? catalogo?.[col.catalogo]?.map((o) => o.valor)
              : undefined
          }
          invalida={col.clave === 'numeroDocumento' && documentoProvisional}
          onGuardar={(nuevo) => onCambiar(ficha.id, { [col.clave]: nuevo })}
        />
      ))}

      <TableCell className="w-20 p-0.5">
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicar fila"
            title="Duplicar fila"
            onClick={() => onDuplicar(ficha.id)}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar fila"
            title="Eliminar fila"
            onClick={() => onEliminar(ficha.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
