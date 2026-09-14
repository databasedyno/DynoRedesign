/** Routes that never require a signed-in merchant session (auth, checkout, marketing). */
const PUBLIC_PATH_PREFIXES = [
  "/auth",
  "/reset-password",
  "/pay/",
  "/pay",
  "/payment",
  "/admin/login",
];
const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/fees",
  "/terms-conditions",
  "/privacy-policy",
  "/aml-policy",
  "/system-status",
  "/documentation",
  "/blog",
]);

export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/blog/")) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
};
