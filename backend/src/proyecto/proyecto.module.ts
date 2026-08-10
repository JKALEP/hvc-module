import { Module } from '@nestjs/common';
import { ProyectoController } from './proyecto.controller';
import { ProyectoService } from './proyecto.service';
import { ProyectoAnaliticaService } from './proyecto-analitica.service';

// Dos providers a propósito: ProyectoService escribe el catálogo y los
// avances; ProyectoAnaliticaService solo lee y agrega para los gráficos.
@Module({
  controllers: [ProyectoController],
  providers: [ProyectoService, ProyectoAnaliticaService],
  // La analítica la consume AlertasModule.
  exports: [ProyectoAnaliticaService],
})
export class ProyectoModule {}
