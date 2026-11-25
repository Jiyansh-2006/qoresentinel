import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, RotateCcw, Send, ShieldAlert, Sparkles, User } from "lucide-react";
import { api } from "../services/api.js";
import type { AssistantChatMessage } from "../types/index.js";

const welcomeMessage: AssistantChatMessage = {
  role: "assistant",
  content: "Hi! I can explain QoreSentinel’s pages, grant review flow, wallet setup, and security model. What would you like to know?",
};

const suggestions = [
  "What does the Dashboard show?",
  "How does the grant review pipeline work?",
  "How do I connect QoreX safely?",
  "What does ML-DSA-87 protect?",
];

const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const isEmphasis = token.startsWith("**") || token.startsWith("__");
    const content = token.slice(isEmphasis ? 2 : 1, isEmphasis ? -2 : -1);
    const key = `${match.index}-${token}`;

    if (isEmphasis) {
      nodes.push(<strong key={key} className="font-semibold text-white">{content}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-200">{content}</code>);
    } else {
      nodes.push(<em key={key}>{content}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

const AssistantMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: Array<{ text: string; ordered: boolean }> = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-3 last:mb-0">
        {paragraph.map((line, index) => (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {renderInlineMarkdown(line)}
          </React.Fragment>
        ))}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const List = ordered ? "ol" : "ul";
    blocks.push(
      <List key={`list-${blocks.length}`} className={`${ordered ? "list-decimal" : "list-disc"} mb-3 space-y-1 pl-5 last:mb-0`}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item.text)}</li>
        ))}
      </List>
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const listItem = line.match(/^\s*(?:(\d+)[.)]|[-*])\s+(.+)$/);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h-${blocks.length}`} className="mb-2 mt-4 text-sm font-semibold text-white first:mt-0">
          {renderInlineMarkdown(heading[1])}
        </h3>
      );
    } else if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[1]);
      if (listItems.length && listItems[0].ordered !== ordered) flushList();
      listItems.push({ text: listItem[2], ordered });
    } else {
      flushList();
      paragraph.push(line);
    }
  });

  flushParagraph();
  flushList();
  return <div className="break-words">{blocks}</div>;
};

export const AssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const requestAnswer = async (conversation: AssistantChatMessage[]) => {
    setPending(true);
    setError(null);
    try {
      const response = await api.chatWithAssistant(conversation.slice(-12));
      const answer: AssistantChatMessage = { role: "assistant", content: response.reply };
      setMessages((current) => [...current, answer].slice(-12));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant request failed.");
    } finally {
      setPending(false);
    }
  };

  const sendQuestion = async (question: string) => {
    const content = question.trim();
    if (!content || pending) return;
    const conversation = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(conversation);
    setInput("");
    await requestAnswer(conversation);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(input);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">QoreSentinel Help Assistant</h1>
            <p className="text-sm text-slate-400">Ask about pages, grant review, wallets, or platform security.</p>
          </div>
        </div>
      </header>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-xs text-amber-100">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p>
          This is a read-only website guide; it cannot access your account or perform transactions. When enabled, your chat messages are sent to Groq to generate replies. Never share recovery phrases, private keys, passwords, or API keys here.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div
          className="h-[480px] max-h-[60vh] space-y-4 overflow-y-auto bg-[#080d18] p-4 sm:p-6"
          aria-live="polite"
          aria-label="Assistant conversation"
        >
          {messages.map((message, index) => {
            const isAssistant = message.role === "assistant";
            return (
              <div key={`${index}-${message.role}`} className={`flex items-start gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isAssistant ? "bg-cyan-500/10 text-cyan-300" : "bg-slate-700 text-slate-200"}`}>
                  {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isAssistant ? "rounded-tl-sm border border-slate-800 bg-slate-900 text-slate-200" : "rounded-tr-sm bg-cyan-950/70 text-cyan-50"}`}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {isAssistant ? "Website Guide" : "You"}
                  </p>
                  {isAssistant ? (
                    <AssistantMessageContent content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
              </div>
            );
          })}
          {pending && (
            <div className="flex items-center gap-3 text-sm text-slate-400" role="status">
              <Sparkles className="h-4 w-4 animate-pulse text-cyan-400" />
              The guide is thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3 sm:px-6">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={pending}
                onClick={() => void sendQuestion(suggestion)}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-700 hover:text-cyan-200 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start justify-between gap-4 border-t border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs text-rose-200 sm:px-6">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
            <button
              type="button"
              onClick={() => void requestAnswer(messages)}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-800 px-2.5 py-1.5 hover:bg-rose-900/40 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-slate-800 p-4 sm:p-6">
          <label htmlFor="assistant-question" className="sr-only">Ask the QoreSentinel website guide</label>
          <textarea
            id="assistant-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion(input);
              }
            }}
            maxLength={1200}
            rows={2}
            placeholder="Ask a question about the website…"
            className="min-h-12 flex-1 resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-600"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        <p className="px-4 pb-4 text-[11px] text-slate-600 sm:px-6">
          Enter to send · Shift+Enter for a new line · Chat history is kept only in this page session.
        </p>
      </section>
    </div>
  );
};
