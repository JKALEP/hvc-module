import { useState } from 'react';
import { SaveIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  useRegistrarAjuste,
  useEliminarAjuste,
} from '@/hooks/useProyectoAnalitica';
import { formatFechaCorta, formatPorcentaje, hoyISO } from '@/lib/format';
import type { AjusteAvance } from '@/types/models';

/**
 * Ajuste manual del avance — la EXCEPCIÓN, no la rutina.
 *
 * El número por defecto de la obra es el calculado. Este formulario solo
 * sirve cuando el avance real incluye trabajo que no se mide en equipos
 * (planos, permisos, materiales). Por eso la justificación es obligatoria
 * y el bloque va visualmente separado del resto: nadie debería llegar aquí
 * por costumbre.
 */
export function FormularioAjusteAvance({
  proyectoId,
  ajustes,
  avanceCalculado,
}: {
  proyectoId: number;
  ajustes: AjusteAvance[];
  avanceCalculado: number | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [porcentaje, setPorcentaje] = useState('');
  const [observacion, setObservacion] = useState('');

  const registrar = useRegistrarAjuste(proyectoId);
  const eliminar = useEliminarAjuste(proyectoId);

  const invalido =
    porcentaje === '' ||
    fecha === '' ||
    observacion.trim() === '' ||
    Number(porcentaje) < 0 ||
    Number(porcentaje) > 100;

  const guardar = () => {
    registrar.mutate(
      {
        fecha,
        porcentaje: Number(porcentaje),
        observacion: observacion.trim(),
      },
      {
        onSuccess: () => {
          setPorcentaje('');
          setObservacion('');
          setAbierto(false);
        },
      },
    );
  };

  const desviacion =
    porcentaje === '' || avanceCalculado === null
      ? null
      : Number(porcentaje) - avanceCalculado;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-500" />
            Ajuste manual del avance
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            El avance de esta obra es{' '}
            <span className="font-medium text-foreground">
              {formatPorcentaje(avanceCalculado)}
            </span>
            , calculado sobre los equipos de todos los reportes diarios. Un
            ajuste solo tiene sentido si el avance real incluye trabajo que no
            se mide en equipos: planos, permisos, materiales. Queda registrado
            con su justificación y no reemplaza al número calculado.
          </p>
        </div>
        {!abierto && (
          <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
            Registrar ajuste
          </Button>
        )}
      </div>

      {abierto && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Fecha del ajuste
              </label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-32 space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Avance real (%)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                className="h-9 tabular-nums"
              />
            </div>
            {desviacion !== null && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Desviación
                </p>
                <p className="flex h-9 items-center text-sm font-semibold tabular-nums text-foreground">
                  {desviacion > 0 ? '+' : ''}
                  {desviacion.toFixed(2)} pts
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Justificación <span className="text-destructive">*</span>
            </label>
            <Input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Qué trabajo no medible en equipos justifica este ajuste"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Obligatoria. Sin ella, el número calculado deja de cuadrar y nadie
              sabe por qué.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAbierto(false)}
              disabled={registrar.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={guardar}
              disabled={invalido || registrar.isPending}
            >
              {registrar.isPending ? <Spinner /> : <SaveIcon />}
              Registrar ajuste
            </Button>
          </div>
        </div>
      )}

      {ajustes.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Fecha</TableHead>
                <TableHead>Avance declarado</TableHead>
                <TableHead>vs calculado</TableHead>
                <TableHead>Justificación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...ajustes].reverse().map((a) => {
                const valor = Number(a.porcentaje);
                const dif =
                  avanceCalculado === null ? null : valor - avanceCalculado;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">
                      {formatFechaCorta(a.fecha)}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {valor}%
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dif === null
                        ? '—'
                        : `${dif > 0 ? '+' : ''}${dif.toFixed(2)} pts`}
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {a.observacion ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar ajuste"
                        disabled={eliminar.isPending}
                        onClick={() => eliminar.mutate(a.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
