import { Navigate, Outlet } from 'react-router-dom';
import { BoxesIcon, LogOutIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { useAuth } from '@/modules/auth/hooks/useAuth';

/**
 * Layout del cliente externo: cabecera simple, sin sidebar.
 *
 * El sidebar lista módulos, y un cliente no tiene ninguno: enseñarle una
 * barra vacía sería recordarle en cada pantalla todo lo que no puede
 * hacer. Aquí solo hay lo suyo y el botón de salir.
 */
export function PortalLayout() {
  const { usuario, cargando, salir } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  // Un interno que aterrice aquí vuelve a su sitio: el portal no es una
  // vista alternativa del módulo, es la casa de las cuentas externas.
  if (usuario.rol !== 'CLIENTE') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BoxesIcon className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">
                HVC Comercial
              </p>
              <p className="text-xs text-muted-foreground">Fotos compartidas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="truncate text-sm font-medium text-foreground">
                {usuario.nombre}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {usuario.email}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={salir}>
              <LogOutIcon />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
