import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { StepUpScope } from "./stepUpBus";

export type StepUpMethod = "email" | "sms" | "totp" | "backup";

export interface StepUpStatus {
  scope: StepUpScope;
  active: boolean;
  expires_at: number | null;
  now: number;
  ttl_seconds: number;
  methods: Record<StepUpMethod, boolean>;
  contact: { email: string; phone: string };
}

export interface StepUpCodeSent {
  channel: "email" | "sms";
  contact: string;
  expires_in: number;
}

export interface StepUpVerified {
  scope: StepUpScope;
  active: true;
  expires_at: number;
  ttl_seconds: number;
}

export const fetchStepUpStatus = async (scope: StepUpScope): Promise<StepUpStatus> =>
  (await axiosBaseApi.get(API_ENDPOINTS.stepUp.status(scope))).data?.data as StepUpStatus;

export const requestStepUpCode = async (scope: StepUpScope): Promise<StepUpCodeSent> =>
  (await axiosBaseApi.post(API_ENDPOINTS.stepUp.requestCode(scope), {})).data?.data as StepUpCodeSent;

export const verifyStepUpCode = async (scope: StepUpScope, method: StepUpMethod, code: string): Promise<StepUpVerified> =>
  (await axiosBaseApi.post(API_ENDPOINTS.stepUp.verify(scope), { method, code })).data?.data as StepUpVerified;

export const revokeStepUp = async (scope: StepUpScope): Promise<void> => {
  await axiosBaseApi.post(API_ENDPOINTS.stepUp.revoke(scope), {});
};

export const apiErrorMessage = (e: unknown, fallback: string): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};
