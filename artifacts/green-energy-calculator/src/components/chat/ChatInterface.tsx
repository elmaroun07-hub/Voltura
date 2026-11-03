import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export function ChatInterface() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const { messages, sendMessage, isStreaming, createConversation } = useChat(conversationId);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputRef.current?.value;
    if (!content) return;

    // The row is created by the first message, not by loading the page. State
    // is not readable in this tick, so the new id goes straight to sendMessage
    // and is reused for every later send in this session.
    let id = conversationId;
    if (id === null) {
      const conversation: { id: number } = await createConversation.mutateAsync();
      id = conversation.id;
      setConversationId(id);
    }

    sendMessage(content, id);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="flex flex-col h-[600px] shadow-2xl border-primary/10 overflow-hidden bg-white/80 backdrop-blur-sm">
      <div className="p-4 border-b bg-primary/5 flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">{t("nav.assistant")}</h3>
          <p className="text-xs text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
      </div>

      <p role="note" data-testid="ai-notice" className="px-4 py-2 text-xs text-muted-foreground bg-muted/40 border-b">
        {t("chat.aiNotice")}
      </p>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t("chat.hello")}</p>
              <p className="text-sm mt-2">{t("chat.tryAsking")}</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === "user" ? "bg-primary text-white" : "bg-accent/20 text-accent-foreground"
              )}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              
              <div
                // Article 50(2): the Assistant's text is marked as AI-generated in the page itself too.
                data-ai-disclosure={msg.role === "assistant" ? "machine-generated" : undefined}
                className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input 
            ref={inputRef} 
            placeholder={t("chat.placeholder")} 
            className="flex-1 focus-visible:ring-primary"
            disabled={isStreaming}
          />
          <Button type="submit" size="icon" aria-label={t("chat.send")} disabled={isStreaming} className={cn(isStreaming && "animate-pulse")}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
