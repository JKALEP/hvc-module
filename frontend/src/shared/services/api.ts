import axios from 'axios';
import { API_URL } from '@/shared/lib/constants';

// Instancia única de axios para todo el frontend.
export const api = axios.create({
  baseURL: API_URL,
});

/** Clave del token en localStorage. Un solo sitio la conoce. */
export const CLAVE_TOKEN = 'hvc.token';

export function leerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function guardarToken(token: string) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
}

// Adjunta el token a cada petición.
api.interceptors.request.use((config) => {
  const token = leerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Ante un 401 la sesión ya no sirve: se limpia y se manda a /login.
 *
 * Se usa location.assign y no el router porque el interceptor vive fuera
 * de React y no tiene acceso a `navigate`. Recargar entero además vacía
 * la caché de TanStack Query, que es justo lo que se quiere al cambiar
 * de usuario: nada del anterior debe sobrevivir.
 *
 * El 403 NO cierra sesión: la sesión es válida, solo falta permiso para
 * ese módulo. Lo maneja la vista.
 */
api.interceptors.response.use(
  (respuesta) => respuesta,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      // El propio login devuelve 401 con credenciales malas: ahí no hay
      // sesión que cerrar ni a dónde redirigir.
      !error.config?.url?.includes('/auth/login')
    ) {
      borrarToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae un mensaje de error legible de una respuesta de axios/Nest. */
export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
