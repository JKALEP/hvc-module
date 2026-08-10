import { Navigate } from 'react-router-dom';
import { ShieldXIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { rutaInicial } from '@/lib/modulos';

/**
 * Puerta de entrada de "/".
 *
 * Sin sesión → login. Con sesión → el primer módulo asignado, siguiendo
 * el orden fijo de MODULOS para que el destino no cambie entre sesiones.
 */
export function Inicio() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  const destino = rutaInicial(usuario);

  // Cuenta sin ningún módulo: no hay a dónde mandarla.
  if (destino === '/sin-acceso') {
    return (
      <EmptyState
        icon={ShieldXIcon}
        title="Tu cuenta no tiene módulos asignados"
        description="Pídele al administrador del sistema que te dé acceso a al menos un módulo."
      />
    );
  }

  return <Navigate to={destino} replace />;
}
