import { Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from '@/components/shared/AppLayout';
import { RutaProtegida } from '@/components/shared/RutaProtegida';
import { Login } from '@/pages/Login';
import { Importar } from '@/pages/Importar';
import { Importaciones } from '@/pages/Importaciones';
import { ImportacionDetalle } from '@/pages/ImportacionDetalle';
import { Maestro } from '@/pages/Maestro';
import { ReporteDiario } from '@/pages/ReporteDiario';
import { Personal } from '@/pages/Personal';
import { Proyectos } from '@/pages/Proyectos';
import { ProyectoDetalle } from '@/pages/ProyectoDetalle';
import { Usuarios } from '@/pages/Usuarios';
import { Inicio } from '@/pages/Inicio';
import { Fotos } from '@/pages/Fotos';
import { AlbumFotos } from '@/pages/AlbumFotos';
import { Invitacion } from '@/pages/Invitacion';
import { Portal } from '@/pages/Portal';
import { PortalAlbum } from '@/pages/PortalAlbum';
import { PortalLayout } from '@/components/shared/PortalLayout';

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
        <Route path="/portal/album/:id" element={<PortalAlbum />} />
      </Route>

      <Route element={<AppLayout />}>
        {/* Decide a dónde va cada quien según sus módulos. */}
        <Route index element={<Inicio />} />

        {/* Costos */}
        <Route path="/importar" element={costos(<Importar />)} />
        <Route path="/importaciones" element={costos(<Importaciones />)} />
        <Route
          path="/importaciones/:id"
          element={costos(<ImportacionDetalle />)}
        />
        <Route path="/maestro" element={costos(<Maestro />)} />

        {/* Personal y proyectos */}
        <Route path="/reporte-diario" element={personal(<ReporteDiario />)} />
        <Route path="/personal" element={personal(<Personal />)} />
        <Route path="/proyectos" element={personal(<Proyectos />)} />
        <Route path="/proyectos/:id" element={personal(<ProyectoDetalle />)} />

        {/* Fotos: el explorador de carpetas y la galería de un álbum.
            /fotos y /fotos/sede/:id son la misma pantalla. */}
        <Route path="/fotos" element={fotos(<Fotos />)} />
        <Route path="/fotos/sede/:id" element={fotos(<Fotos />)} />
        <Route path="/fotos/album/:id" element={fotos(<AlbumFotos />)} />

        {/* Administración */}
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
