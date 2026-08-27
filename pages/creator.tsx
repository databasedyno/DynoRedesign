import type { GetServerSideProps } from "next";

/**
 * /creator is now the "Page" tab of Storefront.
 *
 * The creator page, the product catalog and the share tools all configure ONE
 * public URL (dynopay.com/{handle}), so they were merged into /storefront —
 * having them as separate destinations meant a merchant could publish a page
 * that never mentioned the products they were selling.
 *
 * Server-side redirect (not a client `router.replace`) so no page bundle is
 * downloaded and there is no spinner flash. Every existing
 * `router.push("/creator")` in the app keeps working through this.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/storefront?tab=page",
    permanent: false,
  },
});

const CreatorRedirect = () => null;

export default CreatorRedirect;
