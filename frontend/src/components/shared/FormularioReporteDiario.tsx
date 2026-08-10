import { useState, useImperativeHandle, type Ref } from 'react';
import { toast } from 'sonner';
import { SaveIcon, XIcon, CalculatorIcon } from 'lucide-react';

import { SelectorTrabajadores } from './SelectorTrabajadores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useProyectos, useSupervisores } from '@/hooks/usePersonal';
import {
  useCrearReporte,
  useEditarReporte,
} from '@/hooks/useReportesDiarios';
import { obtenerReporte } from '@/services/reporteDiarioService';
import { getErrorMessage } from '@/services/api';
import { formatPorcentaje, hoyISO, aValorInputFecha } from '@/lib/format';
import type { Trabajador, GuardarReportePayload } from '@/types/models';

// Estado del formulario. Los números viven como string para que el input
// pueda estar vacío sin convertirse en 0.
interface FormState {
  fecha: string;
  proyectoId: string;
  supervisorId: string;
  equiposProgramados: string;
  equiposEjecutados: string;
  tecnicosProgramados: string;
  numeroContratistasProgramados: string;
  calificacionProveedor: string;
  calificacionSupervisor: string;
}

function formVacio(proyectoFijo?: number): FormState {
  return {
    fecha: hoyISO(),
    proyectoId: proyectoFijo !== undefined ? String(proyectoFijo) : '',
    supervisorId: '',
    equiposProgramados: '',
    equiposEjecutados: '',
    tecnicosProgramados: '',
    numeroContratistasProgramados: '',
    calificacionProveedor: '',
    calificacionSupervisor: '',
  };
}

/** Etiqueta de campo con asterisco si es obligatorio. */
export function Campo({
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
        {requerido && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** Lo que el padre puede pedirle al formulario. */
export interface ControlFormularioReporte {
  /** Carga un reporte existente para editarlo. */
  abrirParaEditar: (id: number) => Promise<void>;
  /** Vuelve al estado inicial. */
  limpiar: () => void;
}

/**
 * Formulario de reporte diario, compartido por /reporte-diario y por la
 * vista de un proyecto. Es la única implementación: las validaciones, el
 * cálculo en vivo y el payload viven aquí y no se duplican.
 *
 * Con `proyectoFijo` se oculta el select de proyecto — en la vista de una
 * obra no tiene sentido preguntarlo.
 */
export function FormularioReporteDiario({
  proyectoFijo,
  control,
  onGuardado,
  onCancelar,
}: {
  proyectoFijo?: number;
  control?: Ref<ControlFormularioReporte>;
  onGuardado?: () => void;
  onCancelar?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => formVacio(proyectoFijo));
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);

  const { data: proyectos } = useProyectos();
  const { data: supervisores } = useSupervisores();

  const crear = useCrearReporte();
  const editar = useEditarReporte();
  const guardando = crear.isPending || editar.isPending;

  const limpiar = () => {
    setForm(formVacio(proyectoFijo));
    setTrabajadores([]);
    setEditandoId(null);
  };

  /**
   * Carga un reporte en el formulario. Se hace en respuesta a una acción
   * del usuario, no en un efecto: el formulario se llena una vez, no se
   * sincroniza continuamente con el servidor.
   */
  const abrirParaEditar = async (id: number) => {
    setCargando(true);
    try {
      const r = await obtenerReporte(id);
      setForm({
        fecha: aValorInputFecha(r.fecha),
        proyectoId: String(r.proyectoId),
        supervisorId: String(r.supervisorId),
        equiposProgramados: String(r.equiposProgramados),
        equiposEjecutados: String(r.equiposEjecutados),
        tecnicosProgramados: String(r.tecnicosProgramados),
        numeroContratistasProgramados:
          r.numeroContratistasProgramados === null
            ? ''
            : String(r.numeroContratistasProgramados),
        calificacionProveedor: r.calificacionProveedor ?? '',
        calificacionSupervisor: r.calificacionSupervisor ?? '',
      });
      setTrabajadores(
        r.participaciones.map((p) => ({
          ...p.trabajador,
          empresaId: p.empresaId,
          estado: 'ACTIVO' as const,
          empresa: p.empresa,
        })),
      );
      setEditandoId(id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo abrir el reporte'));
    } finally {
      setCargando(false);
    }
  };

  useImperativeHandle(control, () => ({ abrirParaEditar, limpiar }));

  const set = (campo: keyof FormState) => (valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  // ── Campos CALCULADOS: se muestran en vivo, no se digitan ──
  const prog = Number(form.equiposProgramados);
  const ejec = Number(form.equiposEjecutados);
  const produccionCalculada =
    form.equiposProgramados === '' || form.equiposEjecutados === '' || prog === 0
      ? null
      : (ejec / prog) * 100;
  const tecnicosLaborando = trabajadores.length;
  // Empresas distintas entre el personal elegido: mismo criterio que el
  // backend, para que lo que se ve coincida con lo que se guarda.
  const contratistasTrabajando = new Set(trabajadores.map((t) => t.empresaId))
    .size;

  const faltaAlgo =
    form.fecha === '' ||
    form.proyectoId === '' ||
    form.supervisorId === '' ||
    form.equiposProgramados === '' ||
    form.equiposEjecutados === '' ||
    form.tecnicosProgramados === '';

  const numeroOpcional = (v: string) => (v === '' ? null : Number(v));

  const guardar = () => {
    const payload: GuardarReportePayload = {
      fecha: form.fecha,
      proyectoId: Number(form.proyectoId),
      supervisorId: Number(form.supervisorId),
      equiposProgramados: Number(form.equiposProgramados),
      equiposEjecutados: Number(form.equiposEjecutados),
      tecnicosProgramados: Number(form.tecnicosProgramados),
      numeroContratistasProgramados: numeroOpcional(
        form.numeroContratistasProgramados,
      ),
      calificacionProveedor: numeroOpcional(form.calificacionProveedor),
      calificacionSupervisor: numeroOpcional(form.calificacionSupervisor),
      trabajadoresIds: trabajadores.map((t) => t.id),
    };

    const alTerminar = () => {
      limpiar();
      onGuardado?.();
    };

    if (editandoId !== null) {
      editar.mutate({ id: editandoId, payload }, { onSuccess: alTerminar });
    } else {
      crear.mutate(payload, { onSuccess: alTerminar });
    }
  };

  return (
    <div className="space-y-6">
      {editandoId !== null && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <p className="text-sm text-foreground">
            Editando el reporte <span className="font-medium">#{editandoId}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              limpiar();
              onCancelar?.();
            }}
          >
            <XIcon />
            Cancelar edición
          </Button>
        </div>
      )}

      {/* Fila 1: contexto del reporte */}
      <div
        className={`grid gap-4 ${proyectoFijo === undefined ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        <Campo label="Fecha" requerido>
          <Input
            type="date"
            value={form.fecha}
            onChange={(e) => set('fecha')(e.target.value)}
            className="h-9"
            disabled={cargando}
          />
        </Campo>

        {proyectoFijo === undefined && (
          <Campo label="Proyecto" requerido>
            <Select
              className="h-9"
              value={form.proyectoId}
              onChange={(e) => set('proyectoId')(e.target.value)}
            >
              <option value="">Selecciona un proyecto…</option>
              {(proyectos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.cliente ? ` — ${p.cliente}` : ''}
                </option>
              ))}
            </Select>
          </Campo>
        )}

        <Campo label="Supervisor" requerido>
          <Select
            className="h-9"
            value={form.supervisorId}
            onChange={(e) => set('supervisorId')(e.target.value)}
          >
            <option value="">Selecciona un supervisor…</option>
            {(supervisores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      {/* Fila 2: cifras de la jornada */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Equipos programados" requerido>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.equiposProgramados}
            onChange={(e) => set('equiposProgramados')(e.target.value)}
            className="h-9 tabular-nums"
          />
        </Campo>

        <Campo label="Equipos ejecutados" requerido>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.equiposEjecutados}
            onChange={(e) => set('equiposEjecutados')(e.target.value)}
            className="h-9 tabular-nums"
          />
        </Campo>

        <Campo label="Técnicos programados" requerido>
          <Input
            type="number"
            min={0}
            step={1}
            value={form.tecnicosProgramados}
            onChange={(e) => set('tecnicosProgramados')(e.target.value)}
            className="h-9 tabular-nums"
          />
        </Campo>

        <Campo
          label="Contratistas programadas"
          ayuda="Cuántas empresas se esperaba en obra. Las que realmente trabajaron se calculan."
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={form.numeroContratistasProgramados}
            onChange={(e) =>
              set('numeroContratistasProgramados')(e.target.value)
            }
            placeholder="Opcional"
            className="h-9 tabular-nums"
          />
        </Campo>
      </div>

      {/* Fila 3: calificaciones — dos evaluaciones independientes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Calificación del proveedor (%)"
          ayuda="Evalúa a la empresa contratista."
        >
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.calificacionProveedor}
            onChange={(e) => set('calificacionProveedor')(e.target.value)}
            placeholder="Opcional"
            className="h-9 tabular-nums"
          />
        </Campo>
        <Campo
          label="Calificación del supervisor (%)"
          ayuda="Evalúa al supervisor de HVC. Independiente de la anterior."
        >
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.calificacionSupervisor}
            onChange={(e) => set('calificacionSupervisor')(e.target.value)}
            placeholder="Opcional"
            className="h-9 tabular-nums"
          />
        </Campo>
      </div>

      {/* Calculados — solo lectura */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalculatorIcon className="size-4" />
          <span className="text-xs font-medium tracking-wide uppercase">
            Calculado
          </span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Producción</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {produccionCalculada === null
              ? '—'
              : formatPorcentaje(produccionCalculada, 2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Técnicos laborando</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {tecnicosLaborando}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Contratistas trabajando
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {contratistasTrabajando}
          </p>
        </div>
        {form.tecnicosProgramados !== '' && (
          <div>
            <p className="text-xs text-muted-foreground">
              Diferencia vs programados
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {tecnicosLaborando - Number(form.tecnicosProgramados)}
            </p>
          </div>
        )}
      </div>

      {/* Personal presente */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Personal presente</p>
        <SelectorTrabajadores
          seleccionados={trabajadores}
          onChange={setTrabajadores}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {(editandoId !== null || onCancelar) && (
          <Button
            variant="outline"
            onClick={() => {
              limpiar();
              onCancelar?.();
            }}
            disabled={guardando}
          >
            <XIcon />
            Cancelar
          </Button>
        )}
        <Button onClick={guardar} disabled={faltaAlgo || guardando || cargando}>
          {guardando ? <Spinner /> : <SaveIcon />}
          {editandoId === null ? 'Guardar reporte' : 'Actualizar reporte'}
        </Button>
      </div>
    </div>
  );
}
