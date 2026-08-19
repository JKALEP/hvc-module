import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GestionPersonalController } from './gestion-personal.controller';
import { ExcelController } from './excel.controller';
import { PeriodoService } from './periodo.service';
import { GrupoService } from './grupo.service';
import { FichaService } from './ficha.service';
import { CatalogoService } from './catalogo.service';
import { LecturaExcelService } from './lectura-excel.service';
import { EscrituraExcelService } from './escritura-excel.service';
import { ImportacionPersonalService } from './importacion-personal.service';

/**
 * Gestión de personal — listas SCTR.
 *
 * Pieza autocontenida: no depende de ningún service de nómina ni de
 * proyectos, y nada de lo existente depende de ella.
 */
@Module({
  imports: [PrismaModule],
  controllers: [GestionPersonalController, ExcelController],
  providers: [
    PeriodoService,
    GrupoService,
    FichaService,
    CatalogoService,
    LecturaExcelService,
    EscrituraExcelService,
    ImportacionPersonalService,
  ],
})
export class GestionPersonalModule {}
