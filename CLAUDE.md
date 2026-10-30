# Cast CRM - Instrucciones para Claude Code

Lee y sigue primero [AGENTS.md](./AGENTS.md). Ese archivo contiene el contexto
compartido del producto, la arquitectura, la seguridad multi-organización, las
reglas de Server Actions/TanStack Query, el diseño y la validación.

Estas reglas aplican además a Claude Code:

- Antes de implementar, inspecciona el código existente y los documentos locales
  relevantes; no asumas APIs de Next.js, Better Auth, Prisma o TanStack Query.
- Trata todas las entradas del cliente como no confiables. La autenticación,
  organización activa, membresía y permisos se verifican en el servidor.
- No crees una API REST para resolver una mutación si una Server Action cubre el
  caso. Mantén las lecturas autenticadas en TanStack Query del lado cliente.
- No expongas secretos, el cliente de Prisma ni registros completos de la base
  de datos al navegador.
- Centraliza los componentes reutilizables de interfaz en `components/ui`.
  Prefiere `AppInput`, `AppButton`, `AppAutocomplete` y componentes `App*` equivalentes
  con props limitadas a las necesidades reales del producto; evita importar
  HeroUI directamente en las pantallas y evita wrappers que expongan toda su
  API.
- Cuando un componente se use dentro de una `Surface` de HeroUI, configura
  `variant="secondary"` para mantener el contraste visual. Los componentes
  `App*` deben encapsular esta decisión cuando aplique.
- Implementa los formularios con React Hook Form y validación Zod usando el
  resolver correspondiente. Reutiliza los esquemas entre el formulario y la
  Server Action cuando el contrato sea el mismo, y muestra errores de campo y
  de envío explícitamente.
- Centraliza las variables que puedan cambiar entre empresas u organizaciones en
  una configuración tipada y reutilizable. No hardcodees branding, moneda,
  zona horaria, módulos, límites, etiquetas o preferencias dentro de pantallas;
  separa configuración de negocio, configuración de despliegue y secretos.
- Si una organización necesita algo adicional, debe configurarse desde su
  apartado de configuración. Si el dato debe persistir, modifica el modelo de
  organización de Prisma y crea su migración, junto con la Server Action y la
  UI necesarias; no agregues excepciones hardcodeadas por organización.
- Al terminar, ejecuta las validaciones disponibles y resume archivos cambiados,
  decisiones relevantes y cualquier comprobación que no haya sido posible.
