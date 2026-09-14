import React, { useCallback, useEffect, useState } from "react";
import StepUpDialog from "./StepUpDialog";
import { emitStepUpSession, registerStepUpHandler, StepUpScope } from "./stepUpBus";
import type { StepUpVerified } from "./stepUpApi";

type Req = { scope: StepUpScope; resolvers: ((ok: boolean) => void)[] };

/**
 * Mounted once at the app root. Owns the shared StepUpDialog and serves
 * requests from the bus (axios interceptor + explicit callers) one scope at a time.
 */
const StepUpHost: React.FC = () => {
  const [queue, setQueue] = useState<Req[]>([]);

  useEffect(
    () =>
      registerStepUpHandler(
        (scope) =>
          new Promise<boolean>((resolve) => {
            setQueue((q) => {
              const idx = (q ?? []).findIndex((r) => r.scope === scope);
              if (idx === -1) return [...q, { scope, resolvers: [resolve] }];
              const next = [...q];
              next[idx] = { scope, resolvers: [...next[idx].resolvers, resolve] };
              return next;
            });
          }),
      ),
    [],
  );

  const current = queue[0] || null;

  const settle = useCallback(
    (ok: boolean, result?: StepUpVerified) => {
      if (!current) return;
      if (ok && result) emitStepUpSession({ scope: current.scope, active: true, expires_at: result.expires_at });
      (current.resolvers ?? []).forEach((r) => r(ok));
      setQueue((q) => q.slice(1));
    },
    [current],
  );

  if (!current) return null;
  return <StepUpDialog key={current.scope} open scope={current.scope} onVerified={(r) => settle(true, r)} onCancel={() => settle(false)} />;
};

export default StepUpHost;
