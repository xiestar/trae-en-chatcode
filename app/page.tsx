"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "./api/deepseek";
import ReactMarkdown from "react-markdown";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! How can I assist you today?", reasoning: "" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [isTyping, setIsTyping] = useState(false);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const typeMessage = useCallback((message: string) => {
    let index = 0;
    setIsTyping(true);
    setDisplayedContent("");
  
    const type = () => {
      if (index < message.length) {
        setDisplayedContent(prev => prev + message[index]);
        index++;
        typewriterRef.current = setTimeout(type, 30);
      } else {
        setIsTyping(false);
      }
    };
  
    type();
  }, []);
  
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        typeMessage(lastMessage.content);
      }
    }
  }, [messages, typeMessage]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      if (response.ok) {
        const assistantMessage = data.choices[0].message;
        const reasoningMatch = assistantMessage.content.match(/推理过程：([\s\S]*?)\n\n最终回答：([\s\S]*)/i);
        
        if (reasoningMatch) {
          assistantMessage.reasoning = reasoningMatch[1].trim();
          assistantMessage.content = reasoningMatch[2].trim();
        }
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(data.error || "发送消息失败");
        console.error("Chat error:", data.error);
      }
    } catch (error) {
      setError("网络错误，请稍后重试");
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <nav className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI Chat</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => signIn(undefined, { callbackUrl: '/' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative pt-16">
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 mt-8 mb-24">
          <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-[calc(100vh-12rem)]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className="flex items-start space-x-3 animate-fade-in">
                  <div className={`w-8 h-8 rounded-lg ${message.role === "assistant" ? "bg-gradient-to-r from-blue-600 to-cyan-500" : "bg-gray-600"} flex items-center justify-center text-white font-semibold shrink-0`}>
                    {message.role === "assistant" ? "AI" : "U"}
                  </div>
                  <div className={`flex-1 ${message.role === "assistant" ? "bg-gray-100 dark:bg-gray-700" : "bg-blue-50 dark:bg-gray-600"} rounded-2xl p-4 text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none break-words`}>
                    {message.role === "assistant" && message.reasoning && (
                      <details className="mb-4">
                        <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">查看推理过程</summary>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                          <ReactMarkdown>{message.reasoning}</ReactMarkdown>
                        </div>
                      </details>
                    )}
                    <ReactMarkdown>
                      {message.role === "assistant" && index === messages.length - 1
                        ? (isTyping ? displayedContent : message.content)
                        : message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {error && (
                <div className="text-red-500 dark:text-red-400 text-center py-2 animate-fade-in">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入您的消息..."
                className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center disabled:opacity-50 min-w-[80px]"
              >
                {isLoading ? "发送中..." : "发送"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
