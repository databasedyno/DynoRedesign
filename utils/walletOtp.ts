import axios from "@/axiosConfig";

/**
 * Verify a wallet OTP. Extracted from the old WalletSaga so it can live
 * independently of redux-saga (wallet reads/mutations now go through SWR via
 * WalletDataContext). Behaviour is unchanged.
 */
export async function verifyOtp(
  payload: any
): Promise<{ status: boolean; message: string }> {
  try {
    const response = await axios.post("/wallet/verifyOtp", payload, {
      headers: { "Content-Type": "application/json" },
    });
    const httpStatus = response.status;
    const { message } = response.data;
    return { status: httpStatus === 200, message };
  } catch (e: any) {
    const message =
      e?.response?.data?.message ?? e?.message ?? "OTP verification failed";
    return { status: false, message };
  }
}
