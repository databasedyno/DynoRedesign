import React, { useCallback, useRef, useState } from "react";
import ConfirmDialog, { ConfirmTone } from "./index";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  testIdPrefix?: string;
}

/**
 * Promise-based confirm, so an async handler reads like the old window.confirm:
 *   if (!(await confirm({ title, message, tone: "danger" }))) return;
 * Render `confirmDialog` once in the component's JSX.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    setOpen(false);
    resolverRef.current?.(v);
    resolverRef.current = null;
  }, []);

  const confirmDialog = opts ? (
    <ConfirmDialog {...opts} open={open} onClose={() => settle(false)} onConfirm={() => settle(true)} />
  ) : null;

  return { confirm, confirmDialog };
}

export default useConfirm;
