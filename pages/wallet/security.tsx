import type { GetServerSideProps } from "next";

/** /wallet/security merged into Settings → Security (dashboard redesign, Wave 2). Old links keep working. */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/settings?section=security", permanent: false },
});

const WalletSecurityRedirect = () => null;

export default WalletSecurityRedirect;
