import { Module } from '@nestjs/common';
import { PlantillaService } from './plantilla.service';
import { PlantillaAdminService } from './plantilla-admin.service';
import { PlantillaController } from './plantilla.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Plantillas de correo del módulo Costos (§32, §68).
 *
 * Dos services partidos por pregunta, no por capa: `PlantillaService`
 * responde «¿qué mando en este envío?» y lo usa el Gestor sin saberlo;
 * `PlantillaAdminService` responde «¿qué texto usamos a partir de hoy?»
 * y solo lo toca el SuperAdmin.
 *
 * Solo se exporta el primero: el envío no tiene por qué poder publicar
 * versiones.
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [PlantillaController],
  providers: [PlantillaService, PlantillaAdminService],
  exports: [PlantillaService],
})
export class PlantillaModule {}
