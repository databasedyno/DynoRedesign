/**
 * Per-send dispatch context (AsyncLocalStorage) so companyDispatch can hand
 * mailTransporter a fallback recipient WITHOUT threading a new argument through
 * every template sender. When the primary company address bounces, the Brevo
 * webhook re-sends the very same email to `fallbackTo` (the account owner).
 */
import { AsyncLocalStorage } from "async_hooks";

export interface DispatchContext {
  companyId: number | null;
  fallbackTo: string | null;
  fallbackName: string | null;
}

const als = new AsyncLocalStorage<DispatchContext>();

export const runWithDispatchContext = <T>(ctx: DispatchContext, fn: () => Promise<T>): Promise<T> => als.run(ctx, fn);

export const getDispatchContext = (): DispatchContext | undefined => als.getStore();
