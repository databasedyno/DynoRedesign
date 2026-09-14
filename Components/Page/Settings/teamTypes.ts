export type Role = "admin" | "member";
export type Status = "invited" | "active" | "revoked";

export interface Member {
  id: number;
  company_id: number;
  email: string;
  name: string | null;
  role: Role;
  permissions: Record<string, boolean>;
  status: Status;
  invited_at?: string;
  accepted_at?: string | null;
  expires_at?: string | null;
}

export interface Catalogue {
  keys: string[];
  labels: Record<string, string>;
  roles: string[];
  defaults: Record<string, Record<string, boolean>>;
}

export type Toast = (message: string, severity?: "success" | "error" | "info") => void;

export const roleColor = (role: string): "warning" | "default" => (role === "admin" ? "warning" : "default");
export const statusColor = (s: string): "success" | "info" | "default" =>
  s === "active" ? "success" : s === "invited" ? "info" : "default";

export const apiErrorMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
