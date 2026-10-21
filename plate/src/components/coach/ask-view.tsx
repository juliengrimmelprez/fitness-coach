"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { askCoach } from "@/app/actions/ai";
import type { CoachData } from "@/components/coach/use-coach-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Why did this week feel harder than last week?",
  "Should I train legs or run today?",
  "Am I eating enough protein for my training?",
  "What should I eat after soccer tonight?",
  "Am I on track to get leaner?",
];

/** Renders **bold** from the model as bold text (it occasionally uses it despite the plain-text instruction). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function AskView({ data, profile }: { data: CoachData; profile: Profile }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const result = await askCoach({ context: data.context, goal: profile.goal, messages: next });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setMessages(messages); // roll back so the question can be retried
      setInput(q);
      return;
    }
    setMessages([...next, { role: "assistant", content: result.data }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <div className="space-y-3 pt-2">
          <div className="text-center">
            <MessageCircle className="mx-auto size-8 text-primary" />
            <p className="mt-2 font-medium">Ask your coach</p>
            <p className="text-sm text-muted-foreground">Answers use your sleep, training, food and weight from the last 5 weeks.</p>
          </div>
          <div className="grid gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="xs" variant="ghost" onClick={() => setMessages([])} disabled={loading}>
              <RotateCcw /> New chat
            </Button>
          </div>
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary",
                )}
              >
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Looking at your data…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form
        className="sticky bottom-20 flex items-end gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask about your training, sleep or food…"
          className="min-h-9 resize-none border-0 shadow-none focus-visible:ring-0"
          aria-label="Your question"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || loading} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
