import { Module } from '@nestjs/common';
import { ObservacionController } from './observacion.controller';
import { ObservacionService } from './observacion.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { RequerimientoModule } from '../requerimiento/requerimiento.module';

/**
 * Observaciones sobre el requerimiento (§27-29).
 *
 * Importa `RequerimientoModule` para dos cosas que no debe reimplementar:
 * el control de acceso al requerimiento y la transición de estado.
 */
@Module({
  imports: [AuditoriaModule, RequerimientoModule],
  controllers: [ObservacionController],
  providers: [ObservacionService],
})
export class ObservacionModule {}
