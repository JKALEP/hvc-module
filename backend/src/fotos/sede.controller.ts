import {
  Controller,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { SedeService } from './sede.service';
import type { CrearSedeDto, EditarSedeDto } from './sede.service';
import { RequiereModulo, RequiereNivelFotos } from '../auth/decoradores';
import { Modulo, NivelFotos } from '../../generated/prisma/enums';

/**
 * Escritura de sedes: solo un ADMIN_FOTOS.
 *
 * Aquí no hay lecturas: recorrer el árbol es `GET /fotos/navegacion`, que
 * un colaborador también necesita y por eso no exige este nivel.
 */
@RequiereModulo(Modulo.FOTOS)
@RequiereNivelFotos(NivelFotos.ADMIN_FOTOS)
@Controller('fotos/sede')
export class SedeController {
  constructor(private readonly sede: SedeService) {}

  @Post()
  crear(@Body() dto: CrearSedeDto) {
    return this.sede.crear(dto);
  }

  // Permite renombrar, cambiar estado y MOVER de sitio (parentId).
  @Put(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarSedeDto) {
    return this.sede.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.sede.eliminar(id);
  }
}
