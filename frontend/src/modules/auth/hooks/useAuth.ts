import { useContext } from 'react';
import { AuthContext, type EstadoAuth } from '@/modules/auth/context/AuthContext';

/** Sesión vigente. Falla ruidosamente si se usa fuera del provider. */
export function useAuth(): EstadoAuth {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
