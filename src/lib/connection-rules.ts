/** Timeout for a single reachability check; slow answers never count as offline. */
export const CHECK_TIMEOUT_MS = 15_000;
/** Consecutive network failures (with the browser still reporting online) before showing offline. */
export const NETWORK_FAILURES_FOR_OFFLINE = 2;
