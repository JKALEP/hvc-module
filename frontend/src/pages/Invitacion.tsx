import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BoxesIcon, ImagesIcon, ShieldXIcon } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { abrirInvitacion, activarInvitacion } from '@/services/fotosService';
import { getErrorMessage, guardarToken } from '@/services/api';
import { formatFechaCorta } from '@/lib/format';

const LARGO_MINIMO = 8;

/**
 * Activación de una invitación. Pantalla PÚBLICA, sin sesión y sin sidebar.
 *
 * Al activar, el backend devuelve ya la sesión iniciada: hacer escribir
 * la contraseña otra vez en el login siguiente no aporta seguridad y sí
 * abandono.
 */
export function Invitacion() {
  const { token } = useParams();
  const navegar = useNavigate();

  /**
   * null = la persona no ha tocado el campo, así que vale la sugerencia.
   * Se deriva en vez de asignarse en un efecto: un setState dentro de un
   * efecto encadena renders y el lint del repo lo rechaza.
   */
  const [nombreEditado, setNombreEditado] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');

  const invitacion = useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => abrirInvitacion(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  // Se propone la parte local del correo para no dejar el campo en blanco.
  const sugerencia = invitacion.data?.email.split('@')[0] ?? '';
  const nombre = nombreEditado ?? sugerencia;

  const activar = useMutation({
    mutationFn: () =>
      activarInvitacion(token as string, { nombre, password }),
    onSuccess: (sesion) => {
      guardarToken(sesion.token);
      toast.success(`Bienvenido, ${sesion.usuario.nombre}`);
      // Recarga entera: así el contexto de sesión arranca limpio.
      window.location.assign('/portal');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'No se pudo activar la cuenta')),
  });

  if (invitacion.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (invitacion.isError || !invitacion.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <EmptyState
          icon={ShieldXIcon}
          title="Esta invitación ya no sirve"
          description={getErrorMessage(
            invitacion.error,
            'Puede que ya la hayas usado, que haya caducado o que la hayan cancelado. Pídele una nueva a quien te la envió.',
          )}
        />
      </div>
    );
  }

  const datos = invitacion.data;
  const faltaAlgo =
    nombre.trim() === '' ||
    password.length < LARGO_MINIMO ||
    password !== repetida;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BoxesIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">HVC Comercial</h1>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImagesIcon className="size-4 text-muted-foreground" />
              {datos.invitadoPor} compartió «{datos.recurso}» contigo
            </p>
            <p className="text-xs text-muted-foreground">
              Crea tu contraseña para entrar. El enlace caduca el{' '}
              {formatFechaCorta(datos.expiraEn)}.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Correo
            </label>
            {/* No se puede cambiar: la invitación es para este correo. */}
            <Input value={datos.email} disabled className="h-9" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Tu nombre <span className="text-destructive">*</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombreEditado(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Contraseña <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${LARGO_MINIMO} caracteres`}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Repite la contraseña <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !faltaAlgo) activar.mutate();
              }}
              className="h-9"
            />
            {repetida !== '' && password !== repetida && (
              <p className="text-xs text-destructive">
                Las dos contraseñas no coinciden.
              </p>
            )}
          </div>

          <Button
            className="w-full"
            disabled={faltaAlgo || activar.isPending}
            onClick={() => activar.mutate()}
          >
            {activar.isPending && <Spinner />}
            Crear mi cuenta y entrar
          </Button>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => navegar('/login')}
        className="mx-auto mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        ¿Ya tienes cuenta? Inicia sesión
      </button>
    </div>
  );
}
