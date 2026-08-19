import { useState } from 'react';

import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent } from '@/shared/ui/card';
import { AdminCatalogos } from '@/modules/costos/components/AdminCatalogos';
import { AdminPlantilla } from '@/modules/costos/components/AdminPlantilla';
import {
  AdminClientes,
  AdminProveedores,
  AdminSupervisores,
} from '@/modules/costos/components/AdminMaestros';
import { cn } from '@/shared/lib/utils';

type Seccion =
  | 'catalogos'
  | 'proveedores'
  | 'clientes'
  | 'supervisores'
  | 'plantilla';

const SECCIONES: { id: Seccion; etiqueta: string }[] = [
  { id: 'catalogos', etiqueta: 'Catálogos' },
  { id: 'proveedores', etiqueta: 'Proveedores' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'supervisores', etiqueta: 'Supervisores' },
  { id: 'plantilla', etiqueta: 'Correo' },
];

/**
 * La administración del módulo (§58-59), bajo SuperAdmin.
 *
 * Una pantalla con secciones y no cuatro entradas de menú: son cuatro
 * tablas de configuración que se tocan de higos a brevas y casi siempre
 * en la misma sesión —se da de alta un cliente y, de paso, el supervisor
 * que responde por él—. Cuatro sitios distintos en la barra lateral
 * habrían hecho más ruido que servicio.
 *
 * El administrador del módulo Costos ES el SuperAdmin: no hay un rol
 * propio. `reglaSuperAdmin` va antes que `reglaRolCostos` en la cadena
 * del backend, así que llega a estas rutas sin necesitar fila en
 * `PermisoModulo`, y por eso la entrada vive en el grupo de
 * Administración de la barra lateral y no en el de Costos.
 *
 * Los PROVEEDORES están aquí aunque su alta y su edición sean del Gestor
 * (§30): que el Gestor pueda crear uno sobre la marcha no quita que
 * alguien tenga que poder repasar la lista entera, corregir un RUC mal
 * tecleado o retirar al que ya no trabaja con HVC. Lo único
 * exclusivamente administrativo es borrarlos.
 */
export function AdministracionCostos() {
  const [seccion, setSeccion] = useState<Seccion>('catalogos');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración de Costos"
        description="Los maestros del módulo: lo que se ofrece al llenar un requerimiento y con quién se trabaja."
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              seccion === s.id
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Se monta solo la sección visible: cada una trae su propia
              consulta, y montarlas todas dispararía cuatro peticiones
              para enseñar una. */}
          {seccion === 'catalogos' && <AdminCatalogos />}
          {seccion === 'proveedores' && <AdminProveedores />}
          {seccion === 'clientes' && <AdminClientes />}
          {seccion === 'supervisores' && <AdminSupervisores />}
          {seccion === 'plantilla' && <AdminPlantilla />}
        </CardContent>
      </Card>
    </div>
  );
}
