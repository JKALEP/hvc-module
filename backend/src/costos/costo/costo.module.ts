import { Module } from '@nestjs/common';
import { CostoController } from './costo.controller';
import { BaseCostosService } from './base-costos.service';
import { RegistroCostoService } from './registro-costo.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { RequerimientoModule } from '../requerimiento/requerimiento.module';

/**
 * El costo registrado y el histórico.
 *
 * Dos services partidos por pregunta, no por capa: `registro-costo`
 * responde «¿cuánto costó ESTE requerimiento?» y lo cierra;
 * `base-costos` responde «¿cuánto hemos pagado por esto históricamente?»
 * y es de solo lectura.
 */
@Module({
  imports: [AuditoriaModule, RequerimientoModule],
  controllers: [CostoController],
  providers: [BaseCostosService, RegistroCostoService],
  // Para la exportación de §69: el archivo dice lo mismo que la
  // pantalla porque sale del mismo service.
  exports: [RegistroCostoService],
})
export class CostoModule {}
