import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { OpcionService } from './opcion.service';
import { ClienteService } from './cliente.service';
import { SupervisorService } from './supervisor.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Los maestros del módulo: catálogos de §58, clientes y supervisores.
 *
 * Exporta sus tres services porque el requerimiento los necesita para
 * llenar los selectores de §13 y para comprobar que lo elegido existe y
 * está activo. Exportar el service —y no repetir la consulta— es lo que
 * evita que «qué opciones se ofrecen» acabe teniendo dos respuestas.
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [CatalogoController],
  providers: [OpcionService, ClienteService, SupervisorService],
  exports: [OpcionService, ClienteService, SupervisorService],
})
export class CatalogoModule {}
