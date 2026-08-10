import { Module } from '@nestjs/common';
import { SupervisorController } from './supervisor.controller';
import { SupervisorService } from './supervisor.service';
import { SupervisorAnaliticaService } from './supervisor-analitica.service';

// Dos providers: SupervisorService es el CRUD del catálogo;
// SupervisorAnaliticaService solo lee y agrega el seguimiento.
// Mismo patrón que proyecto/ e indicadores/.
@Module({
  controllers: [SupervisorController],
  providers: [SupervisorService, SupervisorAnaliticaService],
  exports: [SupervisorAnaliticaService],
})
export class SupervisorModule {}
