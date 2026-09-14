import { useKycStatus } from "@/hooks/useKycStatus";

/**
 * Reads the shared GET /api/kyc/status entry (see useKycStatus) and reports
 * whether identity is `approved` — used to lock legal-name fields.
 */
export default function useIdentityVerified() {
  const { data, isLoading } = useKycStatus();
  const status = data?.status;
  return { verified: status === "approved", loading: !!isLoading, status };
}
