import { Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';

/**
 * La bitácora del módulo Costos.
 *
 * Módulo propio y exportado —no global— porque lo usan casi todos los
 * submódulos de Costos y ninguno de fuera. Global está reservado a los
 * cimientos de verdad (`PrismaModule`, `CommonModule`, `AuthModule`);
 * hacer global todo lo que se comparte acaba con un contenedor donde no
 * se sabe quién depende de qué.
 */
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
