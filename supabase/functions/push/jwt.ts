// APNs provider token: an ES256 JWT signed with the .p8 key (WebCrypto, so it runs in Deno and Node alike).
const b64url = (b: Uint8Array | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...b)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export async function apnsJwt(p8: string, keyId: string, teamId: string, now = Date.now()): Promise<string> {
  const der = Uint8Array.from(atob(p8.replace(/-----[^-]+-----|\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const unsigned = `${b64url(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }))}`;
  // WebCrypto gives r||s (64 bytes), which is exactly the JWS ES256 format
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}
