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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { PlantillaService } from './plantilla.service';
import type { GuardarPlantillaDto } from './plantilla.service';
import { ImportacionFotosService } from './importacion.service';
import { CampoFotosService } from './campo.service';
import { EstadoEquipoService } from './estado-equipo.service';
import { SistemaFotosService } from './sistema.service';
import type {
  GuardarFamiliaDto,
  GuardarTipoSistemaDto,
} from './sistema.service';
import { CatalogoActividadService } from './catalogo-actividad.service';
import type { GuardarDefinicionActividadDto } from './catalogo-actividad.service';
import type { GuardarEstadoDto } from './estado-equipo.service';
import { ConfiguracionFotosService } from './configuracion.service';
import type { GuardarCampoDto, EditarCampoDto } from './campo.service';
import type { Decision } from './importacion.service';
import { RequiereModulo, UsuarioActual } from '../auth/decoradores';
import { Modulo } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import type { AccionFotos, EntidadFotos } from '../../generated/prisma/enums';

/** Tope del Excel. Un archivo de estructura no pesa megas. */
const MAX_BYTES_EXCEL = 5 * 1024 * 1024;

/**
 * Auditoría (§23), plantillas (§20) e importación por Excel (§19).
 *
 * Las tres viven juntas porque son la misma clase de cosa: **administrar el
 * módulo**, no trabajar dentro de una carpeta. Ninguna de las tres cuelga de
 * un `carpeta/:id` en su ruta principal.
 *
 * El permiso NO se decide aquí sino en cada service: consultar la bitácora y
 * administrar plantillas piden nivel global, mientras que APLICAR una
 * plantilla o importar un Excel piden EDICION sobre la carpeta destino —usar
 * las herramientas es de quien trabaja en obra, configurarlas es de quien
 * administra—.
 */
@RequiereModulo(Modulo.FOTOS)
@Controller('fotos')
export class AdministracionFotosController {
  constructor(
    private readonly auditoria: AuditoriaFotosService,
    private readonly plantillas: PlantillaService,
    private readonly importacion: ImportacionFotosService,
    private readonly campos: CampoFotosService,
    private readonly configuracion: ConfiguracionFotosService,
    private readonly estados: EstadoEquipoService,
    private readonly sistemas: SistemaFotosService,
    private readonly catalogo: CatalogoActividadService,
  ) {}

  // ── Auditoría (§23) ──

  /** «Quién hizo qué y cuándo», con filtros. */
  @Get('auditoria')
  consultar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('usuarioId', new ParseIntPipe({ optional: true }))
    usuarioId?: number,
    @Query('accion') accion?: string,
    @Query('entidad') entidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.auditoria.consultar(usuario, {
      usuarioId,
      accion: accion as AccionFotos | undefined,
      entidad: entidad as EntidadFotos | undefined,
      desde,
      hasta,
      cursor,
    });
  }

  /** El hilo de una carpeta: todo lo que le ha pasado (§23). */
  @Get('auditoria/carpeta/:id')
  deCarpeta(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.auditoria.deCarpeta(usuario, id);
  }

  // ── Colores del explorador (Fase 1c) ──
  //
  // El color por TIPO de carpeta es configuración del módulo, así que vive
  // aquí. Leerlo es de cualquiera —lo necesita quien pinte el explorador, y
  // «los equipos son celestes» no revela nada—; cambiarlo, de ADMIN_GLOBAL,
  // y eso lo hace cumplir el service.

  @Get('configuracion/color')
  colores() {
    return this.configuracion.colores();
  }

  @Patch('configuracion/color')
  cambiarColor(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: { tipo?: unknown; color?: unknown },
  ) {
    return this.configuracion.cambiarColor(usuario, dto?.tipo, dto?.color);
  }

  // ── Familias y tipos de sistema (Fase 2) ──
  //
  // Vocabulario del módulo, como los estados y los campos: leerlo es de
  // cualquiera —hace falta para dar de alta un equipo— y cambiarlo, de
  // ADMIN_GLOBAL, que lo hace cumplir el service.

  @Get('sistema')
  listarSistemas(@Query('activos') activos?: string) {
    return this.sistemas.listarFamilias(activos === 'true');
  }

  @Post('sistema/familia')
  crearFamilia(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarFamiliaDto,
  ) {
    return this.sistemas.crearFamilia(usuario, dto);
  }

  @Patch('sistema/familia/:id')
  editarFamilia(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarFamiliaDto,
  ) {
    return this.sistemas.editarFamilia(usuario, id, dto);
  }

  @Delete('sistema/familia/:id')
  eliminarFamilia(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sistemas.eliminarFamilia(usuario, id);
  }

  @Post('sistema/tipo')
  crearTipoSistema(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarTipoSistemaDto,
  ) {
    return this.sistemas.crearTipo(usuario, dto);
  }

  @Patch('sistema/tipo/:id')
  editarTipoSistema(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarTipoSistemaDto,
  ) {
    return this.sistemas.editarTipo(usuario, id, dto);
  }

  @Delete('sistema/tipo/:id')
  eliminarTipoSistema(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sistemas.eliminarTipo(usuario, id);
  }

  // ── Catálogo de actividades (Fase 2) ──

  /** `tipoSistema` lo acota a lo que se propone para ese tipo. */
  @Get('catalogo-actividad')
  listarCatalogo(
    @Query('activas') activas?: string,
    @Query('tipoSistema') tipoSistema?: string,
  ) {
    return this.catalogo.listar({
      soloActivas: activas === 'true',
      tipoSistemaId: tipoSistema,
    });
  }

  @Post('catalogo-actividad')
  crearDefinicion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarDefinicionActividadDto,
  ) {
    return this.catalogo.crear(usuario, dto);
  }

  @Patch('catalogo-actividad/:id')
  editarDefinicion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarDefinicionActividadDto,
  ) {
    return this.catalogo.editar(usuario, id, dto);
  }

  @Delete('catalogo-actividad/:id')
  eliminarDefinicion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.eliminar(usuario, id);
  }

  // ── Catálogo de estados de equipo (Fase 1) ──
  //
  // Configuración del módulo, como los campos y los colores: no cuelga de
  // ninguna carpeta. Leer es de cualquiera —hace falta para elegir el estado
  // de una intervención—; cambiar, de ADMIN_GLOBAL, y lo hace cumplir el service.

  @Get('estado-equipo')
  listarEstados(@Query('activos') activos?: string) {
    return this.estados.listar(activos === 'true');
  }

  @Post('estado-equipo')
  crearEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarEstadoDto,
  ) {
    return this.estados.crear(usuario, dto);
  }

  @Patch('estado-equipo/:id')
  editarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarEstadoDto,
  ) {
    return this.estados.editar(usuario, id, dto);
  }

  /** Solo si ninguna intervención lo usa; si no, el service manda retirarlo. */
  @Delete('estado-equipo/:id')
  eliminarEstado(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.estados.eliminar(usuario, id);
  }

  // ── Campos configurables del EQUIPO (Fase 1b) ──
  //
  // Viven aquí y no en `CarpetaController` porque son CONFIGURACIÓN del
  // módulo, no trabajo dentro de una carpeta: ninguna de estas rutas cuelga
  // de un `carpeta/:id`. Es el mismo criterio que puso aquí las plantillas.
  //
  // El permiso lo decide `CampoFotosService`, no un decorador: escribir
  // exige ADMIN_GLOBAL, pero LEER no —cualquiera con el módulo necesita la
  // lista para pintar el formulario de un equipo, y son nombres de campo,
  // no datos de nadie—. Un `@RequiereNivelFotos` en la clase habría cerrado
  // también la lectura.

  @Get('campo')
  listarCampos(@Query('activos') activos?: string) {
    return this.campos.listar(activos === 'true');
  }

  @Post('campo')
  crearCampo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarCampoDto,
  ) {
    return this.campos.crear(usuario, dto);
  }

  /** Renombrar, reordenar y activar/desactivar. El `tipo` no se toca. */
  @Patch('campo/:id')
  editarCampo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCampoDto,
  ) {
    return this.campos.editar(usuario, id, dto);
  }

  /** Solo si nadie lo usa; con valores, el service manda desactivarlo. */
  @Delete('campo/:id')
  eliminarCampo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.campos.eliminar(usuario, id);
  }

  @Post('campo/:id/opcion')
  agregarOpcion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body('etiqueta') etiqueta: unknown,
  ) {
    return this.campos.agregarOpcion(usuario, id, etiqueta);
  }

  /** Elegida por alguien = se desactiva; si no, se borra. Lo decide el service. */
  @Delete('campo/opcion/:opcionId')
  eliminarOpcion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('opcionId', ParseIntPipe) opcionId: number,
  ) {
    return this.campos.eliminarOpcion(usuario, opcionId);
  }

  // ── Plantillas de estructura (§20) ──

  @Get('plantilla')
  listarPlantillas(@Query('activas') activas?: string) {
    return this.plantillas.listar(activas === 'true');
  }

  @Get('plantilla/:id')
  verPlantilla(@Param('id', ParseIntPipe) id: number) {
    return this.plantillas.detalle(id);
  }

  @Post('plantilla')
  crearPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarPlantillaDto,
  ) {
    return this.plantillas.crear(usuario, dto ?? {});
  }

  @Patch('plantilla/:id')
  editarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarPlantillaDto,
  ) {
    return this.plantillas.editar(usuario, id, dto ?? {});
  }

  @Delete('plantilla/:id')
  eliminarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plantillas.eliminar(usuario, id);
  }

  /** «Crear desde plantilla» (§20). La carpeta destino va en la ruta. */
  @Post('plantilla/:id/aplicar/:carpetaId')
  aplicarPlantilla(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('carpetaId', ParseIntPipe) carpetaId: number,
  ) {
    return this.plantillas.aplicar(usuario, id, carpetaId);
  }

  // ── Importación por Excel (§19) ──
  //
  // Dos rutas y no una: §19 exige vista previa ANTES de escribir, y el
  // archivo se manda las dos veces para no guardar estado de sesión en el
  // servidor. Ver la cabecera de `ImportacionFotosService`.

  @Post('importacion/carpeta/:id/previa')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_EXCEL } }),
  )
  previa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @UploadedFile() archivo?: { buffer: Buffer },
  ) {
    if (!archivo?.buffer)
      throw new BadRequestException('No se recibió ningún archivo.');
    return this.importacion.analizar(usuario, archivo.buffer, carpetaId);
  }

  @Post('importacion/carpeta/:id/confirmar')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_EXCEL } }),
  )
  confirmar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) carpetaId: number,
    @UploadedFile() archivo?: { buffer: Buffer },
    @Body() dto?: { decisiones?: string },
  ) {
    if (!archivo?.buffer)
      throw new BadRequestException('No se recibió ningún archivo.');

    // Las decisiones viajan como JSON en un campo del multipart: el cuerpo
    // no puede ser JSON puro porque lleva el archivo al lado.
    let decisiones: Record<number, Decision> = {};
    if (dto?.decisiones) {
      try {
        decisiones = JSON.parse(dto.decisiones) as Record<number, Decision>;
      } catch {
        throw new BadRequestException('Las decisiones no son un JSON válido.');
      }
    }

    return this.importacion.confirmar(
      usuario,
      archivo.buffer,
      carpetaId,
      decisiones,
    );
  }
}
