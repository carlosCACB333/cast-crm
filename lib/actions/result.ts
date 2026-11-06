import { APIError } from "better-auth/api";
import { z } from "zod";

import { APP_LOCALE } from "@/config/organization";
import { unitInfo } from "@/config/products";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; stockShortages?: StockShortage[] };

/** A product whose tracked stock does not cover what is being taken out. */
export interface StockShortage {
  productId: string;
  name: string;
  /** Base unit of the product, e.g. "unit" or "kg". */
  unit: string;
  /** Base units the operation needs. */
  requested: number;
  /** Base units in stock right now. */
  available: number;
}

/**
 * Thrown when an operation would leave products with negative stock. The
 * result lists every product short of stock so the UI can link to each one.
 */
export class InsufficientStockError extends Error {
  constructor(readonly shortages: StockShortage[]) {
    super("INSUFFICIENT_STOCK");
  }
}

const quantityFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

const shortageText = (shortages: StockShortage[]) =>
  shortages
    .map((item) => {
      const unit = unitInfo(item.unit).short;

      return `${item.name} (hay ${quantityFormatter.format(item.available)} ${unit}, se necesitan ${quantityFormatter.format(item.requested)} ${unit})`;
    })
    .join("; ");

const errorMessages: Record<string, string> = {
  CANNOT_GRANT_OWNER_ROLE:
    "Solo un propietario puede asignar el rol de propietario.",
  CANNOT_GRANT_HIGHER_ROLE:
    "No puedes asignar un rol con permisos que tú no tienes.",
  CANNOT_CHANGE_OWN_ROLE: "No puedes cambiar tu propio rol.",
  INVALID_ROLE_NAME: "El nombre del rol debe contener letras o números.",
  ROLE_NAME_IS_ALREADY_TAKEN: "Ya existe un rol con ese nombre.",
  ROLE_IS_ASSIGNED_TO_MEMBERS:
    "No puedes eliminar un rol asignado a miembros. Cámbiales el rol primero.",
  CANNOT_DELETE_A_PRE_DEFINED_ROLE:
    "El rol de propietario no se puede eliminar.",
  TOO_MANY_ROLES: "Se alcanzó el máximo de roles de la organización.",
  ROLE_NOT_FOUND: "El rol no existe.",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE:
    "No puedes crear un rol con permisos que tú no tienes.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE:
    "No puedes editar este rol o darle permisos que tú no tienes.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE:
    "No tienes permiso para eliminar roles.",
  ORGANIZATION_ALREADY_EXISTS:
    "Ya existe una organización con ese identificador.",
  ORGANIZATION_NAME_MISMATCH:
    "El nombre escrito no coincide con el de la organización.",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "Ese identificador ya está en uso.",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    "Solo un propietario puede crear nuevas organizaciones.",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    "Has alcanzado el máximo de organizaciones.",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    "Esa persona ya es miembro de la organización.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    "Esa persona ya tiene una invitación pendiente.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
    "No puedes salir: eres el único propietario.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER:
    "La organización debe tener al menos un propietario.",
  INVITATION_NOT_FOUND: "La invitación no existe o ya no es válida.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "Esta invitación pertenece a otro correo.",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    "Verifica tu correo antes de responder a la invitación.",
  NO_ACTIVE_ORGANIZATION: "No tienes una organización activa.",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION:
    "No eres miembro de esta organización.",
  MEMBER_NOT_FOUND: "El miembro no existe.",
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED:
    "La organización alcanzó su límite de miembros.",
  INVITATION_LIMIT_REACHED: "Se alcanzó el límite de invitaciones pendientes.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE:
    "No puedes invitar con ese rol.",
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Tu cuenta no tiene contraseña.",
  PASSWORD_ALREADY_SET: "Tu cuenta ya tiene una contraseña.",
  SESSION_EXPIRED: "Por seguridad, vuelve a iniciar sesión para continuar.",
  CHANGE_EMAIL_DISABLED: "El cambio de correo no está disponible.",
  EMAIL_IS_THE_SAME: "Ese ya es tu correo actual.",
  SESSION_NOT_FOUND: "La sesión ya no existe.",
  CUSTOMER_NOT_FOUND: "El cliente no existe o fue eliminado.",
  CUSTOMER_EMAIL_TAKEN: "Ya existe un cliente con ese correo.",
  INVALID_CUSTOMER_STATUS: "El estado seleccionado no existe.",
  INVALID_CUSTOMER_OWNER: "El responsable debe ser miembro de la organización.",
  CUSTOMER_STATUS_IN_USE:
    "Hay clientes con este estado. Cámbiales el estado antes de eliminarlo.",
  TOO_MANY_CUSTOMER_STATUSES: "Se alcanzó el máximo de estados de cliente.",
  NOTE_NOT_FOUND: "La nota no existe o no puedes eliminarla.",
  LEAD_NOT_FOUND: "El lead no existe o fue eliminado.",
  INVALID_LEAD_OWNER: "El responsable debe ser miembro de la organización.",
  INVALID_STAGE: "El paso seleccionado no pertenece a este embudo.",
  PIPELINE_NOT_FOUND: "El embudo no existe o fue eliminado.",
  TOO_MANY_STAGES: "Se alcanzó el máximo de pasos en este embudo.",
  LAST_PIPELINE: "Debe existir al menos un embudo.",
  LAST_STAGE: "Un embudo necesita al menos un paso.",
  PRODUCT_NOT_FOUND: "El producto no existe o fue eliminado.",
  PRODUCT_SKU_TAKEN: "Ya existe un producto con esa referencia (SKU).",
  INVALID_PRODUCT_SOURCE:
    "La sugerencia elegida ya no está disponible o no coincide con el código de barras.",
  PRODUCT_BARCODE_TAKEN:
    "Ese código de barras ya lo usa otro producto o forma de venta.",
  INVALID_PRODUCT_CATEGORY: "La categoría seleccionada no existe.",
  TOO_MANY_PRODUCT_CATEGORIES: "Se alcanzó el máximo de categorías.",
  STOCK_NOT_TRACKED:
    "Este producto no controla stock. Actívalo al editar el producto.",
  INVALID_PRESENTATION: "La presentación seleccionada ya no existe.",
  SALES_PRESENTATION_REQUIRED:
    "Elige la presentación de cada producto que se vende en varias (unidad, caja, paquete…).",
  SERVICE_NOT_FOUND: "El servicio no existe o fue eliminado.",
  SERVICE_CODE_TAKEN: "Ya existe un servicio con ese código.",
  INVALID_SERVICE_CATEGORY: "La categoría seleccionada no existe.",
  TOO_MANY_SERVICE_CATEGORIES: "Se alcanzó el máximo de categorías.",
  IMAGES_NOT_CONFIGURED:
    "La subida de imágenes no está configurada. Avisa al administrador del sistema.",
  INVALID_IMAGE: "La imagen no se subió correctamente. Inténtalo de nuevo.",
  IMAGE_TOO_LARGE: "La imagen es demasiado grande.",
  TOO_MANY_IMAGES: "Se alcanzó el máximo de imágenes de este producto.",
  IMAGE_NOT_FOUND: "La imagen no existe o fue eliminada.",
  PRESENTATION_NOT_FOUND: "La forma de venta no existe o fue eliminada.",
  DUPLICATE_PRESENTATION:
    "Ya existe una forma de venta con ese formato y esa cantidad.",
  TOO_MANY_PRESENTATIONS: "Se alcanzó el máximo de formas de venta.",
  INSUFFICIENT_STOCK: "No hay stock suficiente para esa salida.",
  STOCK_CHANGED:
    "El stock cambió mientras lo editabas. Revisa el valor actual y vuelve a intentarlo.",
  STAGE_TARGET_REQUIRED:
    "Elige a qué paso mover los leads antes de eliminar este.",
  SALES_DOCUMENT_NOT_FOUND: "El documento no existe o fue eliminado.",
  INVALID_SALES_CUSTOMER: "El cliente seleccionado no existe.",
  INVALID_SALES_OWNER: "El responsable debe ser miembro de la organización.",
  INVALID_SALES_ITEM:
    "Alguno de los productos o servicios de las líneas ya no existe.",
  SALES_DOCUMENT_LOCKED:
    "Este documento ya no se puede editar en su estado actual.",
  SALES_DOCUMENT_CHANGED:
    "El documento cambió mientras lo editabas. Recarga la página e inténtalo de nuevo.",
  SALES_DOCUMENT_NOT_DELETABLE:
    "Este documento no se puede eliminar en su estado actual. Cancélalo en su lugar.",
  SALES_CUSTOMER_LOCKED:
    "No puedes cambiar el cliente: ya se generaron otros documentos a partir de este. Cancélalos o elimínalos primero.",
  INVALID_SALES_TRANSITION: "Ese cambio de estado no está permitido.",
  INVALID_SALES_CONVERSION:
    "Este documento no se puede convertir en el tipo elegido.",
  SALES_INSUFFICIENT_STOCK:
    "No hay stock suficiente de algún producto para entregar este albarán.",
  INVOICE_HAS_PAYMENTS:
    "La factura tiene cobros registrados. Elimínalos antes de anularla.",
  PAYMENT_NOT_ALLOWED: "Solo se registran cobros de facturas emitidas.",
  PAYMENT_EXCEEDS_BALANCE: "El importe supera lo pendiente de cobro.",
  PAYMENT_NOT_FOUND: "El cobro no existe o fue eliminado.",
  TOO_MANY_PAYMENTS: "Se alcanzó el máximo de cobros de esta factura.",
  PAYMENT_LOCKED:
    "Este cobro no se puede eliminar: pertenece a un ticket o a una caja ya cerrada.",
  INVALID_PAYMENT_METHOD: "La forma de pago no existe o está desactivada.",
  TENDERED_TOO_LOW: "El efectivo entregado no cubre el importe.",
  TOO_MANY_PAYMENT_METHODS: "Se alcanzó el máximo de formas de pago.",
  PAYMENT_METHOD_IN_USE:
    "Esta forma de pago ya tiene cobros. Desactívala en lugar de eliminarla.",
  SALES_PREFIX_IN_USE:
    "Las facturas y los tickets necesitan prefijos distintos para no repetir números.",
  POS_TICKET_LOCKED:
    "Los tickets del punto de venta se anulan desde su caja mientras está abierta.",
  NO_OPEN_CASH_SESSION: "Abre una caja para cobrar en el punto de venta.",
  CASH_SESSION_ALREADY_OPEN:
    "Ya tienes una caja abierta. Ciérrala antes de abrir otra.",
  CASH_REGISTER_IN_USE: "Esa caja ya está abierta por otra persona.",
  INVALID_CASH_REGISTER: "La caja no existe o está desactivada.",
  CASH_REGISTER_NAME_TAKEN: "Ya existe una caja con ese nombre.",
  TOO_MANY_CASH_REGISTERS: "Se alcanzó el máximo de cajas.",
  CASH_REGISTER_OPEN: "Cierra la caja antes de desactivarla.",
  CASH_REGISTER_HAS_SESSIONS:
    "Esta caja tiene aperturas registradas. Desactívala en lugar de eliminarla.",
  CASH_SESSION_NOT_FOUND: "La apertura de caja no existe.",
  CASH_SESSION_CLOSED: "Esta caja ya está cerrada.",
  CASH_SESSION_NOT_YOURS:
    "Solo quien abrió la caja o quien gestiona el punto de venta puede operar en ella.",
  CASH_NOT_ENOUGH: "No hay tanto efectivo en la caja.",
  CASH_OPENING_MISMATCH:
    "El efectivo contado no coincide con el que debería tener la caja. Reporta la diferencia al administrador.",
  CASH_OPENING_MATCHES:
    "Lo contado coincide con el efectivo de la caja: puedes abrirla.",
  CASH_WITHDRAWAL_TOO_HIGH:
    "No puedes retirar más efectivo del que has contado.",
  CASH_REGISTER_OPEN_ADJUST: "Cierra la caja antes de ajustar su efectivo.",
  CASH_BALANCE_UNCHANGED:
    "La caja ya tiene ese efectivo y no hay diferencias pendientes.",
  CASH_REGISTER_HAS_MOVEMENTS:
    "Esta caja tiene movimientos de efectivo. Desactívala en lugar de eliminarla.",
  POS_PAYMENTS_MISMATCH:
    "Los pagos deben sumar exactamente el total del ticket.",
  INVALID_POS_SOURCE:
    "Ese documento ya no se puede cobrar en caja: está cerrado o ya continuó en el flujo de ventas.",
  INVALID_POS_TICKET: "Ese ticket no se puede anular.",
  TOO_MANY_HELD_CARTS:
    "Hay demasiados tickets guardados. Cobra o elimina alguno antes de guardar otro.",
  HELD_CART_NOT_FOUND:
    "Ese ticket guardado ya no existe: puede que otra persona lo haya recuperado.",
  HELD_CART_NOT_YOURS:
    "Solo quien guardó el ticket o un responsable del punto de venta puede eliminarlo.",
};

/**
 * Runs a Server Action body, validating its input and translating Better Auth
 * errors into a serializable result. Unexpected errors are rethrown so they
 * surface instead of being hidden behind a generic message.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  try {
    return { ok: true, data: await fn(parsed.data) };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        ok: false,
        error: `No hay stock suficiente: ${shortageText(error.shortages)}.`,
        stockShortages: error.shortages,
      };
    }
    if (error instanceof APIError) {
      if (error.status === "UNAUTHORIZED") {
        return {
          ok: false,
          error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
        };
      }
      if (error.status === "FORBIDDEN") {
        return {
          ok: false,
          error:
            errorMessages[error.body?.code ?? ""] ??
            "No tienes permiso para realizar esta acción.",
        };
      }

      return {
        ok: false,
        error:
          errorMessages[error.body?.code ?? ""] ??
          error.body?.message ??
          "No se pudo completar la acción.",
      };
    }
    throw error;
  }
}
