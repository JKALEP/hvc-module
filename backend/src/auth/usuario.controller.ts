import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import type { CrearUsuarioDto, EditarUsuarioDto } from './usuario.service';
import { SoloSuperAdmin } from './decoradores';

// Gestión de cuentas y módulos: solo el SuperAdmin.
// Un decorador de clase, cero comprobaciones dentro de los métodos.
@SoloSuperAdmin()
@Controller('usuario')
export class UsuarioController {
  constructor(private readonly usuario: UsuarioService) {}

  @Get()
  listar() {
    return this.usuario.listar();
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.usuario.detalle(id);
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuario.crear(dto);
  }

  // Nombre, estado, contraseña y/o módulos. Los permisos se reemplazan enteros.
  @Put(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarUsuarioDto) {
    return this.usuario.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.usuario.eliminar(id);
  }
}
