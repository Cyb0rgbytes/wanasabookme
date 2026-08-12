import "server-only";

/**
 * Reads the wall clock outside of React's render.
 *
 * `Date.now()` called inside a component body — even a Server Component — is
 * impure: React's purity rule flags it because the value gets baked into
 * prerendered or cached output. An event marked "already started" would stay
 * that way after caching, or vice versa.
 *
 * Isolating the call here keeps components pure while still letting pages read
 * the current time. Pass the result down as data; never call Date.now() in JSX
 * or a component body.
 *
 * `server-only` makes importing this from a Client Component a build error —
 * client clocks are the user's, which may be wrong or deliberately skewed.
 */
export function currentTime(): number {
  return Date.now();
}
