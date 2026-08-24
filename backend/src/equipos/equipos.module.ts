import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquiposController } from './equipos.controller';
import { InventarioController } from './inventario.controller';
import { IncidenciaController } from './incidencia.controller';
import { DocumentoController } from './documento.controller';
import { ReporteController } from './reporte.controller';
import { OrganizacionService } from './organizacion.service';
import { EstructuraService } from './estructura.service';
import { CampoService } from './campo.service';
import { ValorCampoService } from './valor-campo.service';
import { HistorialService } from './historial.service';
import { EquipoService } from './equipo.service';
import { EquipoBusquedaService } from './equipo-busqueda.service';
import { IncidenciaService } from './incidencia.service';
import { CotizacionService } from './cotizacion.service';
import { OrdenCompraService } from './orden-compra.service';
import { ReporteEquipoService } from './reporte-equipo.service';
import { ReporteConsolidadoService } from './reporte-consolidado.service';

/**
 * Gestión de equipos — inventario que HVC administra para terceros.
 *
 * Fase 1: organizaciones y su árbol de ubicaciones.
 * Fase 2: campos dinámicos e inventario.
 * Fase 3: incidencias.
 * Fase 4: cotizaciones y órdenes de compra, con exportación al vuelo.
 * Fase 5: reportes — ficha del equipo y distribución del inventario.
 *
 * `LineasService` y `ExportacionService` no se listan: viven en
 * `CommonModule`, que es global. Salieron de aquí al necesitarlos también
 * el módulo Costos.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    EquiposController,
    InventarioController,
    IncidenciaController,
    DocumentoController,
    ReporteController,
  ],
  providers: [
    OrganizacionService,
    EstructuraService,
    CampoService,
    ValorCampoService,
    HistorialService,
    EquipoService,
    EquipoBusquedaService,
    IncidenciaService,
    CotizacionService,
    OrdenCompraService,
    ReporteEquipoService,
    ReporteConsolidadoService,
  ],
  // ⚠️ Sin `exports`, y volver a ponerlos debería costar una justificación.
  //
  // Aquí se exportaban `OrganizacionService`, `EstructuraService`,
  // `EquipoBusquedaService` y `EquipoService` para que el módulo Fotos los
  // consumiera en su selector de equipos (§12 de la especificación de
  // Fotos). Esa dependencia se deshizo entera en la Fase 1a de «Gestión de
  // contenido»: Fotos ya no referencia este catálogo.
  //
  // Los cuatro services SIGUEN EXISTIENDO y los usan los controllers de
  // este módulo —`EquipoBusquedaService` en `InventarioController`, entre
  // otros—: lo que se retira es la puerta hacia fuera, no la lógica.
  // Ningún otro módulo importa `EquiposModule`.
})
export class EquiposModule {}
