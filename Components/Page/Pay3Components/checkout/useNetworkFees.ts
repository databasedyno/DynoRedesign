import { useEffect, useState } from 'react'
import { apiBase } from './checkoutApi'

/**
 * Live per-chain network fees (USD) from the public, server-cached
 * GET /api/pay/network-fees. `ready` flips after the response or 2.5 s, so the
 * coin preselect never waits on a slow fee provider.
 */
export function useNetworkFees(enabled: boolean): { fees: Record<string, number>; ready: boolean } {
  const [fees, setFees] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled || ready) return
    let active = true
    const timer = setTimeout(() => { if (active) setReady(true) }, 2500)
    fetch(`${apiBase()}/api/pay/network-fees`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active || !j?.data) return
        const map: Record<string, number> = {}
        for (const [chain, row] of Object.entries<any>(j.data)) {
          const usd = Number(row?.feeInUSD)
          if (Number.isFinite(usd)) map[chain] = usd
        }
        setFees(map)
      })
      .catch(() => {})
      .finally(() => { if (active) setReady(true) })
    return () => { active = false; clearTimeout(timer) }
  }, [enabled, ready])

  return { fees, ready }
}
