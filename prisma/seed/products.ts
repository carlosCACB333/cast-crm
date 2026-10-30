/**
 * Fills the products module of an organization with test data: categories,
 * products, presentations and stock history. Development only.
 *
 *   bun run db:seed:products [--org <slug>] [--count 40] [--reset] [--seed 1]
 *
 * Seeded products carry the "demo" tag and a "DEMO-" SKU, so `--reset` removes
 * them (and the seeded categories left empty) without touching real data.
 */
/* eslint-disable no-console -- CLI output. */
import { parseArgs } from "node:util";

import { COLOR_PRESETS } from "@/config/colors";
import { PRODUCT_LIMITS, type ProductUnit } from "@/config/products";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEMO_TAG = "demo";
const SKU_PREFIX = "DEMO-";
/** EAN-13 prefix reserved for in-store use, so it never matches real goods. */
const BARCODE_PREFIX = "200";
const MAX_COUNT = 500;
const HISTORY_DAYS = 60;

type CatalogItem = {
  name: string;
  unit: ProductUnit;
  /** Price range before taxes. */
  price: [number, number];
  tags?: string[];
  /** Whether it is sold in packs or boxes as well. */
  packs?: boolean;
};

const CATALOG: Record<string, CatalogItem[]> = {
  Bebidas: [
    {
      name: "Agua mineral 1,5 l",
      unit: "unit",
      price: [0.4, 0.9],
      packs: true,
    },
    {
      name: "Refresco de cola 33 cl",
      unit: "unit",
      price: [0.6, 1.2],
      packs: true,
    },
    {
      name: "Zumo de naranja 1 l",
      unit: "unit",
      price: [1.2, 2.5],
      packs: true,
    },
    { name: "Café en grano", unit: "kg", price: [12, 22], tags: ["importado"] },
    { name: "Té verde", unit: "unit", price: [2, 4.5] },
    { name: "Aceite de oliva virgen extra", unit: "l", price: [6, 11] },
  ],
  Alimentación: [
    { name: "Arroz redondo", unit: "kg", price: [1, 2.2], packs: true },
    { name: "Harina de trigo", unit: "kg", price: [0.7, 1.4] },
    {
      name: "Pasta espagueti 500 g",
      unit: "unit",
      price: [0.8, 1.6],
      packs: true,
    },
    {
      name: "Tomate triturado 400 g",
      unit: "unit",
      price: [0.6, 1.1],
      packs: true,
    },
    {
      name: "Queso curado",
      unit: "kg",
      price: [12, 20],
      tags: ["refrigerado"],
    },
    { name: "Galletas integrales", unit: "unit", price: [1.2, 2.4] },
  ],
  Limpieza: [
    { name: "Detergente líquido 3 l", unit: "unit", price: [5, 9] },
    { name: "Lejía 2 l", unit: "unit", price: [1, 2], packs: true },
    {
      name: "Bayeta de microfibra",
      unit: "unit",
      price: [0.9, 2],
      packs: true,
    },
    { name: "Friegasuelos", unit: "l", price: [1.5, 3.5] },
    { name: "Bolsas de basura 30 l", unit: "pack", price: [1.5, 3] },
  ],
  Papelería: [
    { name: "Folios A4 80 g", unit: "pack", price: [3.5, 6], packs: true },
    { name: "Bolígrafo azul", unit: "unit", price: [0.3, 1], packs: true },
    { name: "Cuaderno espiral A5", unit: "unit", price: [1.5, 3.5] },
    { name: "Grapadora metálica", unit: "unit", price: [6, 14] },
    { name: "Cinta adhesiva", unit: "unit", price: [0.8, 2], packs: true },
  ],
  Ferretería: [
    { name: "Tornillos 4x40", unit: "box", price: [3, 7] },
    { name: "Cable eléctrico 2,5 mm", unit: "m", price: [0.5, 1.2] },
    { name: "Martillo de carpintero", unit: "unit", price: [8, 18] },
    { name: "Pintura plástica blanca", unit: "l", price: [4, 9] },
    { name: "Baldosa cerámica", unit: "m2", price: [9, 25] },
    { name: "Cola blanca", unit: "kg", price: [3, 6] },
  ],
  Electrónica: [
    { name: "Pilas AA", unit: "pack", price: [3, 7], packs: true },
    { name: "Cargador USB-C 20 W", unit: "unit", price: [9, 20] },
    { name: "Cable HDMI 2 m", unit: "unit", price: [5, 12] },
    { name: "Bombilla LED E27", unit: "unit", price: [2, 5], packs: true },
    {
      name: "Ratón inalámbrico",
      unit: "unit",
      price: [8, 25],
      tags: ["importado"],
    },
  ],
};

const VARIANTS = ["", " Premium", " Eco", " Pro", " Oferta", " XL"];

const { values } = parseArgs({
  options: {
    org: { type: "string" },
    count: { type: "string", default: "40" },
    reset: { type: "boolean", default: false },
    seed: { type: "string", default: "1" },
  },
});

/** Small seeded PRNG (mulberry32) so runs are reproducible. */
function createRandom(seed: number) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    chance: (probability: number) => next() < probability,
    int: (min: number, max: number) =>
      Math.floor(next() * (max - min + 1)) + min,
    between: (min: number, max: number) => min + next() * (max - min),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}

const round = (value: number, decimals = 2) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Whole quantities for counted units, three decimals for measured ones. */
const quantityDecimals = (unit: string) =>
  ["kg", "g", "l", "m", "m2"].includes(unit) ? 3 : 0;

function ean13(body12: string) {
  const sum = [...body12].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );

  return body12 + ((10 - (sum % 10)) % 10);
}

async function resolveOrganization(slug?: string) {
  const select = {
    id: true,
    name: true,
    slug: true,
    defaultTaxRate: true,
  } satisfies Prisma.OrganizationSelect;

  if (slug) {
    const organization = await prisma.organization.findUnique({
      where: { slug },
      select,
    });

    if (!organization) throw new Error(`No existe la organización "${slug}".`);

    return organization;
  }

  const organizations = await prisma.organization.findMany({
    select,
    orderBy: { createdAt: "asc" },
  });

  if (organizations.length === 1) return organizations[0];
  if (!organizations.length) {
    throw new Error("No hay organizaciones. Crea una desde la aplicación.");
  }

  throw new Error(
    `Hay varias organizaciones, indica una con --org: ${organizations
      .map((organization) => organization.slug)
      .join(", ")}`,
  );
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Este comando no se ejecuta en producción.");
  }

  const count = Number(values.count);
  const seed = Number(values.seed);

  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count debe ser un entero entre 1 y ${MAX_COUNT}.`);
  }
  if (!Number.isInteger(seed)) throw new Error("--seed debe ser un entero.");

  const random = createRandom(seed);
  const organization = await resolveOrganization(values.org);
  const organizationId = organization.id;
  const categoryNames = Object.keys(CATALOG);

  if (values.reset) {
    const { count: removed } = await prisma.product.deleteMany({
      where: { organizationId, tags: { has: DEMO_TAG } },
    });
    const { count: removedCategories } =
      await prisma.productCategory.deleteMany({
        where: {
          organizationId,
          name: { in: categoryNames },
          products: { none: {} },
        },
      });

    console.log(
      `Eliminados ${removed} productos y ${removedCategories} categorías de prueba.`,
    );
  }

  const author = await prisma.member.findFirst({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const authorId = author?.userId ?? null;
  const taxRate = organization.defaultTaxRate;

  // Categories: reuse the ones with the same name, append the rest.
  const existingCategories = await prisma.productCategory.findMany({
    where: { organizationId },
    select: { id: true, name: true, position: true },
  });
  const categoryIds = new Map<string, string>();
  let position = Math.max(-1, ...existingCategories.map((c) => c.position));
  let createdCategories = 0;

  for (const [index, name] of categoryNames.entries()) {
    const existing = existingCategories.find((c) => c.name === name);

    if (existing) {
      categoryIds.set(name, existing.id);
      continue;
    }
    if (
      existingCategories.length + createdCategories >=
      PRODUCT_LIMITS.maxCategories
    ) {
      continue;
    }

    const category = await prisma.productCategory.create({
      data: {
        organizationId,
        name,
        color: COLOR_PRESETS[(index * 2 + 1) % COLOR_PRESETS.length],
        position: ++position,
      },
      select: { id: true },
    });

    categoryIds.set(name, category.id);
    createdCategories++;
  }

  // Codes already taken in the organization, to avoid unique violations.
  const [products, presentations] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId },
      select: { sku: true, barcode: true },
    }),
    prisma.productPresentation.findMany({
      where: { organizationId, barcode: { not: null } },
      select: { barcode: true },
    }),
  ]);
  const usedBarcodes = new Set(
    [...products, ...presentations].flatMap((row) =>
      row.barcode ? [row.barcode] : [],
    ),
  );
  let skuNumber = Math.max(
    0,
    ...products.flatMap((product) =>
      product.sku?.startsWith(SKU_PREFIX)
        ? [Number(product.sku.slice(SKU_PREFIX.length)) || 0]
        : [],
    ),
  );

  const nextBarcode = () => {
    let barcode: string;

    do {
      barcode = ean13(
        BARCODE_PREFIX + String(random.int(0, 999_999_999)).padStart(9, "0"),
      );
    } while (usedBarcodes.has(barcode));
    usedBarcodes.add(barcode);

    return barcode;
  };

  const items = categoryNames.flatMap((category) =>
    CATALOG[category].map((item) => ({ ...item, category })),
  );
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let presentationCount = 0;
  let movementCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (let index = 0; index < count; index++) {
        const item = items[index % items.length];
        const variant =
          VARIANTS[Math.floor(index / items.length) % VARIANTS.length];
        const batch = Math.floor(index / (items.length * VARIANTS.length));
        const name = `${item.name}${variant}${batch ? ` ${batch + 1}` : ""}`;
        const decimals = quantityDecimals(item.unit);
        const price = round(random.between(...item.price));
        const cost = round(price * random.between(0.55, 0.75));
        const trackStock = random.chance(0.8);
        const createdAt = new Date(now - HISTORY_DAYS * dayMs);

        // Stock history: opening stock, then a few entries and exits.
        const movements: Prisma.ProductStockMovementUncheckedCreateWithoutProductInput[] =
          [];
        let stock = 0;
        let minStock: number | null = null;

        if (trackStock) {
          minStock = random.chance(0.7) ? random.int(5, 20) : null;
          stock = round(random.between(10, 120), decimals);
          movements.push({
            organizationId,
            type: "IN",
            quantity: stock,
            stockAfter: stock,
            reason: "Stock inicial",
            authorId,
            createdAt,
          });

          const extra = random.int(0, 5);

          for (let step = 1; step <= extra; step++) {
            const isIn = random.chance(0.35);
            const quantity = isIn
              ? round(random.between(5, 60), decimals)
              : -Math.min(stock, round(random.between(1, 30), decimals));

            if (!quantity) continue;
            stock = round(stock + quantity, decimals);
            movements.push({
              organizationId,
              type: isIn ? "IN" : "OUT",
              quantity,
              stockAfter: stock,
              reason: isIn
                ? random.pick(["Compra a proveedor", "Devolución de cliente"])
                : random.pick(["Venta", "Merma", "Consumo interno"]),
              authorId,
              createdAt: new Date(
                createdAt.getTime() +
                  (step / (extra + 1)) * HISTORY_DAYS * dayMs,
              ),
            });
          }

          // Make sure the "low" and "out of stock" filters have results.
          const scenario = random.next();
          const target =
            scenario < 0.1
              ? 0
              : scenario < 0.25 && minStock
                ? random.int(1, minStock)
                : null;

          if (target !== null && target !== stock) {
            movements.push({
              organizationId,
              type: "COUNT",
              quantity: round(target - stock, decimals),
              stockAfter: target,
              reason: "Recuento de inventario",
              authorId,
              createdAt: new Date(now - random.int(0, 3) * dayMs),
            });
            stock = target;
          }
        }

        const packFactors = item.packs
          ? random.chance(0.6)
            ? [6, 12, 24].slice(0, random.int(1, 2))
            : []
          : [];
        const presentationData = packFactors.map((factor, position) => ({
          organizationId,
          unit: factor >= 24 ? "box" : "pack",
          factor,
          // Small discount for buying in bulk.
          price: round(price * factor * (1 - 0.03 * (position + 1))),
          barcode: nextBarcode(),
          position,
        }));

        const tags = [DEMO_TAG, ...(item.tags ?? [])];

        if (random.chance(0.2)) tags.push("novedad");

        await tx.product.create({
          data: {
            organizationId,
            name,
            sku: `${SKU_PREFIX}${String(++skuNumber).padStart(4, "0")}`,
            barcode: random.chance(0.85) ? nextBarcode() : null,
            description: random.chance(0.5)
              ? `${item.name} de la categoría ${item.category.toLowerCase()}. Producto de prueba.`
              : null,
            categoryId: categoryIds.get(item.category) ?? null,
            unit: item.unit,
            price,
            cost: random.chance(0.85) ? cost : null,
            taxRate,
            trackStock,
            stock,
            minStock,
            isActive: !random.chance(0.1),
            tags: tags.slice(0, PRODUCT_LIMITS.maxTags),
            createdById: authorId,
            createdAt,
            presentations: { create: presentationData },
            movements: { create: movements },
          },
          select: { id: true },
        });

        presentationCount += presentationData.length;
        movementCount += movements.length;
      }
    },
    { timeout: 120_000 },
  );

  console.log(
    [
      `Organización: ${organization.name} (${organization.slug})`,
      `Categorías: ${createdCategories} creadas, ${categoryIds.size - createdCategories} reutilizadas`,
      `Productos: ${count}`,
      `Presentaciones: ${presentationCount}`,
      `Movimientos de stock: ${movementCount}`,
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
