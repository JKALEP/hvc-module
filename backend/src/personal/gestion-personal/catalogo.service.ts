import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoPersonal } from '../../../generated/prisma/enums';
import { limpiar } from '../../common/texto';
import { aCampo } from './validacion';
import type { CrearOpcionDto } from './dto';

/**
 * Lo que ofrecen los siete selectores de la tabla.
 *
 * Es un catálogo de SUGERENCIAS, no una restricción: las fichas guardan
 * texto libre, así que un valor que no esté aquí entra igual. Por eso al
 * importar se recogen los valores nuevos y se dan de alta solos — si no,
 * el desplegable no ofrecería lo que ya está escrito en la propia tabla.
 */
@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas las opciones, agrupadas por campo. */
  async listar() {
    const filas = await this.prisma.opcionPersonal.findMany({
      orderBy: [{ campo: 'asc' }, { orden: 'asc' }, { valor: 'asc' }],
    });
    const porCampo = {} as Record<CampoPersonal, typeof filas>;
    for (const campo of Object.values(CampoPersonal)) porCampo[campo] = [];
    for (const f of filas) porCampo[f.campo].push(f);
    return porCampo;
  }

  async crear(dto: CrearOpcionDto) {
    const campo = aCampo(dto.campo);
    const valor = limpiar(dto.valor);
    if (!valor) throw new BadRequestException('El valor es obligatorio.');

    const existe = await this.prisma.opcionPersonal.findFirst({
      where: { campo, valor },
      select: { id: true },
    });
    if (existe)
      throw new ConflictException(
        `"${valor}" ya está en la lista de ${campo}.`,
      );

    const ultimo = await this.prisma.opcionPersonal.findFirst({
      where: { campo },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.opcionPersonal.create({
      data: { campo, valor, orden: (ultimo?.orden ?? -1) + 1 },
    });
  }

  async eliminar(id: number) {
    const opcion = await this.prisma.opcionPersonal.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!opcion) throw new NotFoundException('Esa opción ya no existe.');
    // Quitarla del catálogo NO toca las fichas que ya la usan: el valor
    // vive como texto en cada fila y sigue siendo válido.
    await this.prisma.opcionPersonal.delete({ where: { id } });
    return { ok: true, id };
  }

  /**
   * Da de alta los valores que aparecieron al importar y que aún no
   * estaban. Sin esto, tras importar un Excel con "VENEZOLANO" el
   * desplegable de país no lo ofrecería aunque medio periodo lo tenga.
   */
  async registrarValores(
    valores: { campo: CampoPersonal; valor: string }[],
  ): Promise<number> {
    if (valores.length === 0) return 0;
    const unicos = new Map<string, { campo: CampoPersonal; valor: string }>();
    for (const v of valores) {
      const valor = limpiar(v.valor);
      if (valor) unicos.set(`${v.campo}|${valor}`, { campo: v.campo, valor });
    }
    const { count } = await this.prisma.opcionPersonal.createMany({
      data: [...unicos.values()],
      skipDuplicates: true,
    });
    return count;
  }
}
