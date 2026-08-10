import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  login as loginApi,
  obtenerSesion,
} from '@/services/authService';
import { guardarToken, borrarToken, leerToken } from '@/services/api';
import type { UsuarioSesion } from '@/types/models';

export interface EstadoAuth {
  usuario: UsuarioSesion | null;
  /** true mientras se revalida el token guardado al arrancar la app. */
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<UsuarioSesion>;
  salir: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<EstadoAuth | null>(null);

/**
 * Sesión de la app.
 *
 * El token vive en localStorage; el usuario y sus permisos se revalidan
 * contra /auth/yo al arrancar. No se cachean los permisos en el
 * navegador: si el SuperAdmin le quita un módulo a alguien, el cambio
 * debe notarse al recargar, no cuando venza el token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  // Solo hay algo que revalidar si hay token guardado. Se deriva del
  // estado inicial en vez de arrancar en true y corregirlo dentro del
  // efecto: sin token no hay ni un frame de "cargando".
  const [cargando, setCargando] = useState(() => Boolean(leerToken()));
  const qc = useQueryClient();

  useEffect(() => {
    if (!leerToken()) return;
    obtenerSesion()
      .then(setUsuario)
      // Token vencido o cuenta desactivada: el interceptor ya limpió y
      // redirigió. Aquí solo se deja de cargar.
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(
    async (email: string, password: string) => {
      const { token, usuario: datos } = await loginApi(email, password);
      guardarToken(token);
      setUsuario(datos);
      return datos;
    },
    [],
  );

  const salir = useCallback(() => {
    borrarToken();
    setUsuario(null);
    // Vaciar la caché es obligatorio: si no, el siguiente usuario vería
    // datos del anterior mientras se refrescan las queries.
    qc.clear();
  }, [qc]);

  return (
    <AuthContext.Provider value={{ usuario, cargando, entrar, salir }}>
      {children}
    </AuthContext.Provider>
  );
}
