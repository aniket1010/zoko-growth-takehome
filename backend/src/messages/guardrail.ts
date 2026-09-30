import { env } from "../config/env.js";
import { digitsOnly } from "../lib/phone.js";

export class RecipientNotAllowedError extends Error {
  constructor(phone: string) {
    super(`Refusing to send to ${phone}: not in SEND_ALLOWLIST`);
  }
}

/**
 * The brief's hard rule: only ever message our own or a test number.
 * This check lives in the backend, directly before the Zoko call, so no UI
 * bug or hand-crafted request can bypass it. Empty allowlist = send nothing.
 */
export function assertRecipientAllowed(phone: string | null | undefined): string {
  const digits = digitsOnly(phone ?? "");
  if (!digits || !env.SEND_ALLOWLIST.includes(digits)) throw new RecipientNotAllowedError(phone ?? "<none>");
  return digits;
}
