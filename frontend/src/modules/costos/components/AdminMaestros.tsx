import { useState } from 'react';

import { MaestroCrud, type CampoMaestro } from './MaestroCrud';
import { DialogoAuditoria } from './DialogoAuditoria';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  useClientesCostos,
  useCrearCliente,
  useEditarCliente,
  useEliminarCliente,
  useSupervisoresCostos,
  useCrearSupervisor,
  useEditarSupervisor,
  useEliminarSupervisor,
} from '@/modules/costos/hooks/useMaestros';
import {
  useProveedores,
  useCrearProveedor,
  useEditarProveedor,
  useEliminarProveedor,
} from '@/modules/costos/hooks/useProveedores';
import type { EntidadCostos } from '@/modules/costos/types';

/**
 * Los tres maestros que comparten forma, cada uno con sus campos.
 *
 * Todo lo que hacen es decirle a `MaestroCrud` qué se pide y con qué
 * hooks se guarda. Si algún día uno necesita una regla propia, se saca
 * de aquí y se escribe entero: mejor eso que llenar el componente
 * genérico de excepciones.
 */

/** Lo que se está mirando en la bitácora, o null. */
interface EnHistorial {
  entidad: EntidadCostos;
  id: number;
  nombre: string;
}

const CAMPOS_CLIENTE: CampoMaestro[] = [
  { clave: 'nombre', etiqueta: 'Nombre', requerido: true, enTabla: true },
  { clave: 'ruc', etiqueta: 'RUC', enTabla: true, placeholder: '11 dígitos' },
  { clave: 'contacto', etiqueta: 'Persona de contacto', enTabla: true },
  { clave: 'correo', etiqueta: 'Correo', enTabla: true },
  { clave: 'telefono', etiqueta: 'Teléfono' },
  { clave: 'direccion', etiqueta: 'Dirección' },
];

export function AdminClientes() {
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState<EnHistorial | null>(null);
  const q = useDebounce(busqueda, 300);

  const { data, isError } = useClientesCostos(q);
  const crear = useCrearCliente();
  const editar = useEditarCliente();
  const eliminar = useEliminarCliente();

  return (
    <>
      <MaestroCrud
        titulo="Clientes"
        descripcion="Para quién se pide el requerimiento (§13). Son propios del módulo: no tienen que ver con las cuentas del portal de Fotos."
        singular="el cliente"
        campos={CAMPOS_CLIENTE}
        filas={data ?? []}
        cargando={!data && !isError}
        hayError={isError}
        busqueda={busqueda}
        onBuscar={setBusqueda}
        nombreDe={(c) => c.nombre}
        guardando={crear.isPending || editar.isPending}
        borrando={eliminar.isPending}
        onCrear={(valores) => crear.mutate(valores)}
        onEditar={(id, payload) => editar.mutate({ id, payload })}
        onEliminar={(id, alLograrlo) =>
          eliminar.mutate(id, { onSuccess: alLograrlo })
        }
        onVerHistorial={(c) =>
          setHistorial({ entidad: 'CLIENTE', id: c.id, nombre: c.nombre })
        }
      />
      {historial && (
        <DialogoAuditoria
          entidad={historial.entidad}
          entidadId={historial.id}
          nombre={historial.nombre}
          onCerrar={() => setHistorial(null)}
        />
      )}
    </>
  );
}

const CAMPOS_SUPERVISOR: CampoMaestro[] = [
  { clave: 'nombre', etiqueta: 'Nombre', requerido: true, enTabla: true },
  { clave: 'documento', etiqueta: 'Documento', enTabla: true },
  { clave: 'cargo', etiqueta: 'Cargo', enTabla: true },
  { clave: 'correo', etiqueta: 'Correo', enTabla: true },
  { clave: 'telefono', etiqueta: 'Teléfono' },
];

export function AdminSupervisores() {
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState<EnHistorial | null>(null);
  const q = useDebounce(busqueda, 300);

  const { data, isError } = useSupervisoresCostos(q);
  const crear = useCrearSupervisor();
  const editar = useEditarSupervisor();
  const eliminar = useEliminarSupervisor();

  return (
    <>
      <MaestroCrud
        titulo="Supervisores"
        descripcion="Quién responde por el requerimiento (§13). Catálogo propio, no las fichas de Personal: aquéllas existen por mes."
        singular="el supervisor"
        campos={CAMPOS_SUPERVISOR}
        filas={data ?? []}
        cargando={!data && !isError}
        hayError={isError}
        busqueda={busqueda}
        onBuscar={setBusqueda}
        nombreDe={(s) => s.nombre}
        guardando={crear.isPending || editar.isPending}
        borrando={eliminar.isPending}
        onCrear={(valores) => crear.mutate(valores)}
        onEditar={(id, payload) => editar.mutate({ id, payload })}
        onEliminar={(id, alLograrlo) =>
          eliminar.mutate(id, { onSuccess: alLograrlo })
        }
        onVerHistorial={(s) =>
          setHistorial({ entidad: 'SUPERVISOR', id: s.id, nombre: s.nombre })
        }
      />
      {historial && (
        <DialogoAuditoria
          entidad={historial.entidad}
          entidadId={historial.id}
          nombre={historial.nombre}
          onCerrar={() => setHistorial(null)}
        />
      )}
    </>
  );
}

const CAMPOS_PROVEEDOR: CampoMaestro[] = [
  {
    clave: 'razonSocial',
    etiqueta: 'Razón social',
    requerido: true,
    enTabla: true,
  },
  { clave: 'ruc', etiqueta: 'RUC', enTabla: true, placeholder: '11 dígitos' },
  { clave: 'nombreComercial', etiqueta: 'Nombre comercial', enTabla: true },
  {
    clave: 'correo',
    etiqueta: 'Correo',
    enTabla: true,
    placeholder: 'Sin esto no se le puede pedir cotización',
  },
  { clave: 'telefono', etiqueta: 'Teléfono' },
  { clave: 'direccion', etiqueta: 'Dirección' },
];

/**
 * Los proveedores (§31).
 *
 * `soloActivos: false` — al revés que el selector del Gestor. Esta es la
 * pantalla donde se administran, y los desactivados son justo los que a
 * veces hay que volver a activar: esconderlos los dejaría inalcanzables.
 */
export function AdminProveedores() {
  const [busqueda, setBusqueda] = useState('');
  const [historial, setHistorial] = useState<EnHistorial | null>(null);
  const q = useDebounce(busqueda, 300);

  const { data, isError } = useProveedores(q, false);
  const crear = useCrearProveedor();
  const editar = useEditarProveedor();
  const eliminar = useEliminarProveedor();

  return (
    <>
      <MaestroCrud
        titulo="Proveedores"
        descripcion="A quién se le pide cotización (§30-31). El correo no es opcional en la práctica: sin él, el gestor no puede incluirlo en una solicitud."
        singular="el proveedor"
        campos={CAMPOS_PROVEEDOR}
        filas={data ?? []}
        cargando={!data && !isError}
        hayError={isError}
        busqueda={busqueda}
        onBuscar={setBusqueda}
        nombreDe={(p) => p.razonSocial}
        guardando={crear.isPending || editar.isPending}
        borrando={eliminar.isPending}
        onCrear={(valores) => crear.mutate(valores)}
        onEditar={(id, payload) => editar.mutate({ id, payload })}
        onEliminar={(id, alLograrlo) =>
          eliminar.mutate(id, { onSuccess: alLograrlo })
        }
        onVerHistorial={(p) =>
          setHistorial({
            entidad: 'PROVEEDOR',
            id: p.id,
            nombre: p.razonSocial,
          })
        }
      />
      {historial && (
        <DialogoAuditoria
          entidad={historial.entidad}
          entidadId={historial.id}
          nombre={historial.nombre}
          onCerrar={() => setHistorial(null)}
        />
      )}
    </>
  );
}
