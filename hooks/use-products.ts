"use client";

import type {
  ProductListFilters,
  StockMovementListParams,
} from "@/lib/validations/products";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { listProductCategories } from "@/lib/actions/product-categories";
import {
  getProduct,
  listProducts,
  listStockMovements,
  lookupProductBarcode,
} from "@/lib/actions/products";
import { queryKeys } from "@/lib/query-keys";

/** Paginated products; keeps the previous page visible while the next one loads. */
export function useProducts(filters: ProductListFilters) {
  return useQuery({
    queryKey: queryKeys.productList(filters),
    queryFn: () => unwrapAction(listProducts(filters)),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => unwrapAction(getProduct(id)),
    retry: false,
  });
}

/** One page of a product's stock history; keeps the previous page while loading. */
export function useStockMovements(params: StockMovementListParams) {
  return useQuery({
    queryKey: queryKeys.stockMovements(params),
    queryFn: () => unwrapAction(listStockMovements(params)),
    placeholderData: keepPreviousData,
  });
}

/** Product categories configured by the active organization, in order. */
export function useProductCategories() {
  return useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: () => unwrapAction(listProductCategories()),
  });
}

/**
 * Product of the organization with this barcode, or suggestions from other
 * organizations to fill a new one. Idle while the code is empty.
 */
export function useBarcodeLookup(barcode: string) {
  return useQuery({
    queryKey: queryKeys.productBarcodeLookup(barcode),
    queryFn: () => unwrapAction(lookupProductBarcode(barcode)),
    enabled: barcode !== "",
    staleTime: 60_000,
  });
}
