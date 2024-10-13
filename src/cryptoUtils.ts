import { randomBytes, createHash } from 'crypto';

export function generateSecretAndHash(): { secret: Buffer, hash: Buffer, hashHex: string } {
    const secret: Buffer = randomBytes(32);
    const hash: Buffer = createHash("sha256").update(new Uint8Array(secret)).digest();
    const hashHex = "0x" + hash.toString("hex");
    return { secret, hash, hashHex };
}
