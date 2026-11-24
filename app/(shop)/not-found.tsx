import { NotFoundContent } from "@/components/shop/not-found-content";

/** notFound() inside the shop (a removed product, an unknown category...). */
export default function ShopNotFound() {
  return (
    <NotFoundContent
      title="We couldn't find that"
      message="This product or page isn't available. It may have been removed or renamed."
    />
  );
}
