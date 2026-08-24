import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import {
  ColorCarpetaFotos,
  TipoCarpetaFotos,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';

/**
 * Los colores por defecto, y son el ÚLTIMO recurso, no la fuente de verdad.
 *
 * La verdad está en `configuracion_color_carpeta`, sembrada por la migración
 * —el requerimiento es que el color sea un dato configurable, no una
 * constante—. Esto solo cubre el caso de que a alguien le falte una fila:
 * una pantalla sin color es peor que una con el color de fábrica.
 *
 * `Record` completo a propósito: añadir un tipo de carpeta no compila hasta
 * decidir de qué color es.
 */
const POR_DEFECTO: Record<TipoCarpetaFotos, ColorCarpetaFotos> = {
  CARPETA: ColorCarpetaFotos.AMARILLO,
  EQUIPO: ColorCarpetaFotos.CELESTE,
};

export type ColoresPorTipo = Record<TipoCarpetaFotos, ColorCarpetaFotos>;

/**
 * Configuración del módulo Fotos que no cuelga de ninguna carpeta.
 *
 * Hoy solo el color por tipo (Fase 1c). Vive en un service propio y no en
 * `CarpetaService` porque no es una operación sobre el árbol: es un ajuste
 * del módulo, con el permiso de administrarlo y no el de una carpeta.
 */
@Injectable()
export class ConfiguracionFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Qué color usa cada tipo.
   *
   * Leerlo NO exige ser administrador: lo necesita cualquiera que pinte el
   * explorador, y decir «los equipos son celestes» no revela nada.
   *
   * Se completa con `POR_DEFECTO` en vez de fallar si falta una fila. Es una
   * consulta de dos filas sin filtro, así que no hace falta caché — y una
   * caché aquí habría que invalidarla al cambiar el color, que es
   * exactamente el único momento en que este dato cambia.
   */
  async colores(): Promise<ColoresPorTipo> {
    const filas = await this.prisma.configuracionColorCarpeta.findMany({
      select: { tipo: true, color: true },
    });
    const guardado = new Map(filas.map((f) => [f.tipo, f.color]));
    return {
      CARPETA: guardado.get('CARPETA') ?? POR_DEFECTO.CARPETA,
      EQUIPO: guardado.get('EQUIPO') ?? POR_DEFECTO.EQUIPO,
    };
  }

  /**
   * Cambia el color de un tipo. De ADMIN_GLOBAL: es configuración del módulo.
   *
   * `upsert` y no `update` porque la fila puede no existir —una base montada
   * sin la siembra de la migración, que es justo lo que ya pasó una vez con
   * los CHECK de Neon—.
   */
  async cambiarColor(
    usuario: UsuarioAutenticado,
    tipoCrudo: unknown,
    colorCrudo: unknown,
  ): Promise<ColoresPorTipo> {
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador global de Fotos cambia los colores del explorador.',
      );

    const tipo = this.aTipo(tipoCrudo);
    const color = this.aColor(colorCrudo);

    await this.prisma.configuracionColorCarpeta.upsert({
      where: { tipo },
      create: { tipo, color },
      update: { color },
    });

    // §23. Sin `carpetaId`: no cuelga de ninguna, igual que publicar una
    // plantilla o definir un campo.
    await this.auditoria.registrar(usuario, {
      carpetaId: null,
      entidad: 'CARPETA',
      entidadId: 0,
      accion: 'EDICION',
      descripcion: `Cambió el color de las carpetas de tipo ${tipo} a ${color}.`,
    });

    return this.colores();
  }

  private aTipo(valor: unknown): TipoCarpetaFotos {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(TipoCarpetaFotos) as string[];
    if (s && validos.includes(s)) return s as TipoCarpetaFotos;
    throw new BadRequestException(
      `Tipo de carpeta inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  private aColor(valor: unknown): ColorCarpetaFotos {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(ColorCarpetaFotos) as string[];
    if (s && validos.includes(s)) return s as ColorCarpetaFotos;
    throw new BadRequestException(
      `Color inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }
}
