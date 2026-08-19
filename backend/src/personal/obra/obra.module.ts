import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ObraController } from './obra.controller';
import { CarpetaService } from './carpeta.service';
import { NavegacionService } from './navegacion.service';
import { ProyectoService } from './proyecto.service';
import { JornadaService } from './jornada.service';
import { AnaliticaService } from './analitica.service';
import { AsignacionService } from './asignacion.service';
import { CalculoObraService } from './calculo-obra.service';

/**
 * Obra — proyectos, carpetas y registro diario.
 *
 * Sustituye a los módulos proyecto, reporte-diario, indicadores,
 * supervisor, trabajador y alertas, retirados el 12/08/2026.
 *
 * Las personas y las empresas salen de gestión de personal; este módulo
 * no tiene tablas propias de gente.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ObraController],
  providers: [
    CarpetaService,
    NavegacionService,
    ProyectoService,
    JornadaService,
    AnaliticaService,
    AsignacionService,
    CalculoObraService,
  ],
})
export class ObraModule {}
