import { useState } from 'react';
import {
  ShieldCheckIcon,
  UserPlusIcon,
  Trash2Icon,
  PencilIcon,
  XIcon,
  SaveIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  useUsuarios,
  useCrearUsuario,
  useEditarUsuario,
  useEliminarUsuario,
} from '@/hooks/useUsuarios';
import { MODULOS, ETIQUETA_NIVEL_FOTOS } from '@/lib/modulos';
import { formatFecha } from '@/lib/format';
import type {
  Modulo,
  NivelFotos,
  UsuarioAdmin,
  GuardarUsuarioPayload,
} from '@/types/models';

/** Selección de módulos del formulario. null = no asignado. */
type Seleccion = Partial<Record<Modulo, NivelFotos | true>>;

const VACIO = { email: '', nombre: '', password: '' };

function permisosDesde(seleccion: Seleccion) {
  return MODULOS.filter((m) => seleccion[m.id]).map((m) => ({
    modulo: m.id,
    nivelFotos:
      m.id === 'FOTOS' ? (seleccion.FOTOS as NivelFotos) : undefined,
  }));
}

/** Casillas de módulo, con el selector de nivel solo para Fotos. */
function SelectorModulos({
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
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[190px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => {
                    const s = { ...seleccion };
                    if (e.target.checked) {
                      // Fotos siempre nace con un nivel: sin él el backend
                      // lo rechaza, y un default explícito evita el error.
                      s[m.id] = m.id === 'FOTOS' ? 'COLABORADOR' : true;
                    } else {
                      delete s[m.id];
                    }
                    onChange(s);
                  }}
                  className="size-4 rounded border-input"
                />
                {m.etiqueta}
              </label>

              {m.id === 'FOTOS' && activo && (
                <div className="w-56">
                  <Select
                    className="h-8"
                    value={String(seleccion.FOTOS ?? 'COLABORADOR')}
                    onChange={(e) =>
                      onChange({
                        ...seleccion,
                        FOTOS: e.target.value as NivelFotos,
                      })
                    }
                  >
                    {Object.entries(ETIQUETA_NIVEL_FOTOS).map(([v, l]) => (
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
        Costos y Personal y proyectos dan acceso completo al módulo. Solo Fotos
        tiene niveles.
      </p>
    </div>
  );
}

export function Usuarios() {
  const { data: usuarios, isLoading } = useUsuarios();
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();
  const eliminar = useEliminarUsuario();

  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(VACIO);
  const [seleccion, setSeleccion] = useState<Seleccion>({});

  const guardando = crear.isPending || editar.isPending;

  const limpiar = () => {
    setForm(VACIO);
    setSeleccion({});
    setEditandoId(null);
    setAbierto(false);
  };

  const abrirEdicion = (u: UsuarioAdmin) => {
    const s: Seleccion = {};
    for (const p of u.permisos)
      s[p.modulo] = p.modulo === 'FOTOS' ? (p.nivelFotos as NivelFotos) : true;
    setSeleccion(s);
    setForm({ email: u.email, nombre: u.nombre, password: '' });
    setEditandoId(u.id);
    setAbierto(true);
  };

  const guardar = () => {
    const permisos = permisosDesde(seleccion);
    if (editandoId !== null) {
      const payload: GuardarUsuarioPayload = {
        nombre: form.nombre,
        permisos,
        // Solo se manda si se escribió una nueva.
        ...(form.password ? { password: form.password } : {}),
      };
      editar.mutate({ id: editandoId, payload }, { onSuccess: limpiar });
    } else {
      crear.mutate(
        { ...form, permisos } as GuardarUsuarioPayload,
        { onSuccess: limpiar },
      );
    }
  };

  const faltaAlgo =
    form.nombre.trim() === '' ||
    permisosDesde(seleccion).length === 0 ||
    (editandoId === null &&
      (form.email.trim() === '' || form.password.length < 8));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y permisos"
        description="Cuentas del sistema y a qué módulos accede cada una."
        actions={
          !abierto && (
            <Button onClick={() => setAbierto(true)}>
              <UserPlusIcon />
              Nueva cuenta
            </Button>
          )
        }
      />

      {abierto && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                {editandoId === null
                  ? 'Nueva cuenta'
                  : `Editando cuenta #${editandoId}`}
              </h2>
              <Button variant="ghost" size="sm" onClick={limpiar}>
                <XIcon />
                Cancelar
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Correo <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="h-9"
                  // El correo identifica la cuenta: cambiarlo sería crear otra.
                  disabled={editandoId !== null}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Nombre <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Contraseña{' '}
                  {editandoId === null && (
                    <span className="text-destructive">*</span>
                  )}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder={
                    editandoId === null
                      ? 'Mínimo 8 caracteres'
                      : 'Dejar vacío para no cambiarla'
                  }
                  className="h-9"
                />
              </div>
            </div>

            <SelectorModulos seleccion={seleccion} onChange={setSeleccion} />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button onClick={guardar} disabled={faltaAlgo || guardando}>
                {guardando ? <Spinner /> : <SaveIcon />}
                {editandoId === null ? 'Crear cuenta' : 'Guardar cambios'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <TableSkeleton rows={4} cols={6} />}

      {!isLoading && (usuarios ?? []).length === 0 && (
        <EmptyState
          icon={ShieldCheckIcon}
          title="No hay cuentas todavía"
          description="Crea la primera con el botón de arriba."
        />
      )}

      {!isLoading && (usuarios ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuarios ?? []).map((u) => {
                const esSuper = u.rol === 'SUPERADMIN';
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={esSuper ? 'default' : 'secondary'}>
                        {esSuper ? 'SuperAdmin' : 'Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {esSuper ? (
                        <span className="text-sm text-muted-foreground">
                          Todos (por rol)
                        </span>
                      ) : u.permisos.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.permisos.map((p) => (
                            <Badge key={p.modulo} variant="outline">
                              {MODULOS.find((m) => m.id === p.modulo)?.etiqueta ??
                                p.modulo}
                              {p.nivelFotos
                                ? ` · ${ETIQUETA_NIVEL_FOTOS[p.nivelFotos]}`
                                : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.estado === 'ACTIVO' ? 'success' : 'warning'}
                      >
                        {u.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.ultimoAcceso ? formatFecha(u.ultimoAcceso) : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar cuenta"
                          onClick={() => abrirEdicion(u)}
                        >
                          <PencilIcon />
                        </Button>
                        {!esSuper && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editar.mutate({
                                  id: u.id,
                                  payload: {
                                    estado:
                                      u.estado === 'ACTIVO'
                                        ? 'INACTIVO'
                                        : 'ACTIVO',
                                  },
                                })
                              }
                            >
                              {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Eliminar cuenta"
                              disabled={eliminar.isPending}
                              onClick={() => eliminar.mutate(u.id)}
                            >
                              <Trash2Icon />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
