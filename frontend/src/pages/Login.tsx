import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { BoxesIcon, LogInIcon, TriangleAlertIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/services/api';
import { rutaInicial } from '@/lib/modulos';

export function Login() {
  const navigate = useNavigate();
  const { usuario, cargando, entrar } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ya hay sesión: no tiene sentido mostrar el formulario.
  if (!cargando && usuario) {
    return <Navigate to={rutaInicial(usuario)} replace />;
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const datos = await entrar(email, password);
      navigate(rutaInicial(datos), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo iniciar sesión'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BoxesIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              HVC Costos
            </h1>
            <p className="text-sm text-muted-foreground">
              Comercial S.A.C. · Sistema de gestión
            </p>
          </div>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={enviar} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Correo
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@hvc.com"
                  className="h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 dark:border-destructive/30 dark:bg-red-500/10">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm whitespace-normal text-foreground">
                    {error}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={enviando || email === '' || password === ''}
              >
                {enviando ? <Spinner /> : <LogInIcon />}
                {enviando ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ¿No tienes cuenta? Pídesela al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
