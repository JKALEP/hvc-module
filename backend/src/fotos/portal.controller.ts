import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { NavegacionService } from './navegacion.service';
import { AlbumService } from './album.service';
import { AccesoService } from './acceso.service';
import { TareaService } from './tarea.service';
import { ComentarioService } from './comentario.service';
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
    private readonly album: AlbumService,
    private readonly acceso: AccesoService,
    // Con guion bajo porque `tareas` y `comentarios` son ya los nombres de
    // dos handlers de esta clase.
    private readonly tareas_: TareaService,
    private readonly comentarios_: ComentarioService,
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

  @Get('carpeta/:id/album')
  galeria(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.exigirCliente(usuario);
    // `anonimo`: a un cliente no se le enseña qué persona de HVC subió qué.
    return this.album.galeria(usuario, id, {
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
    return this.album.urlDeDescarga(usuario, fotoId);
  }

  // ── Tareas y comentarios, en SOLO LECTURA (§22) ──
  //
  // §22 describe el recorrido del cliente con esas palabras: «Compartido
  // conmigo → Proyecto A → Frente 1 → Equipo ABC → Tareas → Álbumes →
  // Fotografías → Comentarios». Hasta aquí el portal solo servía las dos del
  // medio.
  //
  // Son delegaciones finas a los MISMOS services que usa el módulo interno:
  // `TareaService.listar`, `fotosDe` y `ComentarioService.listar` exigen
  // `LECTURA` vía `AccesoService`, que es exactamente lo que un cliente
  // tiene por su concesión. No hay ninguna regla nueva que escribir, y
  // duplicar la consulta aquí habría creado una segunda verdad sobre qué ve
  // un cliente.
  //
  // ⚠️ Lo que NO hay, a propósito, es una sola ruta de ESCRITURA. Ese es el
  // candado real del portal: aunque a un cliente se le comparta con EDICION
  // —que §10 permite—, aquí no existe el endpoint para crear una tarea ni
  // para comentar. Por eso el frontend del portal fuerza solo lectura en vez
  // de deducirla del grado: ofrecer un botón que no tiene ruta detrás sería
  // prometer algo que da 404.

  @Get('carpeta/:id/tarea')
  tareas(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.tareas_.listar(usuario, id);
  }

  @Get('tarea/:id/foto')
  fotosDeTarea(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.exigirCliente(usuario);
    return this.tareas_.fotosDe(usuario, id);
  }

  /** `:entidad` es `carpeta`, `tarea`, `album` o `foto` (§14). */
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
