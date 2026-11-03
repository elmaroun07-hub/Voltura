/**
 * VPUB-SEC: the session id is the only thing that ties a browser to its
 * calculations and conversations, so it works as a bearer secret.
 *
 * The web app makes it with crypto.randomUUID() (queryClient.ts), a version 4
 * UUID with 122 random bits, which nobody can guess. The server took any
 * string, so a short or predictable id ("1", "test", "browser-a") was accepted
 * and could be shared or guessed by someone else. Only a version 4 UUID is
 * accepted now; anything else is answered as if the header were absent.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSessionId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}
