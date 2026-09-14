import type { GetServerSideProps } from "next";

/**
 * /profile has been consolidated into Settings — the "Profile & Security"
 * section lives at /settings?section=profile.
 *
 * This used to be a client-side redirect (`useEffect` + `router.replace`), which
 * downloaded the page bundle and flashed a loading spinner before navigating.
 * Redirecting in getServerSideProps ships no JS and is instant, while existing
 * links and bookmarks keep working exactly as before.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/settings?section=profile",
    permanent: false,
  },
});

const ProfileRedirect = () => null;

export default ProfileRedirect;
