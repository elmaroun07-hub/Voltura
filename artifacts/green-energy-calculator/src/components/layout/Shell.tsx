import { Link, useLocation } from "wouter";
import { Leaf, History, Calculator, Zap, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/i18n";
import { LOCALES } from "@workspace/i18n";

const NAV_ITEMS = [
  { href: "/", label: "nav.calculator", icon: Calculator },
  { href: "/history", label: "nav.history", icon: History },
  { href: "/optimizer", label: "nav.optimizer", icon: Zap },
  { href: "/assistant", label: "nav.assistant", icon: MessageSquare },
] as const;

const CODE = { es: "lang.code.es", en: "lang.code.en" } as const satisfies Record<Locale, string>;
const NAME = { es: "lang.name.es", en: "lang.name.en" } as const satisfies Record<Locale, string>;

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-card border-r border-border shadow-sm flex-shrink-0 z-20">
        <div className="p-6 border-b border-border/50">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none text-foreground">{t("brand.name")}</h1>
              <span className="text-xs text-muted-foreground">{t("brand.tagline")}</span>
            </div>
          </Link>
        </div>

        <nav className="p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm border border-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        {/* Language. Spanish is the default (H2b, 2b.1); English is the translation. */}
        <div className="px-4 pb-2" role="group" aria-label={t("lang.switcher")}>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                data-testid={`button-locale-${code}`}
                lang={code}
                aria-label={t(NAME[code])}
                aria-pressed={locale === code}
                onClick={() => setLocale(code)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                  locale === code ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(CODE[code])}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-gradient-to-br from-primary to-accent/80 rounded-2xl p-4 text-white shadow-lg">
            <h3 className="font-bold mb-1">{t("shell.promoTitle")}</h3>
            <p className="text-sm opacity-90 mb-3">{t("shell.promoBody")}</p>
            <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
