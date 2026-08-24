/**
 * Veriff Identity Verification Service
 * Documentation: https://devdocs.veriff.com/apidocs
 */

import axios, { AxiosInstance } from "axios";
import { apiLogger } from "../utils/loggers";
import CryptoJS from "crypto-js";
import crypto from "crypto";
import { hmacHex, verifyVeriffSignature } from "../utils/webhookSignature";

// Veriff API Configuration
const VERIFF_API_BASE_URL = "https://stationapi.veriff.com";
const VERIFF_API_VERSION = "v1";

interface VeriffConfig {
  apiKey: string;
  apiSecret: string;
}

interface CreateSessionParams {
  verification: {
    callback: string;
    person: {
      firstName?: string;
      lastName?: string;
      idNumber?: string;
    };
    vendorData?: string;
    timestamp?: string;
  };
}

interface CreateSessionResponse {
  status: string;
  verification: {
    id: string;
    url: string;
    vendorData: string;
    host: string;
    status: string;
    sessionToken: string;
  };
}

interface VerificationDecision {
  status: string;
  verification: {
    id: string;
    code: number;
    person: {
      firstName: string;
      lastName: string;
      idNumber: string;
      dateOfBirth: string;
      nationality: string;
      addresses: Array<Record<string, unknown>>;
    };
    document: {
      number: string;
      type: string;
      country: string;
      validFrom: string;
      validUntil: string;
    };
    status: string;
    decision: string;
    decisionTime: string;
    acceptanceTime: string;
    reason: string;
    reasonCode: number;
    comments: Array<Record<string, unknown>>;
  };
}

class VeriffService {
  private apiKey: string;
  private apiSecret: string;
  private axiosInstance: AxiosInstance;

  constructor(config: VeriffConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    this.axiosInstance = axios.create({
      baseURL: `${VERIFF_API_BASE_URL}/${VERIFF_API_VERSION}`,
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": this.apiKey,
      },
    });
  }

  /**
   * Generate signature for API requests
   * Required for POST requests to Veriff API
   * Uses crypto-js for HMAC-SHA256 signature generation
   */
  private generateSignature(payload: unknown): string {
    const payloadString = JSON.stringify(payload);
    const signature = CryptoJS.HmacSHA256(payloadString, this.apiSecret).toString(CryptoJS.enc.Hex);
    return signature.toLowerCase();
  }

  /**
   * Create a new verification session
   * This generates a unique session URL for the user to complete verification
   */
  async createSession(params: {
    userId: number;
    companyId: number;
    firstName?: string;
    lastName?: string;
    callbackUrl: string;
  }): Promise<CreateSessionResponse> {
    try {
      const payload: CreateSessionParams = {
        verification: {
          callback: params.callbackUrl,
          person: {
            firstName: params.firstName,
            lastName: params.lastName,
          },
          vendorData: JSON.stringify({
            user_id: params.userId,
            company_id: params.companyId,
          }),
          timestamp: new Date().toISOString(),
        },
      };

      const signature = this.generateSignature(payload);

      const response = await this.axiosInstance.post<CreateSessionResponse>(
        "/sessions",
        payload,
        {
          headers: {
            "X-HMAC-SIGNATURE": signature,
          },
        }
      );

      apiLogger.info("Veriff session created:", response.data.verification.id);
      return response.data;

    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      apiLogger.error("Veriff create session error:", err.response?.data || err.message);
      throw new Error(
        `Failed to create Veriff session: ${err.response?.data?.message || err.message}`
      );
    }
  }

  /**
   * Get verification decision/status
   * Check the current status of a verification
   */
  async getVerificationDecision(
    verificationId: string
  ): Promise<VerificationDecision> {
    try {
      const response = await this.axiosInstance.get<VerificationDecision>(
        `/sessions/${verificationId}/decision`,
        {
          headers: {
            "X-AUTH-CLIENT": this.apiKey,
          },
        }
      );

      apiLogger.info("Veriff decision retrieved:", verificationId);
      return response.data;

    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      apiLogger.error("Veriff get decision error:", err.response?.data || err.message);
      throw new Error(
        `Failed to get Veriff decision: ${err.response?.data?.message || err.message}`
      );
    }
  }

  /**
   * Verify webhook signature
   * Ensures webhook requests are authentic
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload);
      return signature.toLowerCase() === expectedSignature;
    } catch (error) {
      apiLogger.error("Webhook signature verification error:", error);
      return false;
    }
  }

  /**
   * Sign RAW bytes with the shared secret (HMAC-SHA256, lowercase hex).
   * Veriff signs the RAW request body — we MUST verify against the exact
   * bytes received, never a re-stringified parsed object (whitespace / key
   * order / escaping differences would break the digest).
   */
  signRaw(raw: Buffer | string): string {
    // Delegates to the centralized inbound verifier module (HMAC-SHA256, hex).
    // hmacHex hashes a string as utf8 — identical to Buffer.from(raw,"utf8").
    return hmacHex("sha256", raw, this.apiSecret);
  }

  /**
   * Verify a Veriff webhook HMAC signature against the RAW request body
   * (constant-time comparison).
   */
  verifyWebhookRaw(raw: Buffer | string, signature?: string): boolean {
    return verifyVeriffSignature(raw, signature, this.apiSecret);
  }

  /**
   * Verify the X-AUTH-CLIENT header equals our API key (constant-time).
   */
  verifyAuthClient(client?: string): boolean {
    if (!client) return false;
    const a = Buffer.from(String(client));
    const b = Buffer.from(this.apiKey);
    if (a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Parse webhook payload
   * Extract relevant information from Veriff webhook
   */
  parseWebhookPayload(payload: Record<string, unknown>): {
    verificationId: string;
    status: string;
    decision: string;
    decisionCode: string;
    reason: string;
    vendorData: Record<string, unknown>;
  } {
    const verification = (payload.verification || {}) as {
      id?: string;
      status?: string;
      decision?: string;
      code?: number | string;
      reason?: string | null;
      reasonCode?: number | string | null;
      vendorData?: string;
    };
    
    let vendorData: Record<string, unknown> = {};
    try {
      vendorData = JSON.parse(verification.vendorData || "{}");
    } catch (e) {
      apiLogger.error("Failed to parse vendor data:", e);
    }

    // Current Veriff decision webhook carries the outcome in verification.status
    // (approved / declined / resubmission_requested / expired / abandoned).
    // Older payloads used verification.decision — fall back for safety.
    // NOTE: top-level payload.status ("success") is delivery status, NOT the KYC result.
    const outcome = verification.status || verification.decision || "unknown";

    return {
      verificationId: verification.id || "",
      status: outcome,
      decision: outcome,
      decisionCode: verification.code != null ? String(verification.code) : "",
      reason: verification.reason || "",
      vendorData,
    };
  }

  /**
   * Map Veriff decision to KYC status
   */
  mapDecisionToStatus(decision: string): string {
    const statusMap: { [key: string]: string } = {
      approved: "approved",
      declined: "rejected",
      resubmission_requested: "resubmission_requested",
      expired: "expired",
      abandoned: "abandoned",
    };

    return statusMap[decision] || "pending";
  }
}

// Singleton instance
let veriffServiceInstance: VeriffService | null = null;

/**
 * Get Veriff service instance
 */
export const getVeriffService = (): VeriffService => {
  if (!veriffServiceInstance) {
    // Try to initialize from environment variables
    const apiKey = process.env.VERIFF_API_KEY;
    const apiSecret = process.env.VERIFF_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Veriff API credentials not configured. Please set VERIFF_API_KEY and VERIFF_API_SECRET in environment variables.");
    }

    veriffServiceInstance = new VeriffService({ apiKey, apiSecret });
  }

  return veriffServiceInstance;
};

export default VeriffService;
