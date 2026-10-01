/**
 * Render's free plan stops the service after 15 minutes without inbound traffic,
 * and waking it takes up to a minute. That slows the first dashboard load and can
 * make Zoko's webhook miss its 5-second reply window.
 *
 * Render sets RENDER_EXTERNAL_URL on every web service. Calling our own /health
 * through that public URL counts as inbound traffic, so the service stays awake.
 * One always-on free service fits in Render's 750 free hours a month.
 * Does nothing locally (the variable is not set).
 */
export function startKeepAwake(intervalMs = 10 * 60_000) {
  const base = process.env.RENDER_EXTERNAL_URL;
  if (!base) return;
  const url = `${base.replace(/\/+$/, "")}/health`;
  const ping = () =>
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then((res) => {
        if (!res.ok) console.warn(`keep-awake: ${url} answered ${res.status}`);
      })
      .catch((err) => console.warn("keep-awake ping failed", String(err)));
  console.log(`keep-awake: pinging ${url} every ${intervalMs / 60_000} min`);
  return setInterval(ping, intervalMs);
}
