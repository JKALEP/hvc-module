import { useState } from 'react';
import {
  ShieldCheckIcon,
  UserPlusIcon,
  Trash2Icon,
  PencilIcon,
  XIcon,
  SaveIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/shared/ui/table';
import {
  useUsuarios,
  useCrearUsuario,
  useEditarUsuario,
  useEliminarUsuario,
} from '@/modules/auth/hooks/useUsuarios';
import {
  SelectorModulos,
  type Seleccion,
} from '@/modules/auth/components/SelectorModulos';
import {
  MODULOS,
  ETIQUETA_NIVEL_FOTOS,
  ETIQUETA_ROL_COSTOS,
  SIN_NIVEL_FOTOS,
} from '@/shared/lib/modulos';
import { formatFecha } from '@/shared/lib/format';
import type {
  GuardarUsuarioPayload,
  NivelFotos,
  RolCostos,
  UsuarioAdmin,
} from '@/modules/auth/types';


const VACIO = { email: '', nombre: '', password: '' };

/**
 * La selección del formulario, en lo que espera el backend.
 *
 * Cada módulo manda SU sub-rol y deja el otro fuera: el backend rechaza
 * un permiso de Fotos que traiga rol de Costos, y al revés.
 */
function permisosDesde(seleccion: Seleccion) {
  return MODULOS.filter((m) => seleccion[m.id]).map((m) => ({
    modulo: m.id,
    // `true` significa "el módulo sí, sub-rol ninguno". En Fotos eso es un
    // valor legítimo —el supervisor de §4— y viaja como undefined para que
    // el backend lo guarde en null.
    nivelFotos:
      m.id === 'FOTOS' && seleccion.FOTOS !== true
        ? (seleccion.FOTOS as NivelFotos)
        : undefined,
    rolCostos: m.id === 'COSTOS' ? (seleccion.COSTOS as RolCostos) : undefined,
  }));
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
      s[p.modulo] =
        p.modulo === 'FOTOS'
          ? // Sin nivel global es el caso de §4, y se representa con `true`
            // igual que un módulo sin sub-rol.
            ((p.nivelFotos as NivelFotos | null) ?? true)
          : p.modulo === 'COSTOS'
            ? (p.rolCostos as RolCostos)
            : true;
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
                                : p.rolCostos
                                  ? ` · ${ETIQUETA_ROL_COSTOS[p.rolCostos]}`
                                  : // Fotos sin nivel no es "sin configurar":
                                    // es el supervisor de §4, y se dice.
                                    p.modulo === 'FOTOS'
                                    ? ` · ${SIN_NIVEL_FOTOS}`
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
                          title="Editar cuenta"
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
                              title="Eliminar cuenta"
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
