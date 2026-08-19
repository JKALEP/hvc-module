import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import {
  Table2Icon,
  ContactIcon,
  FolderKanbanIcon,
  ShieldCheckIcon,
  Building2Icon,
  ClockIcon,
  CameraIcon,
  LayoutTemplateIcon,
  FoldersIcon,
  ImagesIcon,
  FilePlus2Icon,
  ClipboardListIcon,
  InboxIcon,
  GavelIcon,
  SlidersHorizontalIcon,
  HistoryIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  WalletIcon,
  UsersRoundIcon,
  ShieldIcon,
  SearchIcon,
  LogOutIcon,
  type LucideIcon,
} from 'lucide-react';

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/shared/lib/utils';

import { useAuth } from '@/modules/auth/hooks/useAuth';
import { tieneModulo, rolCostosDe } from '@/shared/lib/modulos';

import type { Modulo, RolCostos } from '@/modules/auth/types';

import logoHvc from '@/assets/hvc-logo.png';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  rolesCostos?: RolCostos[];
}

interface NavGrupo {
  titulo: string;
  icon: LucideIcon;
  modulo?: Modulo;
  soloSuperAdmin?: boolean;
  items: NavItem[];
}

/*
 * ============================================================
 * DATA DE NAVEGACIÓN — lo único que tocas al agregar un módulo.
 *
 * Regla automática (no la decides tú caso por caso):
 *   - grupo con 1 solo item  -> se ve como link directo.
 *   - grupo con 2+ items     -> se ve como acordeón desplegable.
 *
 * Sección donde cae cada grupo (también automático):
 *   - soloSuperAdmin: true   -> sección "Administración"
 *   - lo demás               -> sección "Menú principal"
 * ============================================================
 */
const NAV: NavGrupo[] = [
  {
    titulo: 'Costos',
    icon: WalletIcon,
    modulo: 'COSTOS',
    items: [
      { to: '/costos/emitir', label: 'Emitir requerimiento', icon: FilePlus2Icon, rolesCostos: ['SOLICITANTE'] },
      { to: '/costos/mis-requerimientos', label: 'Mis requerimientos', icon: ClipboardListIcon, rolesCostos: ['SOLICITANTE'] },
      { to: '/costos/bandeja', label: 'Bandeja de cotizaciones', icon: InboxIcon, rolesCostos: ['GESTOR_COTIZACIONES'] },
      { to: '/costos/aprobaciones', label: 'Aprobaciones', icon: GavelIcon, rolesCostos: ['APROBADOR'] },
      { to: '/costos/base', label: 'Base de costos', icon: Table2Icon },
    ],
  },
  {
    titulo: 'Personal y proyectos',
    icon: UsersRoundIcon,
    modulo: 'PERSONAL_PROYECTOS',
    items: [
      { to: '/proyectos', label: 'Proyectos', icon: FolderKanbanIcon },
      { to: '/personal/gestion', label: 'Gestión de personal', icon: ContactIcon },
    ],
  },
  {
    titulo: 'Fotos',
    icon: ImagesIcon,
    modulo: 'FOTOS',
    items: [
      // «Álbumes» era la etiqueta de v2, cuando se entraba a un álbum. Desde
      // v3 la puerta es el explorador de carpetas.
      { to: '/fotos', label: 'Carpetas', icon: FoldersIcon },
      { to: '/fotos/recientes', label: 'Recientes', icon: ClockIcon },
      // §17 lo marca como «muy importante»: es la puerta del supervisor
      // en obra, así que va en el menú y no escondida dentro de una carpeta.
      { to: '/fotos/captura', label: 'Captura rápida', icon: CameraIcon },
    ],
  },
  {
    titulo: 'Administración',
    icon: ShieldIcon,
    soloSuperAdmin: true,
    items: [
      { to: '/costos/admin', label: 'Administración de Costos', icon: SlidersHorizontalIcon },
      { to: '/fotos/admin', label: 'Administración de Fotos', icon: LayoutTemplateIcon },
      { to: '/costos/auditoria', label: 'Auditoría de Costos', icon: HistoryIcon },
      { to: '/equipos', label: 'Gestión de equipos', icon: Building2Icon },
      { to: '/usuarios', label: 'Usuarios', icon: ShieldCheckIcon },
    ],
  },
];

/* ============================================================
   Fila individual de navegación (reutilizada en varios lugares)
   ============================================================ */
function FilaItem({
  to,
  label,
  Icon,
  indent = false,
  activa,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  indent?: boolean;
  /** La ruta activa llega por prop: ver el comentario de `BloqueSeccion`. */
  activa: string | undefined;
}) {
  const isActive = activa === to;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={label}
        className={cn(
          'h-[var(--sidebar-item-height)] rounded-[var(--sidebar-radius)] px-[var(--sidebar-padding-x)]',
          'text-[length:var(--sidebar-text-item)] text-[var(--sidebar-muted)]',
          'transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground)]',
          'data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:text-[var(--sidebar-accent-foreground)]',
          'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
        )}
        style={{
          fontWeight: isActive ? 'var(--sidebar-font-weight-active)' : 'var(--sidebar-font-weight-item)',
        }}
      >
        <NavLink
          to={to}
          className={cn(
            'flex w-full items-center gap-2 overflow-hidden',
            indent && 'pl-[calc(var(--sidebar-icon-size)+0.5rem)] group-data-[collapsible=icon]:pl-0',
          )}
        >
          <Icon
            className="size-[var(--sidebar-icon-size)] shrink-0"
            strokeWidth={isActive ? 2.1 : 1.75}
          />
          <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
            {label}
          </span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Una sección del menú (principal o administración).
 *
 * ⚠️ Vive FUERA de `Sidebar` a propósito, igual que `FilaItem`. Estaban
 * declaradas dentro del render, y eso las volvía un componente NUEVO en
 * cada pasada: React desmontaba y remontaba el árbol del menú entero cada
 * vez que se escribía una letra en el buscador o se abría un acordeón, y
 * con él su estado. Lo cazaba `react-hooks/static-components`.
 *
 * El precio de sacarlas es que lo que antes tomaban del closure —`activa`,
 * `abiertos`, `isIconMode`, `toggleGrupo`— ahora viaja como props. Es más
 * verboso y es lo correcto: son entradas de un componente, no variables
 * ambientales.
 */
function BloqueSeccion({
  titulo,
  grupos,
  activa,
  abiertos,
  isIconMode,
  onToggle,
}: {
  titulo: string;
  grupos: NavGrupo[];
  activa: string | undefined;
  abiertos: Set<string>;
  isIconMode: boolean;
  onToggle: (titulo: string) => void;
}) {
  if (grupos.length === 0) return null;

  // Si la sección tiene un solo grupo adentro, mostrar el título de
  // la sección Y el título del grupo es redundante (a veces hasta
  // literalmente el mismo texto, como "Administración" / "Administración").
  // Con 2+ grupos sí aporta, porque agrupa varios módulos distintos.
  const mostrarTituloSeccion = grupos.length > 1;

  return (
    <div className="mb-[var(--sidebar-section-gap)] last:mb-0">
      {mostrarTituloSeccion && (
        <p
          className={cn(
            'mb-1.5 truncate px-[var(--sidebar-padding-x)] font-semibold text-[var(--sidebar-muted)]',
            'group-data-[collapsible=icon]:hidden',
          )}
          style={{
            fontSize: 'var(--sidebar-text-section)',
            letterSpacing: 'var(--sidebar-letter-spacing-section)',
          }}
        >
          {titulo}
        </p>
      )}

      <SidebarMenu style={{ gap: 'var(--sidebar-item-gap)' }}>
        {grupos.map((grupo) => {
          // 1 solo item -> link directo, usando ícono/label del grupo
          if (grupo.items.length === 1) {
            const unico = grupo.items[0];
            return (
              <FilaItem
                key={grupo.titulo}
                to={unico.to}
                label={grupo.titulo}
                Icon={grupo.icon}
                activa={activa}
              />
            );
          }

          // 2+ items -> acordeón
          const abierto = abiertos.has(grupo.titulo) || isIconMode;
          const GrupoIcon = grupo.icon;

          return (
            <div key={grupo.titulo}>
              {!isIconMode && (
                <button
                  type="button"
                  onClick={() => onToggle(grupo.titulo)}
                  className={cn(
                    'flex h-[var(--sidebar-item-height)] w-full items-center gap-2 rounded-[var(--sidebar-radius)]',
                    'px-[var(--sidebar-padding-x)] text-left text-[var(--sidebar-muted)]',
                    'transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground)]',
                  )}
                >
                  <GrupoIcon className="size-[var(--sidebar-icon-size)] shrink-0" strokeWidth={1.75} />
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{
                      fontSize: 'var(--sidebar-text-item)',
                      fontWeight: 'var(--sidebar-font-weight-item)',
                    }}
                  >
                    {grupo.titulo}
                  </span>
                  <ChevronRightIcon
                    className={cn(
                      'size-[15px] shrink-0 transition-transform duration-150',
                      abierto && 'rotate-90',
                    )}
                    strokeWidth={2}
                  />
                </button>
              )}

              {abierto && (
                <SidebarMenu className="mt-0.5" style={{ gap: 'var(--sidebar-item-gap)' }}>
                  {grupo.items.map((item) => (
                    <FilaItem
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      Icon={item.icon}
                      indent={!isIconMode}
                      activa={activa}
                    />
                  ))}
                </SidebarMenu>
              )}
            </div>
          );
        })}
      </SidebarMenu>
    </div>
  );
}

export function Sidebar() {
  const { usuario, salir } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
  const isIconMode = state === 'collapsed';

  const rolCostos = rolCostosDe(usuario);

  /* ---------- permisos (sin cambios de lógica) ---------- */
  const visibles = NAV.filter((grupo) => {
    if (grupo.soloSuperAdmin) return usuario?.rol === 'SUPERADMIN';
    if (grupo.modulo) return tieneModulo(usuario, grupo.modulo);
    return true;
  })
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter(
        (item) =>
          !item.rolesCostos ||
          usuario?.rol === 'SUPERADMIN' ||
          (rolCostos !== null && item.rolesCostos.includes(rolCostos)),
      ),
    }))
    .filter((grupo) => grupo.items.length > 0);

  const rutas = visibles.flatMap((grupo) => grupo.items.map((item) => item.to));
  const activa = rutas
    .filter((to) => pathname === to || pathname.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0];

  /* ---------- secciones automáticas ---------- */
  const seccionPrincipal = visibles.filter((g) => !g.soloSuperAdmin);
  const seccionAdmin = visibles.filter((g) => g.soloSuperAdmin);

  /* ---------- acordeón: abierto por defecto si contiene la ruta activa ---------- */
  const [abiertos, setAbiertos] = React.useState<Set<string>>(() => {
    const inicial = new Set<string>();
    visibles.forEach((g) => {
      if (g.items.length > 1 && g.items.some((i) => i.to === activa)) inicial.add(g.titulo);
    });
    return inicial;
  });

  const toggleGrupo = (titulo: string) => {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo);
      else next.add(titulo);
      return next;
    });
  };

  /* ---------- buscador ---------- */
  const [busqueda, setBusqueda] = React.useState('');
  const normal = (s: string) => s.toLowerCase().trim();
  const hayBusqueda = normal(busqueda).length > 0;

  const resultados = hayBusqueda
    ? visibles.flatMap((grupo) =>
        grupo.items
          .filter((item) => normal(item.label).includes(normal(busqueda)))
          .map((item) => ({ ...item, grupoTitulo: grupo.titulo })),
      )
    : [];


  return (
    <ShadcnSidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r-0 bg-[var(--sidebar)] text-[var(--sidebar-foreground)]"
    >
      {/* ============================================================
          HEADER: logo + único botón de colapsar (solo desktop; en
          mobile el sidebar es un overlay que se abre desde afuera,
          ver AppLayout).
          ============================================================ */}
      <SidebarHeader className="gap-3 px-[var(--sidebar-padding-x)] pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
            <img src={logoHvc} alt="HVC" className="h-8 w-8 shrink-0 object-contain" />
            <span
              className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden"
              style={{ fontSize: 'var(--sidebar-text-logo)' }}
            >
              HVC
            </span>
          </NavLink>

          <button
            type="button"
            onClick={toggleSidebar}
            title={isIconMode ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden size-7 shrink-0 items-center justify-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground)] md:flex"
          >
            {isIconMode ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
          </button>
        </div>

        {/* Buscador */}
        <div
          className={cn(
            'flex h-9 items-center gap-2 rounded-[var(--sidebar-radius)] border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] px-2.5',
            'group-data-[collapsible=icon]:hidden',
          )}
        >
          <SearchIcon className="size-4 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el menú..."
            className="w-full min-w-0 bg-transparent text-[13px] text-[var(--sidebar-foreground)] placeholder:text-[var(--sidebar-muted)] focus:outline-none"
          />
          {!hayBusqueda && (
            <kbd className="shrink-0 text-[10px] text-[var(--sidebar-muted)]">⌘K</kbd>
          )}
        </div>
      </SidebarHeader>

      {/* ============================================================
          CONTENIDO
          ============================================================ */}
      <SidebarContent className="px-3 py-2">
        {hayBusqueda ? (
          resultados.length > 0 ? (
            <SidebarMenu style={{ gap: 'var(--sidebar-item-gap)' }}>
              {resultados.map((item) => (
                <FilaItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  Icon={item.icon}
                  activa={activa}
                />
              ))}
            </SidebarMenu>
          ) : (
            <p className="px-[var(--sidebar-padding-x)] py-2 text-[13px] text-[var(--sidebar-muted)]">
              Sin resultados para "{busqueda}"
            </p>
          )
        ) : (
          <>
            <BloqueSeccion
              titulo="Menú principal"
              grupos={seccionPrincipal}
              activa={activa}
              abiertos={abiertos}
              isIconMode={isIconMode}
              onToggle={toggleGrupo}
            />
            <BloqueSeccion
              titulo="Administración"
              grupos={seccionAdmin}
              activa={activa}
              abiertos={abiertos}
              isIconMode={isIconMode}
              onToggle={toggleGrupo}
            />
          </>
        )}
      </SidebarContent>

      {/* ============================================================
          FOOTER: perfil (único destino: /perfil) + cerrar sesión.
          Es el único lugar de la app donde vive esta acción.
          ============================================================ */}
      {usuario && (
        <div className="mt-auto border-t border-[var(--sidebar-border)] px-[var(--sidebar-padding-x)] py-3">
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[var(--sidebar-radius)] px-1.5 py-1.5 text-left',
              'transition-colors hover:bg-[var(--sidebar-hover)]',
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-primary)] text-[12px] font-semibold text-[var(--sidebar-primary-foreground)]">
              {usuario.nombre?.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1 leading-none group-data-[collapsible=icon]:hidden">
              <p
                className="truncate font-semibold text-[var(--sidebar-foreground)]"
                style={{ fontSize: 'var(--sidebar-text-profile-name)' }}
              >
                {usuario.nombre}
              </p>
              <p
                className="mt-0.5 truncate text-[var(--sidebar-muted)]"
                style={{ fontSize: 'var(--sidebar-text-profile-role)' }}
              >
                {usuario.rol === 'SUPERADMIN' ? 'SuperAdmin' : usuario.rol}
              </p>
            </div>

            <ChevronDownIcon className="size-4 shrink-0 text-[var(--sidebar-muted)] group-data-[collapsible=icon]:hidden" />
          </button>

          <button
            type="button"
            onClick={salir}
            className={cn(
              'mt-1 flex h-[var(--sidebar-item-height)] w-full items-center gap-2.5 rounded-[var(--sidebar-radius)] px-1.5',
              'text-[var(--sidebar-muted)] transition-colors hover:bg-destructive/15 hover:text-destructive',
            )}
          >
            <LogOutIcon className="size-[var(--sidebar-icon-size)] shrink-0" strokeWidth={1.75} />
            <span
              className="truncate group-data-[collapsible=icon]:hidden"
              style={{ fontSize: 'var(--sidebar-text-item)', fontWeight: 'var(--sidebar-font-weight-item)' }}
            >
              Cerrar sesión
            </span>
          </button>
        </div>
      )}
    </ShadcnSidebar>
  );
}