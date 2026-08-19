import { useRef, useState } from 'react';
import { FileSpreadsheetIcon, AlertTriangleIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import {
  usePreviaImportacion,
  useConfirmarImportacion,
} from '@/modules/fotos/hooks/useAdminFotos';
import type { DecisionImportacion } from '@/modules/fotos/types';

const DECISIONES: { valor: DecisionImportacion; etiqueta: string }[] = [
  { valor: 'OMITIR', etiqueta: 'Omitir' },
  { valor: 'ACTUALIZAR', etiqueta: 'Actualizar' },
  { valor: 'CREAR', etiqueta: 'Crear otra' },
];

/**
 * Importar estructura desde Excel (§19).
 *
 * Dos pasos, y el orden importa: **vista previa antes de escribir**. §19 lo
 * pide así porque un Excel de obra crea decenas de carpetas de una vez y
 * deshacerlo a mano no es viable — se mira qué va a pasar, se deciden los
 * conflictos, y solo entonces se confirma.
 *
 * El archivo se guarda en el estado del componente y se manda las DOS veces:
 * el servidor no recuerda nada entre la previa y la confirmación, así que no
 * hay sesión de importación que pueda quedarse colgada.
 */
export function DialogoImportar({
  carpetaId,
  carpetaNombre,
  abierto,
  onCerrar,
}: {
  carpetaId: number;
  carpetaNombre: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const previa = usePreviaImportacion();
  const confirmar = useConfirmarImportacion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [decisiones, setDecisiones] = useState<
    Record<number, DecisionImportacion>
  >({});

  const resultado = previa.data;

  const limpiar = () => {
    setArchivo(null);
    setDecisiones({});
    previa.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const cerrar = () => {
    limpiar();
    onCerrar();
  };

  const analizar = (f: File) => {
    setArchivo(f);
    setDecisiones({});
    previa.mutate({ carpetaId, archivo: f });
  };

  const importar = () => {
    if (!archivo) return;
    confirmar.mutate(
      { carpetaId, archivo, decisiones },
      { onSuccess: cerrar },
    );
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar estructura desde Excel</DialogTitle>
          <DialogDescription>
            Se creará dentro de «{carpetaNombre}». El Excel define carpetas,
            equipos, tareas y álbumes — no lleva fotos. Columnas: Carpeta,
            Subcarpeta, Equipo, Tipo, Nombre, Descripción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) analizar(f);
            }}
          />

          {previa.isPending && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          {resultado && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {resultado.resumen.carpetasNuevas} carpeta(s) nueva(s)
                </Badge>
                <Badge variant="secondary">
                  {resultado.resumen.carpetasExistentes} ya existían
                </Badge>
                <Badge variant="outline">
                  {resultado.resumen.hojasNuevas} tarea(s)/álbum(es)
                </Badge>
                {resultado.resumen.conflictos > 0 && (
                  <Badge variant="warning">
                    {resultado.resumen.conflictos} conflicto(s)
                  </Badge>
                )}
                {resultado.resumen.problemas > 0 && (
                  <Badge variant="warning">
                    {resultado.resumen.problemas} fila(s) con problema
                  </Badge>
                )}
              </div>

              {/* Los problemas primero: son filas que NO se van a importar,
                  y quien confirma tiene que saberlo antes de pulsar. */}
              {resultado.problemas.length > 0 && (
                <div className="space-y-1 rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangleIcon className="size-4" />
                    Estas filas se saltarán
                  </p>
                  <ul className="space-y-0.5 text-sm text-muted-foreground">
                    {resultado.problemas.map((p) => (
                      <li key={p.fila}>
                        Fila {p.fila}: {p.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {resultado.conflictos.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    Ya existen — decide qué hacer con cada una
                  </p>
                  <ul className="space-y-1.5">
                    {resultado.conflictos.map((c) => (
                      <li
                        key={c.fila}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="text-muted-foreground">
                            {c.camino} /{' '}
                          </span>
                          {c.nombre}
                        </span>
                        <Select
                          className="h-8 w-36"
                          value={decisiones[c.fila] ?? 'OMITIR'}
                          onChange={(e) =>
                            setDecisiones((d) => ({
                              ...d,
                              [c.fila]: e.target.value as DecisionImportacion,
                            }))
                          }
                        >
                          {DECISIONES.map((d) => (
                            <option key={d.valor} value={d.valor}>
                              {d.etiqueta}
                            </option>
                          ))}
                        </Select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {resultado.carpetas.map((c) => (
                      <tr key={c.camino} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5">
                          <span style={{ paddingLeft: `${(c.nivel - 1) * 16}px` }}>
                            {c.camino.split(' / ').pop()}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Badge
                            variant={c.estado === 'nueva' ? 'outline' : 'secondary'}
                          >
                            {c.estado === 'nueva' ? 'Se creará' : 'Ya existe'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            onClick={importar}
            disabled={!resultado || confirmar.isPending}
          >
            <FileSpreadsheetIcon />
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
