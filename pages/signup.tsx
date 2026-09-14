import { GetServerSideProps } from "next";

// Marketing alias — referral invite/reminder emails link to /signup?ref=CODE.
// The real page is /auth/register (which reads ?ref and prefills the code),
// so redirect while preserving the full query string.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const qIdx = ctx.resolvedUrl.indexOf("?");
  const qs = qIdx >= 0 ? ctx.resolvedUrl.slice(qIdx) : "";
  return {
    redirect: { destination: `/auth/register${qs}`, permanent: false },
  };
};

export default function SignupRedirect() {
  return null;
}
