# Cast CRM - Contexto del proyecto

## Producto y objetivo

Cast CRM es un CRM multi-organización, moderno y adaptable a cualquier tipo de
negocio. La interfaz debe ser clara, consistente, accesible y profesional; no
asumas un único sector ni codifiques flujos que solo funcionen para ventas.
Los módulos deben poder crecer y configurarse por organización.

## Stack y decisiones arquitectónicas

- Usa Next.js App Router con React y TypeScript.
- Usa HeroUI y Tailwind CSS siguiendo los patrones existentes del repositorio,
  pero encapsula HeroUI detrás de componentes reutilizables centralizados en
  `components/ui` (por ejemplo, `AppButton`, `AppInput`, `AppAutocomplete`,
  `AppModal` y `AppTable`). Las pantallas y módulos deben importar esos
  componentes de aplicación, no importar componentes de HeroUI directamente en
  cada archivo.
- Cada componente `App*` debe exponer solo las props y variantes que realmente
  usa el producto, con nombres y estados consistentes. No crees un wrapper
  genérico que replique toda la API de HeroUI ni añadas props por anticipado.
  Si una necesidad se repite, amplía el componente centralizado de forma
  compatible.
- Centraliza también los estilos, variantes, estados de error, accesibilidad y
  convenciones visuales de esos componentes en `components/ui`, para que un
  cambio de diseño no requiera editar cada módulo.
- Cuando un componente de HeroUI se renderice dentro de una superficie
  (`Surface`), usa `variant="secondary"`; esta variante es necesaria para que
  el componente conserve el contraste y se vea correctamente en esa superficie.
  Los componentes `App*` deben aplicar esta convención internamente cuando
  corresponda, evitando que cada pantalla tenga que recordarla.
- Gestiona los formularios con React Hook Form y valida sus entradas con
  esquemas Zod mediante el resolver correspondiente. Define el esquema cerca
  del contrato del formulario, reutilízalo cuando también valide la Server
  Action y muestra errores de campo y de envío de forma explícita.
- Usa Better Auth para autenticación, sesiones y el plugin `organization` para
  multi-organización.
- Usa PostgreSQL con Prisma ORM en su versión estable más reciente compatible
  con el proyecto. Antes de usar una API de Prisma, revisa las skills locales
  de Prisma y la documentación/versiones instaladas; no inventes APIs.
- Mantén el acceso a datos detrás de una capa de servidor reutilizable. No
  expongas el cliente de Prisma ni secretos al navegador.
- Centraliza en un único lugar las variables y reglas que puedan cambiar entre
  empresas u organizaciones (branding, nombre, moneda, zona horaria, módulos,
  límites, etiquetas, preferencias y configuración de negocio). Usa una
  configuración tipada y explícita, con valores por defecto seguros, para que
  cambiar de empresa no requiera buscar y editar valores hardcodeados por toda
  la aplicación. Separa esta configuración de los secretos y de las variables
  de entorno específicas del despliegue.
- Si una organización necesita una capacidad, dato o comportamiento adicional,
  configúralo en su apartado de configuración y modifica el modelo de
  organización correspondiente cuando deba persistirse. No introduzcas
  excepciones hardcodeadas por organización ni campos aislados en módulos que
  deban ser parte de la configuración central. Los cambios persistidos deben
  incluir el esquema Prisma, la migración y la UI/Server Action de configuración
  necesarias.

## Datos, organizaciones y permisos

- Toda entidad de negocio debe quedar aislada por organización y cada consulta
  debe filtrar por la organización activa derivada de la sesión en el servidor.
- Nunca aceptes `organizationId` del cliente como prueba de pertenencia.
  Valida sesión, organización activa, membresía y permiso en el servidor.
- Diseña autorización con permisos por módulo y acción (`module:read`,
  `module:create`, `module:update`, `module:delete`, según corresponda), además
  de roles. Debe ser posible conceder acceso a cualquier módulo sin cambiar la
  lógica de cada pantalla.
- Ocultar una opción de navegación no sustituye la autorización. Todas las
  Server Actions y lecturas protegidas deben autenticar y autorizar.
- Los datos globales, si alguna vez son necesarios, deben modelarse y
  autorizarse explícitamente; no omitas el filtro de organización por defecto.

## Lecturas, mutaciones y caché

- Para mutaciones del backend, prefiere Server Actions (`'use server'`) sobre
  Route Handlers/API routes. Usa Route Handlers solo cuando exista una razón
  técnica clara (webhooks, integraciones externas, descargas o APIs públicas).
- Cada Server Action es un endpoint no confiable: valida entradas con el
  esquema del proyecto, autentica, autoriza y devuelve solo datos serializables
  necesarios para la UI. No ocultes errores con valores por defecto.
- La aplicación autenticada no requiere SEO: realiza las lecturas en el cliente
  con TanStack Query (`useQuery`, `useInfiniteQuery`, etc.) y muestra estados
  explícitos de carga, error y vacío. Las mutaciones deben invalidar o actualizar
  las query keys afectadas.
- Mantén la parte pública optimizada para SEO y usa Server Components/metadata
  cuando corresponda. No conviertas toda la aplicación en Client Components
  innecesariamente.
- Respeta la naturaleza secuencial del despacho de Server Actions en el cliente;
  no uses `Promise.all` para paralelizarlas. Si una acción necesita trabajo
  paralelo, hazlo dentro del servidor.

## Diseño y UX

- Prioriza un diseño moderno, coherente y orientado a productividad: jerarquía
  visual, navegación predecible, tablas y formularios claros, responsive,
  accesibilidad y estados de interacción completos.
- Reutiliza componentes, tokens, layouts y utilidades existentes antes de crear
  variantes duplicadas. Los nuevos módulos deben sentirse parte del mismo CRM.
- Prefiere `AppInput` (y el resto de componentes `App*` de `components/ui`)
  frente a importar `Input` de HeroUI directamente. Los imports de HeroUI deben
  quedar principalmente dentro de la capa de componentes de UI centralizados.
- Para elegir valores usa siempre `AppAutocomplete` (formularios) o
  `AppFilterAutocomplete` (filtros), no un select. No existe `AppSelect`.
  - Si las opciones salen de la base de datos (miembros, roles, estados,
    embudos, pasos, etiquetas…), pásale un `source` de `lib/option-sources.ts`:
    busca en el servidor y carga la página siguiente al llegar al final de la
    lista. Nunca cargues la lista completa en el navegador ni la recortes a un
    tamaño fijo.
  - Para una fuente nueva, crea su Server Action paginada en
    `lib/actions/options.ts` (con `optionSearchSchema`, el mismo permiso que
    la lista de origen y soporte para `ids`), su query key bajo la clave de sus
    datos en `lib/query-keys.ts` y su entrada en `optionSources`.
  - Usa `options` solo para valores fijos del código (tipos, monedas) o para
    opciones especiales delante de la fuente (por ejemplo, "Sin asignar").
  - Los filtros de `AppDataTable` (`type: "options"`) aceptan el mismo
    `source`.
- Considera estados de permisos, datos vacíos, errores, carga, paginación,
  filtros, confirmación de acciones destructivas y feedback de mutaciones.

## Flujo de trabajo para agentes

1. Lee este archivo y la documentación local de Next.js en `.next-docs` antes
   de modificar código relacionado con Next.js.
2. Inspecciona patrones existentes y las skills locales relevantes antes de
   introducir Better Auth, Prisma, TanStack Query o componentes HeroUI.
3. Mantén separación entre UI, acciones de servidor, acceso a datos,
   autenticación/autorización y esquemas de validación.
4. Para cambios de esquema, actualiza Prisma de forma reproducible y explica o
   ejecuta la migración correspondiente; nunca edites la base de datos
   manualmente como sustituto de una migración.
5. Ejecuta las comprobaciones más pequeñas que cubran el cambio (`npm run lint`,
   type-check, tests o build cuando estén disponibles) y reporta errores reales.
6. No añadas dependencias, APIs, endpoints ni abstracciones sin necesidad
   verificable. Conserva compatibilidad con el código existente.
7. Antes de crear un valor específico de una empresa, comprueba si pertenece a
   la configuración centralizada; si es configurable por organización,
   persístelo y léelo desde esa fuente en lugar de duplicarlo en componentes o
   acciones.
8. Cuando una necesidad de organización no esté representada en el modelo,
   amplía el modelo de configuración de la organización antes de implementarla
   en la UI; no uses atajos basados en nombres, IDs o condiciones especiales.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
