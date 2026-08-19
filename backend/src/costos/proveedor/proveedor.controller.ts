import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ProveedorService } from './proveedor.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  SoloSuperAdmin,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { GuardarProveedorDto } from './dto';

/**
 * Los proveedores (§31).
 *
 * Controller propio y no una sección más de `CatalogoController` porque
 * el proveedor no es solo un maestro que se configura una vez: §59 le da
 * entrada propia en la navegación del **Gestor de cotizaciones**, que lo
 * busca al compartir un requerimiento (§30) y que puede dar de alta uno
 * nuevo sin pasar por administración.
 *
 * Por eso el rol va método a método:
 *   · leer      — los tres roles. El Aprobador ve de quién es la
 *                 cotización que está decidiendo (§40).
 *   · crear y editar — el Gestor, que es quien los trata (§30).
 *   · borrar    — solo el SuperAdmin: retirar un proveedor del sistema es
 *                 administración, no parte del flujo. Y casi siempre lo
 *                 correcto es desactivarlo, no borrarlo.
 *
 * El SuperAdmin llega a todo sin declarar nada: `reglaSuperAdmin` va
 * antes que `reglaRolCostos` en la cadena.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos/proveedor')
export class ProveedorController {
  constructor(private readonly proveedores: ProveedorService) {}

  /** GET /costos/proveedor?q=ferri&soloActivos=true — el buscador de §30. */
  @Get()
  listar(@Query('q') q?: string, @Query('soloActivos') soloActivos?: string) {
    return this.proveedores.listar({ q, soloActivos: soloActivos === 'true' });
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.proveedores.detalle(id);
  }

  @Post()
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarProveedorDto,
  ) {
    return this.proveedores.crear(usuario, dto);
  }

  @Patch(':id')
  @RequiereRolCostos('GESTOR_COTIZACIONES')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarProveedorDto,
  ) {
    return this.proveedores.editar(usuario, id, dto);
  }

  @Delete(':id')
  @SoloSuperAdmin()
  eliminar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.proveedores.eliminar(usuario, id);
  }
}
