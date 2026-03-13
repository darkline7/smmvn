export async function callProviderApi(
  baseUrl: string,
  apiKey: string,
  params: Record<string, string>,
  timeoutMs = 60000,
): Promise<Response> {
  const body = new URLSearchParams({ key: apiKey, ...params });
  return fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Origin": baseUrl.replace(/\/api.*/, ""),
      "Referer": baseUrl.replace(/\/api.*/, "") + "/",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
