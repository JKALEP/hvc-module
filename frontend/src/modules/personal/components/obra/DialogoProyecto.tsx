import { useState } from 'react';
import { SaveIcon, TriangleAlertIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { useCrearProyecto, useEmpresasPara, usePersonasPara, useCarpetas } from '@/modules/personal/hooks/useObra';
import { hoyISO } from '@/modules/personal/lib/obra';
import type { CarpetaObra } from '@/modules/personal/types';

/** Etiqueta de campo con asterisco si es obligatorio. Privada del diálogo. */
function Campo({
  label,
  requerido,
  children,
  ayuda,
}: {
  label: string;
  requerido?: boolean;
  children: React.ReactNode;
  ayuda?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {requerido && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** Indentación del selector de carpeta, sacada de la ruta materializada. */
function sangria(c: CarpetaObra): string {
  return '  '.repeat(c.ruta.split('/').length - 1);
}

/**
 * Alta de un proyecto.
 *
 * El encargado y el supervisor salen del periodo de personal que cubre
 * la FECHA DE INICIO, así que las dos listas se recargan al cambiarla:
 * una obra que arrancó en marzo debe ofrecer la gente de marzo.
 */
export function DialogoProyecto({
  carpetaId,
  onCerrar,
  onCreado,
}: {
  carpetaId: number | null;
  onCerrar: () => void;
  onCreado: (id: number) => void;
}) {
  const crear = useCrearProyecto();
  const { data: carpetas } = useCarpetas();

  const [nombre, setNombre] = useState('');
  const [sede, setSede] = useState('');
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [fechaFin, setFechaFin] = useState('');
  const [totalEquipos, setTotalEquipos] = useState('');
  const [carpeta, setCarpeta] = useState<number | null>(carpetaId);
  const [encargado, setEncargado] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [apoyo, setApoyo] = useState('');

  const { data: empresas, isLoading: cargandoEmpresas } =
    useEmpresasPara(fechaInicio);
  const { data: supervisores, isLoading: cargandoSup } = usePersonasPara(
    fechaInicio,
    'supervisores',
  );

  const sinPersonal =
    !cargandoEmpresas &&
    !cargandoSup &&
    ((empresas ?? []).length === 0 || (supervisores ?? []).length === 0);

  const faltaAlgo =
    nombre.trim() === '' ||
    sede.trim() === '' ||
    fechaInicio === '' ||
    fechaFin === '' ||
    totalEquipos.trim() === '' ||
    encargado === '' ||
    supervisor === '';

  const guardar = () => {
    crear.mutate(
      {
        nombre: nombre.trim(),
        sede: sede.trim(),
        carpetaId: carpeta,
        fechaInicio,
        fechaFinPrevista: fechaFin,
        totalEquipos: Number(totalEquipos),
        encargadoGrupoId: Number(encargado),
        supervisorFichaId: Number(supervisor),
        apoyoFichaId: apoyo === '' ? null : Number(apoyo),
      },
      { onSuccess: (r) => onCreado(r.id) },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            El estado no se elige: se calcula del avance. La fecha de fin es
            prevista — se pueden registrar jornadas más allá.
          </DialogDescription>
        </DialogHeader>

        {sinPersonal && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm whitespace-normal text-muted-foreground">
              No hay personal cargado para {fechaInicio}. Importa la lista SCTR
              de ese mes en <strong>Gestión de personal</strong> —hacen falta
              contratistas y supervisores— antes de crear el proyecto.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre del proyecto" requerido>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="CHOCAVENTO"
            />
          </Campo>

          <Campo
            label="Sede"
            requerido
            ayuda="Lugar físico de la obra. No es la carpeta."
          >
            <Input
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              placeholder="Ica"
            />
          </Campo>

          <Campo label="Fecha de inicio" requerido>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </Campo>

          <Campo label="Fecha de fin prevista" requerido>
            <Input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </Campo>

          <Campo
            label="Total de equipos"
            requerido
            ayuda="Lo contemplado para toda la obra. Es el denominador del avance."
          >
            <Input
              inputMode="numeric"
              value={totalEquipos}
              onChange={(e) => setTotalEquipos(e.target.value)}
              placeholder="453"
            />
          </Campo>

          <Campo label="Carpeta" ayuda="Vacío = va a la raíz.">
            <Select
              value={carpeta ?? ''}
              onChange={(e) =>
                setCarpeta(e.target.value === '' ? null : Number(e.target.value))
              }
            >
              <option value="">Sin carpeta (raíz)</option>
              {(carpetas ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {sangria(c)}
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            label="Empresa encargada"
            requerido
            ayuda={`Del periodo que cubre el ${fechaInicio}.`}
          >
            <Select
              value={encargado}
              onChange={(e) => setEncargado(e.target.value)}
            >
              <option value="">Elegir…</option>
              {(empresas ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({e.personas})
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Supervisor" requerido>
            <Select
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
            >
              <option value="">Elegir…</option>
              {(supervisores ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombreCompleto}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            label="Apoyo de control y coordinación"
            ayuda="Predeterminado del proyecto. Cada jornada puede llevar otro."
          >
            <Select value={apoyo} onChange={(e) => setApoyo(e.target.value)}>
              <option value="">Sin asignar</option>
              {(supervisores ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombreCompleto}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={faltaAlgo || crear.isPending}>
            {crear.isPending ? <Spinner /> : <SaveIcon />}
            Crear proyecto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
