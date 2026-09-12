/**
 * Case/whitespace-insensitive email matching: `Foo@Example.com` and
 * `foo@example.com ` must resolve to the same account. Apply this before
 * every lookup, uniqueness check, and write involving a user-supplied email —
 * inconsistent casing between two call sites is exactly how "foo@x.com" and
 * "Foo@x.com" end up as two different accounts sharing one mailbox.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
