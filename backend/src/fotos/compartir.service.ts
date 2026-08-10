import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoService } from './correo.service';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * «Compartir»: un solo flujo para carpetas y para álbumes.
 *
 * Quien comparte NO elige entre "colaborador interno" e "invitación
 * externa": escribe un correo y el sistema decide según exista o no la
 * cuenta. Obligar a esa elección sería pedirle al usuario que sepa algo
 * que el sistema ya sabe.
 *
 *   correo con cuenta interna  → acceso directo, sin correo de por medio
 *   correo con cuenta CLIENTE  → acceso directo + aviso
 *   correo desconocido         → invitación con enlace de activación
 */

/** Días que vive un enlace de invitación. Sobrevive a un fin de semana largo. */
const DIAS_VIGENCIA = 7;

/** Formato genérico: cualquier dominio. El verificado es el del remitente. */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Objetivo =
  { tipo: 'sede'; id: number } | { tipo: 'album'; id: number };

export type ResultadoCompartir =
  | { via: 'acceso-directo'; nombre: string; email: string; rol: string }
  | { via: 'invitacion'; email: string; expiraEn: Date; enlace: string };

@Injectable()
export class CompartirService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  private normalizar(email: unknown): string {
    if (typeof email !== 'string')
      throw new BadRequestException('El correo es obligatorio.');
    const limpio = email.trim().toLowerCase();
    if (!FORMATO_EMAIL.test(limpio))
      throw new BadRequestException(
        `"${limpio}" no parece un correo válido. Revisa que tenga el formato nombre@dominio.com.`,
      );
    return limpio;
  }

  /** Nombre del recurso en lenguaje de usuario, para correos y avisos. */
  private async describirObjetivo(objetivo: Objetivo): Promise<string> {
    if (objetivo.tipo === 'sede') {
      const sede = await this.prisma.sede.findUnique({
        where: { id: objetivo.id },
        select: { nombre: true },
      });
      if (!sede) throw new NotFoundException('Esa carpeta no existe.');
      return sede.nombre;
    }
    const album = await this.prisma.albumFotos.findUnique({
      where: { id: objetivo.id },
      select: { nombre: true },
    });
    if (!album) throw new NotFoundException('Ese álbum no existe.');
    return album.nombre;
  }

  private clave(objetivo: Objetivo) {
    return objetivo.tipo === 'sede'
      ? { sedeId: objetivo.id, albumId: null }
      : { sedeId: null, albumId: objetivo.id };
  }

  /** Con quién está compartido: cuentas ya activas + invitaciones vivas. */
  async listar(objetivo: Objetivo) {
    const clave = this.clave(objetivo);

    const [accesos, invitaciones] = await Promise.all([
      this.prisma.accesoCompartido.findMany({
        where: clave,
        orderBy: { creadoEn: 'asc' },
        select: {
          id: true,
          creadoEn: true,
          usuario: {
            select: { id: true, nombre: true, email: true, rol: true },
          },
          otorgadoPor: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.invitacionCliente.findMany({
        where: { ...clave, estado: 'PENDIENTE' },
        orderBy: { creadoEn: 'asc' },
        select: {
          id: true,
          email: true,
          expiraEn: true,
          creadoEn: true,
          invitadoPor: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    const ahora = new Date();
    return {
      accesos: accesos.map((a) => ({
        id: a.id,
        creadoEn: a.creadoEn,
        usuario: a.usuario,
        otorgadoPor: a.otorgadoPor,
        // Lo que puede hacer, en lenguaje de usuario.
        puede: a.usuario.rol === 'CLIENTE' ? 'ver' : 'ver-y-subir',
      })),
      invitaciones: invitaciones.map((i) => ({
        ...i,
        vencida: i.expiraEn < ahora,
      })),
    };
  }

  /**
   * El flujo. Devuelve por qué camino se resolvió para que la UI lo diga.
   */
  async compartir(
    quienComparte: UsuarioAutenticado,
    objetivo: Objetivo,
    emailCrudo: unknown,
  ): Promise<ResultadoCompartir> {
    const email = this.normalizar(emailCrudo);
    const recurso = await this.describirObjetivo(objetivo);
    const clave = this.clave(objetivo);

    const existente = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
        permisos: { select: { modulo: true, nivelFotos: true } },
      },
    });

    if (existente) {
      if (existente.estado !== 'ACTIVO')
        throw new BadRequestException(
          `La cuenta de ${existente.nombre} está desactivada. Reactívala antes de compartirle nada.`,
        );

      if (existente.id === quienComparte.id)
        throw new BadRequestException('No hace falta compartirte algo a ti.');

      const permisoFotos = existente.permisos.find((p) => p.modulo === 'FOTOS');

      if (existente.rol !== 'CLIENTE') {
        if (
          existente.rol === 'SUPERADMIN' ||
          permisoFotos?.nivelFotos === 'ADMIN_FOTOS'
        )
          throw new BadRequestException(
            `${existente.nombre} ya ve todo el módulo Fotos por su rol: no hace falta compartirle nada.`,
          );
        if (!permisoFotos)
          throw new BadRequestException(
            `${existente.nombre} tiene cuenta en el sistema pero no el módulo Fotos. El SuperAdmin debe asignárselo antes.`,
          );
      }

      const yaTiene = await this.prisma.accesoCompartido.findFirst({
        where: { ...clave, usuarioId: existente.id },
        select: { id: true },
      });
      if (yaTiene)
        throw new ConflictException(
          `${existente.nombre} ya tiene acceso a "${recurso}".`,
        );

      await this.prisma.accesoCompartido.create({
        data: {
          ...clave,
          usuarioId: existente.id,
          otorgadoPorId: quienComparte.id,
        },
      });

      // A un cliente se le avisa; a un interno no hace falta, lo verá al entrar.
      if (existente.rol === 'CLIENTE')
        this.correo.enviarAvisoDeAcceso({
          para: email,
          recurso,
          invitadoPor: quienComparte.nombre,
          enlace: this.correo.enlaceDelPortal(),
        });

      return {
        via: 'acceso-directo',
        nombre: existente.nombre,
        email: existente.email,
        rol: existente.rol,
      };
    }

    // No existe: invitación de cliente externo.
    return this.invitar(quienComparte, objetivo, email, recurso);
  }

  /** Crea (o refresca) la invitación y "envía" el enlace. */
  private async invitar(
    quienComparte: UsuarioAutenticado,
    objetivo: Objetivo,
    email: string,
    recurso: string,
  ): Promise<ResultadoCompartir> {
    const clave = this.clave(objetivo);

    // El token viaja en el enlace; en la BD solo su hash. Un enlace es
    // una credencial, y las credenciales no se guardan en claro.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiraEn = new Date(Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000);

    // Si ya había una pendiente al mismo recurso se reutiliza: token
    // nuevo y reloj nuevo. Acumular invitaciones al mismo correo solo
    // multiplica enlaces vivos.
    const pendiente = await this.prisma.invitacionCliente.findFirst({
      where: { ...clave, email, estado: 'PENDIENTE' },
      select: { id: true },
    });

    if (pendiente) {
      await this.prisma.invitacionCliente.update({
        where: { id: pendiente.id },
        data: { tokenHash, expiraEn, invitadoPorId: quienComparte.id },
      });
    } else {
      await this.prisma.invitacionCliente.create({
        data: {
          ...clave,
          email,
          tokenHash,
          expiraEn,
          invitadoPorId: quienComparte.id,
        },
      });
    }

    const enlace = this.correo.enlaceDeInvitacion(token);
    this.correo.enviarCorreoInvitacion({
      para: email,
      recurso,
      invitadoPor: quienComparte.nombre,
      enlace,
      expiraEn,
    });

    return { via: 'invitacion', email, expiraEn, enlace };
  }

  /** Deja de compartir con alguien que ya tenía acceso. */
  async quitarAcceso(objetivo: Objetivo, usuarioId: number) {
    const acceso = await this.prisma.accesoCompartido.findFirst({
      where: { ...this.clave(objetivo), usuarioId },
      select: { id: true },
    });
    if (!acceso)
      throw new NotFoundException('Esa persona no tiene acceso a esto.');

    await this.prisma.accesoCompartido.delete({ where: { id: acceso.id } });
    return { ok: true };
  }

  /** Reenvía una invitación pendiente: token nuevo, el anterior deja de valer. */
  async reenviar(quienComparte: UsuarioAutenticado, invitacionId: number) {
    const inv = await this.prisma.invitacionCliente.findUnique({
      where: { id: invitacionId },
      select: {
        id: true,
        email: true,
        estado: true,
        sedeId: true,
        albumId: true,
      },
    });
    if (!inv) throw new NotFoundException('Esa invitación no existe.');
    if (inv.estado !== 'PENDIENTE')
      throw new BadRequestException(
        'Esa invitación ya no está pendiente: no se puede reenviar.',
      );

    const objetivo: Objetivo =
      inv.sedeId !== null
        ? { tipo: 'sede', id: inv.sedeId }
        : { tipo: 'album', id: inv.albumId as number };

    return this.invitar(
      quienComparte,
      objetivo,
      inv.email,
      await this.describirObjetivo(objetivo),
    );
  }

  /** Cancelar mata el enlace sin borrar el rastro de que se invitó. */
  async cancelar(invitacionId: number) {
    const inv = await this.prisma.invitacionCliente.findUnique({
      where: { id: invitacionId },
      select: { id: true, estado: true },
    });
    if (!inv) throw new NotFoundException('Esa invitación no existe.');
    if (inv.estado !== 'PENDIENTE')
      throw new BadRequestException('Esa invitación ya no está pendiente.');

    await this.prisma.invitacionCliente.update({
      where: { id: invitacionId },
      data: { estado: 'CANCELADA' },
    });
    return { ok: true };
  }
}
