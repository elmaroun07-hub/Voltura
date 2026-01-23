import { Shell } from "@/components/layout/Shell";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default function Assistant() {
  return (
    <Shell>
      <div className="space-y-8 h-full max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Energy Assistant</h1>
          <p className="text-muted-foreground">
            Chat with our AI expert to learn more about renewable energy technologies.
          </p>
        </div>
        
        <ChatInterface />
      </div>
    </Shell>
  );
}
