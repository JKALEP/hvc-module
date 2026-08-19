import * as React from 'react';
import { Outlet } from 'react-router-dom';

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import { Sidebar } from './Sidebar';

/*
 * El perfil y "cerrar sesión" viven únicamente en el pie del
 * Sidebar (ver Sidebar.tsx) — aquí no se repiten.
 *
 * El botón para colapsar el menú vive DENTRO del propio Sidebar,
 * pero solo es visible en desktop (md:flex). En mobile el sidebar
 * se comporta como un panel superpuesto que empieza oculto, así
 * que necesitamos un botón afuera para poder abrirlo: por eso esta
 * barra de aquí abajo solo se muestra en mobile (md:hidden). Nunca
 * están los dos controles visibles a la vez.
 *
 * IMPORTANTE sobre el `style` de abajo: --sidebar-width-config y
 * --sidebar-width-icon-config viven en index.css (ahí se editan los
 * anchos reales). Aquí solo los copiamos a los nombres que
 * SidebarProvider espera (--sidebar-width / --sidebar-width-icon).
 * NUNCA nombres iguales de un lado y otro del `var()` — eso crea un
 * ciclo inválido en CSS y el ancho del sidebar colapsa, que fue el
 * bug que reportaste (contenido que no respeta el espacio real).
 */
export function AppLayout() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'var(--sidebar-width-config)',
          '--sidebar-width-icon': 'var(--sidebar-width-icon-config)',
        } as React.CSSProperties
      }
    >
      <Sidebar />

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}