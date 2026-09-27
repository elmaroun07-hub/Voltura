import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionFetch } from "@/lib/queryClient";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export function useChat(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  // Fetch initial history
  useQuery({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await sessionFetch(`/api/conversations/${conversationId}`);
      if (!res.ok) return null;
      const data = await res.json();
      setMessages(data.messages || []);
      return data;
    },
  });

  const sendMessage = useCallback(async (content: string, id: number) => {

    // Optimistic update
    const userMsg: Message = { id: Date.now(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const res = await sessionFetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      // Handle SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg: Message = { id: Date.now() + 1, role: "assistant", content: "" };
      
      setMessages((prev) => [...prev, assistantMsg]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMsg = {
                ...assistantMsg,
                content: assistantMsg.content + data.content
              };
              setMessages((prev) => 
                prev.map(m => m.id === assistantMsg.id ? assistantMsg : m)
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] });
    }
  }, [queryClient]);

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await sessionFetch(`/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Energy Assistant Chat" }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      return await res.json();
    }
  });

  return {
    messages,
    sendMessage,
    isStreaming,
    createConversation
  };
}
