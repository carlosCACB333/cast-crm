import { ProductDetailLayout } from "@/components/products/product-detail-view";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;

  return <ProductDetailLayout id={id}>{children}</ProductDetailLayout>;
}
