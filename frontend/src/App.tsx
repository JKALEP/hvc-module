import { Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from '@/shared/components/AppLayout';
import { RutaProtegida } from '@/shared/components/RutaProtegida';
import { Login } from '@/modules/auth/pages/Login';
import { BaseCostos } from '@/modules/costos/pages/BaseCostos';
import { EmitirRequerimiento } from '@/modules/costos/pages/EmitirRequerimiento';
import { MisRequerimientos } from '@/modules/costos/pages/MisRequerimientos';
import { RequerimientoDetalle } from '@/modules/costos/pages/RequerimientoDetalle';
import { BandejaGestor } from '@/modules/costos/pages/BandejaGestor';
import { RequerimientoGestion } from '@/modules/costos/pages/RequerimientoGestion';
import { BandejaAprobador } from '@/modules/costos/pages/BandejaAprobador';
import { RequerimientoDecision } from '@/modules/costos/pages/RequerimientoDecision';
import { AdministracionCostos } from '@/modules/costos/pages/AdministracionCostos';
import { AuditoriaCostos } from '@/modules/costos/pages/AuditoriaCostos';
import { GestionPersonal } from '@/modules/personal/pages/GestionPersonal';
import { Proyectos } from '@/modules/personal/pages/Proyectos';
import { ProyectoDetalle } from '@/modules/personal/pages/ProyectoDetalle';
import { Usuarios } from '@/modules/auth/pages/Usuarios';
import { Equipos } from '@/modules/equipos/pages/Equipos';
import { CamposOrganizacion } from '@/modules/equipos/pages/CamposOrganizacion';
import { Inventario } from '@/modules/equipos/pages/Inventario';
import { Incidencias } from '@/modules/equipos/pages/Incidencias';
import { Documentos } from '@/modules/equipos/pages/Documentos';
import { Documento } from '@/modules/equipos/pages/Documento';
import { Reportes } from '@/modules/equipos/pages/Reportes';
import { FichaEquipo } from '@/modules/equipos/pages/FichaEquipo';
import { Inicio } from '@/modules/auth/pages/Inicio';
import { Fotos } from '@/modules/fotos/pages/Fotos';
import { Recientes } from '@/modules/fotos/pages/Recientes';
import { CapturaRapida } from '@/modules/fotos/pages/CapturaRapida';
import { AdminFotos } from '@/modules/fotos/pages/AdminFotos';
import { Invitacion } from '@/modules/auth/pages/Invitacion';
import { Portal } from '@/modules/fotos/pages/Portal';
import { PortalLayout } from '@/shared/components/PortalLayout';

/** Envuelve una pantalla con el módulo que exige. */
const costos = (el: React.ReactNode) => (
  <RutaProtegida modulo="COSTOS">{el}</RutaProtegida>
);
const personal = (el: React.ReactNode) => (
  <RutaProtegida modulo="PERSONAL_PROYECTOS">{el}</RutaProtegida>
);
const fotos = (el: React.ReactNode) => (
  <RutaProtegida modulo="FOTOS">{el}</RutaProtegida>
);

function App() {
  return (
    <Routes>
      {/* Fuera del layout: no hay sidebar sin sesión. */}
      <Route path="/login" element={<Login />} />
      {/* Pública: quien llega aquí todavía no tiene cuenta. */}
      <Route path="/invitacion/:token" element={<Invitacion />} />

      {/* Portal del cliente externo: layout propio, sin sidebar. */}
      <Route element={<PortalLayout />}>
        <Route path="/portal" element={<Portal />} />
        <Route path="/portal/carpeta/:id" element={<Portal />} />
      </Route>

      <Route element={<AppLayout />}>
        {/* Decide a dónde va cada quien según sus módulos. */}
        <Route index element={<Inicio />} />

        {/* Costos. Las rutas solo exigen el MÓDULO, no el rol: quién
            puede hacer qué dentro lo dice el backend con `acciones`, y
            duplicar aquí la matriz de §57 sería tener dos versiones de
            la política esperando a discrepar. */}
        <Route path="/costos/emitir" element={costos(<EmitirRequerimiento />)} />
        <Route
          path="/costos/mis-requerimientos"
          element={costos(<MisRequerimientos />)}
        />
        <Route
          path="/costos/requerimiento/:id"
          element={costos(<RequerimientoDetalle />)}
        />
        <Route path="/costos/bandeja" element={costos(<BandejaGestor />)} />
        <Route
          path="/costos/gestion/:id"
          element={costos(<RequerimientoGestion />)}
        />
        <Route
          path="/costos/aprobaciones"
          element={costos(<BandejaAprobador />)}
        />
        <Route
          path="/costos/decision/:id"
          element={costos(<RequerimientoDecision />)}
        />
        <Route path="/costos/base" element={costos(<BaseCostos />)} />
        {/* Los maestros y la bitácora: el administrador del módulo es el
            SuperAdmin, igual que en el backend con `@SoloSuperAdmin()`. */}
        <Route
          path="/costos/admin"
          element={
            <RutaProtegida soloSuperAdmin>
              <AdministracionCostos />
            </RutaProtegida>
          }
        />
        <Route
          path="/costos/auditoria"
          element={
            <RutaProtegida soloSuperAdmin>
              <AuditoriaCostos />
            </RutaProtegida>
          }
        />

        {/* Personal y proyectos */}
        <Route
          path="/personal/gestion"
          element={personal(<GestionPersonal />)}
        />
        <Route path="/proyectos" element={personal(<Proyectos />)} />
        <Route path="/proyectos/:id" element={personal(<ProyectoDetalle />)} />

        {/* Fotos: una carpeta muestra sus subcarpetas Y sus fotos, así
            que /fotos y /fotos/carpeta/:id son la misma pantalla. */}
        <Route path="/fotos" element={fotos(<Fotos />)} />
        {/* Antes que /fotos/carpeta/:id no hace falta —son rutas
            distintas—, pero se declara junta para leerlas de un vistazo. */}
        <Route path="/fotos/recientes" element={fotos(<Recientes />)} />
        <Route path="/fotos/captura" element={fotos(<CapturaRapida />)} />
        <Route path="/fotos/admin" element={fotos(<AdminFotos />)} />
        <Route path="/fotos/carpeta/:id" element={fotos(<Fotos />)} />

        {/* Administración */}
        {/* Gestión de equipos: solo SuperAdmin, igual que en el backend. */}
        <Route
          path="/equipos"
          element={
            <RutaProtegida soloSuperAdmin>
              <Equipos />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos/:id/campos"
          element={
            <RutaProtegida soloSuperAdmin>
              <CamposOrganizacion />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos/:id/inventario"
          element={
            <RutaProtegida soloSuperAdmin>
              <Inventario />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos/:id/incidencias"
          element={
            <RutaProtegida soloSuperAdmin>
              <Incidencias />
            </RutaProtegida>
          }
        />
        {/* Las dos pestañas son la misma pantalla; el tipo va en la query. */}
        <Route
          path="/equipos/:id/documentos"
          element={
            <RutaProtegida soloSuperAdmin>
              <Documentos />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos/:id/documentos/:tipo/:docId"
          element={
            <RutaProtegida soloSuperAdmin>
              <Documento />
            </RutaProtegida>
          }
        />
        {/* Los reportes cruzan organizaciones, así que cuelgan de la raíz. */}
        <Route
          path="/equipos/reportes"
          element={
            <RutaProtegida soloSuperAdmin>
              <Reportes />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipos/:id/equipo/:equipoId"
          element={
            <RutaProtegida soloSuperAdmin>
              <FichaEquipo />
            </RutaProtegida>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RutaProtegida soloSuperAdmin>
              <Usuarios />
            </RutaProtegida>
          }
        />

        {/* Cualquier otra cosa vuelve al reparto por módulos. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
