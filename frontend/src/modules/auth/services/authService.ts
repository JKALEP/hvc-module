import { api } from '@/shared/services/api';
import type { GuardarUsuarioPayload, RespuestaLogin, UsuarioAdmin, UsuarioSesion } from '@/modules/auth/types';

// Llamadas a /auth y /usuario.

export async function login(
  email: string,
  password: string,
): Promise<RespuestaLogin> {
  const { data } = await api.post<RespuestaLogin>('/auth/login', {
    email,
    password,
  });
  return data;
}

/** Sesión vigente. Se usa al arrancar la app para revalidar el token. */
export async function obtenerSesion(): Promise<UsuarioSesion> {
  const { data } = await api.get<UsuarioSesion>('/auth/yo');
  return data;
}

// ── Gestión de cuentas (solo SuperAdmin) ──

export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  const { data } = await api.get<UsuarioAdmin[]>('/usuario');
  return data;
}

export async function crearUsuario(
  payload: GuardarUsuarioPayload,
): Promise<UsuarioAdmin> {
  const { data } = await api.post<UsuarioAdmin>('/usuario', payload);
  return data;
}

export async function editarUsuario(
  id: number,
  payload: GuardarUsuarioPayload,
): Promise<UsuarioAdmin> {
  const { data } = await api.put<UsuarioAdmin>(`/usuario/${id}`, payload);
  return data;
}

export async function eliminarUsuario(
  id: number,
): Promise<{ ok: boolean; id: number }> {
  const { data } = await api.delete(`/usuario/${id}`);
  return data;
}
