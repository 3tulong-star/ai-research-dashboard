import { createCipheriv, publicEncrypt, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath = "data/research-snapshot.enc.json"] = process.argv.slice(2);
if (!inputPath) throw new Error("Usage: node scripts/encrypt-research-snapshot.mjs INPUT [OUTPUT]");

const [plaintext, publicKey] = await Promise.all([
  readFile(inputPath),
  readFile(new URL("../config/research-public.pem", import.meta.url), "utf8"),
]);
const parsed = JSON.parse(plaintext.toString("utf8"));
if (!parsed.generatedAt || !parsed.discoveryCandidates?.length || !parsed.snapshots?.length || !parsed.decisions?.length) {
  throw new Error("Refusing to encrypt an incomplete research snapshot");
}

const key = randomBytes(32);
const iv = randomBytes(12);
const aad = Buffer.from("sanben-research-v1", "utf8");
const cipher = createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(aad);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
const wrappedKey = publicEncrypt({ key: publicKey, oaepHash: "sha256" }, key);

await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  algorithm: "RSA-OAEP-3072+AES-256-GCM",
  generatedAt: parsed.generatedAt,
  aad: aad.toString("base64"),
  wrappedKey: wrappedKey.toString("base64"),
  iv: iv.toString("base64"),
  tag: tag.toString("base64"),
  ciphertext: ciphertext.toString("base64"),
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ENCRYPTED", generatedAt: parsed.generatedAt, bytes: plaintext.length, outputPath }));
