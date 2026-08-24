# DESIGN SYSTEM REFERENCE

> **Documento de referencia visual portable.**
> Extraído del frontend de *Vías* (`front-via`). Está pensado para ser leído por un agente
> (Claude) que va a construir **una interfaz completamente nueva en OTRO proyecto**,
> reutilizando este mismo lenguaje visual, nivel de calidad, consistencia y UX.

---

## CÓMO USAR ESTE DOCUMENTO

Este documento tiene **dos partes que nunca deben mezclarse**:

| Parte | Qué contiene | Qué hacer con ella |
|---|---|---|
| **PARTE A — Sistema visual reutilizable** | Tokens, tipografía, espaciado, componentes, patrones, estados, responsive | **COPIAR / REPRODUCIR** en el proyecto destino |
| **PARTE B — Contenido específico de Vías** | Módulos, rutas, entidades, textos, enums de negocio, datos ferroviarios | **NO COPIAR NUNCA**. Sirve solo para reconocer qué hay que sustituir |

Regla mental permanente mientras se lee:

> Si algo describe **cómo se ve o cómo se comporta** → Parte A, se reutiliza.
> Si algo describe **de qué trata la aplicación** → Parte B, se descarta.

**Orden de lectura recomendado para reconstruir:**

1. §1 Filosofía → §2 Colores → §3 Tipografía → §4 Espaciado → §5 Radios y sombras
   *(la base: sin esto, nada más encaja)*
2. §6 Arquitectura → §7 Sidebar → §8 Header → §9 PageHeader
   *(el esqueleto de la app)*
3. §10–§23 Componentes
4. §24 Inventario → §25 Patrones de página
   *(cómo se ensambla todo)*
5. §28 Inconsistencias → §29 Principios → §30 Reglas de adaptación

---

## TABLA DE CONTENIDOS

**PARTE A — SISTEMA VISUAL REUTILIZABLE**

1. [Stack y filosofía visual](#1-stack-y-filosofía-visual)
2. [Sistema de colores](#2-sistema-de-colores)
3. [Tipografía](#3-tipografía)
4. [Espaciado y dimensiones](#4-espaciado-y-dimensiones)
5. [Border radius y sombras](#5-border-radius-y-sombras)
6. [Arquitectura visual general](#6-arquitectura-visual-general)
7. [Sidebar](#7-sidebar)
8. [Header / Navbar](#8-header--navbar)
9. [PageHeader](#9-pageheader)
10. [Botones](#10-botones)
11. [Inputs y formularios](#11-inputs-y-formularios)
12. [Cards](#12-cards)
13. [Tablas](#13-tablas)
14. [Modales y Sheets](#14-modales-y-sheets)
15. [Dropdowns, popovers y menús](#15-dropdowns-popovers-y-menús)
16. [Badges y estados semánticos](#16-badges-y-estados-semánticos)
17. [Alertas y notificaciones](#17-alertas-y-notificaciones)
18. [Iconografía](#18-iconografía)
19. [Estados de interacción](#19-estados-de-interacción)
20. [Loading / Empty / Error states](#20-loading--empty--error-states)
21. [Responsive design](#21-responsive-design)
22. [Transiciones y animaciones](#22-transiciones-y-animaciones)
23. [Gráficos y visualización de datos](#23-gráficos-y-visualización-de-datos)
24. [Inventario de componentes reutilizables](#24-inventario-de-componentes-reutilizables)
25. [Patrones de página](#25-patrones-de-página)
26. [Formato de datos y microcopy](#26-formato-de-datos-y-microcopy)
27. [Accesibilidad](#27-accesibilidad)

**PARTE B — CONTENIDO ESPECÍFICO DE VÍAS**

- [Parte B — NO copiar](#parte-b--contenido-específico-de-vías-no-copiar)

**CIERRE**

28. [Inconsistencias conocidas](#28-inconsistencias-conocidas-y-cómo-corregirlas-en-destino)
29. [Principios de diseño](#29-principios-de-diseño)
30. [Reglas para adaptar este Design System a otro proyecto](#30-reglas-para-adaptar-este-design-system-a-otro-proyecto)
31. [Checklist de verificación](#31-checklist-de-verificación)

---
---

# PARTE A — SISTEMA VISUAL REUTILIZABLE

---

## 1. STACK Y FILOSOFÍA VISUAL

### 1.1 Stack técnico de origen

| Capa | Tecnología | Nota para el proyecto destino |
|---|---|---|
| Framework | React 19 + Vite + TypeScript | Sustituible. El sistema visual no depende de React. |
| CSS | **Tailwind CSS 3.4** con `darkMode: 'class'` | Recomendado conservar. Todo el sistema son tokens CSS + utilidades. |
| Componentes | **shadcn/ui** (estilo `radix-nova`, baseColor `neutral`, `cssVariables: true`) sobre `radix-ui` | Recomendado conservar: aporta accesibilidad gratis. |
| Iconos | **`lucide-react`** | Conservar. Todo el lenguaje de iconos asume lucide. |
| Fuente | **Geist Variable** (`@fontsource-variable/geist`) + Geist Mono | Conservar, o sustituir por una grotesca neutral equivalente (Inter, Söhne). |
| Tablas | TanStack Table v8 | Sustituible. |
| Datos / estado | TanStack Query v5 + Zustand | Sustituible. |
| Formularios | react-hook-form + zod (`@hookform/resolvers`) | Sustituible. |
| Toasts | **`sonner`** | Conservar el patrón (ver §17). |
| Gráficos | ApexCharts (principal) + Recharts (disponible) | Sustituible; conservar la paleta `--chart-*`. |
| Utilidad de clases | `clsx` + `tailwind-merge` expuestos como `cn()` | **Conservar**: todos los componentes usan `cn()` para permitir override de clases. |

`cn()` es la única utilidad imprescindible:

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 1.2 Filosofía visual — las 6 decisiones que definen el look

Si el proyecto destino respeta estas seis decisiones, su interfaz se verá "de la misma
familia" aunque el contenido sea completamente distinto.

1. **Neutrales cálidos, no grises planos.**
   El fondo de la app **no es blanco ni gris azulado**: es un *off-white* cálido
   (`hsl(30 12% 97%)`), sensación de papel industrial. Las superficies elevadas
   (cards) **sí** son blanco puro. El contraste card-sobre-fondo es lo que da
   profundidad, no las sombras.

2. **El acento se usa con avaricia.**
   El color de marca (teal industrial) **no** pinta botones primarios, ni headers, ni
   fondos grandes. Se reserva para: foco, indicador del item activo del sidebar,
   contadores de filtros activos, pasos de wizard y links. El botón primario es
   **grafito casi negro**, no el color de marca.

3. **Superficie canónica única.**
   Toda superficie elevada es exactamente
   `rounded-xl border border-border bg-card shadow-sm`. Existe como utilidad
   `.surface`. No hay una segunda forma de dibujar un panel.

4. **Estados semánticos siempre en variante *soft*.**
   Los estados (éxito / aviso / error / info) se muestran como *pills* de fondo tenue
   con texto oscuro del mismo matiz (`bg-success-soft` + `text-success-soft-foreground`),
   nunca como bloques saturados. La variante sólida existe pero es excepcional.

5. **Densidad de aplicación técnica, no de landing page.**
   Controles bajos (botón e input de `32px` de alto), tipografía base de `13–14px`,
   `gap-4` / `gap-6` entre bloques. La pantalla está pensada para mostrar mucha
   información sin sensación de apretujamiento.

6. **Números tabulares en todas partes.**
   Cualquier cifra en tabla, KPI o paginación usa `tabular-nums`. Los códigos e
   identificadores usan la fuente mono. Esta es la firma de "instrumento técnico".

### 1.3 Regla de oro de implementación

> **Nunca escribas un color literal ni un color crudo de la paleta Tailwind.**
> Usa siempre el token semántico (`bg-card`, `text-muted-foreground`, `border-border`,
> `bg-success-soft`). Si necesitas un color que no existe como token, el token falta:
> añádelo al sistema en vez de escribir `bg-red-50`.

---

## 2. SISTEMA DE COLORES

### 2.1 Cómo está construido

Los colores se definen como **variables CSS con canales HSL sin la función `hsl()`**
(formato `H S% L%`) en `:root`. Tailwind las consume con `hsl(var(--token))`, lo que
habilita modificadores de opacidad (`bg-brand/15`, `text-foreground/70`).

```css
/* index.css */
:root { --background: 30 12% 97%; }
```

```js
// tailwind.config.js
colors: { background: 'hsl(var(--background))' }
```

Cada familia semántica tiene hasta 4 variantes:

| Sufijo | Uso |
|---|---|
| *(base)* | Color sólido, fondo fuerte |
| `-foreground` | Texto que va **encima** del color sólido |
| `-soft` | Fondo tenue de la misma familia (badges, chips, iconos) |
| `-soft-foreground` | Texto que va encima del fondo tenue |

### 2.2 Tokens — MODO CLARO (valores exactos)

#### Superficies base

| Token | Valor HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--background` | `30 12% 97%` | `#F8F7F5` | Fondo de toda la app y del área de trabajo |
| `--foreground` | `220 16% 13%` | `#1C1F26` | Texto principal, títulos |
| `--card` | `0 0% 100%` | `#FFFFFF` | Superficies elevadas: cards, paneles, tablas |
| `--card-foreground` | `220 16% 13%` | `#1C1F26` | Texto dentro de cards |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Dropdowns, popovers, dialogs, command |
| `--popover-foreground` | `220 16% 13%` | `#1C1F26` | Texto en popovers |

#### Colores interactivos

| Token | Valor HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--primary` | `220 16% 13%` | `#1C1F26` | **Botón primario (grafito, no la marca)**, tab activo |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre primario |
| `--secondary` | `220 14% 96%` | `#F3F4F6` | Botón secundario, chips neutros |
| `--secondary-foreground` | `220 16% 18%` | `#272B33` | Texto sobre secundario |
| `--muted` | `220 14% 96%` | `#F3F4F6` | Headers de tabla, fondos sutiles, skeletons |
| `--muted-foreground` | `220 9% 46%` | `#6B7280` | **Texto secundario**, labels, placeholders, iconos inactivos |
| `--accent` | `220 14% 94%` | `#EEEFF2` | Hover de items de menú (**no** es el color de marca) |
| `--accent-foreground` | `220 16% 18%` | `#272B33` | Texto sobre accent |

> **Nota crítica:** en este sistema `accent` significa *"fondo de hover de un item"*,
> **no** "color de acento de marca". El acento de marca es `brand`. Confundirlos rompe
> el look completo.

#### Marca (brand) — acento sobrio

| Token | Valor HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--brand` | `188 78% 30%` | `#118899` | Indicador activo, foco, links, pasos de wizard |
| `--brand-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre brand sólido |
| `--brand-soft` | `188 70% 95%` | `#E7F8FA` | Fondo de chips / contadores / iconos de marca |
| `--brand-soft-foreground` | `188 78% 22%` | `#0D6470` | Texto sobre brand-soft |

**Reglas de uso de `brand`:** úsalo en (a) barra vertical del item activo del sidebar,
(b) anillos de foco de controles custom, (c) contador de filtros activos, (d) círculos
del stepper, (e) links de texto. **Nunca** como fondo de botón primario, header,
sidebar completo ni bloques grandes.

#### Estados semánticos

| Familia | Base | `-soft` | `-soft-foreground` | Significado |
|---|---|---|---|---|
| **success** | `142 70% 32%` → `#188A45` | `142 50% 95%` → `#EDF9F1` | `142 70% 22%` → `#115F30` | Activo, operativo, completado, OK |
| **warning** | `32 90% 40%` → `#C26A0A` | `32 80% 95%` → `#FDF3E8` | `32 85% 28%` → `#84490B` | Pendiente, en revisión, requiere atención |
| **info** | `215 60% 38%` → `#27599B` | `215 70% 95%` → `#EBF2FC` | `215 75% 28%` → `#123E7D` | En proceso, programado, informativo |
| **destructive** | `0 72% 45%` → `#C52020` | `0 70% 96%` → `#FDECEC` | `0 72% 38%` → `#A61B1B` | Error, crítico, eliminación, inactivo grave |

Todas tienen además `-foreground: 0 0% 100%` (blanco) para la variante sólida.

#### Bordes, inputs y foco

| Token | Valor HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--border` | `220 13% 91%` | `#E4E6EA` | Borde por defecto de todo |
| `--border-strong` | `220 13% 82%` | `#CBCFD6` | Borde en hover de elementos interactivos; pulgar del scrollbar |
| `--input` | `220 13% 91%` | `#E4E6EA` | Borde de campos de formulario |
| `--ring` | `220 13% 60%` | `#8D939F` | Anillo de foco de los primitivos shadcn |

#### Sidebar (namespace propio, tema oscuro)

El sidebar tiene **su propio subsistema de color**, independiente del resto. Es oscuro
incluso cuando la app está en modo claro.

| Token | Valor HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--sidebar` | `222 75% 10%` | `#07122B` | Fondo del sidebar (navy industrial) |
| `--sidebar-foreground` | `220 15% 88%` | `#DCDEE3` | Texto base del sidebar |
| `--sidebar-primary` | `188 78% 50%` | `#1CD3E8` | **Acento del sidebar**: barra del item activo, etiqueta de rol |
| `--sidebar-primary-foreground` | `222 75% 10%` | `#07122B` | Texto sobre el acento |
| `--sidebar-accent` | `220 30% 14%` | `#19212E` | Fondo de item en hover / activo |
| `--sidebar-accent-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre item activo |
| `--sidebar-border` | `220 30% 18%` | `#202B3B` | Separadores internos del sidebar |
| `--sidebar-ring` | `188 78% 50%` | `#1CD3E8` | Foco dentro del sidebar |

> El acento del sidebar (`188 78% 50%`) es **el mismo matiz** que `--brand`
> (`188 78% 30%`) pero más luminoso, para que funcione sobre fondo oscuro. Si cambias
> el matiz de marca, cambia ambos a la vez.

#### Paleta de gráficos

| Token | Valor HSL | Hex aprox. | Carácter |
|---|---|---|---|
| `--chart-1` | `188 78% 35%` | `#149FB3` | Teal (serie principal) |
| `--chart-2` | `215 60% 45%` | `#2E6DB8` | Acero |
| `--chart-3` | `32 85% 45%` | `#D4820D` | Ámbar |
| `--chart-4` | `142 50% 38%` | `#31914F` | Musgo |
| `--chart-5` | `280 30% 45%` | `#7A5293` | Malva apagado |

Paleta industrial deliberadamente **desaturada**: ninguna serie grita más que otra.

#### Geometría

| Token | Valor |
|---|---|
| `--radius` | `0.625rem` (**10px**) |

### 2.3 Tokens — MODO OSCURO

El modo oscuro está **completamente definido** en `.dark` (Tailwind `darkMode: 'class'`),
pero en el proyecto de origen **nunca se activa** (no hay toggle de tema; `next-themes`
está instalado y lo usa solo el toaster). El proyecto destino puede activarlo sin
trabajo adicional de tokens.

| Token | Claro | Oscuro |
|---|---|---|
| `--background` | `30 12% 97%` | `220 18% 9%` |
| `--foreground` | `220 16% 13%` | `220 14% 92%` |
| `--card` | `0 0% 100%` | `220 18% 11%` |
| `--popover` | `0 0% 100%` | `220 18% 11%` |
| `--primary` | `220 16% 13%` | `220 14% 92%` *(se invierte)* |
| `--primary-foreground` | `0 0% 100%` | `220 18% 11%` |
| `--secondary` / `--muted` | `220 14% 96%` | `220 18% 16%` |
| `--muted-foreground` | `220 9% 46%` | `220 10% 60%` |
| `--accent` | `220 14% 94%` | `220 18% 18%` |
| `--brand` | `188 78% 30%` | `188 78% 55%` |
| `--brand-soft` | `188 70% 95%` | `188 78% 15%` |
| `--brand-soft-foreground` | `188 78% 22%` | `188 78% 75%` |
| `--success` | `142 70% 32%` | `142 60% 50%` |
| `--success-soft` | `142 50% 95%` | `142 50% 14%` |
| `--warning` | `32 90% 40%` | `32 90% 60%` |
| `--info` | `215 60% 38%` | `215 75% 60%` |
| `--destructive` | `0 72% 45%` | `0 72% 60%` |
| `--border` | `220 13% 91%` | `220 18% 18%` |
| `--border-strong` | `220 13% 82%` | `220 18% 24%` |
| `--ring` | `220 13% 60%` | `220 14% 60%` |
| `--chart-1..5` | ver arriba | `188 78% 55%`, `215 70% 60%`, `32 90% 60%`, `142 60% 50%`, `280 40% 60%` |

**Patrón del modo oscuro:** los colores *base* suben en luminosidad (para seguir siendo
legibles sobre oscuro), los `-soft` bajan drásticamente (fondos tenues oscuros) y los
`-soft-foreground` suben (texto claro sobre esos fondos). Los tokens del sidebar **no
cambian**: ya son oscuros.

### 2.4 Bloque de tokens listo para copiar

```css
@layer base {
  :root {
    /* superficies */
    --background: 30 12% 97%;
    --foreground: 220 16% 13%;
    --card: 0 0% 100%;
    --card-foreground: 220 16% 13%;
    --popover: 0 0% 100%;
    --popover-foreground: 220 16% 13%;

    /* interactivos */
    --primary: 220 16% 13%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 220 16% 18%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 220 14% 94%;
    --accent-foreground: 220 16% 18%;

    /* marca */
    --brand: 188 78% 30%;
    --brand-foreground: 0 0% 100%;
    --brand-soft: 188 70% 95%;
    --brand-soft-foreground: 188 78% 22%;

    /* estados */
    --success: 142 70% 32%;        --success-foreground: 0 0% 100%;
    --success-soft: 142 50% 95%;   --success-soft-foreground: 142 70% 22%;
    --warning: 32 90% 40%;         --warning-foreground: 0 0% 100%;
    --warning-soft: 32 80% 95%;    --warning-soft-foreground: 32 85% 28%;
    --info: 215 60% 38%;           --info-foreground: 0 0% 100%;
    --info-soft: 215 70% 95%;      --info-soft-foreground: 215 75% 28%;
    --destructive: 0 72% 45%;      --destructive-foreground: 0 0% 100%;
    --destructive-soft: 0 70% 96%; --destructive-soft-foreground: 0 72% 38%;

    /* bordes y foco */
    --border: 220 13% 91%;
    --border-strong: 220 13% 82%;
    --input: 220 13% 91%;
    --ring: 220 13% 60%;

    /* geometría */
    --radius: 0.625rem;

    /* sidebar */
    --sidebar: 222 75% 10%;
    --sidebar-foreground: 220 15% 88%;
    --sidebar-primary: 188 78% 50%;
    --sidebar-primary-foreground: 222 75% 10%;
    --sidebar-accent: 220 30% 14%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-border: 220 30% 18%;
    --sidebar-ring: 188 78% 50%;

    /* gráficos */
    --chart-1: 188 78% 35%;
    --chart-2: 215 60% 45%;
    --chart-3: 32 85% 45%;
    --chart-4: 142 50% 38%;
    --chart-5: 280 30% 45%;
  }
}
```

Mapeo en `tailwind.config.js` (patrón, abreviado):

```js
colors: {
  border: 'hsl(var(--border))',
  'border-strong': 'hsl(var(--border-strong))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary:   { DEFAULT: 'hsl(var(--primary))',   foreground: 'hsl(var(--primary-foreground))' },
  secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
  muted:     { DEFAULT: 'hsl(var(--muted))',     foreground: 'hsl(var(--muted-foreground))' },
  accent:    { DEFAULT: 'hsl(var(--accent))',    foreground: 'hsl(var(--accent-foreground))' },
  popover:   { DEFAULT: 'hsl(var(--popover))',   foreground: 'hsl(var(--popover-foreground))' },
  card:      { DEFAULT: 'hsl(var(--card))',      foreground: 'hsl(var(--card-foreground))' },
  brand: {
    DEFAULT: 'hsl(var(--brand))', foreground: 'hsl(var(--brand-foreground))',
    soft: 'hsl(var(--brand-soft))', 'soft-foreground': 'hsl(var(--brand-soft-foreground))',
  },
  // success / warning / info / destructive: mismo patrón de 4 claves
  sidebar: {
    DEFAULT: 'hsl(var(--sidebar))', foreground: 'hsl(var(--sidebar-foreground))',
    primary: 'hsl(var(--sidebar-primary))', 'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    accent: 'hsl(var(--sidebar-accent))', 'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    border: 'hsl(var(--sidebar-border))', ring: 'hsl(var(--sidebar-ring))',
  },
  chart: { 1:'hsl(var(--chart-1))', 2:'hsl(var(--chart-2))', 3:'hsl(var(--chart-3))', 4:'hsl(var(--chart-4))', 5:'hsl(var(--chart-5))' },
}
```

### 2.5 Cómo re-tematizar para otra marca

Para adaptar el sistema a otra identidad **sin romper el look**:

1. Cambia **solo el matiz** (`H`) de `--brand` y `--sidebar-primary`, manteniendo
   saturación y luminosidad (`78% 30%` y `78% 50%`). Recalcula `--brand-soft`
   (`H 70% 95%`) y `--brand-soft-foreground` (`H 78% 22%`).
2. Si la marca exige otro fondo, mantén la relación: fondo con `L ≈ 97%` y una pizca
   de calidez; cards en blanco puro. **No pongas el fondo en blanco puro**: se pierde
   la separación card/fondo, que es el mecanismo principal de profundidad.
3. **No toques** los tokens de estado (`success` / `warning` / `info` / `destructive`):
   son convenciones universales, no branding.
4. El botón primario debe seguir siendo el color de texto principal (grafito), no la
   marca — salvo decisión explícita de la nueva identidad.

---

## 3. TIPOGRAFÍA

### 3.1 Familias

```js
fontFamily: {
  sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
  mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
}
```

- **Geist Variable** — toda la interfaz. Grotesca moderna, técnica, alta legibilidad en
  tamaños pequeños.
- **Geist Mono** — códigos, identificadores, valores técnicos.

Ajustes finos aplicados en la capa base:

```css
html {
  @apply font-sans antialiased;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  @apply bg-background text-foreground;
  font-family: 'Geist Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-feature-settings: "cv11", "ss01";
}

h1, h2, h3, h4, h5, h6 {
  @apply font-semibold tracking-tight text-foreground;
  font-feature-settings: "ss01", "ss03";
}

code, kbd, samp, .font-mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-feature-settings: "ss01";
}

.tabular-nums, [data-tabular="true"] {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

> **Todos los headings llevan `font-semibold tracking-tight` por defecto**, aplicado
> globalmente. Esto es parte de la firma: títulos compactos, nunca `font-bold`
> grandilocuente.

### 3.2 Escala tipográfica real (la observada en el código, no la teórica)

| Rol | Tamaño | Peso | Color | Clases |
|---|---|---|---|---|
| **H1 — Título de página** | `24px` → `28px` en `sm:` | 600 | `foreground` | `text-2xl font-semibold tracking-tight sm:text-[28px]` |
| **H2 — Título de sección de página** | `14px` | 600 | `foreground` | `text-sm font-semibold uppercase tracking-wide` |
| **H2 — Título dentro de card de detalle** | `18px` | 600 | `foreground` | `text-lg font-semibold` |
| **H3 — Título de `SectionCard`** | `15px` | 600 | `foreground` | `text-[15px] font-semibold leading-tight tracking-tight` |
| **Título de `Card` (shadcn)** | `16px` | 500 | `card-foreground` | `text-base leading-snug font-medium` |
| **Título de `Sheet`** | `18px` | 600 | `foreground` | `text-lg font-semibold tracking-tight` |
| **Título de `Dialog`** | `16px` | 500 | `popover-foreground` | `text-base leading-none font-medium` |
| **Subtítulo de página** | `14px` | 400 | `muted-foreground` | `text-sm text-muted-foreground` (con `mt-1.5`) |
| **Descripción de card / sección** | `13px` | 400 | `muted-foreground` | `text-[13px] text-muted-foreground` |
| **Cuerpo / celda de tabla** | `14px` | 400 | `foreground` | `text-sm` |
| **Cuerpo denso (tabla compacta)** | `13px` | 400 | `foreground` | `text-[13px]` |
| **Label de formulario** | `14px` | 500 | `foreground` | `text-sm leading-none font-medium` |
| **Label de filtro** | `11.5px` | 600 | `muted-foreground` | `text-[11.5px] font-semibold uppercase tracking-[0.04em]` |
| **Eyebrow** | `10.5px` | 600 | `muted-foreground` | `.eyebrow` → `text-[10.5px] font-semibold uppercase tracking-[0.08em]` |
| **Header de tabla** | `11.5px` (`11px` compacto) | 600 | `muted-foreground` | `text-[11.5px] font-semibold uppercase tracking-wider` |
| **Botón (`default` / `lg`)** | `14px` | 500 | según variante | `text-sm font-medium` |
| **Botón `sm`** | `12.8px` | 500 | — | `text-[0.8rem]` |
| **Botón `xs`** | `12px` | 500 | — | `text-xs` |
| **Badge** | `11px` | 500 | según variante | `text-[11px] font-medium leading-none` |
| **Texto auxiliar / hint / error** | `12px` | 400 | `muted-foreground` o `destructive` | `text-xs` |
| **Item de navegación (sidebar)** | `13px` | 500 | ver §7 | `text-[13px] font-medium` |
| **Sub-item de navegación** | `12.5px` | 400 | ver §7 | `text-[12.5px]` |
| **Valor de KPI** | `26px` | 600 | `foreground` | `text-[26px] font-semibold tracking-tight tabular-nums` |
| **Texto técnico / código inline** | `~0.78em` | 500 | `foreground` | `.text-tech` o `font-mono text-[12px]` |

### 3.3 Cuándo usar cada nivel — reglas de decisión

- **Una sola `h1` por página**, siempre dentro del `PageHeader`. Nunca dos títulos
  grandes compitiendo.
- **Las subsecciones dentro de una página** usan el patrón *section label*: icono +
  texto `text-sm font-semibold uppercase tracking-wide` sobre una línea inferior
  (`border-b border-border pb-3`). No `h2` grandes.
- **Todo lo secundario es `muted-foreground`.** Si dudas entre gris y negro para un
  texto de apoyo, es gris.
- **Uppercase + letter-spacing solo en textos micro** (labels de filtro, eyebrows,
  headers de tabla). Nunca en títulos ni en cuerpo.
- **`font-bold` prácticamente no se usa.** El peso máximo habitual es `600`
  (`font-semibold`).
- **Toda cifra lleva `tabular-nums`.** Toda cifra alineada en columna va a la derecha.
- **Códigos e identificadores van en mono**, normalmente dentro de un chip:
  `inline-block rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[12px] font-medium`.

### 3.4 Utilidades tipográficas del sistema

```css
@layer utilities {
  /* Texto técnico: códigos, identificadores, métricas */
  .text-tech { @apply font-mono text-[0.78em] tracking-tight; font-feature-settings: "ss01","ss03"; }

  /* Eyebrow: label micro sobre un título o encima de un número */
  .eyebrow { @apply text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground; }

  /* Separador con texto centrado */
  .divider-label { @apply flex items-center gap-3 text-xs text-muted-foreground; }
  .divider-label::before,
  .divider-label::after { @apply h-px flex-1 bg-border content-['']; }
}
```

---

## 4. ESPACIADO Y DIMENSIONES

### 4.1 Escala base

Escala Tailwind estándar (`1 unidad = 0.25rem = 4px`), extendida con medios pasos:

```js
spacing: {
  '4.5': '1.125rem',  // 18px
  '5.5': '1.375rem',  // 22px
  '6.5': '1.625rem',  // 26px
  '7.5': '1.875rem',  // 30px
  '13':  '3.25rem',   // 52px
  '15':  '3.75rem',   // 60px
  '18':  '4.5rem',    // 72px
}
```

### 4.2 Ritmo vertical — separaciones canónicas

| Contexto | Valor | Clase |
|---|---|---|
| Entre bloques principales de una página | **24px** | `gap-6` en el contenedor `flex flex-col` |
| Entre secciones mayores (página con varias áreas) | **32px** | `gap-8` |
| Entre elementos dentro de una sección | **16px** | `gap-4` |
| Entre título y subtítulo | **6px** | `mt-1.5` |
| Entre breadcrumb y título | **8px** | `mb-2` |
| Entre label y control de formulario | **6px** | `space-y-1.5` |
| Entre campos de un formulario | **20px** | `space-y-5` |
| Entre botones adyacentes | **8px** | `gap-2` |
| Entre icono y texto (dentro de botón / item) | **6px** o **8px** | `gap-1.5` / `gap-2` |
| Entre items del sidebar | **2px** | `space-y-0.5` |
| Entre chips / badges | **8px** | `gap-2` |

> **Regla:** el contenedor raíz de una página es siempre
> `<div className="flex flex-col gap-6">` (o `gap-8` si tiene secciones mayores). No se
> usan márgenes sueltos entre bloques; el espaciado lo pone el contenedor.

### 4.3 Padding interno canónico

| Elemento | Padding |
|---|---|
| `SectionCard` — header | `px-5 py-4` |
| `SectionCard` — body `sm` / `md` / `lg` | `p-4` / `p-5` / `p-6` |
| `SectionCard` — footer | `px-5 py-3` |
| `DataToolbar` / `DataPagination` | `px-4 py-3` |
| Celda de tabla (default) | `px-4 py-3` |
| Celda de tabla (compact) | `px-3 py-2` |
| Header de tabla (default / compact) | `px-4 py-3` / `px-3 py-2.5` |
| `StatCard` | `p-5` |
| `Card` shadcn (`Card` / `CardContent`) | `py-4` + `px-4` (tamaño `sm`: `py-3` + `px-3`) |
| `Dialog` content | `p-4` |
| `Sheet` header / body / footer | `px-6 py-5` / `px-6 py-5` / `px-6 py-4` |
| `Popover` / `HoverCard` | `p-2.5` |
| Dropdown content | `p-1` (items: `px-1.5 py-1`) |
| Item del sidebar | `px-3 py-2` (sub-item: `px-2.5 py-1.5`) |
| `FiltersToolbar` header / body / footer | `px-5 py-3.5` / `px-5 py-4` / `px-5 py-3` |

### 4.4 Alturas de componentes

| Componente | Alto |
|---|---|
| Botón `xs` | `24px` (`h-6`) |
| Botón `sm` | `28px` (`h-7`) |
| Botón `default` | **`32px`** (`h-8`) |
| Botón `lg` | `36px` (`h-9`) |
| Icon button `icon-xs` / `icon-sm` / `icon` / `icon-lg` | `24` / `28` / `32` / `36px` |
| Input, `SelectTrigger` | **`32px`** (`h-8`); tamaño `sm` = `28px` |
| Input de búsqueda (`SearchInput`) | `36px` (`h-9`) — deliberadamente mayor |
| `DateInput` de filtros | `36px` (`h-9`) |
| Textarea | `min-h-16` (64px), crece con el contenido |
| Badge | `20px` (`h-5`) |
| Header / franja de logo del sidebar | **`64px`** (`h-16`) |
| Avatar del sidebar | `36px` (`h-9 w-9`) |
| Chip de icono de `StatCard` | `40px` (`h-10 w-10`) |
| Círculo de paso del `Stepper` | `28px` (`h-7 w-7`) |

### 4.5 Dimensiones de layout

| Medida | Valor |
|---|---|
| Ancho del sidebar | **`260px`** (`w-[260px]`) |
| Ancho máximo del contenido | **`1500px`** (`max-w-[1500px]`) |
| Padding horizontal del área de trabajo | `24px`, `32px` desde `lg:` (`px-6 lg:px-8`) |
| Padding superior del área de trabajo | `24px` (`pt-6`) |
| Padding inferior del área de trabajo | **`64px`** (`pb-16`) — generoso a propósito |
| Contenedor Tailwind (`container`) | centrado, `padding: 1rem`, `2xl: 1400px` |
| Ancho mínimo de `SearchInput` | `200px` (configurable) |
| Ancho del dropdown de usuario | `224px` (`w-56`) |
| Ancho de `Popover` | `288px` (`w-72`) |
| Ancho de `HoverCard` | `256px` (`w-64`) |

---

## 5. BORDER RADIUS Y SOMBRAS

### 5.1 Radios

Todos derivan de `--radius: 0.625rem` (10px):

```js
borderRadius: {
  sm:    'calc(var(--radius) - 4px)',  //  6px
  md:    'calc(var(--radius) - 2px)',  //  8px
  lg:    'var(--radius)',              // 10px
  xl:    'calc(var(--radius) + 4px)',  // 14px
  '2xl': 'calc(var(--radius) + 8px)',  // 18px
}
```

| Radio | Valor | Se usa en |
|---|---|---|
| `rounded-sm` | 6px | Elementos micro: botón de limpiar búsqueda, items de command |
| `rounded-md` | 8px | Items de menú / dropdown, items del sidebar, badges cuadrados, chips de icono pequeños |
| `rounded-lg` | **10px** | **Botones**, inputs, selects, popovers, dropdowns, hover cards |
| `rounded-xl` | **14px** | **Cards, paneles, tablas, dialogs, tabs list** — la superficie canónica |
| `rounded-2xl` | 18px | Chips de icono destacados (hero del wizard) |
| `rounded-full` | ∞ | Badges, pills, avatares, puntos de estado, pulgar del scrollbar |

> **Jerarquía clave:** contenedor `rounded-xl` (14px) > control interno `rounded-lg`
> (10px) > item interno `rounded-md` (8px). Nunca al revés: un control nunca es más
> redondeado que su contenedor.

### 5.2 Sombras

```js
boxShadow: {
  'xs':      '0 1px 2px 0 rgb(15 18 24 / 0.04)',
  'sm':      '0 1px 2px 0 rgb(15 18 24 / 0.04), 0 1px 1px 0 rgb(15 18 24 / 0.03)',
  'DEFAULT': '0 1px 3px 0 rgb(15 18 24 / 0.05), 0 1px 2px -1px rgb(15 18 24 / 0.04)',
  'md':      '0 4px 6px -1px rgb(15 18 24 / 0.05), 0 2px 4px -2px rgb(15 18 24 / 0.04)',
  'lg':      '0 10px 15px -3px rgb(15 18 24 / 0.06), 0 4px 6px -4px rgb(15 18 24 / 0.04)',
  'ring-brand': '0 0 0 3px hsl(var(--brand) / 0.15)',
}
```

Dos rasgos distintivos frente a Tailwind por defecto:

1. **El color de sombra no es negro puro**, es `rgb(15 18 24)` — el mismo grafito frío
   del texto. Evita el gris sucio.
2. **Las opacidades están reducidas a la mitad** (0.03–0.06 en vez de 0.1). Las sombras
   insinúan, no dibujan.

### 5.3 Niveles de elevación

| Nivel | Cómo se consigue | Qué lo usa |
|---|---|---|
| **0 — plano** | Sin sombra, `bg-muted/30` o `bg-muted/20` | Headers de tabla, toolbars, footers de card |
| **1 — superficie** | `border border-border bg-card shadow-sm` (= `.surface`) | **Cards, paneles, tablas, secciones** — el 90 % de los casos |
| **2 — flotante** | `bg-popover shadow-md ring-1 ring-foreground/10` | Dropdowns, popovers, selects, hover cards, dialogs |
| **3 — overlay** | `shadow-lg` + overlay de fondo | Sheets (drawers), submenús |

> Los primitivos de shadcn del estilo `radix-nova` usan **`ring-1 ring-foreground/10` en
> lugar de `border`** para el contorno de elementos flotantes (dialog, dropdown, popover,
> card). Es un anillo de 1px que no ocupa espacio en el layout. Los componentes
> compuestos del sistema (`SectionCard`, `DataCard`) sí usan `border border-border`.
> Ambos conviven; para código nuevo, usa `border` en superficies estructurales y `ring`
> en flotantes.

### 5.4 La utilidad `.surface` — memorízala

```css
.surface { @apply rounded-xl border border-border bg-card shadow-sm; }
```

Esta única línea define **toda** superficie elevada del sistema. `SectionCard`,
`StatCard`, `DataCard` y `FiltersToolbar` se construyen sobre ella. Si el proyecto
destino solo copia una utilidad de este documento, que sea esta.

Complementarias:

```css
.row-hover    { @apply transition-colors hover:bg-muted/40; }  /* filas / items */
.anim-fade-in { animation: fadeIn 220ms ease-out; }
.anim-slide-up{ animation: slideUp 280ms cubic-bezier(0.16, 1, 0.3, 1); }
```

### 5.5 Scrollbars

Parte de la firma visual: finos, sin track, pulgar redondeado con aire lateral.

```css
* {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border-strong)) transparent;
}
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: hsl(var(--border-strong));
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }

/* Variante para superficies oscuras */
[data-scope="sidebar"] *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); }
[data-scope="sidebar"] *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
```

El truco de `border: 2px solid transparent` + `background-clip: padding-box` hace que el
pulgar se vea de 4px con 2px de aire a cada lado. Cópialo tal cual.

---

## 6. ARQUITECTURA VISUAL GENERAL

### 6.1 Estructura raíz

La aplicación tiene **dos shells distintos**:

| Shell | Cuándo | Estructura |
|---|---|---|
| **Shell público** (auth) | Login, recuperar contraseña, reset | Pantalla completa centrada, sin sidebar (ver §25.6) |
| **Shell autenticado** (`AppShell`) | Todo lo demás | Sidebar fijo + workspace con scroll |

Composición de providers (de fuera hacia dentro):

```
QueryClientProvider          → cliente de datos
  BrowserRouter              → routing
    AuthProvider             → sesión y rol del usuario
      Routes
        /login, /reset-password        → páginas públicas
        ProtectedRoute                 → exige sesión; si no, redirige a /login
          AppShell                     → layout autenticado (Outlet)
            AdminRoute                 → subconjunto de rutas solo para admin
  Toaster (sonner)           → hermano del router, richColors, position="top-right"
```

### 6.2 `AppShell` — el layout autenticado

Es el componente más importante del sistema de layout. **13 líneas que definen toda la
página.**

```tsx
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto min-h-full w-full max-w-[1500px] px-6 pb-16 pt-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

Decisiones que hay que replicar exactamente:

| Decisión | Por qué |
|---|---|
| `h-screen overflow-hidden` en el contenedor | La página **nunca** hace scroll global. El scroll vive dentro del `main`. |
| `flex` horizontal, sidebar primero | El sidebar es un hermano, no un `position: fixed`. Empuja el contenido de forma natural, sin `margin-left` mágicos. |
| `flex-1 overflow-y-auto` en `main` | El workspace tiene **su propio contexto de scroll**. El sidebar queda siempre visible y no se desplaza. |
| `mx-auto max-w-[1500px]` | El contenido se centra y deja de crecer en monitores anchos. En pantallas ultrawide queda aire simétrico a ambos lados. |
| `px-6 lg:px-8` | 24px de margen lateral, 32px desde `lg`. |
| `pt-6` + `pb-16` | Asimetría deliberada: 24px arriba, **64px abajo** para que el último elemento nunca quede pegado al borde inferior de la ventana. |
| `min-h-full` | El contenedor interno ocupa al menos toda la altura, así los estados vacíos se centran bien. |
| `bg-background` en ambos | El fondo cálido es continuo; las cards blancas flotan sobre él. |

### 6.3 Distribución de espacios

```
┌────────────┬────────────────────────────────────────────────────┐
│            │  ← px-6 / lg:px-8 →                                │
│  SIDEBAR   │  ┌──────────────────────────────────────────────┐  │
│  260px     │  │  max-w-[1500px], mx-auto           pt-6      │  │
│  fijo      │  │                                              │  │
│  #07122B   │  │  PageHeader (h1 + subtitle + actions)        │  │
│            │  │  ── gap-6 ──                                 │  │
│  scroll    │  │  Bloque 1 (filtros / tabs / KPIs)            │  │
│  interno   │  │  ── gap-6 ──                                 │  │
│            │  │  Bloque 2 (tabla / gráficos)                 │  │
│            │  │                                    pb-16     │  │
│  ────────  │  └──────────────────────────────────────────────┘  │
│  footer    │        ↑ scroll independiente (overflow-y-auto)    │
│  usuario   │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

### 6.4 Estructura interna de una página

**Toda** página del sistema sigue esta forma:

```tsx
<div className="flex flex-col gap-6">
  <PageHeader title="…" subtitle="…" breadcrumb={[…]} actions={<…/>} />

  {/* 1..n bloques, separados automáticamente por el gap-6 */}
  <FiltersToolbar>…</FiltersToolbar>
  <DataCard>…</DataCard>
</div>
```

Variante con secciones mayores (`gap-8` + *section labels*):

```tsx
<div className="flex flex-col gap-8">
  <PageHeader … />

  <section className="flex flex-col gap-4">
    <SectionLabel icon={Trash2}>Registros eliminados</SectionLabel>
    <ResumenCards />
    <Listado />
  </section>

  <section className="flex flex-col gap-4">
    <SectionLabel icon={History}>Historial de operaciones</SectionLabel>
    <Filtros />
    <Tabla />
  </section>
</div>
```

`SectionLabel` (patrón reutilizable, ~10 líneas):

```tsx
<div className="flex items-center gap-2 border-b border-border pb-3">
  <Icon className="h-4 w-4 text-muted-foreground" />
  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
    {children}
  </h2>
</div>
```

### 6.5 Grid y flex — cuándo se usa cada uno

| Necesidad | Solución |
|---|---|
| Apilar bloques de página | `flex flex-col gap-6` |
| Fila de KPIs | `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (o `lg:grid-cols-4`) |
| Rejilla de gráficos | `grid gap-4 grid-cols-1 lg:grid-cols-2` (helper `ChartGrid`) |
| Rejilla de filtros | `grid gap-x-4 gap-y-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (helper `FiltersGrid`) |
| Rejilla de campos de detalle | `grid gap-3 md:grid-cols-3` (o `md:grid-cols-4`) |
| Header con título a la izquierda y acciones a la derecha | `flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between` |
| Barra de herramientas | `flex flex-wrap items-center justify-between gap-3` |
| Split asimétrico (mapa + lista) | `grid gap-4 lg:grid-cols-[5fr_7fr]` |
| Icono + texto | `flex items-center gap-2` |

**Reglas de alineación observadas:**

- Los headers de página alinean por **`items-end`** (línea base inferior), no por
  `items-center`: el título y los botones comparten la línea de asiento.
- Las barras de herramientas alinean por `items-center`.
- Los headers de card alinean por `items-start` (para que el icono quede arriba cuando
  hay descripción de dos líneas).
- Los bloques que pueden desbordar llevan siempre `min-w-0` y su texto `truncate`.
- Las columnas numéricas de tabla se alinean a la derecha (`text-right`); las de
  identificador, al centro o izquierda.

### 6.6 Footer

**No existe footer de aplicación.** El cierre visual de la página lo da el `pb-16` del
workspace. Los "footers" que sí existen son locales: pie de card (`SectionCard footer`),
pie de tabla (`DataPagination`) y pie de modal (`DialogFooter` / `SheetFooter`).

### 6.7 Cómo reproducir este patrón en otro proyecto

1. Crea `AppShell` con la estructura exacta de §6.2 (`h-screen overflow-hidden` +
   sidebar hermano + `main` con `overflow-y-auto`).
2. Fija `max-w-[1500px]` y el padding `px-6 pb-16 pt-6 lg:px-8` en un único sitio; toda
   página lo hereda y **ninguna** define márgenes propios de página.
3. Obliga a que cada página devuelva `<div className="flex flex-col gap-6">` con un
   `PageHeader` como primer hijo.
4. Nunca uses `position: fixed` para el sidebar ni `margin-left` en el contenido: rompe
   el centrado y el cálculo de `max-width`.

---

## 7. SIDEBAR

Es el elemento con más carácter del sistema: oscuro, denso, con acento luminoso.

### 7.1 Contenedor

```tsx
<aside
  data-scope="sidebar"
  className="flex h-full w-[260px] flex-col
             border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
>
```

| Propiedad | Valor |
|---|---|
| Ancho | `260px` fijo |
| Alto | `h-full` (hereda `h-screen` del shell) |
| Posición | Hermano flex, **no** fixed ni absolute |
| Fondo | `bg-sidebar` → `#07122B` |
| Texto base | `text-sidebar-foreground` → `#DCDEE3` |
| Borde derecho | `border-r border-sidebar-border` → `#202B3B` |
| `data-scope="sidebar"` | Activa el scrollbar claro sobre fondo oscuro (§5.5) |

Estructura en tres zonas verticales:

```
┌──────────────────────┐
│  LOGO      h-16      │  ← altura fija, borde inferior
├──────────────────────┤
│                      │
│  NAV                 │  ← flex-1, overflow-y-auto, px-2.5 py-4
│  (crece y scrollea)  │
│                      │
├──────────────────────┤
│  USUARIO + LOGOUT    │  ← altura natural, borde superior
└──────────────────────┘
```

### 7.2 Zona de logo

```tsx
<div className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
  <img src={logo} alt="…" className="max-h-10 w-auto object-contain" />
</div>
```

- Altura `64px` — **la misma que el header**, para que ambos coincidan visualmente.
- Logo centrado, limitado a `max-h-10` (40px) y `w-auto`: nunca se deforma.
- Borde inferior que separa de la navegación.

### 7.3 Zona de navegación

```tsx
<nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-4">
```

- `flex-1` + `overflow-y-auto`: si hay muchos items, **solo la nav scrollea**; logo y
  footer quedan fijos.
- `space-y-0.5` (2px) entre items: densidad alta.
- `px-2.5` (10px) de padding lateral — clave: deja el aire justo para que la barra del
  item activo sobresalga con `-left-2.5`.

#### Item simple

```tsx
<Link
  to={item.to}
  className={cn(
    'group relative flex items-center gap-3 rounded-md px-3 py-2',
    'text-[13px] font-medium transition-colors',
    active
      ? 'bg-sidebar-accent text-white'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white',
  )}
>
  {active && (
    <span aria-hidden
      className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
  )}
  <Icon className="h-4 w-4 shrink-0" />
  <span className="truncate">{item.label}</span>
</Link>
```

**Anatomía:** `[barra activa] [icono 16px] --gap-3 (12px)-- [label]`

| Estado | Fondo | Texto | Extra |
|---|---|---|---|
| Default | transparente | `sidebar-foreground/70` | — |
| Hover | `sidebar-accent/50` | `white` | `transition-colors` |
| **Activo** | `sidebar-accent` | `white` | **Barra vertical de 3px en `sidebar-primary`** pegada al borde izquierdo |
| Foco | anillo `sidebar-ring` | — | (heredado del navegador / Radix) |

**El detalle que define el sidebar:** el indicador activo es una barra de `3px` de ancho,
`rounded-r-full`, en el color de acento luminoso, posicionada `-left-2.5` (sale del
padding del contenedor y toca el borde del sidebar) y con `top-1.5 bottom-1.5` (6px de
aire arriba y abajo, para que no llegue a los extremos del item). No es un borde
izquierdo del item: es un `span` absoluto. Cópialo así.

#### Item con sub-items (grupo colapsable)

```tsx
<button type="button" onClick={toggle}
  className={cn(
    'group relative flex w-full items-center gap-3 rounded-md px-3 py-2',
    'text-[13px] font-medium transition-colors',
    seccionActiva
      ? 'text-white'                                   // ← sin fondo
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white',
  )}
>
  {seccionActiva && <span className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />}
  <Icon className="h-4 w-4 shrink-0" />
  <span className="flex-1 truncate text-left">{item.label}</span>
  {expandido ? <ChevronDown className="h-3.5 w-3.5 opacity-70" />
             : <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
</button>

{expandido && (
  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
    {children.map(child => (
      <Link className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
        childActive
          ? 'bg-sidebar-accent text-white'
          : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/40 hover:text-white',
      )}>
        <ChildIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{child.label}</span>
      </Link>
    ))}
  </div>
)}
```

Diferencias deliberadas padre vs. hijo:

| | Padre | Hijo |
|---|---|---|
| Texto | `13px`, `font-medium` | `12.5px`, peso normal |
| Icono | `16px` (`h-4 w-4`) | `14px` (`h-3.5 w-3.5`) |
| Gap icono/texto | `12px` (`gap-3`) | `10px` (`gap-2.5`) |
| Padding | `px-3 py-2` | `px-2.5 py-1.5` |
| Opacidad en reposo | `/70` | `/55` |
| Hover | `sidebar-accent/50` | `sidebar-accent/40` |
| Activo | fondo `sidebar-accent` + barra brand | fondo `sidebar-accent`, **sin barra** |

**Indentación y guía:** el grupo hijo lleva `ml-4` (16px) + `border-l border-sidebar-border`
+ `pl-3` (12px). La línea vertical fina es la que comunica la jerarquía; sin ella el
submenú parece una lista suelta.

**Comportamiento de expansión:**

```tsx
const seccionActiva = currentPath.startsWith(item.to);
const [expandido, setExpandido] = useState(seccionActiva);   // abierto si estoy dentro
useEffect(() => { if (seccionActiva) setExpandido(true); }, [seccionActiva]);
```

- Un grupo se abre automáticamente si la ruta actual pertenece a esa sección, y se
  **mantiene abierto** mientras se navega dentro.
- El padre **no navega**: solo expande/colapsa. Navegar es responsabilidad de los hijos.
- El chevron rota entre `ChevronRight` (cerrado) y `ChevronDown` (abierto), con
  `opacity-70`.
- El estado de expansión es local (`useState`), no persiste entre recargas.

**Detección de ruta activa:**

```tsx
function isPathActive(to: string, currentPath: string): boolean {
  if (to === '/') return currentPath === '/';   // la raíz solo coincide exacta
  return currentPath.startsWith(to);            // el resto, por prefijo
}
```

**Filtrado por permisos:** los items pueden declarar `soloAdmin: true` y se filtran antes
de renderizar (`NAV_ITEMS.filter(i => !i.soloAdmin || esAdmin)`). El sidebar nunca
muestra un item al que el usuario no puede entrar.

#### Modelo de datos de navegación

```ts
export interface NavItem {
  to: string;          // ruta, o prefijo de sección si tiene children
  label: string;       // etiqueta visible
  icon: LucideIcon;    // icono de lucide
  soloAdmin?: boolean; // visible solo para administradores
  children?: NavItem[];// sub-items; si existen, el padre solo expande
}

export const NAV_ITEMS: NavItem[] = [ /* … */ ];
```

Mantén esta forma: es lo que permite que el sidebar sea puramente declarativo y que el
proyecto destino solo tenga que sustituir el array (que pertenece a la Parte B).

### 7.4 Zona de usuario (footer del sidebar)

```tsx
<div className="border-t border-sidebar-border px-3 py-3">
  {/* Perfil */}
  <div className="flex items-center gap-3 px-2 py-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent">
      <User className="h-4 w-4 text-sidebar-foreground/80" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold leading-tight text-white">{nombre}</p>
      <p className="truncate text-[11px] text-sidebar-foreground/60">{email}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-primary">
        {rol}
      </p>
    </div>
  </div>

  {/* Logout */}
  <button onClick={handleLogout}
    className="mt-2 flex w-full items-center justify-center gap-2
               rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2
               text-[12px] font-medium text-sidebar-foreground transition-all
               hover:bg-sidebar-accent hover:text-white
               active:translate-y-px">
    <LogOut className="h-3.5 w-3.5" />
    Cerrar sesión
  </button>
</div>
```

**Separación navegación / usuario:** un `border-t border-sidebar-border`. Nada más — no
hay margen extra ni fondo distinto. La zona de usuario tiene altura natural y nunca
scrollea.

**Jerarquía de tres líneas en el perfil** (patrón reutilizable para cualquier app):

| Línea | Tamaño | Peso | Color | Contenido |
|---|---|---|---|---|
| 1 | `13px` | 600 | `white` | Nombre |
| 2 | `11px` | 400 | `sidebar-foreground/60` | Email (identificador secundario) |
| 3 | `10px` | 600, uppercase, `tracking-[0.08em]` | **`sidebar-primary`** | Rol |

El rol usa el color de acento: es el único sitio del footer donde aparece color, y sirve
de recordatorio permanente del nivel de permisos.

**Avatar:** círculo de `36px` con fondo `sidebar-accent` e icono `User` de `16px`. No hay
foto de perfil ni iniciales en el sistema original; si el destino necesita iniciales,
manténlas dentro del mismo círculo con `text-[13px] font-semibold`.

**Botón de logout:**

- Ancho completo, contenido centrado (`justify-center`) — a diferencia de los items de
  navegación, que van a la izquierda. Esa diferencia lo marca como acción, no como
  destino.
- Estilo *outline sobre oscuro*: `border-sidebar-border` + `bg-sidebar-accent/40`.
- Hover: sube a `bg-sidebar-accent` + texto blanco.
- **`active:translate-y-px`**: micro-hundimiento al pulsar. Es el mismo gesto que usan
  todos los botones del sistema (§10) y da sensación física.
- Al cerrar sesión: `await logout()` → `toast.success('Sesión cerrada')` → `navigate('/login')`.

**Dropdown de usuario:** en el sidebar **no** hay dropdown; el perfil es informativo y el
logout es un botón directo. El dropdown de usuario existe en el `Header` (§8), que hoy no
está montado. Para el proyecto destino: elige **uno de los dos** sitios, no ambos.

### 7.5 Scroll y responsive del sidebar

- **Scroll:** solo la `<nav>` (`flex-1 overflow-y-auto`). El pulgar del scrollbar usa la
  variante clara para fondo oscuro gracias a `data-scope="sidebar"`.
- **Responsive:** ver §21.2. El componente ya acepta `onClose?: () => void` y lo invoca
  al hacer clic en cualquier link — es decir, **está preparado para vivir dentro de un
  drawer móvil**, aunque el shell actual no lo monte así.

### 7.6 Especificación de sidebar colapsable (opcional, no existe en origen)

Si el proyecto destino necesita colapso a modo "solo iconos", esta es la extensión
coherente con el sistema:

| Aspecto | Expandido | Colapsado |
|---|---|---|
| Ancho | `260px` | `64px` (`w-16`) |
| Transición | `transition-[width] duration-200 ease-out` | idem |
| Logo | completo | isotipo `h-8 w-8` |
| Item | icono + label | solo icono, centrado (`justify-center`) |
| Label | visible | oculto, mostrado en `Tooltip side="right"` |
| Chevron de grupo | visible | oculto; el grupo se abre como submenú flotante (`Popover side="right"`) |
| Barra activa | `-left-2.5` | igual, se mantiene |
| Footer usuario | 3 líneas | solo avatar, con `Tooltip` |

Persistir el estado en `localStorage` y respetar `prefers-reduced-motion`.

---

## 8. HEADER / NAVBAR

### 8.1 Estado real en el proyecto de origen

**Hoy la aplicación no tiene header.** Existe un componente `header.tsx` completamente
implementado, pero **no está importado por `AppShell` ni por ninguna otra parte del
código**: es código muerto. El `AppShell` solo renderiza `Sidebar` + `main`.

Consecuencias reales:

- No hay breadcrumbs globales (los breadcrumbs viven dentro del `PageHeader` de cada
  página, §9).
- No hay menú de usuario en la parte superior: perfil y logout están en el pie del
  sidebar (§7.4).
- No hay centro de notificaciones. El feedback se da con toasts (§17).
- **El botón hamburguesa del header no está cableado**, que es la razón por la que el
  sidebar no tiene comportamiento móvil (§21.2).

Esto se documenta tal cual para que el proyecto destino no reproduzca el hueco por
inercia. **Recomendación: implementar el header.**

### 8.2 Especificación del header (componente existente, listo para montar)

```tsx
<header className="sticky top-0 z-30 flex h-16 items-center justify-between
                   border-b bg-background px-4 lg:px-6">
```

| Propiedad | Valor | Razón |
|---|---|---|
| Altura | **`64px`** (`h-16`) | Coincide con la franja de logo del sidebar |
| Posición | `sticky top-0 z-30` | Permanece visible al hacer scroll del workspace |
| Fondo | `bg-background` | Se funde con el fondo; **no** es una barra de color |
| Separación del contenido | `border-b` (1px, `border-border`) | Única separación. Sin sombra. |
| Padding | `px-4 lg:px-6` | Ligeramente menor que el del workspace |
| Layout | `flex items-center justify-between` | Izquierda: navegación/contexto. Derecha: usuario. |

**Zona izquierda** — hamburguesa (solo móvil) + espacio reservado para breadcrumbs:

```tsx
<div className="flex items-center gap-2">
  <Button variant="ghost" size="icon" className="md:hidden"
          onClick={onMenuClick} aria-label="Abrir menú">
    <Menu className="h-5 w-5" />
  </Button>
</div>
```

**Zona derecha** — dropdown de usuario:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="flex items-center gap-2 px-2">
      <div className="flex flex-col items-end leading-tight">
        <span className="text-sm font-medium">{user?.nombre}</span>
        <Badge variant={esAdmin ? 'default' : 'secondary'} className="h-4 py-0 text-[10px]">
          {user?.rol}
        </Badge>
      </div>
      <div className="rounded-full bg-muted p-2">
        <User className="h-4 w-4" />
      </div>
    </Button>
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel className="font-normal">
      <div className="flex flex-col space-y-1">
        <p className="text-sm font-medium">{user?.nombre}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
      <LogOut className="mr-2 h-4 w-4" />
      Cerrar sesión
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Detalles del patrón de usuario en header:

- El nombre se alinea a la derecha (`items-end`) y el avatar queda **después** del texto:
  lectura natural "quién soy → mi avatar → menú".
- El rol se muestra como `Badge` minúsculo (`h-4`, `text-[10px]`, `py-0`), con variante
  `default` (grafito sólido) para admin y `secondary` para el resto.
- El avatar es un círculo `bg-muted` con `p-2` e icono de `16px` (total ~32px).
- El dropdown repite nombre + email como cabecera no interactiva
  (`DropdownMenuLabel font-normal`), separador, y una sola acción destructiva.
- **Logout siempre en `text-destructive`** y siempre el último item.

### 8.3 Header recomendado para el proyecto destino

Estructura completa sugerida (integra lo que el origen dejó a medias):

```
┌─────────────────────────────────────────────────────────────────────┐
│ [☰ móvil]  Breadcrumbs / título contextual    [buscar] [🔔] [usuario]│  h-16
└─────────────────────────────────────────────────────────────────────┘
```

| Zona | Contenido | Responsive |
|---|---|---|
| Izquierda | Hamburguesa `md:hidden`; breadcrumb compacto `hidden md:flex` | El breadcrumb se oculta en móvil |
| Centro | Opcional: buscador global (`⌘K`, usa el componente `Command`) | `hidden lg:block` |
| Derecha | Notificaciones (icon button + punto de estado), dropdown de usuario | El nombre se oculta en `<sm`, queda solo el avatar |

**Notificaciones** (no existe en origen; especificación coherente):

```tsx
<Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
  <Bell className="h-4 w-4" />
  {hayNoLeidas && (
    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive
                     ring-2 ring-background" />
  )}
</Button>
```

El punto lleva `ring-2 ring-background` para separarse del icono. El panel se abre con
`Popover` (`w-80`, `p-0`), con una cabecera `px-4 py-3 border-b`, lista de items con
`row-hover`, y `EmptyState size="sm"` cuando no hay nada.

**Título de página en el header: no.** El `h1` vive en el `PageHeader` del contenido
(§9). Duplicarlo en el header rompe la jerarquía.

### 8.4 Separación respecto al contenido

- El header se separa **solo con `border-b`**. Nunca con `shadow`.
- Si se monta el header, el `main` no necesita cambios: el header va **dentro** de la
  columna derecha, antes del contenedor con `max-w-[1500px]`:

```tsx
<div className="flex h-screen overflow-hidden bg-background">
  <Sidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <Header onMenuClick={() => setDrawerAbierto(true)} />
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto min-h-full w-full max-w-[1500px] px-6 pb-16 pt-6 lg:px-8">
        <Outlet />
      </div>
    </main>
  </div>
</div>
```

---

## 9. PAGEHEADER

El encabezado estándar de **cualquier** página. Es el patrón canónico del sistema y
sustituye a cualquier `h1` suelto.

### 9.1 API

```ts
interface PageHeaderProps {
  title: string;                                  // h1
  subtitle?: string;                              // línea de contexto
  breadcrumb?: { label: string; to?: string }[];  // migas, encima del título
  actions?: ReactNode;                            // botones a la derecha
  className?: string;
}
```

### 9.2 Estructura

```tsx
<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div className="min-w-0">
    {breadcrumb && (
      <nav aria-label="breadcrumb"
           className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {/* último item: font-medium text-foreground; separador: ChevronRight h-3 w-3 text-muted-foreground/60 */}
      </nav>
    )}

    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
      {title}
    </h1>

    {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
  </div>

  {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
</header>
```

### 9.3 Especificación visual

| Elemento | Estilo |
|---|---|
| Contenedor | `flex flex-col gap-4` en móvil → `sm:flex-row sm:items-end sm:justify-between` |
| Breadcrumb | `text-xs text-muted-foreground`, `gap-1.5`, `mb-2` |
| Breadcrumb — último item | `font-medium text-foreground` (marca dónde estás) |
| Breadcrumb — separador | `<ChevronRight className="h-3 w-3 text-muted-foreground/60" />` |
| Título | `text-2xl` → `sm:text-[28px]`, `font-semibold tracking-tight` |
| Subtítulo | `mt-1.5 text-sm text-muted-foreground` |
| Acciones | `flex flex-shrink-0 items-center gap-2` |

**Detalles que importan:**

- **`sm:items-end`**: título y botones comparten línea base inferior. Con
  `items-center` los botones "flotan" respecto a un título de dos líneas.
- **`min-w-0` en el bloque de texto** + **`flex-shrink-0` en las acciones**: si el
  título es largo, se encoge él, no los botones.
- En móvil el bloque se apila y las acciones quedan debajo, alineadas a la izquierda.
- El breadcrumb del origen **no es navegable** (los items no renderizan `<Link>` aunque
  el tipo admite `to`). Si el destino quiere navegación, envuelve en `<Link>` todos los
  items excepto el último y añade `hover:text-foreground transition-colors`.

### 9.4 Uso

```tsx
<PageHeader
  title="Usuarios"
  subtitle="Gestión de cuentas del sistema"
  breadcrumb={[{ label: 'Administración' }, { label: 'Usuarios' }]}
  actions={
    <>
      <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Exportar</Button>
      <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />Nuevo usuario</Button>
    </>
  }
/>
```

**Convención de acciones:** las secundarias (`variant="outline"`) van a la izquierda, la
primaria (`variant="default"`) a la derecha. Siempre `size="sm"` y con icono de `14px`
(`h-3.5 w-3.5`) más `mr-1.5`.

---

## 10. BOTONES

### 10.1 Clases base (comunes a todas las variantes)

```
group/button inline-flex shrink-0 items-center justify-center
rounded-lg border border-transparent bg-clip-padding
text-sm font-medium whitespace-nowrap
transition-all outline-none select-none
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
active:not-aria-[haspopup]:translate-y-px
disabled:pointer-events-none disabled:opacity-50
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
[&_svg]:pointer-events-none [&_svg]:shrink-0
[&_svg:not([class*='size-'])]:size-4
```

Cinco decisiones de este bloque hay que conservarlas sí o sí:

1. **`rounded-lg` (10px)** — todos los botones, de cualquier tamaño.
2. **`border border-transparent`** — todas las variantes reservan 1px de borde, así
   `outline` y `default` tienen exactamente la misma altura y no hay saltos al cambiar
   de variante.
3. **`active:not-aria-[haspopup]:translate-y-px`** — micro-hundimiento de 1px al pulsar,
   *excepto* si el botón abre un menú (donde el hundimiento sería confuso). Es la firma
   táctil del sistema.
4. **`focus-visible:ring-3 ring-ring/50`** — anillo de 3px, solo con foco de teclado.
5. **`[&_svg]:size-4` automático** — cualquier icono dentro del botón se normaliza a 16px
   sin que haya que declararlo (salvo que traiga su propia clase `size-*`).

### 10.2 Variantes

| Variante | Clases | Cuándo usarla |
|---|---|---|
| **`default`** (primaria) | `bg-primary text-primary-foreground` | Acción principal de la pantalla. **Una sola por vista.** Es grafito casi negro, no la marca. |
| **`outline`** | `border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted` | Acción secundaria. La variante más usada del sistema: filtros, exportar, cancelar, paginación, triggers de combobox. |
| **`secondary`** | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Acción terciaria con algo de peso visual. Poco usada. |
| **`ghost`** | `hover:bg-muted hover:text-foreground aria-expanded:bg-muted` | Acciones en tabla, icon buttons, cerrar modal, toggles de toolbar. Sin fondo hasta el hover. |
| **`destructive`** | `bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20` | Eliminar, desactivar. **Ojo: es *soft*, no rojo sólido** — fondo al 10 % y texto rojo. |
| **`link`** | `text-primary underline-offset-4 hover:underline` | Acción que se comporta como enlace dentro de un texto. |

> **El botón destructivo no es un bloque rojo.** Es un botón de fondo rojo muy tenue con
> texto rojo. Esto baja el ruido visual en tablas llenas de acciones y reserva el rojo
> saturado para alertas reales.

`aria-expanded:bg-muted` en `outline` y `ghost`: cuando el botón mantiene abierto un menú,
se queda visualmente "encendido".

### 10.3 Tamaños

| Tamaño | Alto | Padding | Texto | Icono | Uso |
|---|---|---|---|---|---|
| `xs` | `24px` | `px-2` | `text-xs` | `12px` | Acciones micro dentro de celdas o chips |
| `sm` | `28px` | `px-2.5` | `text-[0.8rem]` | `14px` | **El más usado**: acciones de página, toolbars, filtros |
| `default` | `32px` | `px-2.5` | `text-sm` | `16px` | Formularios, modales, acción principal |
| `lg` | `36px` | `px-2.5` | `text-sm` | `16px` | Acciones destacadas |
| `icon-xs` | `24×24` | — | — | `12px` | Icon button micro |
| `icon-sm` | `28×28` | — | — | `16px` | Cerrar modal, colapsar |
| `icon` | `32×32` | — | — | `16px` | Menú de fila, paginación |
| `icon-lg` | `36×36` | — | — | `16px` | Icon button destacado |

Los tamaños `xs` y `sm` reducen también el radio:
`rounded-[min(var(--radius-md),10px)]` / `rounded-[min(var(--radius-md),12px)]`.

Los `gap` internos se ajustan por tamaño: `gap-1` (`xs`, `sm`) y `gap-1.5`
(`default`, `lg`).

Padding asimétrico automático con `has-data-[icon=inline-start]:pl-2` /
`has-data-[icon=inline-end]:pr-2`: cuando hay icono en un lado, ese lado pierde un poco
de padding para compensar el peso visual del glifo.

### 10.4 Iconos dentro de botones

| Situación | Patrón |
|---|---|
| Icono + texto, tamaño `sm` | `<Plus className="mr-1.5 h-3.5 w-3.5" /> Nuevo` |
| Icono + texto, tamaño `default` | `<RefreshCw className="mr-2 h-4 w-4" /> Reintentar` |
| Solo icono | `size="icon"` + `aria-label` obligatorio |
| Icono al final | `Continuar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />` |

Regla: el icono siempre **precede** al texto, salvo que indique avance/dirección
(flechas, chevrons), en cuyo caso va detrás.

### 10.5 Estados

| Estado | Comportamiento |
|---|---|
| **Default** | Según variante |
| **Hover** | Cambio de fondo con `transition-all`; nunca cambia el tamaño |
| **Active** | `translate-y-px` (1px hacia abajo) |
| **Focus (teclado)** | `focus-visible:border-ring` + `ring-3 ring-ring/50`. Nunca `outline: none` sin sustituto |
| **Disabled** | `pointer-events-none` + `opacity-50` |
| **Loading** | No es una prop: se compone. Ver abajo |
| **Inválido** | `aria-invalid` → borde y anillo `destructive` |
| **Expandido** (abre menú) | `aria-expanded:bg-muted`, y se anula el hundimiento |

**Patrón de loading (no hay prop `loading`):**

```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isPending ? 'Guardando…' : 'Guardar'}
</Button>
```

Dos convenciones: spinner `Loader2` con `animate-spin`, y **la etiqueta cambia a gerundio
con puntos suspensivos tipográficos** (`Guardando…`, `Cargando…`, `Ingresando...`). El
botón se deshabilita mientras dura la operación.

### 10.6 Grupos de botones

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" size="sm">Cancelar</Button>
  <Button size="sm">Guardar</Button>
</div>
```

- Separación `gap-2` (8px).
- **La acción primaria siempre a la derecha.**
- En pies de modal: `flex-col-reverse` en móvil → `sm:flex-row sm:justify-end`, para que
  en móvil la primaria quede arriba (más accesible al pulgar).
- Para paginación se usan icon buttons contiguos con `gap-1`.

---

## 11. INPUTS Y FORMULARIOS

### 11.1 Input de texto

```
h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1
text-base md:text-sm transition-colors outline-none
placeholder:text-muted-foreground
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50
aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20
```

| Aspecto | Valor | Nota |
|---|---|---|
| Alto | `32px` (`h-8`) | Igual que el botón `default` |
| Radio | `rounded-lg` (10px) | Igual que el botón |
| Fondo | **`bg-transparent`** | No blanco: hereda el fondo del contenedor. Sobre una card se ve blanco; sobre `muted`, gris. |
| Borde | `border-input` (1px) | |
| Padding | `px-2.5 py-1` | |
| Texto | `text-base` en móvil, **`md:text-sm`** | `16px` en móvil evita el zoom automático de iOS al enfocar. **Copiar este truco.** |
| Placeholder | `text-muted-foreground` | |
| Foco | `border-ring` + `ring-3 ring-ring/50` | |
| Disabled | `bg-input/50` + `opacity-50` + `cursor-not-allowed` | |
| Error | `aria-invalid` → borde y anillo `destructive` | Se activa con el atributo, no con una clase |

### 11.2 Textarea

Mismas reglas que el input, con dos diferencias:

- `min-h-16` (64px) y `field-sizing-content` — **crece automáticamente con el contenido**.
- `py-2` en lugar de `py-1`.

### 11.3 Select

`SelectTrigger`:

```
flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input
bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors
data-[size=default]:h-8 data-[size=sm]:h-7
data-placeholder:text-muted-foreground
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
disabled:cursor-not-allowed disabled:opacity-50
```

- **`w-fit` por defecto**: el trigger se ajusta al contenido. Dentro de una rejilla de
  filtros hay que forzar `className="w-full"`.
- Chevron: `<ChevronDownIcon className="size-4 text-muted-foreground" />`.
- `data-placeholder:text-muted-foreground` — el placeholder se distingue del valor real.

`SelectContent`: `rounded-lg bg-popover shadow-md ring-1 ring-foreground/10`,
`max-h-(--radix-select-content-available-height)`, scroll interno con botones de
scroll arriba/abajo.

`SelectItem`: `rounded-md py-1 pr-8 pl-1.5 text-sm focus:bg-accent focus:text-accent-foreground`,
con el check (`CheckIcon`, 16px) posicionado **a la derecha** (`absolute right-2`).

`SelectLabel`: `px-1.5 py-1 text-xs text-muted-foreground`.
`SelectSeparator`: `-mx-1 my-1 h-px bg-border`.

**Convención para "sin filtro":** Radix Select no admite `value=""`. El sistema usa un
centinela:

```tsx
const SIN_FILTRO = '__all__';
<Select value={filtros.rol ?? SIN_FILTRO}
        onValueChange={v => onChange({ ...filtros, rol: v === SIN_FILTRO ? undefined : v })}>
  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
  <SelectContent>
    <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
    …
  </SelectContent>
</Select>
```

### 11.4 Combobox (select con búsqueda)

Para listas largas. Composición `Popover` + `Command`:

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between font-normal">
      {seleccionada
        ? <span className="truncate">{seleccionada.label}</span>
        : <span className="text-muted-foreground">{placeholder}</span>}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
    <Command>
      <CommandInput placeholder="Buscar..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados</CommandEmpty>
        <CommandGroup>
          {options.map(o => (
            <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
              <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
              {o.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

Claves a replicar:

- El trigger es un `Button variant="outline"` con **`font-normal`** (un select no debe
  parecer un botón con texto en medium).
- `w-[var(--radix-popover-trigger-width)]` — el panel mide exactamente lo que el trigger.
- `ChevronsUpDown` con `opacity-50` como indicador de combobox.
- El check ocupa siempre su espacio (`opacity-0` cuando no está seleccionado): así los
  labels no bailan.

### 11.5 MultiSelect

Mismo esqueleto que el combobox, más:

- Opción **"Todos"** opcional en la cabecera de la lista, que selecciona/deselecciona todo.
- Texto del trigger con **pluralización automática**:
  - sin selección → placeholder;
  - todo seleccionado → `allOptionLabel`;
  - parcial → `"3 elementos seleccionados"` / `"1 elemento seleccionado"`.
- Props para el sustantivo: `itemLabelSingular`, `itemLabelPlural` (por defecto añade `s`).

Este componente es totalmente genérico y **reutilizable tal cual** en cualquier dominio.

### 11.6 Checkbox, radio y switch

En el sistema de origen **no hay componentes propios de checkbox, radio ni switch**
(`@radix-ui/react-checkbox` está instalado pero sin envoltorio). Los pocos checkboxes que
existen son `<input type="checkbox">` nativos.

Especificación coherente para el proyecto destino:

```tsx
// Checkbox
'peer h-4 w-4 shrink-0 rounded-sm border border-input transition-colors ' +
'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring ' +
'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground ' +
'disabled:cursor-not-allowed disabled:opacity-50'
// indicador: <Check className="h-3 w-3" strokeWidth={3} />

// Radio
'peer h-4 w-4 shrink-0 rounded-full border border-input ' +
'data-[state=checked]:border-primary ' +
'focus-visible:ring-3 focus-visible:ring-ring/50'
// indicador: punto central de 8px en bg-primary

// Switch
'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ' +
'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input ' +
'focus-visible:ring-3 focus-visible:ring-ring/50'
// thumb: 'h-4 w-4 rounded-full bg-background shadow transition-transform
//         data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
```

Los tres se emparejan con un `Label` a la derecha, con `gap-2` y el label clicable
(`htmlFor`).

### 11.7 Date picker

**No hay componente de calendario.** Se usa `<input type="date">` nativo, estilizado:

```tsx
<input type="date"
  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm
             tabular-nums text-foreground outline-none transition-colors
             placeholder:text-muted-foreground
             focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15
             disabled:cursor-not-allowed disabled:opacity-50
             [color-scheme:light]" />
```

Particularidades: `tabular-nums` (las fechas no bailan), `[color-scheme:light]` (fuerza el
icono nativo claro) y foco en **`brand`** en lugar de `ring` — es de los pocos controles
que usan el color de marca en el foco.

### 11.8 Input de búsqueda (`SearchInput`)

```tsx
<div className="relative" style={{ minWidth }}>
  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5
                     -translate-y-1/2 text-muted-foreground" aria-hidden />
  <Input value={value} onChange={…} placeholder="Buscar…"
         className="h-9 bg-background pl-8 pr-7 text-sm" />
  {value && (
    <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda"
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5
                 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <X className="h-3.5 w-3.5" />
    </button>
  )}
</div>
```

- Alto `36px` (mayor que el input normal): es un control de uso frecuente.
- Lupa de `14px` a la izquierda, `pointer-events-none` para no bloquear el clic.
- Botón de limpiar **solo cuando hay texto**.
- `minWidth` configurable (200px por defecto) para que en una toolbar flexible no se
  encoja demasiado.
- Placeholder con puntos suspensivos tipográficos: `Buscar…`.

### 11.9 Labels

Componente `Label` (Radix):

```
flex items-center gap-2 text-sm leading-none font-medium select-none
peer-disabled:cursor-not-allowed peer-disabled:opacity-50
group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50
```

Existen **dos estilos de label** según el contexto:

| Contexto | Estilo | Aspecto |
|---|---|---|
| **Formulario** | `text-sm font-medium` (color por defecto) | Label normal, legible |
| **Filtro** | `text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground` | Micro-label en versalitas |

No los mezcles: los formularios usan labels normales; las barras de filtros usan
micro-labels. Es lo que hace que un panel de filtros se lea como "controles" y un
formulario como "datos".

### 11.10 `FormField` — envoltorio de campo de formulario

```tsx
<div className="space-y-1.5">
  <Label htmlFor={htmlFor}>
    {label}
    {required && <span className="ml-0.5 text-destructive">*</span>}
  </Label>
  {children}
  {error   ? <p className="text-xs text-destructive">{error}</p>
   : hint  ? <p className="text-xs text-muted-foreground">{hint}</p>
   : null}
</div>
```

Reglas:

- `space-y-1.5` (6px) entre label, control y mensaje.
- Obligatorio = asterisco `text-destructive` pegado al label (`ml-0.5`).
- **El error tiene prioridad sobre el hint**: nunca se muestran los dos.
- Mensajes en `text-xs`.

### 11.11 `FilterField` — envoltorio de campo de filtro

```tsx
<div className="space-y-1.5">
  <label className={cn(
    'block text-[11.5px] font-semibold uppercase tracking-[0.04em]',
    error ? 'text-destructive' : 'text-muted-foreground',
  )}>{label}</label>
  {children}
  {error ? <p className="text-xs text-destructive">{error}</p>
   : helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
</div>
```

Acepta `span` (1–6) para que un campo ocupe varias columnas de la rejilla
(`sm:col-span-2`, `lg:col-span-3`, …).

### 11.12 Composición de formularios

**Formulario en panel lateral (el patrón dominante):**

```tsx
<Sheet open onOpenChange={o => !o && onClose()}>
  <SheetContent side="right" size="md">
    <SheetHeader>
      <SheetTitle>{esEdicion ? 'Editar usuario' : 'Nuevo usuario'}</SheetTitle>
      <SheetDescription>Modifique los datos del usuario.</SheetDescription>
    </SheetHeader>

    <SheetBody>
      <form id="form-usuario" onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="usr-nombre">Nombre</Label>
          <Input id="usr-nombre" required placeholder="Nombre completo" />
        </div>
        {/* … */}
      </form>
    </SheetBody>

    <SheetFooter>
      <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      <Button type="submit" form="form-usuario" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**El truco clave:** el `<form>` vive en el `SheetBody` (que scrollea) y el botón de
submit vive en el `SheetFooter` (que no scrollea), enlazados con
`form="form-usuario"` + `id`. Así las acciones están siempre visibles aunque el
formulario sea largo. **Reprodúcelo tal cual.**

Otras convenciones de formulario:

- `space-y-5` (20px) entre campos.
- Texto de ayuda contextual bajo el control, en `text-xs text-muted-foreground`, y
  **puede ser dinámico** (p. ej., describir qué implica el rol seleccionado).
- Campos que solo aplican al crear (no al editar) se ocultan condicionalmente.
- El título y el botón cambian según modo: `Nuevo …` / `Editar …`, `Crear` / `Guardar`.

### 11.13 `InputGroup` — input con addons

Permite pegar iconos, botones o texto dentro del marco del input.

```tsx
<InputGroup>
  <InputGroupInput placeholder="Buscar…" />
  <InputGroupAddon align="inline-start"><SearchIcon className="size-4 opacity-50" /></InputGroupAddon>
</InputGroup>
```

- El foco del control interno se propaga al grupo entero con
  `has-[[data-slot=input-group-control]:focus-visible]:border-ring` + `ring-3`.
- Lo mismo con `aria-invalid` y `disabled`.
- `align`: `inline-start`, `inline-end`, `block-start`, `block-end` (los `block-*`
  convierten el grupo en columna, para textareas con barra de herramientas).
- Al hacer clic en el addon, el foco va al input.

### 11.14 Validación y errores

- Validación con **zod** + `zodResolver` de react-hook-form.
- El mensaje de error se muestra bajo el campo (`text-xs text-destructive`) y sustituye
  al hint.
- El control se marca con `aria-invalid` para que se pinten borde y anillo rojos.
- Los errores de servidor **no** se pintan en el campo: van a un toast de error (§17).
- Los mensajes se traducen a lenguaje humano antes de mostrarlos (el origen mantiene un
  diccionario de errores de proveedor → texto en español). **Patrón recomendado:** nunca
  mostrar al usuario el mensaje crudo de la API.

---

## 12. CARDS

El sistema tiene **cinco tipos de card**, cada uno con un propósito distinto. Elegir el
correcto es la mitad de la consistencia visual.

| Componente | Para qué | Cuándo NO usarlo |
|---|---|---|
| `Card` (shadcn) | Contenedor genérico de bajo nivel | Si necesitas header con título + acciones → usa `SectionCard` |
| **`SectionCard`** | **Sección de contenido con header, cuerpo y pie** | Si solo envuelves una tabla → `DataCard` |
| **`DataCard`** | **Contenedor de listado: toolbar + tabla + paginación** | Si el contenido no es tabular |
| **`ChartCard`** | **Gráfico con header, loading y estado vacío** | Si no es un gráfico |
| **`StatCard`** | **KPI / métrica destacada** | Si necesitas más de un número |

### 12.1 `Card` — primitivo de shadcn

```
group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4
text-sm text-card-foreground ring-1 ring-foreground/10
data-[size=sm]:gap-3 data-[size=sm]:py-3
```

| Sub-componente | Estilo |
|---|---|
| `Card` | `rounded-xl bg-card ring-1 ring-foreground/10`, `py-4`, `gap-4` (`sm`: `py-3`, `gap-3`) |
| `CardHeader` | `grid auto-rows-min items-start gap-1 px-4`; si hay `CardAction` pasa a `grid-cols-[1fr_auto]` |
| `CardTitle` | `font-heading text-base leading-snug font-medium` |
| `CardDescription` | `text-sm text-muted-foreground` |
| `CardAction` | `col-start-2 row-span-2 row-start-1 self-start justify-self-end` |
| `CardContent` | `px-4` (`sm`: `px-3`) |
| `CardFooter` | `flex items-center rounded-b-xl border-t bg-muted/50 p-4` |

Detalles: el padding vertical vive en `Card` y el horizontal en cada hijo, así un
`CardFooter` puede sangrar a los bordes. Las imágenes en primera/última posición
redondean sus esquinas automáticamente (`*:[img:first-child]:rounded-t-xl`). El footer
tiene fondo `muted/50` y borde superior: es una franja, no un bloque suelto.

### 12.2 `SectionCard` — la card canónica del sistema

Envoltorio estándar de cualquier sección de contenido.

```ts
interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;                          // botones a la derecha del header
  leading?: ReactNode;                          // indicador a la izquierda del título
  eyebrow?: ReactNode;                          // micro-label sobre el título
  children: ReactNode;
  footer?: ReactNode;
  bodyPadding?: 'none' | 'sm' | 'md' | 'lg';    // default 'md'
  variant?: 'default' | 'flush';
  className?: string;
  bodyClassName?: string;
}
```

Anatomía:

```
┌──────────────────────────────────────────────────────────┐
│ [leading] EYEBROW                          [actions]     │  header
│           Título de la sección                           │  px-5 py-4
│           Descripción                                    │  border-b, bg-card
├──────────────────────────────────────────────────────────┤
│                                                          │
│  children                                                │  body p-5 (configurable)
│                                                          │
├──────────────────────────────────────────────────────────┤
│  footer                                                  │  px-5 py-3, bg-muted/30
└──────────────────────────────────────────────────────────┘
```

Estilos exactos:

| Zona | Clases |
|---|---|
| Contenedor | `.surface overflow-hidden` (= `rounded-xl border border-border bg-card shadow-sm`) |
| Header | `flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-5 py-4` |
| Eyebrow | `.eyebrow mb-1` |
| Título | `text-[15px] font-semibold leading-tight tracking-tight text-foreground` (`h3`) |
| Descripción | `mt-1 text-[13px] text-muted-foreground` |
| Acciones | `flex flex-shrink-0 items-center gap-2` |
| Body | `p-4` / `p-5` / `p-6` / sin padding según `bodyPadding` |
| Footer | `border-t border-border bg-muted/30 px-5 py-3` |

**El header solo se renderiza si hay título, descripción, acciones o eyebrow.** Sin
ellos, la card es un contenedor limpio.

`bodyPadding="none"` + `variant="flush"` es la combinación para meter una tabla que ya
gestiona su propio padding.

### 12.3 `DataCard` + `DataToolbar` + `DataPagination`

Trío que unifica **todos los listados** del sistema en una sola tarjeta.

```tsx
<DataCard>
  <DataToolbar rightSlot={<Button variant="outline" size="sm">Exportar</Button>}>
    <SearchInput value={q} onChange={setQ} placeholder="Filtrar por código…" />
    <SearchInput value={n} onChange={setN} placeholder="Filtrar por nombre…" minWidth={260} />
  </DataToolbar>

  <DataTable bare columns={columnas} data={pagina} loading={isLoading} />

  <DataPagination>
    <span className="text-muted-foreground">Mostrando <b>1–20</b> de <b>134</b> registros</span>
    <div className="flex items-center gap-1">{/* controles */}</div>
  </DataPagination>
</DataCard>
```

| Componente | Clases |
|---|---|
| `DataCard` | `overflow-hidden rounded-xl border border-border bg-card shadow-sm` |
| `DataToolbar` | `flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3` |
| `DataPagination` | `flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-sm` |

Detalles del patrón:

- Toolbar y paginación comparten fondo `bg-muted/20` y bordes al **60 % de opacidad**
  (`border-border/60`): son franjas de servicio, más tenues que un borde estructural.
- La tabla va en modo `bare` (sin borde ni sombra propios): el marco lo pone el
  `DataCard`. Esto evita el "borde dentro de borde" que estropea los listados.
- `DataToolbar` divide en dos zonas: `children` (búsquedas y filtros, `flex-1 flex-wrap gap-2`)
  y `rightSlot` (acciones secundarias, `gap-1.5`).
- `DataPagination` no impone estructura: se le pasan dos bloques (info a la izquierda,
  controles a la derecha).

### 12.4 `ChartCard`

Construido sobre `SectionCard` con `bodyPadding="none"`, añade:

- Área de gráfico con `minHeight` configurable (280px por defecto) y padding `px-5 py-4`.
- **Skeleton de gráfico** propio: 12 barras verticales de altura variable + 3 barritas
  de leyenda. Sugiere la forma del gráfico mientras carga, en vez de un rectángulo gris.
- Prop `empty` para el estado sin datos, centrado en el área.
- Helper `ChartGrid` para rejillas de gráficos:

```tsx
<ChartGrid columns={2}>   {/* grid-cols-1 lg:grid-cols-2 */}
  <ChartCard title="Evolución" …>…</ChartCard>
  <ChartCard title="Distribución" …>…</ChartCard>
</ChartGrid>
```

`columns`: `1` → `grid-cols-1`; `2` → `grid-cols-1 lg:grid-cols-2`;
`3` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. Siempre `gap-4`.

### 12.5 `StatCard` — KPI

```ts
interface StatCardProps {
  label: string;                       // eyebrow
  value: ReactNode;                    // cifra principal
  unit?: string;                       // sufijo ('mm', '%', 'registros')
  helper?: string;                     // línea secundaria
  icon?: LucideIcon;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'destructive';
  delta?: { value: string | number; label?: string;
            direction?: 'up' | 'down' | 'flat';
            goodDirection?: 'up' | 'down' };
  loading?: boolean;
  onClick?: () => void;
}
```

Anatomía:

```
┌─────────────────────────────────────────┐
│ ETIQUETA EN VERSALITAS         ┌──────┐ │
│ 142 registros                  │ icon │ │   p-5
│ texto de apoyo                 └──────┘ │
│ ┌──────────┐                            │
│ │ ↑ +12 %  │  vs mes anterior           │
│ └──────────┘                            │
└─────────────────────────────────────────┘
```

| Elemento | Estilo |
|---|---|
| Contenedor | `.surface p-5`; con `onClick`: `cursor-pointer hover:border-border-strong hover:shadow` |
| Label | `.eyebrow truncate` |
| Valor | `text-[26px] font-semibold tracking-tight text-foreground tabular-nums` |
| Unidad | `text-sm font-medium text-muted-foreground`, alineada por `items-baseline` con el valor |
| Helper | `truncate text-xs text-muted-foreground` |
| Chip de icono | `h-10 w-10 rounded-lg` + fondo/texto según tono (ver tabla) |
| Delta | pill `rounded-full px-2 py-0.5 text-xs font-medium` con flecha de 12px |

Fondo del chip de icono por tono:

| Tono | Clases |
|---|---|
| `neutral` | `bg-muted text-muted-foreground` |
| `brand` | `bg-brand-soft text-brand-soft-foreground` |
| `success` | `bg-success-soft text-success-soft-foreground` |
| `warning` | `bg-warning-soft text-warning-soft-foreground` |
| `info` | `bg-info-soft text-info-soft-foreground` |
| `destructive` | `bg-destructive-soft text-destructive-soft-foreground` |

**Decisiones de diseño explícitas (documentadas en el propio componente):**

1. **Sin borde lateral de color.** El tropo del "borde izquierdo de 4px de color" está
   deliberadamente evitado. El tono se comunica **solo** con el chip del icono.
2. El valor usa `tabular-nums` para que al actualizarse no baile.
3. `value` acepta `ReactNode`: permite meter un código en mono con otro tamaño.
4. Valor nulo → `—` en `text-muted-foreground` (nunca "0" ni vacío).

**Delta (`DeltaChip`):** el color no depende de la dirección, sino de si esa dirección es
*buena*. `goodDirection: 'down'` hace que una bajada se pinte en verde (útil para
métricas donde menos es mejor). Iconos: `ArrowUpRight` / `ArrowDownRight` / `Minus`.
Sin dirección definida → `text-muted-foreground bg-muted`.

**Skeleton propio:** tres barras (`h-3 w-20`, `h-8 w-24`, `h-3 w-32`) dentro de la
superficie, respetando el layout final.

**Rejilla de KPIs:**

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <StatCard … /> <StatCard … /> <StatCard … />
</div>
```

Con 4 KPIs: `sm:grid-cols-2 lg:grid-cols-4`.

---

## 13. TABLAS

`DataTable` es el componente más elaborado del sistema. Cubre orden, carga, vacío,
paginación, densidad y composición.

### 13.1 API

```ts
interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  mensajeVacio?: string;
  paginacion?: { page: number; limit: number; total: number;
                 totalPages: number; onPageChange: (p: number) => void };
  onRowClick?: (row: TData) => void;
  density?: 'default' | 'compact';
  bare?: boolean;      // true si va dentro de un DataCard
}
```

### 13.2 Contenedor

```tsx
<div className={cn('relative overflow-x-auto',
                   !bare && 'rounded-xl border border-border bg-card shadow-sm')}>
  <table className="w-full border-collapse">…</table>
</div>
```

- `overflow-x-auto` **siempre**: en pantallas estrechas la tabla scrollea
  horizontalmente dentro de su marco, sin romper el layout de la página.
- `bare` desactiva el marco propio para componer dentro de `DataCard`.
- Cuando no es `bare`, el wrapper añade `space-y-3` para separar la paginación.

### 13.3 Encabezado

```tsx
<tr className="border-b border-border bg-muted/30">
  <th className="text-left font-semibold uppercase tracking-wider
                 text-muted-foreground whitespace-nowrap px-4 py-3 text-[11.5px]">
    <button className="flex items-center gap-1.5 transition-colors
                       cursor-pointer select-none hover:text-foreground"
            onClick={header.column.getToggleSortingHandler()}>
      {label}
      <SortIcon dir={header.column.getIsSorted()} />
    </button>
  </th>
</tr>
```

| Aspecto | Valor |
|---|---|
| Fondo | `bg-muted/30` (muy tenue, no gris sólido) |
| Borde inferior | `border-b border-border` (opacidad completa: separa cabecera de datos) |
| Texto | `11.5px` (`11px` compacto), `font-semibold`, `uppercase`, `tracking-wider`, `text-muted-foreground` |
| Padding | `px-4 py-3` (compacto: `px-3 py-2.5`) |
| Alineación | `text-left` por defecto |
| Wrap | `whitespace-nowrap` |

**Ordenación:** cada cabecera ordenable es un `<button>` con hover a `text-foreground`.
Icono de estado:

| Estado | Icono |
|---|---|
| Sin ordenar | `<ChevronsUpDown className="h-3 w-3 opacity-40" />` |
| Ascendente | `<ChevronUp className="h-3 w-3 text-foreground" />` |
| Descendente | `<ChevronDown className="h-3 w-3 text-foreground" />` |

El icono **siempre ocupa espacio**, incluso sin ordenar (al 40 % de opacidad): así las
cabeceras no se mueven al ordenar. Las columnas no ordenables renderizan el botón
`disabled` sin icono.

Cabeceras alineadas a la derecha/centro se declaran en la columna:

```ts
header: () => <span className="block text-right">Longitud</span>
```

### 13.4 Filas y celdas

```tsx
<tr className={cn(
  'border-b border-border/60 transition-colors',
  'hover:bg-muted/40',
  esUltima && 'border-b-0',
  onRowClick && 'cursor-pointer',
)}>
  <td className="align-middle text-foreground px-4 py-3 text-sm">…</td>
</tr>
```

| Aspecto | Valor |
|---|---|
| Separador de filas | `border-b border-border/60` (**60 % de opacidad**: más tenue que el borde de cabecera) |
| Última fila | `border-b-0` — sin línea colgando sobre el pie |
| Hover | `hover:bg-muted/40` + `transition-colors` |
| **Zebra striping** | **No existe.** Deliberadamente eliminado por un look más limpio |
| Selección de fila | `cursor-pointer` + `onRowClick`; no hay checkbox de selección múltiple |
| Padding celda | `px-4 py-3` (default) / `px-3 py-2` (compact) |
| Tamaño de texto | `text-sm` (default) / `text-[13px]` (compact) |
| Alineación vertical | `align-middle` |

### 13.5 Formato de contenido de celdas

Convenciones observadas, todas reutilizables:

| Tipo de dato | Render |
|---|---|
| Texto principal | `<span className="font-medium text-foreground">` |
| Texto secundario | `text-muted-foreground` |
| **Código / identificador** | Chip: `inline-block rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[12px] font-medium text-foreground` |
| **Número** | `block text-right tabular-nums`, con unidad pegada (`1.234 m`) |
| Número destacado | `+ font-medium text-foreground` |
| Número secundario | `+ text-muted-foreground` |
| Fecha | `formatearFecha()` → `DD/MM/YYYY` |
| Estado | `<StatusBadge tone="…">` |
| Vacío / nulo | `—` en `text-muted-foreground` |
| Dato adicional bajo el principal | `flex flex-col gap-1` + segunda línea `text-xs` |
| Acciones | Dropdown con trigger `<Button variant="ghost" size="icon"><MoreHorizontal /></Button>` |

### 13.6 Columna de acciones

```tsx
{
  id: 'acciones',
  header: '',                       // sin título
  cell: ({ row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={…}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={…}>
          <Trash2 className="mr-2 h-4 w-4" />Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
```

Reglas: cabecera vacía, última columna, `align="end"` en el menú, acciones destructivas
separadas por `DropdownMenuSeparator` y marcadas con `variant="destructive"`, items
condicionales según el estado de la fila.

### 13.7 Estado de carga — patrón de dos modos

Esta es una de las mejores decisiones de UX del sistema. **Cópiala.**

```ts
const isFirstLoad = loading && data.length === 0;   // aún no hay nada que enseñar
const showOverlay = loading && data.length  > 0;    // refrescando datos existentes
const isEmpty     = !loading && data.length === 0;
```

**Primera carga → filas skeleton** (6 filas, una `Skeleton h-3.5 w-[80%]` por celda),
que respetan el número de columnas y la densidad:

```tsx
<tr className="border-b border-border/60">
  <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-[80%]" /></td>
</tr>
```

**Recarga con datos → overlay**, sin desmontar la tabla:

```tsx
<div className="absolute inset-0 z-10 flex items-center justify-center
                bg-background/60 backdrop-blur-[1px] transition-opacity duration-200">
  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
</div>
<table className={cn('w-full border-collapse', showOverlay && 'opacity-60 transition-opacity duration-200')}>
```

Los datos anteriores siguen visibles al 60 % con un desenfoque de 1px y un spinner
centrado. **La tabla no salta, no cambia de altura y no parpadea** al aplicar un filtro.

### 13.8 Estado vacío

```tsx
<tr>
  <td colSpan={columns.length} className="p-0">
    <EmptyState titulo={mensajeVacio} className="m-6" />
  </td>
</tr>
```

Mensaje por defecto: `"No hay registros para mostrar"`. Cuando hay filtros activos, el
mensaje debe decirlo: `"No hay tramos que coincidan con los filtros."`, e idealmente
ofrecer una acción de limpiar filtros.

### 13.9 Paginación

**Variante A — servidor (dentro de `DataTable`):** bloque
`flex flex-wrap items-center justify-between gap-3 px-1`.

- Izquierda: `Mostrando <b>1–20</b> de <b>134</b> registros`, con las cifras en
  `font-medium text-foreground tabular-nums` y el resto en `text-muted-foreground`. Si
  `total === 0` → `"Sin registros"`.
- Derecha: cuatro icon buttons `variant="outline" size="icon" className="h-8 w-8"` —
  `ChevronsLeft`, `ChevronLeft`, indicador, `ChevronRight`, `ChevronsRight`.
- Indicador central: `px-3 text-sm tabular-nums` → `Página 2 de 7`; mientras carga
  muestra `<Loader2 className="inline h-4 w-4 animate-spin" />`.
- Botones deshabilitados en los extremos y durante la carga.

**Variante B — cliente (dentro de `DataPagination`):** dos botones `outline size="sm"`
con etiqueta (`Anterior` / `Siguiente`) y el indicador en medio; el bloque de controles
solo se renderiza si hay más de una página, y el texto informativo añade `(filtrados)`
cuando hay filtros activos.

No hay selector de "filas por página" en el origen. Si el destino lo necesita: `Select`
tamaño `sm` en la zona izquierda, junto al texto de conteo.

### 13.10 Densidad

| Densidad | Celda | Cabecera | Texto |
|---|---|---|---|
| `default` | `px-4 py-3` | `px-4 py-3` | `text-sm` |
| `compact` | `px-3 py-2` | `px-3 py-2.5` | `text-[13px]` |

`compact` para tablas de muchas columnas o vistas de auditoría.

### 13.11 Responsive de tablas

Estrategia del origen: **scroll horizontal** (`overflow-x-auto`) con
`whitespace-nowrap` en cabeceras. Simple y predecible.

Mejoras recomendadas para el destino (§21.4): ocultar columnas secundarias por
breakpoint (`hidden md:table-cell`), o cambiar a lista de cards en `<md` conservando los
mismos tokens.

---

## 14. MODALES Y SHEETS

El sistema tiene **dos superficies modales** con propósitos distintos:

| | `Dialog` | `Sheet` |
|---|---|---|
| Forma | Caja centrada | Panel lateral deslizante |
| Tamaño por defecto | `sm:max-w-sm` (384px) | `max-w-lg` (512px), lado derecho |
| Para | Confirmaciones, formularios cortos, avisos | **Formularios, configuración, detalles largos** |
| Animación | Fade + zoom | Slide desde el borde |
| Uso en el origen | Confirmaciones y modales pequeños | **La superficie dominante para formularios** |

### 14.1 `Dialog`

**Overlay:**

```
fixed inset-0 isolate z-50 bg-black/10 duration-100
supports-backdrop-filter:backdrop-blur-xs
data-open:animate-in data-open:fade-in-0
data-closed:animate-out data-closed:fade-out-0
```

Muy claro (`black/10`) + micro-desenfoque. **No** el clásico `bg-black/80`: el contenido
de detrás sigue siendo legible, lo que refuerza la sensación de "capa", no de "cortina".

**Contenido:**

```
fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)]
-translate-x-1/2 -translate-y-1/2 gap-4
rounded-xl bg-popover p-4 text-sm text-popover-foreground
ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
```

- Centrado con `top-1/2 left-1/2` + translate.
- `max-w-[calc(100%-2rem)]` — en móvil siempre queda 1rem de aire a cada lado.
- `rounded-xl`, `p-4`, `gap-4` entre header/body/footer.
- `ring-1 ring-foreground/10` en lugar de borde.
- Animación de 100 ms: fade + zoom del 95 %.

**Sub-componentes:**

| Parte | Estilo |
|---|---|
| `DialogHeader` | `flex flex-col gap-2` |
| `DialogTitle` | `font-heading text-base leading-none font-medium` |
| `DialogDescription` | `text-sm text-muted-foreground` |
| `DialogFooter` | `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end` |
| Botón de cerrar | `Button variant="ghost" size="icon-sm"` en `absolute top-2 right-2`, con `<span className="sr-only">Close</span>` |

**El footer sangra a los bordes** con `-mx-4 -mb-4`, se pinta con `bg-muted/50` y borde
superior: se convierte en una franja de acciones anclada abajo. Y `flex-col-reverse` en
móvil → la acción primaria queda arriba.

**Tamaños:** se ajustan con `className` (`sm:max-w-md`, `sm:max-w-2xl`, …). No hay prop
de tamaño.

**Cierre:** clic en overlay, `Escape`, botón X, o programático. Radix gestiona el
focus trap y la restauración del foco.

### 14.2 `Sheet` (drawer lateral)

```ts
side?: 'right' | 'left' | 'top' | 'bottom';        // default 'right'
size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; // default 'md'
showCloseButton?: boolean;                          // default true
```

Tamaños:

| `size` | Horizontal (`left`/`right`) | Vertical (`top`/`bottom`) |
|---|---|---|
| `sm` | `max-w-md` (448px) | `max-h-[40vh]` |
| `md` | `max-w-lg` (512px) | `max-h-[60vh]` |
| `lg` | `max-w-2xl` (672px) | `max-h-[80vh]` |
| `xl` | `max-w-3xl` (768px) | `max-h-[90vh]` |
| `2xl` | `max-w-5xl` (1024px) | `max-h-[95vh]` |
| `full` | `max-w-full` | `max-h-full` |

Siempre con `w-full` (u `h-full`) previo, de modo que en móvil ocupa todo el ancho.

**Overlay:** `bg-foreground/15 backdrop-blur-[1px]`, `duration-150`. Usa el color de
texto con opacidad en lugar de negro puro — encaja mejor con el neutro cálido.

**Contenido:**

```
fixed z-50 flex flex-col bg-card text-foreground shadow-lg outline-none duration-200
inset-y-0 right-0 h-full border-l
data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right
```

**Estructura de tres zonas — el patrón clave:**

```tsx
<SheetContent side="right" size="md">
  <SheetHeader>   {/* border-b border-border bg-card px-6 py-5 pr-12 */}
    <SheetTitle>…</SheetTitle>              {/* text-lg font-semibold tracking-tight */}
    <SheetDescription>…</SheetDescription>  {/* text-sm text-muted-foreground */}
  </SheetHeader>

  <SheetBody>     {/* flex-1 overflow-y-auto bg-background px-6 py-5 */}
    …contenido largo…
  </SheetBody>

  <SheetFooter>   {/* flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-4 */}
    <Button variant="outline">Cancelar</Button>
    <Button>Guardar</Button>
  </SheetFooter>
</SheetContent>
```

Tres detalles que hay que replicar:

1. **Header y footer fijos, body scrollable** (`flex-1 overflow-y-auto`).
2. El body usa **`bg-background`** mientras header y footer usan `bg-card`: el contraste
   sutil delimita las zonas sin necesidad de más bordes.
3. `pr-12` en el header reserva sitio para el botón de cerrar
   (`ghost icon-sm` en `absolute right-3 top-3 z-10`).

### 14.3 `ConfirmDialog` — confirmación reutilizable

```ts
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar?: string;               // default 'Confirmar'
  variante?: 'default' | 'destructive';
  onConfirmar: () => Promise<void> | void;
}
```

Comportamiento:

- Si `variante === 'destructive'`, el título lleva
  `<AlertTriangle className="h-5 w-5 text-destructive" />` delante.
- Gestiona el loading internamente: deshabilita ambos botones, muestra
  `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` y cierra el diálogo al terminar.
- Botones: `Cancelar` (`outline`) + acción (`default` o `destructive`), en ese orden.

**Regla:** toda acción destructiva pasa por `ConfirmDialog`. Nunca un `window.confirm()`,
nunca un borrado directo desde un menú.

### 14.4 Responsive de modales

- `Dialog`: `max-w-[calc(100%-2rem)]` garantiza márgenes en móvil; el footer se apila con
  la primaria arriba.
- `Sheet`: `w-full` + `max-w-*` → a pantalla completa en móvil, panel en desktop.
- **Recomendado para el destino:** en `<sm`, cambiar los sheets laterales a
  `side="bottom" size="lg"` (bottom sheet), que es el gesto natural en móvil.

---

## 15. DROPDOWNS, POPOVERS Y MENÚS

Los cuatro tipos de superficie flotante comparten la misma receta visual:

> `rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10`
> + animación de 100 ms (fade + zoom 95 % + desplazamiento de 2px desde el lado de origen)

### 15.1 `DropdownMenu`

**Contenido:**

```
z-50 max-h-(--radix-dropdown-menu-content-available-height)
w-(--radix-dropdown-menu-trigger-width) min-w-32
origin-(--radix-dropdown-menu-content-transform-origin)
overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1
text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100
data-[side=bottom]:slide-in-from-top-2  …  data-open:animate-in data-open:zoom-in-95
```

Detalles importantes:

- `sideOffset={4}` por defecto; `align="start"` (usar `align="end"` en menús de fila y de
  usuario).
- El menú **mide lo mismo que el trigger** por defecto (`w-(--radix-…-trigger-width)`),
  con mínimo `min-w-32`. Para anchos fijos, pasar `className="w-56"`.
- `max-h-(--radix-…-available-height)` — nunca se sale de la ventana; scrollea.
- `origin-(--radix-…-transform-origin)` — el zoom nace desde el trigger.
- La animación de entrada incluye un desplazamiento de 2px **desde el lado contrario** al
  que se abre.

**Items:**

| Elemento | Estilo |
|---|---|
| `DropdownMenuItem` | `relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm focus:bg-accent focus:text-accent-foreground data-disabled:opacity-50` |
| Variante destructiva | `data-[variant=destructive]:text-destructive` + `focus:bg-destructive/10` + icono en `text-destructive` |
| `DropdownMenuLabel` | `px-1.5 py-1 text-xs font-medium text-muted-foreground` |
| `DropdownMenuSeparator` | `-mx-1 my-1 h-px bg-border` |
| `DropdownMenuShortcut` | `ml-auto text-xs tracking-widest text-muted-foreground` |
| `CheckboxItem` / `RadioItem` | `py-1 pr-8 pl-1.5`; indicador `absolute right-2` |
| `SubTrigger` | igual que item + `<ChevronRightIcon className="ml-auto" />`; `data-open:bg-accent` |
| `SubContent` | igual que content, con `shadow-lg` |

Convenciones:

- El hover/foco se pinta con **`bg-accent`**, no con el color de marca.
- Los iconos se normalizan a 16px automáticamente; con texto se usa `mr-2`.
- El separador sangra fuera del padding (`-mx-1`) y toca los bordes del menú.
- **Los indicadores de check van a la derecha**, no a la izquierda (a diferencia de
  `Command`, donde van a la izquierda).

### 15.2 `Popover`

```
z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5
rounded-lg bg-popover p-2.5 text-sm text-popover-foreground
shadow-md ring-1 ring-foreground/10 outline-hidden duration-100
```

- `w-72` (288px) por defecto, `align="center"`, `sideOffset={4}`.
- Es un contenedor **flex column con `gap-2.5`**: los hijos se separan solos.
- Sub-componentes: `PopoverHeader` (`flex flex-col gap-0.5 text-sm`), `PopoverTitle`
  (`font-medium`), `PopoverDescription` (`text-muted-foreground`).
- Para meter un `Command` dentro: `className="w-full p-0"` o
  `w-[var(--radix-popover-trigger-width)] p-0`.

### 15.3 `HoverCard`

Idéntico al popover pero `w-64` (256px) y activado por hover. Para previsualizaciones
informativas, nunca para acciones.

### 15.4 `Command` (paleta / lista buscable)

```
flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground
```

| Parte | Estilo |
|---|---|
| `CommandInput` | Dentro de un `InputGroup` de `h-8 rounded-lg border-input/30 bg-input/30` con lupa a la izquierda |
| `CommandList` | `max-h-72 scroll-py-1 overflow-y-auto no-scrollbar` |
| `CommandEmpty` | `py-6 text-center text-sm` |
| `CommandGroup` | `p-1`; cabecera `px-2 py-1.5 text-xs font-medium text-muted-foreground` |
| `CommandItem` | `rounded-sm px-2 py-1.5 text-sm data-selected:bg-muted data-selected:text-foreground` |
| `CommandSeparator` | `-mx-1 h-px bg-border` |
| `CommandDialog` | `Dialog` con `top-1/3 translate-y-0 p-0` y sin botón de cerrar |

**`CommandDialog` se ancla a `top-1/3`**, no al centro: es la posición canónica de una
paleta de comandos. Si el destino añade búsqueda global (`⌘K`), este es el componente.

### 15.5 Posicionamiento — reglas generales

| Caso | Configuración |
|---|---|
| Menú de acciones de fila | `align="end"` |
| Menú de usuario | `align="end" className="w-56"` |
| Dropdown de filtro / combobox | `align="start"`, ancho = trigger |
| Popover informativo | `align="center"` |
| Submenú | lateral automático (Radix) |

Radix hace el *collision detection*: si no cabe abajo, se abre arriba, y la animación se
adapta al lado real (`data-[side=*]`).

---

## 16. BADGES Y ESTADOS SEMÁNTICOS

### 16.1 Primitivo `Badge`

```
group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1
overflow-hidden rounded-full border border-transparent px-2 py-0.5
text-[11px] font-medium leading-none whitespace-nowrap transition-all
[&>svg]:size-3!
```

| Aspecto | Valor |
|---|---|
| Alto | `20px` (`h-5`) fijo |
| Forma | `rounded-full` (pill) |
| Texto | `11px`, `font-medium`, `leading-none` |
| Padding | `px-2 py-0.5` |
| Icono interno | forzado a `12px` |
| Borde | `border-transparent` de base (las variantes soft lo colorean) |

### 16.2 Variantes

**Neutras:**

| Variante | Clases |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `outline` | `border-border bg-card text-foreground` |
| `ghost` | `text-muted-foreground hover:bg-muted hover:text-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

**Semánticas soft (las recomendadas):**

| Variante | Clases |
|---|---|
| `success` | `bg-success-soft text-success-soft-foreground border-success/15` |
| `warning` | `bg-warning-soft text-warning-soft-foreground border-warning/15` |
| `info` | `bg-info-soft text-info-soft-foreground border-info/15` |
| `brand` | `bg-brand-soft text-brand-soft-foreground border-brand/15` |
| `destructive` | `bg-destructive-soft text-destructive-soft-foreground` |

**Semánticas sólidas (uso escaso):** `solid-success`, `solid-warning`, `solid-info`,
`solid-brand` → `bg-{tono} text-{tono}-foreground`.

**El borde al 15 %** (`border-success/15`) es el detalle que hace que las variantes soft
no se vean como manchas: define el contorno sin competir con el relleno.

### 16.3 `StatusBadge` — el componente canónico de estado

```ts
type StatusTone = 'success' | 'warning' | 'info' | 'destructive' | 'brand' | 'neutral';

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  withDot?: boolean;              // default true
  variant?: 'soft' | 'solid';     // default 'soft'
}
```

Render: `<Badge variant={…} className="gap-1.5 px-2 py-0.5">` con un punto de 6px
(`h-1.5 w-1.5 rounded-full`) del color base del tono, seguido del texto.

Color del punto por tono: `bg-success` / `bg-warning` / `bg-info` / `bg-destructive` /
`bg-brand` / `bg-muted-foreground`. En variante `solid`, el punto pasa a
`bg-current opacity-90`. El tono `neutral` mapea a la variante `secondary`.

**El punto es lo que hace escaneable la columna de estado**: aunque haya seis etiquetas
distintas, el ojo lee primero los colores.

### 16.4 Mapa semántico genérico (aplicable a cualquier dominio)

| Tono | Significado universal | Ejemplos de etiqueta |
|---|---|---|
| `success` | Estado final positivo, operativo, activo | Activo, Completado, Operativo, Aprobado, Publicado |
| `warning` | Requiere atención, en espera, transitorio | Pendiente, En revisión, Programado, Borrador, Por vencer |
| `info` | En progreso, informativo, neutro-activo | En proceso, En curso, Enviado, Asignado |
| `destructive` | Fallo, bloqueo, cancelación, crítico | Error, Rechazado, Cancelado, Vencido, Fuera de servicio |
| `brand` | Destacado, especial, premium | Destacado, Nuevo, Prioritario |
| `neutral` | Inactivo, archivado, sin dato | Inactivo, Archivado, N/A, Sin definir |

> **El proyecto destino define sus propios nombres de estado**, pero debe respetar este
> mapa tono → significado. Es lo que hace que un usuario entienda la interfaz sin leer.

### 16.5 Contadores y chips

**Contador de filtros activos:**

```tsx
<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full
                 bg-brand-soft px-1.5 text-[11px] font-semibold tabular-nums
                 text-brand-soft-foreground">
  {activeCount}
</span>
```

`min-w` + `justify-center` hacen que 1 y 99 se vean igual de equilibrados.

**Contador en pestaña:**

```tsx
<span className="inline-flex min-w-[22px] items-center justify-center rounded-full
                 bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground
                 group-data-[state=active]:bg-background/20
                 group-data-[state=active]:text-background">
```

Cambia de color cuando la pestaña está activa (fondo invertido).

**Chip de resumen (`WizardSummary`):**

```tsx
<li className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-tight
               bg-success-soft text-success-soft-foreground border-success/20">
```

Tres tonos: `completed` (success soft), `current` (brand soft + `ring-2 ring-brand/15`),
`pending` (`bg-card text-muted-foreground border-border`).

**Punto pulsante para "en curso":**

```tsx
<span className="relative flex h-2 w-2">
  <span className="absolute inset-0 animate-pulse-subtle rounded-full bg-brand opacity-75" />
  <span className="relative h-2 w-2 rounded-full bg-brand" />
</span>
```

---

## 17. ALERTAS Y NOTIFICACIONES

### 17.1 Toasts (`sonner`) — el canal principal de feedback

Montaje, hermano del router:

```tsx
<Toaster richColors position="top-right" />
```

Configuración del componente:

```tsx
<Sonner
  theme={theme}
  className="toaster group"
  icons={{
    success: <CircleCheckIcon className="size-4" />,
    info:    <InfoIcon className="size-4" />,
    warning: <TriangleAlertIcon className="size-4" />,
    error:   <OctagonXIcon className="size-4" />,
    loading: <Loader2Icon className="size-4 animate-spin" />,
  }}
  style={{
    '--normal-bg':     'var(--popover)',
    '--normal-text':   'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
    '--border-radius': 'var(--radius)',
  }}
/>
```

| Aspecto | Valor |
|---|---|
| Posición | **`top-right`** |
| Colores | `richColors` (sonner tiñe según el tipo) |
| Superficie | Tokens del sistema: `popover`, `border`, `--radius` |
| Iconos | **lucide, no los de sonner** — coherencia con el resto |
| Duración | Por defecto de sonner (~4 s); los errores persisten más |
| Cierre | Automático, o clic / swipe |

### 17.2 Cuándo usar cada tipo

| Tipo | Cuándo | Ejemplo de copy |
|---|---|---|
| `toast.success` | Mutación completada | `'Usuario desactivado'`, `'Sesión cerrada'` |
| `toast.error` | Fallo de operación o de red | `'Correo o contraseña incorrectos'` |
| `toast.info` | Información no crítica | `'Se aplicaron los filtros guardados'` |
| `toast.warning` | Aviso que no bloquea | `'Algunas filas se omitieron'` |
| `toast.loading` | Operación larga, luego se resuelve | usar `toast.promise` |

**Copy de toasts:** corto, en pasado, sin punto final, sin "¡". Describe **lo que pasó**,
no lo que hizo el usuario: `'Usuario desactivado'`, no `'Has desactivado el usuario'`.

### 17.3 Integración automática con mutaciones

El sistema envuelve las mutaciones para que el feedback sea automático y uniforme:

```ts
export function useApiMutation<TData, TVariables>(options) {
  const { mensajeExito, mostrarToastError = true, onSuccess, onError, ...rest } = options;
  return useMutation({
    ...rest,
    onSuccess: (data, vars, ctx) => {
      if (mensajeExito) toast.success(mensajeExito);
      onSuccess?.(data, vars, ctx);
    },
    onError: (error, vars, ctx) => {
      if (mostrarToastError) toast.error(extraerMensajeError(error));
      onError?.(error, vars, ctx);
    },
  });
}
```

**Este patrón es de los más valiosos del sistema.** Garantiza que ninguna operación falle
en silencio y que ningún desarrollador tenga que acordarse de poner un toast.
Reprodúcelo con el equivalente del stack de destino.

### 17.4 Banners inline

Para confirmaciones contextuales que deben permanecer (no desaparecer como un toast):

```tsx
<div className="flex items-center justify-between gap-4 rounded-md border
                border-success/20 bg-success-soft p-3">
  <p className="text-sm font-medium text-success-soft-foreground">
    ✓ Registro creado (#123). Puedes adjuntar archivos o ir al detalle.
  </p>
  <Button size="sm" variant="outline">Ir al detalle</Button>
</div>
```

Estructura: `rounded-md`, fondo `-soft`, borde `/20`, `p-3`, mensaje a la izquierda y
acción a la derecha. Mismo esqueleto para las cuatro familias semánticas.

> Nota: en el origen este banner está escrito con colores crudos
> (`border-green-200 bg-green-50 text-green-800`). **La versión con tokens de arriba es la
> correcta** — ver §28.

### 17.5 Alerta inline en formulario / sección

Para avisos dentro de un formulario o panel:

```tsx
<div className="flex items-start gap-2.5 rounded-lg border border-warning/20
                bg-warning-soft px-3.5 py-3">
  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-soft-foreground" />
  <div className="min-w-0 text-[13px] text-warning-soft-foreground">
    <p className="font-medium">Título del aviso</p>
    <p className="mt-0.5 opacity-90">Explicación de una o dos líneas.</p>
  </div>
</div>
```

`items-start` + `mt-0.5` en el icono lo alinea con la primera línea de texto, no con el
centro del bloque.

### 17.6 Jerarquía de feedback

| Gravedad | Canal |
|---|---|
| Confirmación efímera de una acción | Toast |
| Información persistente sobre el contexto | Banner inline |
| Error que impide continuar en un campo | Mensaje bajo el campo + `aria-invalid` |
| Fallo de carga de una sección | `ErrorState` con botón de reintentar (§20) |
| Decisión irreversible | `ConfirmDialog` (§14.3) |

---

## 18. ICONOGRAFÍA

### 18.1 Librería

**`lucide-react`** — exclusivamente. Trazo de 2px (`strokeWidth={2}` por defecto),
esquinas redondeadas, geometría uniforme. Ningún otro set de iconos aparece en el
sistema, y esa exclusividad es parte de la coherencia.

Excepción documentada: el timeline usa **emoji** como marcadores de evento
(📍 🔧 ⏱️ ✅ ❌ ❓). Es una inconsistencia (§28); la versión correcta usa iconos lucide
dentro del mismo círculo.

### 18.2 Tamaños por contexto

| Contexto | Tamaño | Clases |
|---|---|---|
| Icono dentro de botón `sm` | **14px** | `h-3.5 w-3.5` |
| Icono dentro de botón `default` | **16px** | `h-4 w-4` (o automático por `[&_svg]:size-4`) |
| Icono dentro de botón `xs` | 12px | `h-3 w-3` |
| Item de navegación (sidebar) | 16px | `h-4 w-4 shrink-0` |
| Sub-item de navegación | 14px | `h-3.5 w-3.5 shrink-0` |
| Icono en badge | 12px | forzado por `[&>svg]:size-3!` |
| Icono de ordenación en tabla | 12px | `h-3 w-3` |
| Chip de icono de KPI | 20px sobre chip de 40px | `h-5 w-5` en `h-10 w-10` |
| Icono de estado vacío | 20 / 28 / 32px sobre círculo de 40 / 56 / 64px | por `size` |
| Icono hero de wizard | 24px sobre chip de 56px | `h-6 w-6` en `h-14 w-14` |
| Icono de menú hamburguesa | 20px | `h-5 w-5` |
| Separador de breadcrumb | 12px | `h-3 w-3` |
| Icono de toast | 16px | `size-4` |

**Regla general:** el icono es siempre **un paso menor** que el texto que acompaña, salvo
en chips decorativos.

### 18.3 Relación icono / texto

| Situación | Separación |
|---|---|
| Icono + texto en botón `sm` | `mr-1.5` (6px) |
| Icono + texto en botón `default` | `mr-2` (8px) |
| Icono + texto en item de menú | `mr-2` (8px) |
| Icono + texto en item de navegación | `gap-3` (12px) |
| Icono + texto en sub-item | `gap-2.5` (10px) |
| Icono + texto en badge | `gap-1` / `gap-1.5` |
| Icono + label de sección | `gap-2` (8px) |

`shrink-0` en **todo** icono dentro de un contenedor flex: nunca debe deformarse cuando
el texto es largo.

### 18.4 Colores de icono

| Contexto | Color |
|---|---|
| Icono decorativo / secundario | `text-muted-foreground` |
| Icono en botón | hereda del botón (`currentColor`) |
| Icono en item activo del sidebar | hereda (`text-white`) |
| Icono en chip de tono | `text-{tono}-soft-foreground` |
| Icono de error | `text-destructive` |
| Icono de acción destructiva en menú | `text-destructive` (automático por `data-[variant=destructive]`) |
| Icono ordenación inactivo | `opacity-40` |

### 18.5 Semántica de iconos — vocabulario reutilizable

Este mapeo es de dominio neutro y se puede copiar tal cual:

| Acción / concepto | Icono |
|---|---|
| Crear / añadir | `Plus` |
| Editar | `Pencil` |
| Eliminar | `Trash2` |
| Buscar | `Search` |
| Limpiar / cerrar | `X` |
| Filtros | `SlidersHorizontal` / `Filter` |
| Configurar | `Settings2` |
| Más acciones | `MoreHorizontal` |
| Descargar / exportar | `Download` |
| Subir / importar | `Upload` |
| Refrescar / reintentar | `RefreshCw` |
| Expandir / colapsar | `ChevronDown` / `ChevronUp` / `ChevronRight` |
| Navegación de páginas | `ChevronLeft` / `ChevronRight` / `ChevronsLeft` / `ChevronsRight` |
| Selector (combobox) | `ChevronsUpDown` |
| Ordenar | `ChevronsUpDown` / `ChevronUp` / `ChevronDown` |
| Confirmado / seleccionado | `Check` |
| Usuario | `User` / `Users` |
| Cerrar sesión | `LogOut` |
| Menú móvil | `Menu` |
| Éxito | `CircleCheck` |
| Información | `Info` |
| Advertencia | `TriangleAlert` |
| Error | `OctagonX` / `AlertCircle` |
| Cargando | `Loader2` + `animate-spin` |
| Estado vacío | `Inbox` |
| Historial | `History` |
| Analítica / gráficos | `BarChart3` |
| Tendencia | `ArrowUpRight` / `ArrowDownRight` / `Minus` |

### 18.6 Icon buttons

```tsx
<Button variant="ghost" size="icon" aria-label="Más acciones">
  <MoreHorizontal className="h-4 w-4" />
</Button>
```

- **`aria-label` obligatorio** en todo botón sin texto.
- Variante habitual: `ghost` (en tablas y toolbars) u `outline` (en paginación).
- Tamaños: `icon-xs` (24), `icon-sm` (28), `icon` (32), `icon-lg` (36) — cuadrados
  perfectos.

---

## 19. ESTADOS DE INTERACCIÓN

Tabla maestra del comportamiento visual. Es la referencia rápida para cualquier
componente nuevo.

| Componente | Default | Hover | Focus (teclado) | Active | Selected | Disabled | Loading |
|---|---|---|---|---|---|---|---|
| **Botón primario** | `bg-primary` | `bg-primary/80` | `border-ring` + `ring-3 ring-ring/50` | `translate-y-px` | — | `opacity-50` + `pointer-events-none` | Spinner + label en gerundio + `disabled` |
| **Botón outline** | `border-border bg-background` | `bg-muted` | idem | `translate-y-px` | `aria-expanded:bg-muted` | idem | idem |
| **Botón ghost** | transparente | `bg-muted` | idem | `translate-y-px` | `aria-expanded:bg-muted` | idem | idem |
| **Botón destructivo** | `bg-destructive/10 text-destructive` | `bg-destructive/20` | `ring-destructive/20` | `translate-y-px` | — | idem | idem |
| **Input / Textarea** | `border-input bg-transparent` | — | `border-ring` + `ring-3 ring-ring/50` | — | — | `bg-input/50 opacity-50 cursor-not-allowed` | — |
| **Input inválido** | `aria-invalid` → `border-destructive` + `ring-3 ring-destructive/20` | — | idem | — | — | — | — |
| **Select trigger** | `border-input` | — | `border-ring` + `ring-3` | — | `data-placeholder:text-muted-foreground` | `opacity-50 cursor-not-allowed` | — |
| **Fila de tabla** | `border-b border-border/60` | `bg-muted/40` | — | — | (no hay selección múltiple) | — | overlay + `opacity-60` |
| **Cabecera ordenable** | `text-muted-foreground` | `text-foreground` | — | icono `text-foreground` | — | `disabled` sin icono | — |
| **Item de menú** | transparente | `bg-accent text-accent-foreground` | idem (`focus:`) | — | check a la derecha | `opacity-50` + `pointer-events-none` | — |
| **Item destructivo de menú** | `text-destructive` | `bg-destructive/10` | idem | — | — | idem | — |
| **Item de sidebar** | `text-sidebar-foreground/70` | `bg-sidebar-accent/50 text-white` | anillo `sidebar-ring` | — | `bg-sidebar-accent text-white` + barra brand 3px | — | — |
| **Sub-item de sidebar** | `text-sidebar-foreground/55` | `bg-sidebar-accent/40 text-white` | idem | — | `bg-sidebar-accent text-white` | — | — |
| **Tab** | `text-muted-foreground` | `bg-muted/60 text-foreground` | `focus-visible:outline-none` (+ anillo propio) | — | `bg-foreground text-background` | `opacity-50` + `pointer-events-none` | — |
| **Card clicable** | `.surface` | `border-border-strong` + `shadow` | — | — | — | — | Skeleton interno |
| **Trigger de configuración (barra)** | `border-border bg-card shadow-sm` | `border-border-strong bg-muted/40` | `border-brand` + `ring-2 ring-brand/15` | — | — | — | — |
| **Botón de logout (sidebar)** | `bg-sidebar-accent/40` | `bg-sidebar-accent text-white` | — | `translate-y-px` | — | — | — |
| **Paso de stepper** | `border-border bg-card text-muted-foreground` | `scale-105` si clicable | — | — | `bg-brand text-brand-foreground` + `ring-4 ring-brand/15` | `cursor-default` | — |

### 19.1 Principios transversales

1. **El hover nunca cambia el tamaño ni la posición** (excepto el `scale-105` de los pasos
   del stepper, que es un affordance deliberado). Solo cambia color/fondo/sombra.
2. **`transition-colors` o `transition-all` siempre**, para que ningún cambio sea brusco.
3. **El foco de teclado se distingue del hover**: usa anillo, no fondo. Y siempre
   `focus-visible`, nunca `focus` (para no molestar al clic con ratón).
4. **`active:translate-y-px` es la firma táctil.** Todos los botones lo tienen, salvo los
   que abren menús.
5. **Disabled = `opacity-50` + `pointer-events-none`.** Nunca se cambia el color: se baja
   la opacidad, así el disabled se lee igual sobre cualquier fondo.
6. **Dos niveles de opacidad para jerarquía en el sidebar** (`/70` padre, `/55` hijo). El
   hover lleva a blanco puro en ambos.
7. **El foco con color de marca** (`ring-brand/15`) se reserva para controles custom
   (date input, trigger de configuración); los primitivos usan `ring-ring/50`.

---

## 20. LOADING / EMPTY / ERROR STATES

Los tres estados comparten una **misma anatomía**, lo que hace que la app se sienta
coherente incluso cuando no hay nada que mostrar.

```
        ┌─────────┐
        │  icono  │   círculo, centrado
        └─────────┘
        Título          font-semibold
        Descripción     text-muted-foreground, max-w limitado
        [ Acción ]      opcional, mt-5
```

### 20.1 `EmptyState`

```ts
interface EmptyStateProps {
  titulo?: string;        // 'No hay datos'
  subtitulo?: string;     // 'No se encontraron registros para mostrar'
  icon?: LucideIcon;      // Inbox
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
```

```tsx
<div className="flex flex-col items-center justify-center text-center py-12 px-6">
  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full
                  border border-border bg-muted/60 text-muted-foreground">
    <Icon className="h-7 w-7" />
  </div>
  <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
  <p className="mt-1 max-w-[36ch] text-sm text-muted-foreground">{subtitulo}</p>
  {action && <div className="mt-5">{action}</div>}
</div>
```

Escala por tamaño:

| `size` | Padding | Círculo | Icono | Título | Uso |
|---|---|---|---|---|---|
| `sm` | `py-8 px-6` | `h-10 w-10` | `h-5 w-5` | `text-sm` | Dentro de celdas, listas compactas |
| `md` | `py-12 px-6` | `h-14 w-14` | `h-7 w-7` | `text-sm` | **Default** — tablas, secciones |
| `lg` | `py-20 px-6` | `h-16 w-16` | `h-8 w-8` | `text-base` | Página entera vacía |

**El detalle:** `max-w-[36ch]` en la descripción. Limitar por número de caracteres (no por
píxeles) mantiene siempre una línea de lectura cómoda.

### 20.2 `ErrorState`

Misma anatomía, con tres cambios:

| Aspecto | Diferencia |
|---|---|
| Círculo | `bg-destructive-soft text-destructive-soft-foreground` — **sin borde** |
| Icono | `AlertCircle` |
| Acción | Botón `outline size="sm"` con `<RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reintentar` |
| Ancho de descripción | `max-w-[44ch]` (los errores necesitan explicar más) |

Textos por defecto: `'No se pudo cargar la información'` /
`'Hubo un problema al obtener los datos. Por favor intentá nuevamente.'`

**Copy de errores:** describe el problema y ofrece salida. Nunca muestres el error crudo
de la API ni códigos HTTP al usuario.

### 20.3 `LoadingSpinner`

```tsx
<div className="flex items-center gap-2 text-muted-foreground">
  <div className="animate-spin rounded-full border-2 border-muted-foreground/20
                  border-t-muted-foreground h-6 w-6" />
  {texto && <span className="text-sm">{texto}</span>}
</div>
```

- Anillo CSS (no un SVG): borde al 20 % con la parte superior sólida.
- Tamaños: `sm` 16px, `md` 24px, `lg` 32px.
- `fullPage` → se envuelve en `flex items-center justify-center min-h-[400px]`.

Alternativa igual de válida y muy usada: `<Loader2 className="h-6 w-6 animate-spin" />`.

### 20.4 `Skeleton`

```tsx
<div className="animate-pulse rounded-md bg-muted" />
```

Primitivo mínimo: el consumidor le da tamaño con clases (`h-3 w-20`, `h-8 w-24`…).

**Regla de oro del skeleton:** debe reproducir la **forma real** del contenido que va a
llegar, no un rectángulo genérico. El sistema lo aplica de forma consistente:

| Skeleton | Forma |
|---|---|
| `StatCard` | 3 barras: `h-3 w-20`, `h-8 w-24`, `h-3 w-32` — label, valor, helper |
| Tabla | 6 filas × N columnas, cada celda `h-3.5 w-[80%]` |
| Gráfico | 12 barras verticales de altura variable + 3 barritas de leyenda |
| Panel | bloque con cabecera `h-4 w-48` + cuerpo `bg-muted/60` |

### 20.5 Matriz de decisión

| Situación | Qué mostrar |
|---|---|
| Primera carga de una tabla | Filas skeleton |
| Primera carga de un KPI | `StatCard loading` |
| Primera carga de un gráfico | Skeleton de gráfico |
| Primera carga de una página entera | `LoadingSpinner fullPage` |
| **Recarga con datos ya visibles** | **Overlay semitransparente + spinner (no skeleton)** |
| Sin resultados por filtros | `EmptyState` con mensaje específico + acción "Limpiar filtros" |
| Sin datos nunca creados | `EmptyState` + acción "Crear el primero" |
| Fallo de carga | `ErrorState` con `onRetry` |
| Fallo de una mutación | Toast de error (la vista no cambia) |
| Ruta inexistente | Redirección a la home |

**La distinción más importante:** primera carga → skeleton; recarga → overlay. Reemplazar
datos visibles por skeletons produce parpadeo y pérdida de contexto.

---

## 21. RESPONSIVE DESIGN

### 21.1 Breakpoints

Los de Tailwind por defecto, sin personalizar:

| Prefijo | Ancho mínimo | Uso en el sistema |
|---|---|---|
| *(base)* | 0 | Móvil |
| `sm:` | **640px** | Header de página a fila; rejillas a 2 columnas; footers de modal a fila |
| `md:` | **768px** | Rejillas de detalle (3–4 columnas); ocultar hamburguesa; `md:text-sm` en inputs |
| `lg:` | **1024px** | Padding a 32px; rejillas a 3–4 columnas; splits de 2 paneles |
| `xl:` | **1280px** | Rejillas de 3 gráficos o 6 filtros |
| `2xl:` | 1536px | Contenedor a 1400px |

Punto de corte real de la app: **`lg` (1024px)** es donde el layout de escritorio se
completa.

### 21.2 Sidebar — estado real y patrón recomendado

**Estado real:** el sidebar **no es responsive**. Se renderiza siempre como columna fija
de 260px, en cualquier tamaño de pantalla. En un móvil de 375px consume el 69 % del ancho.
El componente ya acepta `onClose`, y el `Header` (sin montar) ya tiene el botón
hamburguesa: la pieza que falta es el drawer.

**Patrón recomendado** (mismo componente `Sidebar`, dos contenedores):

```tsx
export function AppShell() {
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Escritorio: columna fija */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Móvil: drawer */}
      <Sheet open={drawerAbierto} onOpenChange={setDrawerAbierto}>
        <SheetContent side="left" size="sm" showCloseButton={false}
                      className="w-[260px] border-0 p-0">
          <Sidebar onClose={() => setDrawerAbierto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setDrawerAbierto(true)} />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto min-h-full w-full max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
```

| Breakpoint | Comportamiento |
|---|---|
| `< md` (768px) | Sidebar oculto; se abre como drawer desde la izquierda sobre overlay; se cierra al navegar (`onClose` en cada link) |
| `>= md` | Columna fija de 260px, siempre visible |
| Opcional `>= xl` | Botón de colapso a modo iconos (64px), ver §7.6 |

El `Sheet` ya aporta overlay, foco atrapado, cierre con `Escape` y animación de slide.

### 21.3 Contenido y padding

| Breakpoint | Padding horizontal |
|---|---|
| base | `px-6` (24px) — **recomendado bajar a `px-4` en móvil** |
| `lg:` | `px-8` (32px) |

El `max-w-[1500px]` solo actúa por encima de ~1560px; por debajo, el contenido es fluido.

### 21.4 Tablas

**Estado real:** `overflow-x-auto` — la tabla scrollea dentro de su marco. Correcto y
suficiente, pero mejorable.

**Patrones recomendados, por orden de preferencia:**

1. **Ocultar columnas secundarias por breakpoint** (mejor relación esfuerzo/resultado):
   ```tsx
   { accessorKey: 'creadoEn', header: 'Creado',
     meta: { className: 'hidden lg:table-cell' } }
   ```
   Mantener siempre visibles: identificador, nombre, estado y acciones.

2. **Cambiar a lista de cards en `<md`:**
   ```tsx
   <div className="md:hidden divide-y divide-border/60">
     {rows.map(r => (
       <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
         <div className="min-w-0">
           <p className="truncate text-sm font-medium text-foreground">{r.nombre}</p>
           <p className="truncate text-xs text-muted-foreground">{r.detalle}</p>
         </div>
         <StatusBadge tone={r.tono}>{r.estado}</StatusBadge>
       </div>
     ))}
   </div>
   <div className="hidden md:block"><DataTable … /></div>
   ```

3. Mantener el scroll horizontal para tablas de datos densos donde la comparación
   columna a columna es el objetivo.

### 21.5 Rejillas — comportamiento por breakpoint

| Rejilla | Base | `sm:` | `md:` | `lg:` | `xl:` |
|---|---|---|---|---|---|
| KPIs (3) | 1 col | 2 col | — | 3 col | — |
| KPIs (4) | 1 col | 2 col | — | 4 col | — |
| Gráficos (`ChartGrid` 2) | 1 col | — | — | 2 col | — |
| Gráficos (`ChartGrid` 3) | 1 col | — | 2 col | — | 3 col |
| Filtros (`FiltersGrid` 4) | 1 col | 2 col | — | 4 col | — |
| Filtros (`FiltersGrid` 6) | 1 col | 2 col | — | 3 col | 6 col |
| Campos de detalle | 1 col | — | 3–4 col | — | — |
| Split mapa/lista | 1 col | — | — | `5fr 7fr` | — |

Todas con `gap-4` (`gap-3` en campos de detalle).

### 21.6 Header de página, formularios y modales

- **`PageHeader`**: `flex-col gap-4` en móvil → `sm:flex-row sm:items-end sm:justify-between`.
  Las acciones caen debajo del título en móvil.
- **Formularios**: una columna siempre. Si un formulario ancho necesita dos columnas,
  usar `grid gap-4 sm:grid-cols-2` y dejar en `col-span-2` los campos largos.
- **Inputs**: `text-base md:text-sm` — 16px en móvil evita el zoom de iOS.
- **`Dialog`**: `max-w-[calc(100%-2rem)]` + footer `flex-col-reverse` → primaria arriba.
- **`Sheet`**: `w-full max-w-lg` → pantalla completa en móvil. Recomendado:
  `side="bottom"` en `<sm`.
- **`SectionTabs`**: la lista de pestañas ya scrollea horizontalmente
  (`overflow-x-auto flex-nowrap`), lo que funciona bien en móvil.

### 21.7 Checklist responsive para el proyecto destino

- [ ] Sidebar → drawer por debajo de `md`
- [ ] Header con hamburguesa montado
- [ ] `px-4` en móvil, `px-6` en `sm`, `px-8` en `lg`
- [ ] Inputs con `text-base md:text-sm`
- [ ] Tablas: columnas secundarias ocultas o vista de cards en `<md`
- [ ] Footers de modal con `flex-col-reverse` en móvil
- [ ] Objetivos táctiles de al menos 32px (los icon buttons `icon` cumplen; evitar
      `icon-xs` como única acción en móvil)
- [ ] Nada con `overflow-x` a nivel de página: solo dentro de contenedores

---

## 22. TRANSICIONES Y ANIMACIONES

### 22.1 Duraciones

| Duración | Uso |
|---|---|
| **100 ms** | Aparición de superficies flotantes (dropdown, popover, dialog, select) |
| **150 ms** | Overlay de sheet |
| **200 ms** | Slide de sheet; fundido del overlay de tabla; transición de tab |
| **220 ms** | `fade-in` de entrada de contenido |
| **280 ms** | `slide-up` de entrada de contenido |
| **400 ms** | Animación de series de gráfico |
| **2.4 s** | `pulse-subtle` (bucle) |
| *(por defecto)* | `transition-colors` en hovers — el default de Tailwind (150 ms) |

**Nada dura más de 300 ms** salvo los bucles y los gráficos. La interfaz responde
inmediatamente.

### 22.2 Curvas

| Curva | Uso |
|---|---|
| `ease-out` | Entradas (fade-in, slide-down) |
| `cubic-bezier(0.16, 1, 0.3, 1)` | `slide-up` — *ease-out expo*, arranque rápido y frenada larga; la curva "premium" del sistema |
| `ease-in-out` | Bucles (`pulse-subtle`) |
| `linear` | Spinners |

### 22.3 Keyframes definidos

```js
keyframes: {
  'fade-in':      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
  'slide-up':     { '0%': { opacity: '0', transform: 'translateY(4px)' },  '100%': { opacity: '1', transform: 'translateY(0)' } },
  'slide-down':   { '0%': { opacity: '0', transform: 'translateY(-4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
  'pulse-subtle': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
},
animation: {
  'fade-in':      'fade-in 220ms ease-out',
  'slide-up':     'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
  'slide-down':   'slide-down 220ms ease-out',
  'pulse-subtle': 'pulse-subtle 2.4s ease-in-out infinite',
},
```

**Los desplazamientos son de 4px.** No 20px, no 40px. El movimiento se insinúa; el peso
de la animación lo lleva la opacidad.

### 22.4 Animaciones de Radix (`tw-animate-css`)

Los primitivos usan atributos de estado:

```
data-open:animate-in  data-open:fade-in-0  data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
data-[side=bottom]:slide-in-from-top-2
data-[side=top]:slide-in-from-bottom-2
data-[side=left]:slide-in-from-right-2
data-[side=right]:slide-in-from-left-2
```

- `zoom-in-95` — el elemento nace al 95 % de su tamaño.
- `slide-in-from-*-2` — 8px de desplazamiento, **desde el lado contrario a donde se abre**
  (si se abre hacia abajo, entra desde arriba).
- `origin-(--radix-*-transform-origin)` — el zoom nace desde el punto del trigger.

### 22.5 Micro-interacciones

| Interacción | Efecto |
|---|---|
| Pulsar un botón | `active:translate-y-px` |
| Hover en card clicable | `hover:border-border-strong hover:shadow` |
| Hover en fila de tabla | `hover:bg-muted/40` |
| Hover en paso de stepper clicable | `hover:scale-105` |
| Recarga de tabla | `opacity-60` + `backdrop-blur-[1px]` + spinner |
| Expandir grupo del sidebar | Rotación del chevron (cambio de icono) |
| Entrada de paso de wizard | `.anim-fade-in` |
| Indicador "en curso" | `animate-pulse-subtle` |
| Skeleton | `animate-pulse` |

### 22.6 Recomendación de accesibilidad

El origen **no implementa** `prefers-reduced-motion`. El destino debería:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 23. GRÁFICOS Y VISUALIZACIÓN DE DATOS

### 23.1 Envoltorio

Todo gráfico va dentro de un `ChartCard` (§12.4), que resuelve header, acciones, loading
y vacío de forma uniforme. Nunca un `<canvas>`/`<svg>` suelto en la página.

### 23.2 Paleta

Usar **`--chart-1` … `--chart-5`** (§2.2) en ese orden. Para más de 5 series, repetir la
secuencia variando la luminosidad (±10 %) en lugar de introducir colores nuevos.

Reglas:

- Serie única → `chart-1` (el teal de marca).
- Series comparables → orden de la paleta.
- Series con significado semántico (bueno/malo) → usar los tokens de estado
  (`success` / `destructive`), no la paleta de gráficos.

> El origen usa en varios gráficos una paleta hexadecimal cruda
> (`#0284c7`, `#16a34a`, `#d97706`, `#e11d48`, …), más saturada que la del sistema. **Es
> una inconsistencia** (§28): el destino debe usar los tokens `--chart-*`.

### 23.3 Configuración base de gráfico (independiente de la librería)

| Elemento | Especificación |
|---|---|
| Rejilla | Solo líneas horizontales; color `border` (`#e2e8f0` en el origen); `strokeDashArray: 3` |
| Ejes | Etiquetas `11.5px`, color `muted-foreground`; sin línea de eje |
| Rotación de etiquetas X | `-35°` cuando hay más de 8 categorías |
| Título del eje Y | `12px`, `font-weight: bold` |
| Data labels | `12px`, peso 700; sobre la barra en `foreground`; dentro de barra apilada en blanco |
| Leyenda | Arriba, centrada; en móvil (`<640px`) pasa abajo |
| Tooltip | `shared: false`, `intersect: true` — solo el segmento señalado |
| Radio de barra | `8px`, aplicado al extremo (`borderRadiusApplication: 'end'`) |
| Ancho de columna | Dinámico: ≤1 cat → 25 %; ≤3 → 40 %; ≤7 → 55 %; >7 → 70 % |
| Animación | 400 ms |
| Estado sin datos | Texto centrado `14px` en `muted-foreground` |

**El ancho de columna dinámico** es un detalle de calidad que merece copiarse: evita que
un gráfico con dos categorías se vea con dos bloques gigantescos.

### 23.4 Toolbar de gráfico

Patrón del origen: los controles de zoom se sacan del menú nativo de la librería y se
exponen como botones visibles en el header del card:

```tsx
<div className="flex items-center gap-1">
  <Button variant="outline" size="icon-sm" onClick={onZoomIn}  aria-label="Acercar"><ZoomIn className="h-3.5 w-3.5" /></Button>
  <Button variant="outline" size="icon-sm" onClick={onZoomOut} aria-label="Alejar"><ZoomOut className="h-3.5 w-3.5" /></Button>
  <Button variant="outline" size="icon-sm" onClick={onReset} disabled={!hasZoom} aria-label="Restablecer"><RotateCcw className="h-3.5 w-3.5" /></Button>
</div>
```

Del menú nativo solo se conservan las descargas (PNG / SVG / CSV).

**Principio:** las acciones frecuentes son visibles; las raras se esconden en un menú.

### 23.5 Exportación

```tsx
<div className="flex flex-wrap gap-2">
  <Button variant="outline" size="sm"><Image className="mr-1 h-4 w-4" />PNG</Button>
  <Button variant="outline" size="sm"><FileText className="mr-1 h-4 w-4" />SVG</Button>
  <Button variant="outline" size="sm"><Table className="mr-1 h-4 w-4" />CSV</Button>
</div>
```

Nombres de archivo con marca temporal: `grafico-distribucion-{timestamp}`.

### 23.6 Leyenda personalizada

Cuando la leyenda de la librería no basta (escalas tipo semáforo, categorías con color
propio), se usa un componente propio colocado **encima** del gráfico, con
`mb-2` / `mb-3` y `shrink-0`, dentro de un contenedor `flex flex-col` donde el gráfico
tiene `flex-1 min-h-0`.

---

## 24. INVENTARIO DE COMPONENTES REUTILIZABLES

Inventario completo del sistema de origen. La columna **Prioridad** indica qué construir
primero en el proyecto destino.

### 24.1 Primitivos de UI (`components/ui/`)

| Componente | Propósito | Variantes / tamaños | Prioridad |
|---|---|---|---|
| **`Button`** | Acción | 6 variantes × 8 tamaños | **1** |
| **`Input`** | Texto de una línea | — (h-8) | **1** |
| **`Label`** | Etiqueta de campo | — | **1** |
| **`Badge`** | Etiqueta de estado | 11 variantes | **1** |
| **`Card`** | Contenedor genérico | `default`, `sm` + 6 sub-componentes | **1** |
| **`Skeleton`** | Placeholder de carga | — | **1** |
| **`Separator`** | Divisor | horizontal / vertical | 2 |
| **`Textarea`** | Texto multilínea | auto-crece | 2 |
| **`Select`** | Desplegable | trigger `default` / `sm` | **1** |
| **`DropdownMenu`** | Menú de acciones | items, checkbox, radio, sub, label, separador, shortcut | **1** |
| **`Dialog`** | Modal centrado | tamaño por `className` | **1** |
| **`Sheet`** | Panel lateral | 4 lados × 6 tamaños | **1** |
| **`Popover`** | Panel flotante | `w-72` | 2 |
| **`HoverCard`** | Previsualización al pasar | `w-64` | 3 |
| **`Tabs`** | Pestañas | list + trigger + content | 2 |
| **`Command`** | Lista buscable / paleta | inline o en dialog | 2 |
| **`MultiSelect`** | Selección múltiple con búsqueda | opción "Todos", pluralización | 2 |
| **`InputGroup`** | Input con addons | 4 alineaciones | 3 |
| **`Toaster`** (sonner) | Notificaciones | success / error / info / warning / loading | **1** |
| `SelectorEnumMultiple` | Multi-select sobre un enum con labels | — | *(específico de dominio)* |

### 24.2 Componentes de layout (`components/layout/`)

| Componente | Propósito | Notas | Prioridad |
|---|---|---|---|
| **`AppShell`** | Layout autenticado | Sidebar + workspace con scroll propio | **1** |
| **`Sidebar`** | Navegación principal | 260px, oscuro, grupos colapsables, footer de usuario | **1** |
| **`PageHeader`** | Encabezado de página | breadcrumb + h1 + subtítulo + acciones | **1** |
| `Header` | Barra superior | **Existe pero no está montado** (§8) | 2 |
| `NAV_ITEMS` | Definición de navegación | Estructura reutilizable; **contenido = Parte B** | **1** |

### 24.3 Componentes compartidos (`components/shared/`)

| Componente | Propósito | Variantes / props clave | Prioridad |
|---|---|---|---|
| **`SectionCard`** | Sección con header/cuerpo/pie | `bodyPadding`, `variant`, `eyebrow`, `leading`, `actions`, `footer` | **1** |
| **`DataCard`** + `DataToolbar` + `DataPagination` | Contenedor de listado | Composición de 3 piezas | **1** |
| **`StatCard`** | KPI | 6 tonos, `delta`, `loading`, `onClick` | **1** |
| **`StatusBadge`** | Estado de entidad | 6 tonos × soft/solid, `withDot` | **1** |
| **`EmptyState`** | Sin datos | `sm` / `md` / `lg`, icono, acción | **1** |
| **`ErrorState`** | Fallo de carga | `sm` / `md` / `lg`, `onRetry` | **1** |
| **`LoadingSpinner`** | Cargando | `sm` / `md` / `lg`, `fullPage` | **1** |
| **`SearchInput`** | Búsqueda | lupa + limpiar, `minWidth` | **1** |
| **`ConfirmDialog`** | Confirmar acción | `default` / `destructive`, loading interno | **1** |
| **`FiltersToolbar`** + `FiltersGrid` + `FilterField` + `DateInput` | Panel de filtros | colapsable, contador, limpiar, 1–6 columnas | **1** |
| **`ChartCard`** + `ChartGrid` | Gráfico y rejilla de gráficos | `minHeight`, `loading`, `empty`, 1–3 columnas | 2 |
| **`SectionTabs`** + `SectionTabPanel` | Pestañas tipo píldora | contadores, `rightSlot`, scroll horizontal | 2 |
| **`Stepper`** | Progreso por pasos | `default` / `compact`, pasos clicables | 3 |
| **`WizardStep`** + `WizardSummary` | Asistente paso a paso | hero + resumen con chips de 3 tonos | 3 |
| **`ConfigSheet`** + `ConfigSummaryChips` | Panel de configuración | trigger `bar` / `button` / `icon`, controlado o no | 3 |
| `DataField` | Par etiqueta/valor | Para vistas de detalle *(tiene un typo, §28)* | 2 |
| `SkeletonTable` | Skeleton de tabla suelto | Redundante con el de `DataTable` | 3 |
| `FiltersSection` | Filtros plegables (versión antigua) | **Sustituido por `FiltersToolbar`** | — |
| `PagePlaceholder` | Página en construcción | Andamiaje | 3 |
| `BadgeColor` | Badge de semáforo | **Legado, colores crudos** — usar `StatusBadge` | — |

### 24.4 Tablas, formularios, KPI y gráficos

| Componente | Propósito | Props clave | Prioridad |
|---|---|---|---|
| **`DataTable`** | Tabla de datos | `columns`, `data`, `loading`, `paginacion`, `onRowClick`, `density`, `bare` | **1** |
| **`FormField`** | Campo de formulario | `label`, `error`, `hint`, `required` | **1** |
| **`Combobox`** | Select con búsqueda | `options`, `value`, `onChange` | 2 |
| `KpiCard` | KPI (envoltorio retro-compatible) | Delega en `StatCard` | — |
| `ChartExportButtons` | Exportar gráfico | `onPNG`, `onSVG`, `onCSV` | 3 |

### 24.5 Piezas que faltan y conviene añadir en el destino

| Componente | Por qué | Especificación |
|---|---|---|
| **`Checkbox`** | No existe envoltorio (se usan inputs nativos) | §11.6 |
| **`RadioGroup`** | Ídem | §11.6 |
| **`Switch`** | Ídem | §11.6 |
| **`Tooltip`** | No existe; imprescindible para icon buttons y sidebar colapsado | Radix Tooltip con `bg-popover shadow-md ring-1 ring-foreground/10 rounded-md px-2 py-1 text-xs` |
| **`Alert`** | Banners inline se escriben a mano cada vez | §17.4 / §17.5 |
| **`Breadcrumb` navegable** | El actual no enlaza | §9.3 |
| **`Avatar`** | Solo hay un círculo con icono | Círculo con imagen, fallback a iniciales `text-[13px] font-semibold` |
| **`Pagination`** | La lógica está duplicada en dos sitios | Extraer del `DataTable` y del `DataPagination` |
| **`Timeline`** | Existe acoplado al dominio | §25.5 |
| **`FileUpload`** | Existe acoplado al dominio | §25.7 |

---

## 25. PATRONES DE PÁGINA

Siete plantillas completas. Cubren prácticamente cualquier pantalla de una aplicación de
gestión.

### 25.1 Listado con filtros (el patrón más común)

```
PageHeader (título + subtítulo + breadcrumb + [acción primaria])
   ↓ gap-6
FiltersToolbar (header con contador + rejilla de filtros + pie con "Buscar")
   ↓ gap-6
DataTable con paginación
```

```tsx
export function EntidadesPage() {
  const [filtros, setFiltros] = useState({ page: 1, limit: 20 });
  const [filtrosAplicados, setFiltrosAplicados] = useState({ page: 1, limit: 20 });
  const { data, isLoading } = useApiQuery({
    queryKey: ['entidades', filtrosAplicados],
    queryFn: () => api.listar(filtrosAplicados),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Entidades"
        subtitle="Descripción breve de qué gestiona esta pantalla"
        breadcrumb={[{ label: 'Sección' }, { label: 'Entidades' }]}
        actions={<Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />Nueva entidad</Button>}
      />

      <FiltrosEntidades filtros={filtros} onChange={setFiltros}
                        onBuscar={() => setFiltrosAplicados({ ...filtros, page: 1 })}
                        isLoading={isLoading} />

      <TablaEntidades data={data} loading={isLoading}
                      onPageChange={p => setFiltrosAplicados(prev => ({ ...prev, page: p }))} />

      {mostrarForm && <FormEntidad … />}
    </div>
  );
}
```

**Patrón de estado de filtros — importante:** se mantienen **dos** estados,
`filtros` (lo que el usuario está escribiendo) y `filtrosAplicados` (lo que se consulta).
La consulta solo se dispara al pulsar "Buscar". Ventajas: no hay peticiones por cada
tecla y el usuario controla cuándo recargar.

**Panel de filtros:**

```tsx
<FiltersToolbar
  description="Busca por nombre, categoría o estado."
  activeCount={contarActivos(filtros)}
  onClear={activeCount > 0 ? limpiar : undefined}
  primaryAction={<Button onClick={onBuscar} disabled={isLoading} size="sm">
    {isLoading ? 'Cargando…' : 'Buscar'}
  </Button>}
>
  <FiltersGrid columns={4}>
    <FilterField label="Nombre"><Input placeholder="Buscar por nombre…" /></FilterField>
    <FilterField label="Estado">
      <Select><SelectTrigger className="w-full"><SelectValue placeholder="Todos" /></SelectTrigger>…</Select>
    </FilterField>
    …
  </FiltersGrid>
</FiltersToolbar>
```

Anatomía del `FiltersToolbar`:

| Zona | Contenido |
|---|---|
| Header (`px-5 py-3.5`, `border-b`) | Chip de icono `h-7 w-7 rounded-md bg-muted` con `SlidersHorizontal` de 14px + título `text-[13px] font-semibold` + contador `bg-brand-soft` + descripción `text-xs`; a la derecha, "Limpiar todo" (solo si hay filtros) y botón de colapsar |
| Body (`px-5 py-4`) | `FiltersGrid` |
| Footer (`px-5 py-3`, `border-t bg-muted/30`) | Acción secundaria + primaria, alineadas a la derecha |

**El contador de filtros activos es un detalle de calidad clave:** el usuario siempre sabe
si está viendo datos filtrados, incluso con el panel colapsado.

### 25.2 Listado con pestañas (varias sub-entidades)

```
PageHeader
   ↓ gap-6
SectionTabs (pestañas con contadores)
   └─ SectionTabPanel → DataCard (toolbar + tabla + paginación)
```

`SectionTabs`:

```tsx
<div className="flex items-center justify-between gap-3
                rounded-xl border border-border bg-card p-1.5 shadow-sm">
  <TabsList className="inline-flex h-auto flex-nowrap items-center gap-1
                       overflow-x-auto bg-transparent p-0">
    <TabsTrigger className="group inline-flex shrink-0 items-center gap-2
                            rounded-lg px-3.5 py-1.5 text-[13px] font-medium
                            text-muted-foreground transition-colors
                            hover:bg-muted/60 hover:text-foreground
                            data-[state=active]:bg-foreground
                            data-[state=active]:text-background
                            data-[state=active]:shadow-none">
      <span>{label}</span>
      {count != null && <span className="…contador…">{count}</span>}
    </TabsTrigger>
  </TabsList>
  {rightSlot && <div className="flex flex-shrink-0 items-center gap-1.5 pr-1">{rightSlot}</div>}
</div>
```

Rasgos:

- La pestaña activa **invierte los colores** (`bg-foreground text-background`): negro
  sobre blanco. Máximo contraste, cero ambigüedad.
- La barra es una `.surface` con `p-1.5`; las pestañas son píldoras `rounded-lg` dentro.
- `flex-nowrap overflow-x-auto` → con muchas pestañas, scroll horizontal en vez de salto
  de línea.
- Contador opcional que cambia de color al activarse.
- Panel: `TabsContent` con `mt-4`.

**Contenido de cada pestaña — plantilla canónica de CRUD:**

```tsx
<DataCard>
  <DataToolbar>
    <SearchInput value={q} onChange={setQ} placeholder="Filtrar por código…" />
    <SearchInput value={n} onChange={setN} placeholder="Filtrar por nombre…" minWidth={260} />
  </DataToolbar>

  <DataTable bare columns={columnas} data={pagina} loading={isLoading}
             mensajeVacio="No hay registros que coincidan con los filtros." />

  {!isLoading && total > 0 && (
    <DataPagination>
      <span className="text-muted-foreground">
        Mostrando <span className="font-medium text-foreground tabular-nums">1–20</span> de{' '}
        <span className="font-medium text-foreground tabular-nums">{total}</span> registros
        {hayFiltros && <span className="ml-1 text-muted-foreground/70">(filtrados)</span>}
      </span>
      <div className="flex items-center gap-1">{/* Anterior / Página x de y / Siguiente */}</div>
    </DataPagination>
  )}
</DataCard>
```

Estrategia de datos para catálogos pequeños: cargar todo una vez y filtrar/paginar en
cliente con `useMemo`; al filtrar, resetear la página a 1.

### 25.3 Dashboard analítico

```
PageHeader
   ↓ gap-6
Fila de KPIs (grid gap-4 sm:grid-cols-2 lg:grid-cols-3)
   ↓ gap-6
Panel de configuración / filtros (ConfigSheet o FiltersToolbar)
   ↓ gap-6
ChartGrid → ChartCard × N
```

```tsx
<div className="flex flex-col gap-6">
  <PageHeader title="Análisis" subtitle="…" breadcrumb={[…]} />

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <StatCard label="Total del mes" value={142} unit="registros" icon={Activity}
              tone="brand" delta={{ value: '+12 %', direction: 'up' }} />
    <StatCard label="…" value="…" icon={…} tone="warning" />
    <StatCard label="…" value="…" icon={…} tone={critico ? 'destructive' : 'neutral'} />
  </div>

  <ChartGrid columns={2}>
    <ChartCard eyebrow="Módulo" title="Evolución" description="Últimos 12 meses"
               loading={isLoading} minHeight={320}
               actions={<Button variant="outline" size="sm">Exportar</Button>}>
      {/* gráfico */}
    </ChartCard>
    <ChartCard title="Distribución" loading={isLoading}>{/* gráfico */}</ChartCard>
  </ChartGrid>
</div>
```

**Patrón `ConfigSheet`** — cuando un gráfico tiene muchos parámetros, no se llena la
página de controles: se usa una barra-trigger que resume la configuración y abre un
panel lateral.

```tsx
<ConfigSheet title="Configurar gráfico" triggerVariant="bar"
             activeCount={3}
             summary={<ConfigSummaryChips items={[{ label: 'Periodo', value: '2026' }, …]} />}
             size="xl">
  {(close) => <FormularioDeConfiguracion onAplicar={close} />}
</ConfigSheet>
```

Trigger `bar`: fila `border border-border bg-card px-4 py-3 shadow-sm` con chip de icono
`h-9 w-9 rounded-md bg-brand-soft`, título, resumen en `text-xs` y `Abrir →` a la derecha;
hover a `border-border-strong bg-muted/40`.

`ConfigSummaryChips` muestra hasta N pares `etiqueta: valor` separados por `·`, con
`+N más` al final, y `Sin configuración aplicada` en cursiva si no hay nada.

**Patrón muy reutilizable:** resume el estado en una línea y esconde la complejidad
detrás de un clic.

### 25.4 Vista de detalle

```
Header de detalle (título con identificador + Volver / Editar / Eliminar)
   ↓ space-y-4
Card "Estado actual"  (badge + acción principal + rejilla de campos)
Card "Datos principales"
Card "Contexto"
Card "Historial" (timeline)
Card "Adjuntos"
```

```tsx
<div className="space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="text-2xl font-semibold tracking-tight">Registro #{id}</h1>
    <div className="flex gap-2">
      <Button asChild variant="outline"><Link to="/entidades">Volver</Link></Button>
      <Button asChild><Link to={`/entidades/${id}/editar`}>Editar</Link></Button>
      <Button variant="destructive" onClick={() => setConfirmar(true)}>Eliminar</Button>
    </div>
  </header>

  <Card className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Estado actual</h2>
      <Button size="sm">Registrar acción</Button>
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      <Campo label="Estado" valor={<StatusBadge tone="warning">Pendiente</StatusBadge>} />
      <Campo label="Última acción" valor={…} />
      <Campo label="Responsable" valor={…} />
      <Campo label="Fecha" valor={formatearFecha(…)} />
    </div>
  </Card>

  {/* … más cards agrupando campos por tema … */}
</div>
```

`Campo` (par etiqueta/valor):

```tsx
<div className="space-y-0.5">
  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
  <p className="text-sm font-medium">{valor ?? <span className="text-muted-foreground">—</span>}</p>
</div>
```

**Filosofía de detalle documentada en el origen y que merece copiarse:**

> Se muestran **todos** los campos siempre, aunque estén vacíos. Así el usuario ve de un
> vistazo qué falta por completar. Los valores ausentes se renderizan en cursiva gris o
> como `—`, nunca se ocultan.

Agrupación: 3–6 campos por card, agrupados por tema, con `h2 text-lg font-semibold` y
`grid gap-3 md:grid-cols-3` (o `md:grid-cols-4` para campos cortos).

**Modo embebido:** la misma página acepta una prop `isEmbedded` que quita el header y usa
`space-y-4` sin padding, para poder reutilizar la vista dentro de un `Sheet`. Es un patrón
excelente: una sola implementación de detalle sirve como página y como panel lateral.

### 25.5 Timeline (historial de eventos)

```tsx
<div className="relative">
  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />

  <ol className="space-y-4">
    <li className="relative flex items-start gap-4">
      <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center
                      rounded-full border border-border bg-card shadow-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs text-muted-foreground">{fecha ?? 'Sin fecha asignada'}</p>
            <div className="font-medium text-foreground">{titulo}</div>
            {detalle && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detalle}</p>}
          </div>
          <StatusBadge tone={tono}>{estado}</StatusBadge>
        </div>
        <div className="mt-2 flex gap-1">
          <Button size="sm" variant="ghost">Editar</Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">Eliminar</Button>
        </div>
      </div>
    </li>
  </ol>
</div>
```

Especificación:

- Línea vertical de 2px en `bg-border`, posicionada en `left-[15px]` — el centro exacto
  del círculo de 32px (`w-8`), con `top-2 bottom-2` para no sobresalir.
- Círculo `h-8 w-8 rounded-full border border-border bg-card shadow-sm`, con `z-10` para
  taparla.
- Fecha arriba en `text-xs text-muted-foreground`, luego el título y el detalle.
- Badge de estado a la derecha, acciones abajo en `ghost sm`.
- Vacío: `<li className="ml-12 text-sm italic text-muted-foreground">`.
- Fechas nulas: `'Sin fecha asignada'`, nunca vacío.

> En el origen los marcadores son emoji. **Usa iconos lucide** en el destino (§28).

### 25.6 Pantalla de autenticación

**Aviso importante:** la pantalla de login del proyecto de origen **no usa el design
system**. Es un sistema visual independiente, con CSS inyectado en una etiqueta `<style>`,
fuente externa (Outfit, cargada desde Google Fonts), fondo `#050816`, verde `#00d084` y
clases propias con prefijo `lp-`. Ningún token del sistema participa. **Es la mayor
inconsistencia del proyecto** (§28).

**Lo que sí merece conservarse es la *composición*, que es buena:**

```
┌───────────────────────────────────┬──────────────────┐
│  Panel visual                     │  Panel de acceso │
│  · imagen de fondo a sangre       │  · icono en      │
│  · degradado oscuro (izq → der)   │    círculo       │
│  · logo arriba a la izquierda     │  · título        │
│  · píldora de contexto abajo      │  · subtítulo     │
│                                   │  · campos con    │
│                                   │    icono         │
│                                   │  · recordarme /  │
│                                   │    olvidé        │
│                                   │  · botón ancho   │
└───────────────────────────────────┴──────────────────┘
   panel centrado, max-w-[1120px], alto ~620px, radius 14px
   < 920px → columna: visual arriba (220px), formulario abajo
```

**Reconstrucción con tokens del sistema** (esto es lo que debe copiarse):

```tsx
<div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
  <div className="grid w-full max-w-[1120px] overflow-hidden rounded-xl border border-border
                  bg-card shadow-lg lg:h-[620px] lg:grid-cols-[1fr_360px]">

    {/* Panel visual */}
    <div className="relative hidden min-h-[220px] lg:block">
      <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/60 to-foreground/20" />
      <div className="relative z-10 flex h-full flex-col justify-between p-10">
        <img src={logo} alt="Logo" className="w-44 object-contain" />
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10
                        bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur">
          <Shield className="h-4 w-4" />
          Acceso privado
        </div>
      </div>
    </div>

    {/* Panel de acceso */}
    <div className="flex items-center justify-center border-l border-border bg-card p-8">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full
                        bg-brand-soft text-brand-soft-foreground ring-1 ring-brand/15">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">Accede con tus credenciales</p>

        <form className="mt-8 space-y-5">
          <FormField label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
            <InputGroup>
              <InputGroupAddon><Mail className="size-4 opacity-50" /></InputGroupAddon>
              <Input id="email" type="email" autoComplete="email" className="h-11" />
            </InputGroup>
          </FormField>

          <FormField label="Contraseña" htmlFor="password" error={errors.password?.message}>
            {/* input con botón de mostrar/ocultar (ghost icon-sm, Eye / EyeOff) */}
          </FormField>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox /> Recordarme
            </label>
            <Button variant="link" size="sm" type="button">¿Olvidaste tu contraseña?</Button>
          </div>

          <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ingresando…</>
                        : <>Iniciar sesión<ArrowRight className="ml-1.5 h-4 w-4" /></>}
          </Button>
        </form>
      </div>
    </div>
  </div>
</div>
```

**Máquina de estados de la pantalla de acceso** (esto sí es reutilizable tal cual):

| Vista | Contenido | Salidas |
|---|---|---|
| `login` | Email + contraseña + recordarme + olvidé | Entrar / ir a `recuperar` |
| `recuperar` | Solo email + explicación | Enviar → `enviado` / volver a `login` |
| `enviado` | Confirmación con el email en negrita, icono en círculo, aviso de spam | Volver a `login` |

Todas las vistas comparten el mismo panel: **no hay navegación entre páginas**, solo
cambia el contenido del panel derecho. Eso mantiene el contexto y evita parpadeos.

Otros comportamientos a copiar:

- Mostrar/ocultar contraseña con `Eye` / `EyeOff`.
- Traducción de errores del proveedor de auth a mensajes humanos, con coincidencia por
  subcadena y un mensaje de reserva.
- Redirección tras login a la ruta de origen guardada
  (`location.state.from.pathname`), o a la home.
- Si ya hay sesión, redirigir en lugar de mostrar el formulario.
- Botón deshabilitado + etiqueta `Ingresando…` mientras se envía.

**Alturas de control mayores en auth:** `h-11` (44px) en vez de `h-8`. Es correcto: en una
pantalla con dos campos, controles más grandes se sienten mejor. Es la única excepción
justificada a la densidad general.

### 25.7 Subida de archivos

```tsx
<div className="space-y-3">
  <Label>Subir archivos</Label>

  <label className="flex cursor-pointer flex-col items-center justify-center gap-1
                    rounded-md border border-dashed border-border p-4 text-center
                    transition-colors hover:bg-muted/20">
    <span className="text-sm font-medium text-muted-foreground">
      Haz clic para seleccionar archivos
    </span>
    <span className="text-xs text-muted-foreground">PNG, JPG o PDF · máx. 10 MB</span>
    <input type="file" multiple className="hidden" onChange={…} />
  </label>

  {/* Previsualizaciones */}
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border">
      <img src={preview} className="h-full w-full object-cover" />
      <button className="absolute right-1 top-1 rounded-full bg-background/80 p-1
                         opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Quitar">
        <X className="h-3 w-3" />
      </button>
    </div>
  </div>

  <div className="flex gap-2">
    <Button size="sm" onClick={subir} disabled={vacio || subiendo}>
      {subiendo ? 'Subiendo…' : `Subir ${n} archivo${n === 1 ? '' : 's'}`}
    </Button>
    <Button size="sm" variant="outline" onClick={limpiar}>Limpiar</Button>
  </div>
</div>
```

Claves: zona con `border-dashed`, `<input type="file" className="hidden">` dentro de un
`<label>` (accesible y sin JS), previsualizaciones con `URL.createObjectURL` **y
`revokeObjectURL` en el cleanup** para no filtrar memoria, botón de quitar que aparece al
hacer hover, y contador pluralizado en el botón de subir.

### 25.8 Página de configuración / formulario largo

```
PageHeader
   ↓ gap-6
SectionCard "Grupo 1" → campos
SectionCard "Grupo 2" → campos
   ↓
Barra de acciones fija abajo (o SectionCard footer con Guardar/Cancelar)
```

Con más de ~10 campos, agrupar en varias `SectionCard` con título y descripción, en lugar
de una única lista larga.

### 25.9 Asistente por pasos (wizard)

```
Stepper (progreso)
   ↓
WizardStep (hero: chip de icono + "Paso N de M" + título + descripción + campo)
   ↓
WizardSummary (chips acumulativos del estado)
   ↓
Navegación: [Atrás] [Continuar]
```

`WizardStep`: contenedor `mx-auto max-w-lg anim-fade-in`; hero centrado con chip
`h-14 w-14 rounded-2xl bg-brand-soft ring-1 ring-brand/15`, indicador
`text-[11px] font-semibold uppercase tracking-[0.08em] text-brand`, título
`text-lg font-semibold tracking-tight` y descripción `text-sm text-muted-foreground max-w-prose`.

`Stepper`: círculos de 28px unidos por línea de 1px (`bg-brand` si está completado,
`bg-border` si no); completado → `bg-brand` con `Check strokeWidth={3}`; actual →
`bg-brand` + `ring-4 ring-brand/15`; pendiente → `border-border bg-card text-muted-foreground`.
Variante `compact`: barras de 8px de alto en lugar de círculos.

**Un solo campo por paso.** El wizard existe para reducir la carga cognitiva; meter tres
campos en un paso lo desvirtúa.

---

## 26. FORMATO DE DATOS Y MICROCOPY

Parte del acabado profesional. Todo esto es reutilizable sin cambios.

### 26.1 Funciones de formato

Centralizadas en un único módulo (`lib/format.ts`). **Ningún componente formatea por su
cuenta.**

| Función | Entrada | Salida |
|---|---|---|
| `formatearFecha` | ISO o `Date` | `04/05/2026` |
| `formatearFechaHora` | ISO o `Date` | `04/05/2026 14:30` |
| `formatearNumero(v, dec = 2)` | número | `1.234,56` (locale `es-PE`) |
| `formatearEntero` | número | `1.234` |
| `fechaAIso` | `Date` | `2026-05-04` |

**Todas devuelven `'—'` ante `null`, `undefined` o `NaN`**, y capturan errores de parseo.
Esta única decisión elimina los `Invalid Date` y los `NaN` de la interfaz.

Ejemplo del patrón:

```ts
export function formatearFecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  try {
    const fecha = typeof valor === 'string' ? parseISO(valor) : valor;
    return format(fecha, 'dd/MM/yyyy', { locale: es });
  } catch {
    return '—';
  }
}
```

### 26.2 Convenciones de presentación

| Caso | Convención |
|---|---|
| Valor ausente | **`—`** (guion largo) en `text-muted-foreground`. Nunca vacío, `null`, `N/A` ni `0` |
| Fecha | `DD/MM/YYYY` |
| Fecha y hora | `DD/MM/YYYY HH:mm` (24 h) |
| Número | Separador de miles según locale, alineado a la derecha, `tabular-nums` |
| Número con unidad | Valor + espacio + unidad: `1.234 m`, `80 km/h`, `24,5 °C` |
| Porcentaje | `12,4 %` (con espacio antes del signo, en español) |
| Rango | `1–20` (guion corto, sin espacios) |
| Código / identificador | Chip mono (§13.5) |
| Identificador de registro | `#123` |
| Contador de resultados | `Mostrando 1–20 de 134 registros` |

### 26.3 Microcopy

| Elemento | Convención | Ejemplos |
|---|---|---|
| Título de página | Sustantivo, sin artículo | `Usuarios`, `Auditoría` |
| Subtítulo | Frase corta que explica el propósito | `Gestión de cuentas del sistema` |
| Botón de crear | `Nuevo` / `Nueva` + entidad en singular | `Nuevo usuario` |
| Botón de guardar | `Guardar` (editar) / verbo concreto (crear) | `Crear y enviar invitación` |
| Botón de cancelar | Siempre `Cancelar` | |
| Placeholder de búsqueda | `Buscar…` o `Filtrar por X…` (**puntos suspensivos tipográficos**) | |
| Estado de carga en botón | Gerundio + `…` | `Guardando…`, `Cargando…` |
| Toast de éxito | Pasado, sin punto final | `Usuario desactivado` |
| Toast de error | Descripción del problema | `Correo o contraseña incorrectos` |
| Estado vacío | Título + explicación | `No hay datos` / `No se encontraron registros para mostrar` |
| Estado vacío con filtros | Mencionar los filtros | `No hay registros que coincidan con los filtros.` |
| Confirmación de borrado | Pregunta + consecuencia | `¿Eliminar el registro?` / `Esta acción puede revertirse desde Auditoría.` |
| Texto de ayuda | Explica la consecuencia, no repite el label | `Se enviará un correo de invitación a esta dirección.` |
| Opción "sin filtro" | `Todos` | |

**Detalles ortotipográficos consistentes en todo el sistema:**

- Puntos suspensivos tipográficos `…` (U+2026), no `...`.
- Guion largo `—` para valores ausentes; guion corto `–` para rangos.
- Sin signos de exclamación en el feedback.
- Sin punto final en toasts ni etiquetas de botón.
- El texto de ayuda **puede ser dinámico** y describir la consecuencia de la opción
  elegida (p. ej., qué implica cada rol).

---

## 27. ACCESIBILIDAD

Lo que el sistema hace bien y debe conservarse:

| Práctica | Dónde |
|---|---|
| `aria-label` en todo botón sin texto | Icon buttons, cerrar, limpiar, colapsar, hamburguesa |
| `aria-hidden` en elementos decorativos | Barra del item activo, línea del timeline, iconos ilustrativos |
| `sr-only` para texto alternativo | Botón de cerrar del `Dialog` |
| `aria-expanded` en triggers | Combobox, multiselect, grupos colapsables |
| `aria-current="step"` | Paso actual del stepper |
| `aria-invalid` para errores | Inputs, selects, textareas (activa el estilo de error) |
| `aria-label="breadcrumb"` | Navegación de migas |
| `role="combobox"` | Triggers de selección con búsqueda |
| `focus-visible` en lugar de `focus` | Todos los controles |
| `htmlFor` en labels | Todos los campos de formulario |
| Foco atrapado y restaurado | Dialog y Sheet (vía Radix) |
| Cierre con `Escape` | Todas las superficies flotantes (Radix) |
| Navegación por teclado en menús y listas | Radix + cmdk |

Mejoras pendientes que el destino debería incorporar:

- `prefers-reduced-motion` (§22.6).
- `role="status"` / `aria-live="polite"` en los estados de carga, para que un lector de
  pantalla anuncie que se están cargando datos.
- Verificar el contraste del texto sobre `-soft`: los pares
  `{tono}-soft` / `{tono}-soft-foreground` están diseñados para cumplir AA, pero
  `text-muted-foreground` sobre `bg-muted` queda justo — no lo uses para texto pequeño
  crítico.
- Skip link ("Saltar al contenido") antes del sidebar.
- `scope="col"` en los `<th>` de las tablas.

---
---

# PARTE B — CONTENIDO ESPECÍFICO DE VÍAS (NO COPIAR)

> **Esta sección existe únicamente para que sepas reconocer qué NO debe viajar al otro
> proyecto.** Nada de lo que aparece aquí debe aparecer en el proyecto destino: ni los
> nombres, ni las rutas, ni las entidades, ni los textos, ni la lógica.

## B.1 Dominio

Aplicación interna de gestión de **infraestructura ferroviaria** (vía férrea de un metro
urbano): seguimiento de fallas de riel y soldadura, desgaste de carriles, temperatura de
vía y visualización geográfica del estado de la línea. Todo el vocabulario de negocio es
ferroviario y **no es transferible**.

## B.2 Marca e identidad

- Nombre de la organización, logotipo (`logo.png`), imagen de portada del login
  (`banner-home-04.jpg`).
- El texto `UNNA` en comentarios de código y en el `alt` del logo.
- El nombre de proyecto `front-via` / `backend-via`.

**Sustituir por:** la identidad del proyecto destino. El *hueco* (logo de ≤40px de alto
centrado en una franja de 64px) sí se reutiliza; la imagen no.

## B.3 Módulos y navegación

Estructura de `NAV_ITEMS` del origen — **el esqueleto de datos se reutiliza, el contenido
no**:

| Módulo | Sub-módulos | Solo admin |
|---|---|---|
| Mapa de Calor | — | no |
| Catálogos | — | no |
| Fallas | Análisis, Falla Riel, Falla Soldadura Inox | no |
| Temperatura | Análisis, Importaciones | no |
| Desgaste | Análisis, Escenarios, Mediciones | no |
| Auditoría | — | **sí** |
| Usuarios | — | **sí** |

## B.4 Rutas

Todas las rutas del origen son específicas del dominio:

```
/                              /catalogos
/mapa-calor
/fallas  /fallas/analisis  /fallas/riel  /fallas/riel/nueva
/fallas/riel/:id  /fallas/riel/:id/editar
/fallas/soldadura  /fallas/soldadura/nueva  /fallas/soldadura/:id  /fallas/soldadura/:id/editar
/temperatura  /temperatura/analisis  /temperatura/importaciones  /temperatura/importaciones/:id
/desgaste  /desgaste/analisis  /desgaste/escenarios  /desgaste/escenarios/:id/valores  /desgaste/mediciones
/auditoria  /usuarios
/login  /reset-password
```

**Lo reutilizable es el *esquema* de rutas**, no las rutas:

| Patrón | Forma |
|---|---|
| Índice de módulo con sub-secciones | `/modulo` → redirección a `/modulo/analisis` |
| Listado | `/modulo/entidad` |
| Crear | `/modulo/entidad/nueva` |
| Detalle | `/modulo/entidad/:id` |
| Editar | `/modulo/entidad/:id/editar` |
| Sub-recurso | `/modulo/entidad/:id/subrecurso` |
| Comodín | `*` → redirección a la home |

## B.5 Entidades del dominio

`Tramo`, `Estación`, `Curva Horizontal`, `Curva Vertical`, `Velocidad`, `Cambiavía`,
`Elemento de Desgaste`, `Falla de Riel`, `Falla de Soldadura Inox`, `Acción de Riel`,
`Medición de Desgaste`, `Escenario`, `Valor MTB`, `Importación de Temperatura`,
`Log de Auditoría`.

Atributos ferroviarios: `progresiva`, `progresivaFinal`, `via`, `carril`, `velocidadKmh`,
`tramoCodigo`, `puntoW`, `W1`/`W2`, `tipoOnda`, `perfil`, `zonaAfectada`, `PT`.

**Sustituir por:** las entidades del proyecto destino.

## B.6 Enums y estados de negocio

- `EstadoFalla`: `NO_ATENDIDO`, `PROGRAMADO`, `EN_EJECUCION`, `RESUELTO`, `CANCELADO`,
  `FALTA_VERIFICAR`.
- `NivelAlertaColor`: `VERDE`, `AMARILLO`, `ROJO`, `GRIS` (semáforo de dominio).
- `TipoDefectoRiel`, `ElementoAfectadoRiel`, `ZonaAfectadaRiel`, `PerfilFallaRiel`,
  `AltaBaja`, `TipoViaFiltro`, `ModoG2`, `CategoriaG2`, y sus diccionarios `LABEL_*`.
- Roles: `USUARIO`, `ADMINISTRADOR`.

> **Lo que sí se reutiliza es el mecanismo:** un enum + un diccionario `LABEL_*` que
> traduce cada valor a su etiqueta visible, y un mapeo de cada valor a un tono semántico
> del sistema (§16.4). Los valores concretos, no.

## B.7 Textos específicos

`Catálogos Operacionales`, `Gestión de infraestructura ferroviaria — Línea 1 Metro de
Lima`, `Mapa de Calor`, `Visualización geográfica de temperatura, desgaste y fallas`,
`Falla de Riel #123`, `Distribución de Fallas`, `Cantidad de Fallas`, `Soldaduras sin
acción`, `Tramo con más fallas`, `+ Registrar acción`, `Esta acción puede revertirse desde
Auditoría.`, `Acceso operativo: catálogos, fallas, desgaste y temperatura.`

## B.8 Funcionalidad exclusiva del dominio

- **Mapa de calor / esquema de vía**: SVG de la línea con estaciones y tramos, con capas
  intercambiables (temperatura, desgaste general, desgaste índice, fallas) y leyendas de
  semáforo y de carriles.
- **Wizards de configuración de gráficos de desgaste** (`wizard-desgaste`,
  `wizard-desgaste-g3`).
- **Importación de datos de temperatura** desde Excel.
- **Timeline de acciones sobre una falla** (el patrón visual sí es reutilizable, §25.5;
  el contenido no).
- **Auditoría con recuperación de registros eliminados** (soft delete).
- Cálculos de progresivas, índices de desgaste y proyecciones.

## B.9 Componentes acoplados al dominio (no copiar tal cual)

`BadgeEstadoFalla`, `BadgeColor`, `KpisFallas`, `KpisDesgaste`, `KpisTemperatura`,
`Grafico1..3*`, `TimelineAccionesRiel`, `AccionRielModal`, `AccionRielForm`,
`ArchivoUploader`, `ImagenesUploader`, `EsquemaBase`, `Capa*`, `Leyenda`, `ListaDetalle`,
`SelectorTramos`, `SelectorCurvas*`, `SelectorNivel`, `SelectorTipoFalla`,
`SelectorViaFallas`, `SelectorCascada`, `FiltrosFallas`, `FiltrosTemperatura`,
`FiltrosDesgaste*`, `WizardDesgaste*`, todos los `*-tab.tsx` de catálogos.

De cada uno se reutiliza **el patrón visual descrito en la Parte A**, no la
implementación.

## B.10 Integraciones e infraestructura

Supabase (autenticación y almacenamiento), backend NestJS propio, despliegue en Vercel,
locale `es-PE`, `date-fns` con locale español, `xlsx` para importaciones,
`html-to-image` para exportar gráficos.

**Nota:** el locale y las convenciones de fecha/número (§26) sí son reutilizables si el
destino es hispanohablante; adáptalos si no lo es.

---

# CIERRE

---

## 28. INCONSISTENCIAS CONOCIDAS Y CÓMO CORREGIRLAS EN DESTINO

El proyecto de origen tiene un sistema de diseño muy sólido, pero convive con restos de
etapas anteriores. **Estas desviaciones no deben replicarse.** Se documentan para que las
reconozcas si algún día miras el código original.

### 28.1 Colores crudos de la paleta Tailwind conviviendo con los tokens

**Qué pasa:** hay 102 usos de clases como `bg-red-50`, `text-green-600`,
`border-amber-400`, `bg-blue-100`, `text-gray-400`, `bg-purple-100`, junto a los tokens
semánticos.

**Dónde:** `BadgeEstadoFalla` (6 estados con paleta cruda), `BadgeColor`, `BannerCreado`,
`FilterField` (usa `text-red-500` en vez de `text-destructive`), varios items de menú
(`text-red-600`, `text-green-600`), y las paletas hexadecimales de algunos gráficos.

**Por qué importa:** rompe el modo oscuro (los colores crudos no cambian), impide
re-tematizar y produce derivas cromáticas (hay al menos tres rojos distintos en la app).

**Corrección en destino:**

| En lugar de | Usa |
|---|---|
| `bg-red-50 text-red-800 border-red-200` | `bg-destructive-soft text-destructive-soft-foreground border-destructive/15` |
| `bg-green-50 text-green-800 border-green-200` | `bg-success-soft text-success-soft-foreground border-success/15` |
| `bg-amber-100 text-amber-800` | `bg-warning-soft text-warning-soft-foreground` |
| `bg-blue-100 text-blue-800` | `bg-info-soft text-info-soft-foreground` |
| `bg-gray-100 text-gray-700` | `bg-secondary text-secondary-foreground` |
| `text-red-500` / `text-red-600` | `text-destructive` |
| `text-green-600` | `text-success` |
| `text-gray-400` | `text-muted-foreground` |
| `#0284c7`, `#16a34a`, … en gráficos | `hsl(var(--chart-1))` … `hsl(var(--chart-5))` |

**Regla para el destino:** prohíbe por lint las clases de color crudas de Tailwind fuera
de la definición de tokens.

### 28.2 Tres sistemas de badge de estado coexistiendo

**Qué pasa:** hay tres formas distintas de pintar un estado:

1. `StatusBadge` — el canónico, con tokens y punto de color. ✅
2. `BadgeEstadoFalla` — `<span>` propio, `rounded-md`, colores crudos, tamaños `sm`/`md`.
3. `BadgeColor` — `Badge variant="outline"` con clases `alerta-*` y fondos crudos.

Además, algunas tablas usan `Badge` directamente con clases inline
(`className="border-amber-400 text-amber-500"`).

**Corrección:** **un único componente de estado** (`StatusBadge`). Los estados del dominio
se mapean a tonos con un diccionario:

```ts
const TONO_POR_ESTADO: Record<EstadoDominio, StatusTone> = {
  PENDIENTE:  'warning',
  EN_CURSO:   'info',
  COMPLETADO: 'success',
  CANCELADO:  'neutral',
  ERROR:      'destructive',
};

<StatusBadge tone={TONO_POR_ESTADO[estado]}>{LABEL_ESTADO[estado]}</StatusBadge>
```

### 28.3 La pantalla de login no usa el design system

**Qué pasa:** ~250 líneas de CSS inyectadas en una etiqueta `<style>`, con fuente propia
cargada desde Google Fonts (Outfit), paleta propia (`#050816`, `#00d084`, `#081018`),
clases con prefijo `lp-`, y estilos globales que sobrescriben `html, body, #root`
(incluido `body { overflow: hidden }`).

**Por qué importa:** es una segunda identidad visual dentro de la misma aplicación. El
usuario ve un producto en el login y otro distinto al entrar. Además, los estilos globales
inyectados pueden afectar a otras pantallas.

**Corrección:** reconstruir el login con tokens y componentes del sistema conservando la
composición de dos paneles. La reconstrucción completa está en §25.6.

### 28.4 El header existe pero no está montado

**Qué pasa:** `header.tsx` está implementado (menú de usuario, badge de rol, logout,
hamburguesa) y no lo importa nadie.

**Consecuencias:** no hay hamburguesa → el sidebar no puede colapsar en móvil; el menú de
usuario duplica la funcionalidad del pie del sidebar.

**Corrección:** montar el header (§8.4) **y** elegir un único sitio para el menú de
usuario. Recomendación: perfil y logout en el header (convención más extendida), y en el
sidebar solo navegación.

### 28.5 El sidebar no es responsive

**Qué pasa:** 260px fijos en cualquier viewport.

**Corrección:** patrón de drawer en §21.2. El componente ya acepta `onClose`; solo falta
el contenedor.

### 28.6 Modo oscuro definido pero inalcanzable

**Qué pasa:** el bloque `.dark` está completo y `next-themes` instalado, pero no hay
`ThemeProvider` ni control para alternar. Solo el toaster consulta el tema.

**Corrección:** si el destino quiere modo oscuro, envolver la app en `ThemeProvider` con
`attribute="class"`, añadir un toggle en el header y **auditar** los colores crudos
(§28.1), que son lo único que impide que funcione.

### 28.7 Duplicaciones de componentes

| Duplicado | Situación | Qué usar |
|---|---|---|
| `FiltersSection` vs `FiltersToolbar` | Dos paneles de filtros | **`FiltersToolbar`** |
| `KpiCard` vs `StatCard` | `KpiCard` es un envoltorio retro-compatible | **`StatCard`** |
| `SkeletonTable` vs skeleton interno de `DataTable` | Redundantes | El de `DataTable` |
| Paginación en `DataTable` vs en `DataPagination` | Lógica duplicada | Extraer un `Pagination` común |
| `Dialog` vs `Sheet` para formularios | Ambos en uso | **`Sheet`** para formularios; `Dialog` solo para confirmaciones |

### 28.8 Errores puntuales

| Problema | Dónde | Corrección |
|---|---|---|
| Typo: la etiqueta renderiza `{label}a` (una "a" pegada al final) | `DataField` | Quitar la `a` |
| Timeline con emoji como iconos | `TimelineAccionesRiel` | Usar iconos lucide |
| Formateo de fecha reimplementado localmente | `TimelineAccionesRiel` | Usar `formatearFecha` de `lib/format` |
| Mezcla de `border` y `ring-1` para el mismo tipo de contorno | Varios | `border` en superficies estructurales, `ring` en flotantes |
| `App.css` con estilos de la plantilla de Vite sin usar | `src/App.css` | Eliminar |
| `alerta-*` (colores legacy) mapeados en el config de Tailwind | `tailwind.config.js` | No portar |

### 28.9 Resumen: qué copiar y qué no

| ✅ Copiar | ❌ No copiar |
|---|---|
| Tokens de `index.css` (§2.4) | Colores crudos de Tailwind |
| `.surface`, `.eyebrow`, `.text-tech`, `.row-hover` | `alerta-*` legacy |
| `AppShell`, `Sidebar`, `PageHeader` | `App.css` |
| `SectionCard`, `DataCard`, `StatCard`, `ChartCard` | `KpiCard`, `FiltersSection`, `BadgeColor` |
| `DataTable` con sus estados | `SkeletonTable` |
| `StatusBadge` | `BadgeEstadoFalla` |
| `EmptyState`, `ErrorState`, `LoadingSpinner` | CSS del login |
| `FiltersToolbar` + `FiltersGrid` + `FilterField` | Emoji como iconos |
| Composición del login (§25.6), no su CSS | `NAV_ITEMS` (contenido) |
| Patrón `useApiMutation` con toasts | Enums de dominio |

---

## 29. PRINCIPIOS DE DISEÑO

Los ocho principios que explican por qué esta interfaz se ve coherente. Si el destino
respeta estos principios, se verá igual de sólida aunque tenga otro contenido.

### 1. Consistencia por reutilización, no por disciplina

No se confía en que cada desarrollador recuerde las reglas: **se encapsulan en
componentes**. Existe una sola forma de hacer cada cosa —una card (`SectionCard`), un
listado (`DataCard` + `DataTable`), un KPI (`StatCard`), un estado (`StatusBadge`), un
panel de filtros (`FiltersToolbar`)— y esa forma trae el estilo incorporado.

*Cómo aplicarlo:* antes de escribir clases sueltas, pregúntate qué componente del sistema
resuelve esto. Si no existe, créalo y documéntalo — no lo resuelvas inline.

### 2. Jerarquía por peso y color, no por tamaño

La escala tipográfica es **estrecha** (de 10,5px a 28px). La jerarquía se construye con
peso (400 → 600), color (`foreground` → `muted-foreground`) y tratamiento
(versalitas + tracking para lo micro). Esto permite mucha densidad de información sin que
la pantalla parezca un cartel.

*Cómo aplicarlo:* para destacar algo, cambia el color o el peso antes que el tamaño.

### 3. El espaciado es responsabilidad del contenedor

Los componentes **no traen márgenes externos**. El contenedor de página impone `gap-6`;
el `SectionCard` impone su padding; la rejilla impone su `gap`. El resultado es un ritmo
vertical uniforme en toda la aplicación sin ajustes caso por caso.

*Cómo aplicarlo:* prohíbe `mt-*` / `mb-*` entre bloques hermanos. Usa `gap`.

### 4. Contraste al servicio de la lectura, no de la decoración

El fondo cálido y las cards blancas crean separación sin bordes gruesos ni sombras
marcadas. Los bordes son de 1px y a menudo al 60 % de opacidad. Las sombras tienen la
mitad de opacidad que las de Tailwind. **El contraste fuerte se reserva para lo que
importa**: texto principal, botón primario, pestaña activa.

*Cómo aplicarlo:* si un elemento necesita destacar, quítale ruido al de al lado antes de
añadirle peso a él.

### 5. Alineación estricta

Todo se alinea a una rejilla implícita: el ancho del sidebar, el padding del workspace, los
paddings de card, las alturas de los controles. Los números están alineados a la derecha con
`tabular-nums`; los títulos y los botones comparten línea base (`items-end`); los iconos
llevan `shrink-0` para no deformarse.

*Cómo aplicarlo:* respeta los valores de §4. Cuando dudes entre dos valores, elige el que
ya exista en el sistema.

### 6. Feedback en cada interacción

Nada ocurre en silencio: hover en cada elemento interactivo, `translate-y-px` al pulsar,
anillo de foco visible, spinner con etiqueta en gerundio, toast automático en toda
mutación, overlay al recargar una tabla, contador de filtros activos, skeleton con la forma
del contenido real. **El usuario siempre sabe qué está pasando.**

*Cómo aplicarlo:* por cada acción que añadas, define su estado de carga, su éxito y su
error antes de darla por terminada.

### 7. Los estados vacíos y de error son parte del diseño

`EmptyState` y `ErrorState` comparten anatomía con el contenido normal (icono en círculo,
título, descripción limitada a 36–44 caracteres, acción). No son pantallas de emergencia:
son estados diseñados, con copy útil y una salida clara.

*Cómo aplicarlo:* ninguna vista se considera terminada sin sus estados vacío, cargando y
error.

### 8. Simplicidad progresiva

Lo frecuente está a la vista; lo complejo se esconde detrás de un clic pero se **resume**
antes de esconderse. `ConfigSheet` muestra un resumen en una línea y guarda la
configuración en un panel; `FiltersToolbar` puede colapsarse pero mantiene el contador
visible; los botones de zoom del gráfico están fuera del menú porque se usan; las
descargas están dentro porque no.

*Cómo aplicarlo:* cuando escondas complejidad, deja siempre visible un resumen de su
estado.

---

## 30. REGLAS PARA ADAPTAR ESTE DESIGN SYSTEM A OTRO PROYECTO

> ### Regla fundamental
>
> **El proyecto destino debe conservar el lenguaje visual y los patrones de UI
> documentados aquí, pero debe utilizar exclusivamente sus propios módulos, rutas,
> entidades, datos y funcionalidades.**

### 30.1 El proyecto destino NO debe copiar

- ❌ **Nombres** de módulos, entidades, componentes de dominio ni de la organización.
- ❌ **Rutas** (`/fallas`, `/desgaste`, `/temperatura`, `/catalogos`, `/mapa-calor`, …).
- ❌ **Textos**: títulos, subtítulos, mensajes, ayudas y etiquetas específicas de Vías.
- ❌ **Módulos**: Fallas, Desgaste, Temperatura, Catálogos, Mapa de Calor, Auditoría.
- ❌ **Entidades**: Tramo, Estación, Curva, Cambiavía, Falla, Medición, Escenario…
- ❌ **Enums de negocio** y sus diccionarios de etiquetas.
- ❌ **Lógica de negocio**: cálculos de progresivas, índices de desgaste, proyecciones.
- ❌ **Datos**: catálogos, seeds, valores de ejemplo, códigos.
- ❌ **Funcionalidades exclusivas**: mapa de calor de vía, importación de temperatura,
  wizards de desgaste, timeline de acciones de falla.
- ❌ **Assets**: logo, banner, iconografía de marca.
- ❌ Las **inconsistencias** de §28.

### 30.2 El proyecto destino SÍ debe reutilizar

- ✅ **Lenguaje visual**: tokens de color, tipografía, radios, sombras, escala de
  espaciado (§2–§5).
- ✅ **Componentes UI**: todo el inventario de §24, reconstruido con la arquitectura del
  destino.
- ✅ **Jerarquía**: escala tipográfica, uso de peso y color, niveles de elevación.
- ✅ **Espaciado**: `gap-6` entre bloques, paddings canónicos, alturas de control.
- ✅ **Colores**: el sistema completo de tokens semánticos con variantes `soft`.
- ✅ **Tipografía**: familias, escala real, reglas de uso, `tabular-nums`, mono para
  códigos.
- ✅ **Navegación**: `AppShell`, sidebar oscuro de 260px con grupos colapsables e
  indicador de acento, `PageHeader` con breadcrumb.
- ✅ **Estados**: mapa tono → significado (§16.4), estados de interacción (§19),
  loading / empty / error (§20).
- ✅ **Patrones de interacción**: dos estados de filtros, overlay en recarga, toasts
  automáticos, confirmación de acciones destructivas, formulario en `Sheet` con footer
  anclado.
- ✅ **Responsive**: breakpoints, drawer móvil, comportamiento de rejillas y tablas (§21).
- ✅ **Estructura visual**: composición de página, patrones de §25.
- ✅ **Calidad de UX**: microcopy, formato de datos, `—` para vacíos, gerundios en carga,
  contadores de filtros activos.

### 30.3 Procedimiento de adaptación

**Fase 1 — Fundamentos** *(hazlo antes de escribir ninguna pantalla)*
1. Copia el bloque de tokens de §2.4 a tu CSS global.
2. Configura el mapeo de Tailwind (§2.4) y el `borderRadius` derivado (§5.1).
3. Añade las sombras custom (§5.2) y las animaciones (§22.3).
4. Instala la fuente (Geist Variable o equivalente) y aplica los ajustes base de §3.1.
5. Define las utilidades `.surface`, `.eyebrow`, `.text-tech`, `.row-hover` (§5.4).
6. Aplica los estilos de scrollbar (§5.5).
7. Crea `cn()` (§1.1).
8. Ajusta `--brand` y `--sidebar-primary` al matiz de tu marca (§2.5) — **y nada más**.

**Fase 2 — Esqueleto**
9. Construye `AppShell` exactamente como §6.2, con el drawer móvil de §21.2.
10. Construye `Sidebar` (§7) y aliméntalo con **tu** array de navegación.
11. Construye `Header` (§8.3) con tu menú de usuario.
12. Construye `PageHeader` (§9).

**Fase 3 — Componentes (por prioridad de §24)**
13. Prioridad 1: `Button`, `Input`, `Label`, `Badge`, `Card`, `Skeleton`, `Select`,
    `DropdownMenu`, `Dialog`, `Sheet`, `Toaster`.
14. Compuestos prioritarios: `SectionCard`, `DataCard`, `DataTable`, `StatCard`,
    `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingSpinner`, `SearchInput`,
    `ConfirmDialog`, `FiltersToolbar`.
15. Añade lo que falta en el origen: `Checkbox`, `RadioGroup`, `Switch`, `Tooltip`,
    `Alert`, `Avatar` (§24.5).

**Fase 4 — Pantallas**
16. Elige el patrón de §25 que corresponda a cada pantalla.
17. Sustituye entidades, rutas y textos por los tuyos.
18. Para cada estado del dominio, define su tono según §16.4.
19. Centraliza el formato de datos (§26.1) desde el primer día.

**Fase 5 — Verificación**
20. Recorre el checklist de §31.

### 30.4 Cómo decidir ante un caso nuevo

Cuando necesites algo que este documento no cubre, aplica en este orden:

1. **¿Hay un componente del sistema que lo resuelva?** Úsalo, aunque encaje solo al 80 %.
2. **¿Hay un patrón análogo documentado?** Cópialo y adáptalo.
3. **¿Puedo construirlo con tokens existentes?** Hazlo; nunca introduzcas un color, radio
   o sombra nuevos.
4. **¿Necesito de verdad un token nuevo?** Añádelo al sistema con las cuatro variantes
   (base / foreground / soft / soft-foreground) y documéntalo.
5. **En caso de duda, elige la opción más sobria.** Este sistema siempre resta antes que
   sumar.

### 30.5 Prompt sugerido para el proyecto destino

```
Lee DESIGN_SYSTEM_REFERENCE.md completo antes de escribir código.

Construye la interfaz de [TU PROYECTO] usando EXCLUSIVAMENTE el lenguaje visual,
los tokens, los componentes y los patrones descritos en su PARTE A.

Ignora por completo la PARTE B: es el dominio del proyecto de origen. Los módulos,
rutas, entidades, textos y funcionalidades deben ser los de [TU PROYECTO].

Sigue el procedimiento de adaptación de §30.3 en orden.
Aplica las correcciones de §28 (no reproduzcas las inconsistencias del origen).
Verifica el resultado contra el checklist de §31.

Regla innegociable: ningún color literal ni clase de color cruda de Tailwind.
Solo tokens semánticos.
```

---

## 31. CHECKLIST DE VERIFICACIÓN

Para el agente que implemente en el proyecto destino.

### Fundamentos

- [ ] Todos los tokens de §2.4 definidos en `:root`
- [ ] Modo oscuro definido en `.dark` (aunque no se active todavía)
- [ ] `--radius: 0.625rem` y la escala de radios derivada
- [ ] Sombras custom con color `rgb(15 18 24)` y opacidades reducidas
- [ ] Fuente sans variable + mono, con los ajustes base de §3.1
- [ ] Utilidades `.surface`, `.eyebrow`, `.text-tech`, `.row-hover`
- [ ] Estilos de scrollbar (claro y variante oscura)
- [ ] Keyframes y animaciones de §22.3
- [ ] `cn()` disponible y usado en todos los componentes
- [ ] **Cero** clases de color crudas de Tailwind fuera de la definición de tokens

### Layout

- [ ] `AppShell` con `h-screen overflow-hidden` y scroll solo en `main`
- [ ] Contenido con `max-w-[1500px] mx-auto`
- [ ] Padding `px-4 sm:px-6 lg:px-8`, `pt-6`, `pb-16`
- [ ] Sidebar de 260px, oscuro, con barra de acento de 3px en el item activo
- [ ] Grupos del sidebar colapsables, abiertos automáticamente en la sección actual
- [ ] Sidebar como drawer por debajo de `md`
- [ ] Header de 64px, sticky, con `border-b` y sin sombra
- [ ] Perfil y logout en **un solo** sitio (header o sidebar, no ambos)
- [ ] Toda página envuelta en `flex flex-col gap-6` con `PageHeader` como primer hijo

### Componentes

- [ ] Botones: 6 variantes, 8 tamaños, `active:translate-y-px`, `focus-visible:ring-3`
- [ ] Botón primario en grafito (no en color de marca)
- [ ] Botón destructivo en variante soft (`bg-destructive/10`)
- [ ] Inputs de 32px, `rounded-lg`, `bg-transparent`, `text-base md:text-sm`
- [ ] `.surface` como base de toda superficie elevada
- [ ] `SectionCard` con header/cuerpo/pie y paddings de §4.3
- [ ] `DataCard` + `DataToolbar` + `DataPagination` para listados
- [ ] `DataTable` con: skeleton en primera carga, overlay en recarga, estado vacío,
      ordenación con icono siempre visible, sin zebra striping
- [ ] `StatCard` sin borde lateral de color, con chip de icono por tono
- [ ] `StatusBadge` como **único** componente de estado
- [ ] `EmptyState` / `ErrorState` / `LoadingSpinner` con la anatomía de §20
- [ ] `FiltersToolbar` con contador de filtros activos y "Limpiar todo"
- [ ] Formularios en `Sheet` con footer anclado y `form` + `id`
- [ ] `ConfirmDialog` en toda acción destructiva
- [ ] `Toaster` en `top-right` con `richColors` e iconos lucide
- [ ] Componentes que faltan en el origen añadidos (§24.5)

### Interacción y estados

- [ ] Hover definido en todo elemento interactivo
- [ ] `focus-visible` (nunca `focus`) con anillo visible
- [ ] Disabled = `opacity-50` + `pointer-events-none`
- [ ] Loading en botón: spinner + gerundio + `disabled`
- [ ] Toast automático en éxito y error de toda mutación
- [ ] Overlay (no skeleton) al recargar datos ya visibles
- [ ] Ninguna transición por encima de 300 ms
- [ ] Desplazamientos de animación de 4–8px, nunca mayores

### Contenido y datos

- [ ] Funciones de formato centralizadas, con `'—'` ante valores nulos
- [ ] `tabular-nums` en toda cifra
- [ ] Números alineados a la derecha en tablas
- [ ] Códigos e identificadores en chip mono
- [ ] Microcopy según §26.3 (gerundios, `…` tipográfico, sin punto final en toasts)
- [ ] Mapa tono → significado respetado en todos los estados

### Responsive

- [ ] Verificado a 375px, 768px, 1024px, 1440px y 1920px
- [ ] Sin scroll horizontal a nivel de página en ningún tamaño
- [ ] Tablas: scroll interno o columnas ocultas por breakpoint
- [ ] Modales con márgenes en móvil y primaria arriba en el footer
- [ ] Objetivos táctiles de al menos 32px

### Accesibilidad

- [ ] `aria-label` en todo botón sin texto
- [ ] `aria-hidden` en elementos decorativos
- [ ] `htmlFor` en todos los labels
- [ ] `aria-invalid` en campos con error
- [ ] Navegación completa por teclado
- [ ] `prefers-reduced-motion` respetado
- [ ] Contraste AA verificado en los pares `-soft` / `-soft-foreground`

### Coherencia global

- [ ] Una sola forma de hacer cada cosa (sin componentes duplicados)
- [ ] Ninguna inconsistencia de §28 reproducida
- [ ] Ningún nombre, ruta, entidad o texto de la Parte B presente en el código
- [ ] La pantalla de login usa los mismos tokens que el resto de la aplicación

---

*Fin del documento.*
