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
      /*
       * ⚠️ `h-screen overflow-hidden` — la página NUNCA scrollea de forma
       * global; el scroll vive dentro del `main`. No es preferencia de
       * estilo, arregla un desbordamiento real: `SidebarInset` se dimensiona
       * con `w-full`, que resuelve al ancho del viewport SIN descontar la
       * barra de scroll vertical. En cuanto una página es lo bastante alta
       * como para que aparezca la barra, el `main` ya se calculó 20px más
       * ancho de la cuenta y, sumado al desplazamiento del sidebar, la
       * página se sale a lo ancho. Medido en `/usuarios`: 1546 contra 1526.
       */
      className="h-screen overflow-hidden"
      style={
        {
          '--sidebar-width': 'var(--sidebar-width-config)',
          '--sidebar-width-icon': 'var(--sidebar-width-icon-config)',
        } as React.CSSProperties
      }
    >
      <Sidebar />

      {/*
       * ⚠️ `min-w-0` va AQUÍ, no en el `<main>` de dentro. `SidebarInset`
       * renderiza su propio `<main>` con `w-full`, y ése es el que se
       * dimensiona al viewport sin descontar la barra de scroll. Puesto en
       * el hijo no sirve de nada: el ancho ya venía impuesto desde fuera.
       */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
        </header>

        {/*
         * Medidas del área de trabajo (§6.2 del design system). Se fijan
         * en UN SOLO SITIO y toda página las hereda: ninguna define
         * márgenes propios de página.
         *
         * ⚠️ El padding es ASIMÉTRICO a propósito: 24px arriba y 64px
         * abajo. El `pb-16` es lo que evita que el último elemento de una
         * pantalla larga quede pegado al borde inferior de la ventana,
         * que es donde más se nota que una interfaz está sin rematar.
         */}
        {/*
         * `min-w-0` es la pieza que hace que esto funcione de verdad: sin
         * ella el `main` impone su ancho dentro del flex en vez de
         * encogerse, y el `overflow-hidden` de arriba solo escondería el
         * problema en lugar de resolverlo.
         */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto min-h-full w-full max-w-[1500px] px-6 pt-6 pb-16 lg:px-8">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}