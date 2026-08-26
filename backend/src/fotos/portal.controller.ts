import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import { FotoService } from './foto.service';
import { AccesoService } from './acceso.service';
import { ActividadService } from './actividad.service';
import { ComentarioService } from './comentario.service';
import { CicloService } from './ciclo.service';
import { PermiteCliente, UsuarioActual } from '../auth/decoradores';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Portal del cliente externo. Solo lectura y descarga.
 *
 * Controller aparte y no un `if` dentro de los internos: lo que un
 * cliente puede hacer es un subconjunto tan pequeño que enumerarlo es
 * más seguro que filtrarlo. Aquí no existe ninguna ruta de escritura que
 * se pueda dejar abierta por descuido.
 */
@PermiteCliente()
@Controller('portal')
export class PortalController {
  constructor(
    private readonly navegacion: NavegacionService,
    private readonly fotos: FotoService,
    private readonly acceso: AccesoService,
    // Con guion bajo porque `actividades` y `comentarios` son ya los nombres de
    // dos handlers de esta clase.
    private readonly actividades_: ActividadService,
    private readonly comentarios_: ComentarioService,
    private readonly ciclos_: CicloService,
  ) {}

  private exigirCliente(usuario: UsuarioAutenticado) {
    if (!this.acceso.esCliente(usuario))
      throw new ForbiddenException(
        'El portal es para cuentas externas. Usa la sección Fotos.',
      );
  }

  @Get('carpeta')
  raiz(@UsuarioActual() usuario: UsuarioAutenticado) {
    this.exigirCliente(usuario);
    return this.navegacion.contenido(usuario, null);
  }

  @Get('carpeta/:id')
  contenido(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.navegacion.contenido(usuario, id);
  }

  /**
   * Las fotos sueltas de una visita, en solo lectura.
   *
   * ⚠️ Era `carpeta/:id/album` y colgaba de la carpeta. Con los álbumes
   * retirados (Fase 4) las fotos son del CICLO, así que el cliente recorre lo
   * mismo que un interno: carpeta → equipo → visita → fotos. §22 describe ese
   * recorrido, y esta ruta es la que lo hace posible.
   */
  @Get('ciclo/:id/foto')
  galeria(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.exigirCliente(usuario);
    // `anonimo`: a un cliente no se le enseña qué persona de HVC subió qué.
    return this.fotos.galeria(usuario, id, {
      cursor,
      desde,
      hasta,
      anonimo: true,
    });
  }

  @Get('foto/:fotoId/descarga')
  descargar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    this.exigirCliente(usuario);
    return this.fotos.urlDeDescarga(usuario, fotoId);
  }

  // ── Actividades y comentarios, en SOLO LECTURA (§22) ──
  //
  // §22 describe el recorrido del cliente con esas palabras: «Compartido
  // conmigo → Proyecto A → Frente 1 → Equipo ABC → Actividades → Álbumes →
  // Fotografías → Comentarios». Hasta aquí el portal solo servía las dos del
  // medio.
  //
  // Son delegaciones finas a los MISMOS services que usa el módulo interno:
  // `ActividadService.listar`, `fotosDe` y `ComentarioService.listar` exigen
  // `LECTURA` vía `AccesoService`, que es exactamente lo que un cliente
  // tiene por su concesión. No hay ninguna regla nueva que escribir, y
  // duplicar la consulta aquí habría creado una segunda verdad sobre qué ve
  // un cliente.
  //
  // ⚠️ Lo que NO hay, a propósito, es una sola ruta de ESCRITURA. Ese es el
  // candado real del portal: aunque a un cliente se le comparta con EDICION
  // —que §10 permite—, aquí no existe el endpoint para crear una actividad ni
  // para comentar. Por eso el frontend del portal fuerza solo lectura en vez
  // de deducirla del grado: ofrecer un botón que no tiene ruta detrás sería
  // prometer algo que da 404.

  /**
   * El historial de ciclos del equipo. El cliente lo ve COMPLETO: es
   * información de su propia instalación y la trazabilidad era el objetivo.
   */
  @Get('carpeta/:id/ciclo')
  ciclos(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.ciclos_.listar(usuario, id);
  }

  @Get('ciclo/:id/actividad')
  actividades(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.actividades_.listar(usuario, id);
  }

  @Get('actividad/:id/foto')
  fotosDeActividad(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.actividades_.fotosDe(usuario, id);
  }

  /** `:entidad` es `carpeta`, `actividad`, `album` o `foto` (§14). */
  @Get('comentario/:entidad/:id')
  comentarios(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('entidad') entidad: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.comentarios_.listar(usuario, entidad, id);
  }
}
