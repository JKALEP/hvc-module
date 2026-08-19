import { Navigate, useLocation } from 'react-router-dom';
import { ShieldXIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';
import { Spinner } from '@/shared/ui/spinner';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { tieneModulo, ETIQUETA_MODULO } from '@/shared/lib/modulos';
import type { Modulo } from '@/modules/auth/types';

/**
 * Envuelve una ruta con el módulo que exige.
 *
 * Es defensa en profundidad, no la única: el backend ya rechaza con 403
 * aunque alguien escriba la URL a mano. Esto solo evita que la pantalla
 * cargue y pida datos que van a fallar.
 */
export function RutaProtegida({
  modulo,
  soloSuperAdmin = false,
  children,
}: {
  modulo?: Modulo;
  soloSuperAdmin?: boolean;
  children: React.ReactNode;
}) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  // Aún revalidando el token guardado: no decidir todavía, o se
  // expulsaría a alguien con sesión válida en cada recarga.
  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!usuario) {
    // Se recuerda a dónde iba para volver ahí tras entrar.
    return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />;
  }

  if (soloSuperAdmin && usuario.rol !== 'SUPERADMIN') {
    return (
      <EmptyState
        icon={ShieldXIcon}
        title="Sección restringida"
        description="Solo el SuperAdmin puede gestionar cuentas y permisos."
      />
    );
  }

  if (modulo && !tieneModulo(usuario, modulo)) {
    return (
      <EmptyState
        icon={ShieldXIcon}
        title="No tienes acceso a esta sección"
        description={`Tu cuenta no tiene asignado el módulo ${ETIQUETA_MODULO[modulo]}. Pídeselo al administrador del sistema.`}
      />
    );
  }

  return <>{children}</>;
}
