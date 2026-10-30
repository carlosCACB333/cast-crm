"use client";

import {
  type CategoriesConfig,
  CategoriesSettings,
} from "@/components/catalog/categories-settings";
import { PRODUCT_LIMITS } from "@/config/products";
import { SERVICE_LIMITS } from "@/config/services";
import { usePermission } from "@/hooks/use-organization";
import { useProductCategories } from "@/hooks/use-products";
import { useServiceCategories } from "@/hooks/use-services";
import {
  createProductCategory,
  deleteProductCategory,
  moveProductCategory,
  updateProductCategory,
} from "@/lib/actions/product-categories";
import {
  createServiceCategory,
  deleteServiceCategory,
  moveServiceCategory,
  updateServiceCategory,
} from "@/lib/actions/service-categories";
import { queryKeys } from "@/lib/query-keys";

// Categories of each catalog module. Changing them requires
// `organization:update`; any member can read them.

const productCategories: CategoriesConfig = {
  title: "Categorías",
  description: "En el orden en que aparecen al elegirlas.",
  itemsLabel: { one: "producto", many: "productos" },
  placeholder: "Por ejemplo, Accesorios",
  maxCategories: PRODUCT_LIMITS.maxCategories,
  invalidate: [queryKeys.products],
  actions: {
    create: createProductCategory,
    update: updateProductCategory,
    move: moveProductCategory,
    remove: deleteProductCategory,
  },
};

const serviceCategories: CategoriesConfig = {
  ...productCategories,
  itemsLabel: { one: "servicio", many: "servicios" },
  placeholder: "Por ejemplo, Mantenimiento",
  maxCategories: SERVICE_LIMITS.maxCategories,
  invalidate: [queryKeys.services],
  actions: {
    create: createServiceCategory,
    update: updateServiceCategory,
    move: moveServiceCategory,
    remove: deleteServiceCategory,
  },
};

export function ProductCategories() {
  const canEdit = usePermission({ organization: ["update"] });
  const categories = useProductCategories();

  return (
    <CategoriesSettings
      canEdit={canEdit}
      categories={categories}
      config={productCategories}
    />
  );
}

export function ServiceCategories() {
  const canEdit = usePermission({ organization: ["update"] });
  const categories = useServiceCategories();

  return (
    <CategoriesSettings
      canEdit={canEdit}
      categories={categories}
      config={serviceCategories}
    />
  );
}
