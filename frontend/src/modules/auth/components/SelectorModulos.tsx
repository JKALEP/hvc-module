import { Select } from '@/shared/ui/select';
import {
  MODULOS,
  ETIQUETA_NIVEL_FOTOS,
  ETIQUETA_ROL_COSTOS,
  SIN_NIVEL_FOTOS,
} from '@/shared/lib/modulos';
import type { Modulo, NivelFotos, RolCostos } from '@/modules/auth/types';

/** Selección de módulos del formulario. Ausente = no asignado. */
export type Seleccion = Partial<Record<Modulo, NivelFotos | RolCostos | true>>;

/**
 * Qué sub-rol lleva cada módulo, y con qué valor nace al marcarlo.
 *
 * Tabla y no dos ramas de `if` porque son dos módulos hoy y la forma es
 * idéntica: un selector con sus etiquetas y un valor por defecto. El
 * defecto NO es cosmético — el backend rechaza un permiso de Fotos sin
 * nivel o uno de Costos sin rol, así que marcar la casilla tiene que
 * dejar algo válido puesto.
 *
 * `PERSONAL_PROYECTOS` no aparece: da acceso completo al módulo o
 * ninguno, y no tiene nada que elegir.
 */
const SUBROLES: Partial<
  Record<
    Modulo,
    {
      etiquetas: Record<string, string>;
      porDefecto: string | true;
      /**
       * Etiqueta de "ninguno", cuando el módulo admite no llevar sub-rol.
       * Elegirla guarda `true` —módulo sí, sub-rol no— igual que en
       * PERSONAL_PROYECTOS, y el backend recibe el sub-rol en null.
       */
      opcionVacia?: string;
    }
  >
> = {
  FOTOS: {
    etiquetas: ETIQUETA_NIVEL_FOTOS,
    // Sin nivel global: el supervisor de §4, que es el caso corriente. Los
    // tres niveles que existen dan alcance sobre TODO el árbol, así que
    // ninguno sirve de defecto sin regalar más de lo que se pide.
    porDefecto: true,
    opcionVacia: SIN_NIVEL_FOTOS,
  },
  COSTOS: {
    etiquetas: ETIQUETA_ROL_COSTOS,
    // El de menos alcance: no recomienda ni aprueba.
    porDefecto: 'SOLICITANTE',
  },
};

/** Casillas de módulo, con el selector de sub-rol en los que lo tienen. */
export function SelectorModulos({
  seleccion,
  onChange,
}: {
  seleccion: Seleccion;
  onChange: (s: Seleccion) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Módulos <span className="text-destructive">*</span>
      </p>
      <div className="space-y-2">
        {MODULOS.map((m) => {
          const activo = Boolean(seleccion[m.id]);
          const subrol = SUBROLES[m.id];
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[190px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => {
                    const s = { ...seleccion };
                    if (e.target.checked) {
                      s[m.id] = (subrol?.porDefecto ?? true) as
                        | NivelFotos
                        | RolCostos
                        | true;
                    } else {
                      delete s[m.id];
                    }
                    onChange(s);
                  }}
                  className="size-4 rounded border-input"
                />
                {m.etiqueta}
              </label>

              {subrol && activo && (
                <div className="w-72">
                  <Select
                    className="h-8"
                    // `true` es "módulo sí, sub-rol no": se pinta como la
                    // opción vacía, no como un valor del enum.
                    value={
                      seleccion[m.id] === true ? '' : String(seleccion[m.id])
                    }
                    onChange={(e) =>
                      onChange({
                        ...seleccion,
                        [m.id]:
                          e.target.value === ''
                            ? true
                            : (e.target.value as NivelFotos | RolCostos),
                      })
                    }
                  >
                    {subrol.opcionVacia !== undefined && (
                      <option value="">{subrol.opcionVacia}</option>
                    )}
                    {Object.entries(subrol.etiquetas).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Costos y Fotos exigen elegir el papel dentro del módulo. Personal y
        proyectos da acceso completo.
      </p>
    </div>
  );
}
