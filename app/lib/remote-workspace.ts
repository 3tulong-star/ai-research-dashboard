type Workspace = Record<string, unknown> & {
  generatedAt?: string | null;
  discoveryCandidates?: unknown[];
  snapshots?: unknown[];
  decisions?: unknown[];
};

type EncryptedSnapshot = {
  schemaVersion: number;
  algorithm: string;
  generatedAt: string;
  aad: string;
  wrappedKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

const SNAPSHOT_URL = "https://raw.githubusercontent.com/3tulong-star/ai-research-dashboard/main/data/research-snapshot.enc.json";
let cached: { expiresAt: number; value: Workspace } | null = null;

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pemBytes(pem: string) {
  return decodeBase64(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
}

function concat(left: Uint8Array, right: Uint8Array) {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left);
  joined.set(right, left.length);
  return joined;
}

export async function loadRemoteWorkspace(privateKeyPem: string | undefined): Promise<Workspace | null> {
  if (!privateKeyPem) return null;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const response = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`encrypted snapshot HTTP ${response.status}`);
    const envelope = await response.json() as EncryptedSnapshot;
    if (envelope.schemaVersion !== 1 || envelope.algorithm !== "RSA-OAEP-3072+AES-256-GCM") throw new Error("unsupported encrypted snapshot");
    const privateKey = await crypto.subtle.importKey(
      "pkcs8", pemBytes(privateKeyPem), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"],
    );
    const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, decodeBase64(envelope.wrappedKey));
    const aesKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({
      name: "AES-GCM", iv: decodeBase64(envelope.iv),
      additionalData: decodeBase64(envelope.aad), tagLength: 128,
    }, aesKey, concat(decodeBase64(envelope.ciphertext), decodeBase64(envelope.tag)));
    const workspace = JSON.parse(new TextDecoder().decode(plaintext)) as Workspace;
    if (!workspace.generatedAt || !workspace.discoveryCandidates?.length || !workspace.snapshots?.length || !workspace.decisions?.length) {
      throw new Error("decrypted research snapshot is incomplete");
    }
    cached = { expiresAt: Date.now() + 5 * 60 * 1000, value: workspace };
    return workspace;
  } catch (error) {
    console.error("encrypted research snapshot unavailable", error instanceof Error ? error.message : String(error));
    return null;
  }
}
