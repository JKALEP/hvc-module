import { NavLink, useLocation } from 'react-router-dom';
import {
  UploadCloudIcon,
  ClipboardListIcon,
  Table2Icon,
  BoxesIcon,
  ClipboardPlusIcon,
  UsersIcon,
  FolderKanbanIcon,
  ShieldCheckIcon,
  ImagesIcon,
  LogOutIcon,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { tieneModulo } from '@/lib/modulos';
import { cn } from '@/lib/utils';
import type { Modulo } from '@/types/models';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGrupo {
  titulo?: string;
  /** Módulo que exige. Sin él, visible para cualquier sesión. */
  modulo?: Modulo;
  /** Solo para la cuenta SuperAdmin. */
  soloSuperAdmin?: boolean;
  items: NavItem[];
}

const NAV: NavGrupo[] = [
  {
    titulo: 'Costos',
    modulo: 'COSTOS',
    items: [
      { to: '/importar', label: 'Importar', icon: UploadCloudIcon },
      { to: '/importaciones', label: 'Importaciones', icon: ClipboardListIcon },
      { to: '/maestro', label: 'Tabla Maestra', icon: Table2Icon },
    ],
  },
  {
    titulo: 'Personal y proyectos',
    modulo: 'PERSONAL_PROYECTOS',
    items: [
      { to: '/reporte-diario', label: 'Reporte diario', icon: ClipboardPlusIcon },
      { to: '/proyectos', label: 'Proyectos', icon: FolderKanbanIcon },
      { to: '/personal', label: 'Personal', icon: UsersIcon },
    ],
  },
  {
    titulo: 'Fotos',
    modulo: 'FOTOS',
    // Una sola entrada: el explorador ya lleva dentro la administración.
    items: [{ to: '/fotos', label: 'Álbumes', icon: ImagesIcon }],
  },
  {
    titulo: 'Administración',
    soloSuperAdmin: true,
    items: [{ to: '/usuarios', label: 'Usuarios', icon: ShieldCheckIcon }],
  },
];

export function Sidebar() {
  const { usuario, salir } = useAuth();
  const { pathname } = useLocation();

  /**
   * Un grupo sin permiso NO se renderiza: no aparece deshabilitado ni en
   * gris. Mostrar puertas cerradas solo genera preguntas de por qué no
   * abren.
   */
  const visibles = NAV.filter((g) => {
    if (g.soloSuperAdmin) return usuario?.rol === 'SUPERADMIN';
    if (g.modulo) return tieneModulo(usuario, g.modulo);
    return true;
  });

  /**
   * Gana la ruta más específica: en /fotos/admin se enciende "Administrar"
   * y no también "Álbumes", que es prefijo suyo. En /fotos/album/3, donde
   * no hay entrada propia, se queda encendido "Álbumes".
   */
  const rutas = visibles.flatMap((g) => g.items.map((i) => i.to));
  const activa = rutas
    .filter((to) => pathname === to || pathname.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo / nombre */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BoxesIcon className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">
            HVC Costos
          </p>
          <p className="text-xs text-muted-foreground">Comercial S.A.C.</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {visibles.map((grupo) => (
          <div
            key={grupo.titulo ?? grupo.items[0].to}
            className="flex flex-col gap-1"
          >
            {grupo.titulo && (
              <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {grupo.titulo}
              </p>
            )}
            {grupo.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none',
                  'focus-visible:ring-3 focus-visible:ring-ring/50',
                  activa === to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="size-4.5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Sesión */}
      <div className="space-y-2 border-t border-sidebar-border px-3 py-3">
        {usuario && (
          <div className="px-2">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {usuario.nombre}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {usuario.rol === 'SUPERADMIN' ? 'SuperAdmin' : usuario.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={salir}
        >
          <LogOutIcon />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
