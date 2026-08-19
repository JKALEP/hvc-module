import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Campo } from './Campo';
import type { Cabecera } from '@/modules/costos/lib/cabecera';
import type { OpcionesRequerimiento } from '@/modules/costos/types';

/**
 * El formulario inicial de §13.
 *
 * `soloLogistica` es la regla de §54: una vez emitido, el lugar y la
 * fecha de entrega se siguen pudiendo cambiar —la obra se movió de nave,
 * la parada de planta se corrió— pero el cliente, el supervisor y los
 * dos tipos no: cambiarlos no es corregir un dato, es otro
 * requerimiento. Los campos bloqueados se muestran deshabilitados y con
 * el motivo, en vez de desaparecer: ocultarlos haría creer que el dato
 * no existe.
 */
export function FormularioCabecera({
  valor,
  opciones,
  soloLogistica,
  onChange,
}: {
  valor: Cabecera;
  opciones: OpcionesRequerimiento;
  soloLogistica?: boolean;
  onChange: (c: Cabecera) => void;
}) {
  const set = (campo: keyof Cabecera) => (v: string) =>
    onChange({ ...valor, [campo]: v });

  const motivo = soloLogistica
    ? 'No se puede cambiar con el requerimiento ya emitido.'
    : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo label="Tipo de mantenimiento" requerido ayuda={motivo}>
        <Select
          value={valor.tipoMantenimientoId}
          disabled={soloLogistica}
          onChange={(e) => set('tipoMantenimientoId')(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {opciones.tiposMantenimiento.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.valor}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Tipo de requerimiento" requerido ayuda={motivo}>
        <Select
          value={valor.tipoRequerimientoId}
          disabled={soloLogistica}
          onChange={(e) => set('tipoRequerimientoId')(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {opciones.tiposRequerimiento.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.valor}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Supervisor" requerido ayuda={motivo}>
        <Select
          value={valor.supervisorId}
          disabled={soloLogistica}
          onChange={(e) => set('supervisorId')(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {opciones.supervisores.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.nombre}
              {s.cargo ? ` — ${s.cargo}` : ''}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Cliente" requerido ayuda={motivo}>
        <Select
          value={valor.clienteId}
          disabled={soloLogistica}
          onChange={(e) => set('clienteId')(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {opciones.clientes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo label="Lugar de entrega" requerido>
        <Input
          value={valor.lugarEntrega}
          onChange={(e) => set('lugarEntrega')(e.target.value)}
          placeholder="Planta Lurín — Sala de máquinas"
        />
      </Campo>

      <Campo
        label="Fecha de entrega"
        requerido
        ayuda="No puede ser anterior a la fecha de emisión."
      >
        <Input
          type="date"
          value={valor.fechaEntrega}
          onChange={(e) => set('fechaEntrega')(e.target.value)}
        />
      </Campo>
    </div>
  );
}
