import type { GetServerSideProps } from "next";

/**
 * /company has been consolidated into Settings.
 *
 * The dedicated company page duplicated what `/settings?section=company`
 * already does — it listed the user's companies, opened CreateCompanyModal to
 * add one, and opened CompanySettingsDialog to edit one. Keeping both meant two
 * places to change the same thing, and it made /company the second-heaviest
 * route in the app at 2.93 MB of first-load JS (the shared baseline is 458 kB).
 *
 * This is a server-side redirect on purpose: the previous /profile stub did the
 * same job with a `useEffect` + `router.replace`, which still downloads the page
 * bundle and flashes a spinner before moving. Redirecting in
 * getServerSideProps costs no JS and is instant.
 *
 * The old implementation remains in git history if a dedicated
 * account/company management screen is ever wanted again (see the IA audit at
 * docs/IA_AUDIT_2026-08.md — "Account" is planned to become the single tenant,
 * at which point this becomes an account switcher rather than a company page).
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/settings?section=company",
    permanent: false,
  },
});

const CompanyRedirect = () => null;

export default CompanyRedirect;
