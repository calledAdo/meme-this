/**
 * Node's fetch negotiates HTTP/2 by default. The public Arc RPC drops HTTP/2 sessions and undici then keeps
 * reusing the dead session ("ERR_HTTP2_INVALID_SESSION"), so every server-side RPC call fails until restart.
 * Force HTTP/1.1 keep-alive for all outgoing server requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new Agent({ allowH2: false, keepAliveTimeout: 10_000 }));
}
