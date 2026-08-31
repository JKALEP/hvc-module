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
import { RequerimientoService } from './requerimiento.service';
import { ItemService } from './item.service';
import { OpcionService } from '../catalogo/opcion.service';
import { ClienteService } from '../catalogo/cliente.service';
import { SupervisorService } from '../catalogo/supervisor.service';
import {
  RequiereModulo,
  RequiereRolCostos,
  UsuarioActual,
} from '../../auth/decoradores';
import { Modulo } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import type { GuardarRequerimientoDto, GuardarItemDto, MotivoDto } from './dto';
import type { GuardarClienteDto } from '../catalogo/dto';

/**
 * El requerimiento y sus ítems.
 *
 * `@RequiereModulo(COSTOS)` va en la clase; el ROL va método a método,
 * porque dentro del mismo recurso conviven acciones de roles distintos:
 * leer un requerimiento lo hacen los tres, emitirlo solo el Solicitante.
 * Es §57 —la autorización vive en el backend— y por eso está aquí y no
 * solo en los botones que se pintan.
 *
 * Las lecturas NO llevan `@RequiereRolCostos`: el Gestor y el Aprobador
 * tienen que ver los requerimientos ajenos, que es todo su trabajo. Quién
 * ve QUÉ lo acota el service —un Solicitante solo los suyos (§26)—, que
 * es una regla de alcance, no de rol.
 */
@RequiereModulo(Modulo.COSTOS)
@Controller('costos/requerimiento')
export class RequerimientoController {
  constructor(
    private readonly requerimientos: RequerimientoService,
    private readonly items: ItemService,
    private readonly opciones: OpcionService,
    private readonly clientes: ClienteService,
    private readonly supervisores: SupervisorService,
  ) {}

  /**
   * Todo lo que necesitan los selectores del formulario de §13, de una
   * sola vez.
   *
   * Cinco listas en una llamada y no cinco llamadas: es UN formulario que
   * se abre entero, y pedirlas por separado habría dejado la pantalla
   * llenándose a trozos.
   *
   * Solo lo ACTIVO. La pantalla de administración —que sí quiere ver lo
   * retirado— usa `/costos/admin/*`, que es otro endpoint aunque hoy
   * devuelva casi lo mismo.
   *
   * ⚠️ Va declarado ANTES que `:id`. Nest resuelve las rutas en orden de
   * declaración, y con `:id` delante esto entraría por ahí y respondería
   * «requerimiento no encontrado».
   */
  @Get('opciones')
  async opcionesDeFormulario() {
    const [
      tiposMantenimiento,
      tiposRequerimiento,
      unidades,
      clientes,
      supervisores,
    ] = await Promise.all([
      this.opciones.listar({ tipo: 'TIPO_MANTENIMIENTO', soloActivas: true }),
      this.opciones.listar({ tipo: 'TIPO_REQUERIMIENTO', soloActivas: true }),
      this.opciones.listar({ tipo: 'UNIDAD_MEDIDA', soloActivas: true }),
      this.clientes.listar({ soloActivos: true }),
      this.supervisores.listar({ soloActivos: true }),
    ]);

    return {
      tiposMantenimiento,
      tiposRequerimiento,
      unidades,
      clientes,
      supervisores,
    };
  }

  /** GET /costos/requerimiento?grupo=pendientes|finalizados&estado=OBSERVADO */
  @Get()
  listar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('grupo') grupo?: string,
    @Query('estado') estado?: string,
  ) {
    return this.requerimientos.listar(usuario, { grupo, estado });
  }

  @Get(':id')
  detalle(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requerimientos.detalle(usuario, id);
  }

  /** La cadena completa de §64: quién hizo qué y cuándo. */
  @Get(':id/historial')
  historial(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requerimientos.historial(usuario, id);
  }

  // ── Acciones del Solicitante ──

  @Post()
  @RequiereRolCostos('SOLICITANTE')
  crear(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarRequerimientoDto,
  ) {
    return this.requerimientos.crear(usuario, dto);
  }

  @Patch(':id')
  @RequiereRolCostos('SOLICITANTE')
  editar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarRequerimientoDto,
  ) {
    return this.requerimientos.editar(usuario, id, dto);
  }

  /**
   * Reserva el número para enseñarlo en la vista previa.
   *
   * Idempotente: volver al paso 3 no consume otro correlativo. Ver el
   * aviso de `RequerimientoService.reservarNumero` sobre los huecos que
   * deja un borrador que llega aquí y no se emite.
   */
  @Post(':id/reservar-numero')
  @RequiereRolCostos('SOLICITANTE')
  reservarNumero(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requerimientos.reservarNumero(usuario, id);
  }

  /**
   * Da de alta un cliente desde el propio formulario del requerimiento.
   *
   * Existe porque el selector de cliente pasó a ser un combobox
   * «buscar o crear»: quien emite se encuentra a menudo con un cliente
   * que todavía no está en el maestro, y mandarlo a pedirle el alta al
   * SuperAdmin para poder seguir escribiendo era el camino corto a que
   * alguien reutilizara un cliente equivocado.
   *
   * ⚠️ Es un permiso NUEVO para el Solicitante: `/costos/admin/cliente`
   * sigue siendo solo del SuperAdmin y este endpoint no lo sustituye —
   * aquí solo se CREA, no se edita ni se retira. El alta queda en la
   * bitácora con su autor, igual que la que hace el SuperAdmin, porque
   * es el mismo `ClienteService.crear`.
   */
  @Post('cliente')
  @RequiereRolCostos('SOLICITANTE')
  crearCliente(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: GuardarClienteDto,
  ) {
    return this.clientes.crear(usuario, dto);
  }

  /** §25. También es «devolverlo corregido» tras una observación (§28). */
  @Post(':id/emitir')
  @RequiereRolCostos('SOLICITANTE')
  emitir(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requerimientos.emitir(usuario, id);
  }

  @Post(':id/cancelar')
  @RequiereRolCostos('SOLICITANTE')
  cancelar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivoDto,
  ) {
    return this.requerimientos.cancelar(usuario, id, dto?.motivo ?? undefined);
  }

  /** El «Cancelar» de §15: abandona un borrador que nadie ha visto. */
  @Delete(':id')
  @RequiereRolCostos('SOLICITANTE')
  eliminarBorrador(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requerimientos.eliminarBorrador(usuario, id);
  }

  // ── Ítems (§19-23) ──

  @Post(':id/item')
  @RequiereRolCostos('SOLICITANTE')
  agregarItem(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GuardarItemDto,
  ) {
    return this.items.agregar(usuario, id, dto);
  }

  @Patch(':id/item/:itemId')
  @RequiereRolCostos('SOLICITANTE')
  editarItem(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: GuardarItemDto,
  ) {
    return this.items.editar(usuario, id, itemId, dto);
  }

  @Delete(':id/item/:itemId')
  @RequiereRolCostos('SOLICITANTE')
  eliminarItem(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.items.eliminar(usuario, id, itemId);
  }
}
