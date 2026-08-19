import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aId } from '../../common/validacion';
import {
  normalizarFicha,
  aNumeroDocumento,
  aFechaNacimiento,
  aRemuneracion,
  type FichaNormalizada,
} from './validacion';
import { limpiar } from '../../common/texto';
import type {
  CrearFichaDto,
  EditarFichaDto,
  MoverFichasDto,
  EliminarFichasDto,
} from './dto';
import { aListaDeIds } from './validacion';

/** Campos de texto que se editan tal cual, sin conversión. */
const CAMPOS_TEXTO = [
  'nombres',
  'apellidoPaterno',
  'tipoTrabajador',
  'paisNacimiento',
  'tipoDocumento',
  'sexo',
  'moneda',
  'estadoCivil',
  'sede',
] as const;

@Injectable()
export class FichaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Traduce la violación de @@unique([periodoId, numeroDocumento]). */
  private traducirDuplicado(error: unknown, documento: string) {
    const codigo = (error as { code?: string })?.code;
    if (codigo === 'P2002')
      return new ConflictException(
        `El documento ${documento} ya está en este periodo. Búscalo en la lista en vez de volver a agregarlo.`,
      );
    return error;
  }

  async crear(usuario: UsuarioAutenticado, dto: CrearFichaDto) {
    const grupoId = aId(dto.grupoId, 'El grupo indicado no es válido.');
    const grupo = await this.prisma.grupoPersonal.findUnique({
      where: { id: grupoId },
      select: { id: true, periodoId: true },
    });
    if (!grupo) throw new NotFoundException('Ese grupo ya no existe.');

    const datos = normalizarFicha(dto);
    const ultimo = await this.prisma.fichaPersonal.findFirst({
      where: { grupoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    try {
      return await this.prisma.fichaPersonal.create({
        data: {
          ...datos,
          periodoId: grupo.periodoId,
          grupoId,
          orden: (ultimo?.orden ?? -1) + 1,
          actualizadoPorId: usuario.id,
        },
      });
    } catch (error) {
      throw this.traducirDuplicado(error, datos.numeroDocumento);
    }
  }

  /**
   * Edición inline: llega SOLO lo que cambió.
   *
   * Se aplica campo a campo en vez de revalidar la ficha entera porque
   * la tabla guarda celda por celda: exigir los 13 en cada pulsación
   * haría imposible arreglar una fila que ya está incompleta.
   */
  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarFichaDto) {
    const actual = await this.prisma.fichaPersonal.findUnique({
      where: { id },
      select: { id: true, periodoId: true, numeroDocumento: true },
    });
    if (!actual)
      throw new NotFoundException('Esa persona ya no está en la lista.');

    const data: Record<string, unknown> = {};

    for (const campo of CAMPOS_TEXTO) {
      if (!(campo in dto)) continue;
      const valor = limpiar(dto[campo]);
      if (!valor)
        throw new BadRequestException(
          `El campo ${campo} no puede quedar vacío.`,
        );
      data[campo] = valor;
    }

    // El único de los 13 que admite vacío: hay personal extranjero con
    // un solo apellido en las listas que ya se presentan.
    if ('apellidoMaterno' in dto)
      data.apellidoMaterno = limpiar(dto.apellidoMaterno) ?? '';

    if ('numeroDocumento' in dto)
      data.numeroDocumento = aNumeroDocumento(dto.numeroDocumento);
    if ('fechaNacimiento' in dto)
      data.fechaNacimiento = aFechaNacimiento(dto.fechaNacimiento);
    if ('remuneracion' in dto)
      data.remuneracion = aRemuneracion(dto.remuneracion);

    // Mover de grupo: el destino tiene que ser del MISMO periodo, si no
    // la ficha quedaría contada en un mes y colgada de otro.
    if ('grupoId' in dto && dto.grupoId !== null && dto.grupoId !== undefined) {
      const grupoId = aId(dto.grupoId, 'El grupo indicado no es válido.');
      const destino = await this.prisma.grupoPersonal.findUnique({
        where: { id: grupoId },
        select: { id: true, periodoId: true },
      });
      if (!destino)
        throw new NotFoundException('El grupo de destino ya no existe.');
      if (destino.periodoId !== actual.periodoId)
        throw new BadRequestException(
          'Solo se puede mover a un grupo del mismo periodo.',
        );
      data.grupoId = grupoId;
    }

    if (Object.keys(data).length === 0)
      return { ok: true, id, sinCambios: true };
    data.actualizadoPorId = usuario.id;

    try {
      return await this.prisma.fichaPersonal.update({
        where: { id },
        data: data as never,
      });
    } catch (error) {
      throw this.traducirDuplicado(
        error,
        (data.numeroDocumento as string) ?? actual.numeroDocumento,
      );
    }
  }

  /**
   * Duplica una fila.
   *
   * El documento NO se copia: es único dentro del periodo y copiarlo
   * fallaría siempre. Se deja vacío el mínimo legal para que la fila
   * exista y el usuario escriba el DNI real encima.
   */
  async duplicar(usuario: UsuarioAutenticado, id: number) {
    const origen = await this.prisma.fichaPersonal.findUnique({
      where: { id },
    });
    if (!origen)
      throw new NotFoundException('Esa persona ya no está en la lista.');

    // Sufijo incremental hasta encontrar hueco: "COPIA-1", "COPIA-2"…
    let sufijo = 1;
    let documento = `COPIA-${sufijo}`;
    while (
      await this.prisma.fichaPersonal.findFirst({
        where: { periodoId: origen.periodoId, numeroDocumento: documento },
        select: { id: true },
      })
    ) {
      sufijo += 1;
      documento = `COPIA-${sufijo}`;
    }

    const ultimo = await this.prisma.fichaPersonal.findFirst({
      where: { grupoId: origen.grupoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.fichaPersonal.create({
      data: {
        periodoId: origen.periodoId,
        grupoId: origen.grupoId,
        orden: (ultimo?.orden ?? -1) + 1,
        nombres: origen.nombres,
        apellidoPaterno: origen.apellidoPaterno,
        apellidoMaterno: origen.apellidoMaterno,
        tipoTrabajador: origen.tipoTrabajador,
        paisNacimiento: origen.paisNacimiento,
        tipoDocumento: origen.tipoDocumento,
        numeroDocumento: documento,
        sexo: origen.sexo,
        fechaNacimiento: origen.fechaNacimiento,
        moneda: origen.moneda,
        remuneracion: origen.remuneracion,
        estadoCivil: origen.estadoCivil,
        sede: origen.sede,
        actualizadoPorId: usuario.id,
      },
    });
  }

  /** Mueve varias fichas de golpe a otro grupo del mismo periodo. */
  async mover(usuario: UsuarioAutenticado, dto: MoverFichasDto) {
    const ids = aListaDeIds(dto.fichaIds, 'fichaIds');
    const grupoId = aId(
      dto.grupoDestinoId,
      'El grupo de destino no es válido.',
    );

    const destino = await this.prisma.grupoPersonal.findUnique({
      where: { id: grupoId },
      select: { id: true, periodoId: true },
    });
    if (!destino)
      throw new NotFoundException('El grupo de destino ya no existe.');

    const fichas = await this.prisma.fichaPersonal.findMany({
      where: { id: { in: ids } },
      select: { id: true, periodoId: true },
    });
    if (fichas.length !== ids.length)
      throw new NotFoundException(
        'Alguna de las personas seleccionadas ya no está en la lista.',
      );
    if (fichas.some((f) => f.periodoId !== destino.periodoId))
      throw new BadRequestException(
        'Solo se puede mover a un grupo del mismo periodo.',
      );

    await this.prisma.fichaPersonal.updateMany({
      where: { id: { in: ids } },
      data: { grupoId, actualizadoPorId: usuario.id },
    });
    return { ok: true, movidas: ids.length, grupoId };
  }

  /** Borra una o varias fichas. */
  async eliminar(dto: EliminarFichasDto) {
    const ids = aListaDeIds(dto.fichaIds, 'fichaIds');
    const { count } = await this.prisma.fichaPersonal.deleteMany({
      where: { id: { in: ids } },
    });
    return { ok: true, eliminadas: count };
  }

  /** Datos ya validados, para reusar desde la importación. */
  normalizar(dto: CrearFichaDto): FichaNormalizada {
    return normalizarFicha(dto);
  }
}
