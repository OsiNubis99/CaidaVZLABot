import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `ms` ms
 * of stability. Useful for piping a search input into a server query
 * without firing a request per keystroke.
 */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
