import { Module } from '@nestjs/common';
import { AprobacionController } from './aprobacion.controller';
import { AprobacionService } from './aprobacion.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { RequerimientoModule } from '../requerimiento/requerimiento.module';

/**
 * Las decisiones del Aprobador (§40-45).
 *
 * Importa `RequerimientoModule` por lo mismo que los demás: el control de
 * acceso y la transición de estado no se reimplementan.
 */
@Module({
  imports: [AuditoriaModule, RequerimientoModule],
  controllers: [AprobacionController],
  providers: [AprobacionService],
})
export class AprobacionModule {}
