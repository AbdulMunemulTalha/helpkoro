import { randomBytes } from 'node:crypto';

/**
 * Generate a UUID version 7 (time-ordered) per ADR-006.
 *
 * Layout: 48-bit big-endian Unix-ms timestamp, 4-bit version (0b0111),
 * 2-bit variant (0b10), and 74 bits of randomness. Time-ordered keys give
 * better index locality for high-write ledger and event tables.
 *
 * @param nowMs Millisecond timestamp to embed; defaults to the current time.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const buf = randomBytes(16);
  // 48-bit big-endian timestamp in bytes 0..5.
  buf.writeUIntBE(nowMs, 0, 6);
  // Version 7 in the high nibble of byte 6.
  buf[6] = (buf.readUInt8(6) & 0x0f) | 0x70;
  // Variant 0b10 in the high bits of byte 8.
  buf[8] = (buf.readUInt8(8) & 0x3f) | 0x80;
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `value` is a syntactically valid UUID (any version). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
