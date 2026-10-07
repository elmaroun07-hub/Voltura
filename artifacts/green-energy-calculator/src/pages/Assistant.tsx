import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useI18n } from "@/i18n";

export default function Assistant() {
  const { t } = useI18n();
  return (
    <Shell>
      <div className="space-y-8 h-full max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">{t("nav.assistant")}</h1>
          <p className="text-muted-foreground">
            {t("assistant.intro")}
          </p>
        </div>
        
        <ChatInterface />
      </div>
    </Shell>
  );
}
