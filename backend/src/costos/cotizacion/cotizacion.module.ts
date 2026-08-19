import { Module } from '@nestjs/common';
import { CotizacionController } from './cotizacion.controller';
import { SolicitudService } from './solicitud.service';
import { CotizacionService } from './cotizacion.service';
import { ComparacionService } from './comparacion.service';
import { EvaluacionService } from './evaluacion.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PlantillaModule } from '../plantilla/plantilla.module';
import { RequerimientoModule } from '../requerimiento/requerimiento.module';

/**
 * El trabajo del Gestor: solicitudes, cotizaciones, comparación y
 * recomendación (§30-39).
 *
 * Cuatro services y no uno, partidos por PREGUNTA y no por capa:
 *   · `solicitud`   — a quién se le pidió y si salió el correo
 *   · `cotizacion`  — qué respondió cada uno
 *   · `comparacion` — cuál conviene (solo lectura)
 *   · `evaluacion`  — cuál se recomienda y por qué
 *
 * `LineasService` y `CorreoService` no se listan: vienen de
 * `CommonModule`, que es global.
 */
@Module({
  imports: [AuditoriaModule, PlantillaModule, RequerimientoModule],
  controllers: [CotizacionController],
  providers: [
    SolicitudService,
    CotizacionService,
    ComparacionService,
    EvaluacionService,
  ],
  // `ComparacionService` sale para que la exportación de §69 arme el
  // comparativo con los MISMOS números que la pantalla, en vez de
  // recalcularlos y acabar con dos verdades.
  exports: [CotizacionService, ComparacionService],
})
export class CotizacionModule {}
