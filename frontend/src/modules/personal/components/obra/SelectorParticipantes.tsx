import { useMemo, useState } from 'react';
import { SearchIcon, SaveIcon, TriangleAlertIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { usePersonasPara } from '@/modules/personal/hooks/useObra';
import { fechaCorta } from '@/modules/personal/lib/obra';
import type { Jornada, PersonaElegible } from '@/modules/personal/types';

/**
 * Quién trabajó ese día, y quién supervisó.
 *
 * El buscador es ABIERTO a propósito: recorre todo el periodo de
 * personal que cubre la fecha, sin restringir a la empresa encargada,
 * porque a una obra puede venir gente de cualquier contrata. No existe
 * una lista de «quiénes debían venir»: solo se registra a quien vino.
 */
export function SelectorParticipantes({
  fecha,
  jornada,
  encargadoNombre,
  supervisorPorDefecto,
  onGuardar,
  onCerrar,
  guardando,
}: {
  fecha: string;
  jornada?: Jornada;
  encargadoNombre: string;
  supervisorPorDefecto: { id: number; nombre: string };
  onGuardar: (datos: {
    participantes: number[];
    supervisorFichaId: number | null;
    apoyoFichaId: number | null;
  }) => void;
  onCerrar: () => void;
  guardando: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [marcados, setMarcados] = useState<Set<number>>(
    () =>
      new Set(
        (jornada?.asistencias ?? [])
          .map((a) => a.fichaPersonalId)
          .filter((id): id is number => id !== null),
      ),
  );
  const [supervisor, setSupervisor] = useState(
    String(jornada?.supervisorFichaId ?? supervisorPorDefecto.id),
  );
  const [apoyo, setApoyo] = useState(String(jornada?.apoyoFichaId ?? ''));

  const { data: contratistas, isLoading } = usePersonasPara(
    fecha,
    'contratistas',
  );
  const { data: supervisores } = usePersonasPara(fecha, 'supervisores');

  const visibles = useMemo(() => {
    const todas = contratistas ?? [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (p) =>
        p.nombreCompleto.toLowerCase().includes(q) ||
        p.documento.includes(q) ||
        p.grupoNombre.toLowerCase().includes(q),
    );
  }, [contratistas, busqueda]);

  // Se listan primero los ya marcados: al reabrir un día, lo registrado
  // no queda escondido tras 70 nombres.
  const ordenadas = useMemo(
    () =>
      [...visibles].sort((a, b) => {
        const ma = marcados.has(a.id) ? 0 : 1;
        const mb = marcados.has(b.id) ? 0 : 1;
        return ma - mb || a.nombreCompleto.localeCompare(b.nombreCompleto);
      }),
    [visibles, marcados],
  );

  const alternar = (id: number) =>
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const externos = (contratistas ?? []).filter(
    (p) => marcados.has(p.id) && p.grupoNombre !== encargadoNombre,
  ).length;

  const sinPersonal = !isLoading && (contratistas ?? []).length === 0;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jornada del {fechaCorta(fecha)}</DialogTitle>
          <DialogDescription>
            Marca a quien efectivamente participó. Puedes registrar gente de
            cualquier empresa, no solo de la encargada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Supervisor del día
            </label>
            <Select
              className="h-9"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {(supervisores ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombreCompleto}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Apoyo del día
            </label>
            <Select
              className="h-9"
              value={apoyo}
              onChange={(e) => setApoyo(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {(supervisores ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombreCompleto}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {sinPersonal && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-500/10">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm whitespace-normal text-muted-foreground">
              No hay contratistas cargados para esta fecha. Importa la lista
              SCTR del mes en Gestión de personal.
            </p>
          </div>
        )}

        <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-2.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI o empresa"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          {isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando personal…
            </p>
          )}
          {!isLoading && ordenadas.length === 0 && !sinPersonal && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nadie coincide con la búsqueda.
            </p>
          )}
          {ordenadas.map((p: PersonaElegible) => {
            const marcado = marcados.has(p.id);
            const externo = p.grupoNombre !== encargadoNombre;
            return (
              <label
                key={p.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50',
                  marcado && 'bg-muted/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(p.id)}
                  className="size-4 shrink-0 rounded border-input"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {p.nombreCompleto}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.documento}
                  </span>
                </span>
                {/* Se resalta a quien no es de la encargada: es la forma
                    de ver el personal externo de un vistazo. */}
                <Badge variant={externo ? 'warning' : 'secondary'}>
                  {p.grupoNombre}
                </Badge>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {marcados.size} participante(s)
            {externos > 0 && ` · ${externos} de otra empresa`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              disabled={guardando}
              onClick={() =>
                onGuardar({
                  participantes: [...marcados],
                  supervisorFichaId: supervisor === '' ? null : Number(supervisor),
                  apoyoFichaId: apoyo === '' ? null : Number(apoyo),
                })
              }
            >
              {guardando ? <Spinner /> : <SaveIcon />}
              Guardar jornada
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
