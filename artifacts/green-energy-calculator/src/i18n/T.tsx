import type { Params } from "@workspace/i18n";
import { useI18n } from "./index";
import { catalog, type WebKey } from "./catalog";

type Es = typeof catalog.es;
/** Keys whose Spanish entry takes no parameters. */
type PlainKey = { [K in WebKey]: [Params<Es[K]>] extends [never] ? K : never }[WebKey];

/** A catalog entry as a JSX child, for components that only need one word (screen-reader labels). */
export function T({ k }: { k: PlainKey }) {
  const { t } = useI18n();
  return <>{(t as (key: PlainKey) => string)(k)}</>;
}
