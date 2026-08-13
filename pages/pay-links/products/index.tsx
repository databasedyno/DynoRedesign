import type { GetServerSideProps } from "next";

/**
 * /pay-links/products is now the "Products" tab of Storefront.
 *
 * Products are part of the merchant's storefront, not a second kind of payment
 * link — live products now render inline on their public page. The editor
 * routes (/pay-links/products/new, /[productId]/edit, /[productId]/orders) are
 * unchanged; only this list view moved.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/storefront?tab=products",
    permanent: false,
  },
});

const ProductsRedirect = () => null;

export default ProductsRedirect;
