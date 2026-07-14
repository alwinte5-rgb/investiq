"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askAdvisorAction } from "@/app/(authed)/advisor/actions";

const SUGGESTED = [
  "What's the difference between margin and risk?",
  "Explain pip value with an example.",
  "How does leverage change what I can lose?",
  "Why does my position size depend on my stop loss?",
  "What does a 1:2 risk-to-reward ratio mean?",
  "What is swap and when am I charged it?",
];

interface Msg {
  role: "user" | "advisor";
  text: string;
}

export function AdvisorUI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function ask(q: string) {
    const question = q.trim();
    if (question.length < 3 || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    start(async () => {
      const res = await askAdvisorAction(question);
      if (res.ok) setMessages((m) => [...m, { role: "advisor", text: res.answer }]);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Ask about an investing concept or your own portfolio. Try one of these:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
                Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about investing or your portfolio…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length < 3}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>

      <p className="text-[11px] text-slate-400">
        Educational only — InvestIQ is not a financial advisor and never gives buy/sell or
        personalized investment advice.
      </p>
    </div>
  );
}
