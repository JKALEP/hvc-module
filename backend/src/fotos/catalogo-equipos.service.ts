import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { OrganizacionService } from '../equipos/organizacion.service';
import { EquipoBusquedaService } from '../equipos/equipo-busqueda.service';
import { EstructuraService } from '../equipos/estructura.service';
import { EquipoService } from '../equipos/equipo.service';
import type { GuardarEquipoDto } from '../equipos/equipo.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * La puerta de Fotos al catálogo de Gestión de Equipos (§12).
 *
 * ── La relación va en UN SOLO SENTIDO ───────────────────────────────
 * El equipo del que se fotografía una inspección es el MISMO que ya está
 * registrado en el otro módulo, así que Fotos lo REFERENCIA por FK y nunca
 * copia sus datos. Este service es de lectura salvo por el atajo de abajo.
 *
 * ── Y por eso vive en `fotos/`, no en `equipos/` ────────────────────
 * La dependencia apunta Fotos → Equipos, que es el sentido correcto:
 * Equipos no sabe que Fotos existe. Poner el controller dentro de
 * `equipos/` habría obligado a que ese módulo importara `AccesoService`
 * para preguntar por niveles de Fotos, que es la flecha al revés.
 *
 * Lo único que cambia en Gestión de Equipos es su `exports`. Cero rutas
 * nuevas suyas, cero cambios en sus controllers y cero en su lógica: aquí
 * se llama a sus services tal cual.
 *
 * ── Por qué no hace falta búsqueda nueva ────────────────────────────
 * `Equipo` no tiene columnas de marca ni modelo: salvo `codigoInterno`,
 * todo es EAV en `ValorCampoEquipo`. `EquipoBusquedaService.listar({ q })`
 * ya mira el código Y todos los valores de texto, así que «buscar por
 * marca» sale gratis — lo que faltaba no era una consulta, era una puerta
 * autorizada.
 */
@Injectable()
export class CatalogoEquiposService {
  constructor(
    private readonly organizaciones: OrganizacionService,
    private readonly busqueda: EquipoBusquedaService,
    private readonly estructura: EstructuraService,
    private readonly equipos: EquipoService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Las organizaciones activas, para el primer paso del selector.
   *
   * Se devuelve lo mínimo —id y nombre— y no la fila entera: el selector
   * solo necesita elegir, y `OrganizacionService.listar` trae además
   * contadores y campos que aquí no pinta nadie.
   */
  async listarOrganizaciones() {
    const filas = await this.organizaciones.listar(false);
    return filas.map((o) => ({ id: o.id, nombre: o.nombre }));
  }

  /**
   * Las ubicaciones de una organización, en plano.
   *
   * Hace falta para el atajo de registro: `EquipoService.crear` exige un
   * `nodoId`, así que sin poder ofrecer la lista el atajo era inservible — y
   * el árbol de ubicaciones solo se lee con `@SoloSuperAdmin`.
   *
   * Se devuelve PLANO y con la profundidad, no el árbol anidado: el selector
   * lo pinta en un `<select>` con sangría, y aplanar en el cliente un árbol
   * que solo se va a recorrer una vez es trabajo de más.
   */
  async listarUbicaciones(organizacionId: number) {
    const arbol = await this.estructura.arbol(organizacionId);
    const plano: { id: number; nombre: string; nivel: number }[] = [];

    const recorrer = (
      nodos: { id: number; nombre: string; hijos?: unknown[] }[],
      nivel: number,
    ) => {
      for (const n of nodos) {
        plano.push({ id: n.id, nombre: n.nombre, nivel });
        recorrer(
          (n.hijos ?? []) as {
            id: number;
            nombre: string;
            hijos?: unknown[];
          }[],
          nivel + 1,
        );
      }
    };
    recorrer(arbol, 0);

    return plano;
  }

  /** Busca equipos dentro de una organización, por código o por EAV. */
  buscarEquipos(opciones: {
    organizacionId: number;
    q?: string | null;
    pagina?: number;
  }) {
    return this.busqueda.listar({
      organizacionId: opciones.organizacionId,
      q: opciones.q,
      pagina: opciones.pagina,
    });
  }

  /**
   * El atajo de §12: crear un equipo SIN salir de Fotos.
   *
   * Existe para que el supervisor no tenga que irse al otro módulo, buscar
   * dónde se registra un equipo y volver. Lo importante es lo que NO hace:
   * no duplica el modelo ni escribe en las tablas de Equipos a mano —llama
   * a `EquipoService.crear`, el mismo que usa el propio módulo—.
   *
   * **Dos puertas al mismo service, cada una con su regla de quién pasa.**
   * `POST /equipos/equipo` sigue intacto bajo `@SoloSuperAdmin`. Esta pide
   * el módulo FOTOS con nivel EDITOR_GLOBAL o superior. Y es SOLO crear:
   * editar y eliminar equipos siguen siendo exclusivos del SuperAdmin, sin
   * puerta nueva.
   *
   * Queda constancia en la bitácora de Fotos: que un equipo naciera desde
   * este atajo es información del flujo de Fotos, y Gestión de Equipos no
   * tiene por qué registrarla —su historial anota que se creó, no desde
   * dónde—.
   */
  async crearEquipo(usuario: UsuarioAutenticado, dto: GuardarEquipoDto) {
    if (!this.acceso.tieneNivelMinimo(usuario, 'EDITOR_GLOBAL'))
      throw new ForbiddenException(
        'Para registrar equipos desde Fotos hace falta nivel de Editor global o superior. ' +
          'Pide a un administrador que lo registre en Gestión de equipos.',
      );

    const equipo = await this.equipos.crear(usuario, dto);

    // `EquipoService.crear` cierra con un `findUnique`, y eso lo tipa
    // nullable aunque acabe de insertar la fila. Sin este corte, el evento
    // de auditoría se escribiría con un id inventado.
    if (!equipo)
      throw new InternalServerErrorException(
        'El equipo se creó pero no se pudo leer de vuelta. Búscalo en Gestión de equipos antes de reintentar.',
      );

    await this.auditoria.registrar(usuario, {
      entidad: 'EQUIPO',
      entidadId: equipo.id,
      accion: 'EQUIPO_CREADO_DESDE_FOTOS',
      descripcion: `Equipo registrado desde el selector de Fotos${
        dto.codigoInterno ? ` (código ${String(dto.codigoInterno)})` : ''
      }.`,
    });

    return equipo;
  }
}
