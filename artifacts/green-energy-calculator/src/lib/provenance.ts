import { type Resolution } from "@/lib/api";
import { type WebTranslate } from "@/i18n";

/**
 * The one place a machine enum becomes words a person reads. G7.
 *
 * `irradianceSource` is the provenance record: it is asserted in the API test
 * suite and a production watch reads it, so it must never be printed raw.
 * A previous branch would have shown users `nasa-live`.
 *
 * Extracted from ResultsDisplay at H-OPT, unchanged, because the AI Optimizer
 * tab now ships a provenance line too and two label maps for one enum is how
 * they drift — one tab saying "NASA POWER satellite data, 2019–2023 mean" while
 * the other still says 2022. P5: one map, and G7's gate reads the render sites
 * that call it. H2b: the words now come from the catalog, in the reader's
 * language; the map is still this one switch.
 *
 * The period is taken from the response, never written as a literal here: a
 * hardcoded year in the UI would be a second source of truth for one fact, and
 * would keep saying it the day the server starts sending something else. It
 * states the years the mean actually spans, because a multi-year mean without
 * its period is not a citation.
 *
 * No default branch. The switch is exhaustive over the union, so TypeScript
 * fails the build if the enum grows; an impossible state throws rather than
 * being quietly given a comfortable label.
 */
export function irradianceLabel(resolution: Resolution, t: WebTranslate): string {
  switch (resolution.irradianceSource) {
    case "nasa-live": {
      if (resolution.irradiancePeriod === null) {
        throw new Error("nasa-live carries no irradiancePeriod");
      }
      const { start, end } = resolution.irradiancePeriod;
      const span = start === end ? `${start}` : `${start}–${end}`;
      return t("irradiance.nasa", { span });
    }
    case "not-reached":
      // Unreachable on a 200: an unresolvable location returns 422 before any
      // result exists to render.
      throw new Error("irradianceSource 'not-reached' on a successful response");
  }
}
