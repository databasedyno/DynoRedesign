import axiosBaseApi from "@/axiosConfig";

/**
 * Server-side encryption — sends payload to backend for encryption.
 * Replaces the previous client-side AES encryption that used an exposed
 * NEXT_PUBLIC_ key (which was visible in the browser bundle).
 */
const createEncryption = async (content: string): Promise<string> => {
  try {
    const {
      data: { data },
    } = await axiosBaseApi.post("/pay/encrypt-payload", {
      payload: content,
    });
    return data.data;
  } catch (error) {
    console.error("Server-side encryption failed:", error);
    throw new Error("Failed to encrypt payment data");
  }
};

export default createEncryption;
