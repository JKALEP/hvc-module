import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';

/**
 * Activación de una invitación: rutas PÚBLICAS, sin sesión.
 *
 * Son los únicos endpoints del sistema que escriben sin autenticar, así
 * que el token es lo único que separa a cualquiera de una cuenta nueva:
 * es de un solo uso, caduca, y se compara por hash porque en la BD nunca
 * se guardó en claro.
 */

const RONDAS_BCRYPT = 10;
const LARGO_MINIMO_PASSWORD = 8;

@Injectable()
export class InvitacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async buscar(token: string) {
    if (typeof token !== 'string' || token.length < 20)
      throw new NotFoundException('Esa invitación no es válida.');

    const inv = await this.prisma.invitacionCliente.findUnique({
      where: { tokenHash: this.hash(token) },
      select: {
        id: true,
        email: true,
        estado: true,
        expiraEn: true,
        carpetas: {
          select: { carpetaId: true, carpeta: { select: { nombre: true } } },
        },
        invitadoPor: { select: { nombre: true } },
      },
    });

    // El mismo mensaje para "no existe" y para "ya se usó": distinguirlos
    // convertiría este endpoint en un oráculo de tokens válidos.
    if (!inv || inv.estado !== 'PENDIENTE')
      throw new NotFoundException(
        'Esta invitación ya no es válida. Puede que ya la hayas usado o que la hayan cancelado. Pídele una nueva a quien te la envió.',
      );

    return inv;
  }

  /** Lo que ve la pantalla de activación antes de pedir la contraseña. */
  async validar(token: string) {
    const inv = await this.buscar(token);

    if (inv.expiraEn < new Date())
      throw new BadRequestException(
        'Esta invitación caducó. Pídele una nueva a quien te la envió.',
      );

    return {
      email: inv.email,
      // Puede cubrir varias carpetas con un solo enlace.
      recurso: inv.carpetas.map((c) => c.carpeta.nombre).join(', '),
      invitadoPor: inv.invitadoPor.nombre,
      expiraEn: inv.expiraEn,
    };
  }

  /**
   * Crea la cuenta de cliente y le da el acceso, en una transacción.
   *
   * Si algo falla a mitad no puede quedar ni una cuenta sin acceso ni un
   * acceso sin cuenta.
   */
  async activar(
    token: string,
    nombreCrudo: unknown,
    passwordCrudo: unknown,
    /** §23: aceptar una invitación es de las sensibles. */
    ip?: string | null,
  ) {
    const inv = await this.buscar(token);
    if (inv.expiraEn < new Date())
      throw new BadRequestException(
        'Esta invitación caducó. Pídele una nueva a quien te la envió.',
      );

    const nombre =
      typeof nombreCrudo === 'string' && nombreCrudo.trim() !== ''
        ? nombreCrudo.trim()
        : inv.email;
    const password = typeof passwordCrudo === 'string' ? passwordCrudo : '';
    if (password.length < LARGO_MINIMO_PASSWORD)
      throw new BadRequestException(
        `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`,
      );

    // Entre que se mandó la invitación y ahora, alguien pudo crear esa
    // cuenta por otra vía.
    const yaExiste = await this.prisma.usuario.findUnique({
      where: { email: inv.email },
      select: { id: true },
    });
    if (yaExiste)
      throw new BadRequestException(
        'Ya existe una cuenta con ese correo. Entra con tu contraseña; si no la recuerdas, pídesela al administrador.',
      );

    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);

    const completa = await this.prisma.invitacionCliente.findUnique({
      where: { id: inv.id },
      select: {
        invitadoPorId: true,
        carpetas: { select: { carpetaId: true, permiso: true } },
      },
    });
    if (!completa) throw new NotFoundException('Esa invitación no existe.');
    if (completa.carpetas.length === 0)
      throw new BadRequestException(
        'Esta invitación se quedó sin carpetas. Pídele una nueva a quien te la envió.',
      );

    const creado = await this.prisma.$transaction(async (tx) => {
      const cliente = await tx.usuario.create({
        data: {
          email: inv.email,
          nombre,
          passwordHash,
          // Un CLIENTE no lleva filas en PermisoModulo: no entra a
          // ningún módulo, solo a lo que le compartieron.
          rol: 'CLIENTE',
          estado: 'ACTIVO',
        },
        select: { id: true, email: true, nombre: true },
      });

      // Una invitación puede cubrir varias carpetas: todas de una vez.
      //
      // El permiso NO se decide aquí: viaja en la invitación desde que se
      // envió (§9 lo pide en el formulario de compartir), así que aceptar
      // solo lo copia. Elegirlo en este punto convertiría el enlace en
      // algo que concede un acceso distinto del que se prometió.
      await tx.accesoCompartido.createMany({
        data: completa.carpetas.map((c) => ({
          carpetaId: c.carpetaId,
          usuarioId: cliente.id,
          otorgadoPorId: completa.invitadoPorId,
          permiso: c.permiso,
        })),
      });

      await tx.invitacionCliente.update({
        where: { id: inv.id },
        data: {
          estado: 'ACEPTADA',
          aceptadaEn: new Date(),
          clienteId: cliente.id,
        },
      });

      return cliente;
    });

    // §23, acciones 11 y 12 — son DOS hechos, no uno: «nació una cuenta» y
    // «se aceptó esta invitación» se consultan por caminos distintos (por
    // usuario y por invitación), y con un solo evento uno de los dos no
    // encontraría nada.
    //
    // El autor es el propio cliente recién creado: nadie de HVC estaba
    // delante cuando ocurrió, y atribuírselo a quien invitó diría que hizo
    // algo que no hizo.
    const autor = { id: creado.id, nombre: creado.nombre } as Parameters<
      AuditoriaFotosService['registrar']
    >[0];
    await this.auditoria.registrar(autor, [
      {
        carpetaId: null,
        entidad: 'CARPETA',
        entidadId: creado.id,
        accion: 'CREACION',
        descripcion: `Se creó la cuenta de cliente ${creado.email}.`,
        ip,
      },
      {
        carpetaId: null,
        entidad: 'INVITACION',
        entidadId: inv.id,
        accion: 'INVITACION_ACEPTADA',
        descripcion: `${creado.email} aceptó su invitación.`,
        ip,
      },
    ]);

    return creado;
  }
}
