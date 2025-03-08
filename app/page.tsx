"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Message } from "./api/deepseek";
import ReactMarkdown from "react-markdown";
import { auth, database } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, push, set, onValue, query, orderByChild } from "firebase/database";
import AuthForm from "./components/auth/AuthForm";

const MessageContent = memo(({ content }: { content: string }) => (
  <div className="prose dark:prose-invert max-w-none break-words">
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
));

MessageContent.displayName = 'MessageContent';

const MessageItem = memo(({ message, isLatest, currentMessage }: { message: Message; isLatest: boolean; currentMessage: string }) => (
  <div className="flex items-start space-x-3 animate-fade-in">
    <div className={`w-8 h-8 rounded-lg ${message.role === "assistant" ? "bg-gradient-to-r from-blue-600 to-cyan-500" : "bg-gray-600"} flex items-center justify-center text-white font-semibold shrink-0`}>
      {message.role === "assistant" ? "AI" : "U"}
    </div>
    <div className={`flex-1 ${message.role === "assistant" ? "bg-gray-100 dark:bg-gray-700" : "bg-blue-50 dark:bg-gray-600"} rounded-2xl p-4 text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none break-words`}>
      {message.role === "assistant" && isLatest ? (
        <MessageContent content={currentMessage} />
      ) : (
        <MessageContent content={message.content} />
      )}
    </div>
  </div>
));

MessageItem.displayName = 'MessageItem';

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! How can I assist you today?", reasoning: "" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  // 这些变量暂时未使用，但可能在将来的功能中需要，先注释掉
  // const [isTyping, setIsTyping] = useState(false);
  // const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const typeMessage = useCallback((message: string) => {
    // setIsTyping(true);
    setCurrentMessage(message);
    // setIsTyping(false);
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 加载用户的聊天记录
        const chatRef = ref(database, `chats/${currentUser.uid}`);
        const chatQuery = query(chatRef, orderByChild('timestamp'));
        onValue(chatQuery, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const messageList = Object.values(data) as Message[];
            setMessages(messageList);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    if (user) {
      // 保存用户消息到数据库
      const chatRef = ref(database, `chats/${user.uid}`);
      const newMessageRef = push(chatRef);
      set(newMessageRef, { ...userMessage, timestamp: Date.now() });
    }
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "发送消息失败");
        console.error("Chat error:", errorData.error);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("无法读取响应流");
        return;
      }

      const decoder = new TextDecoder();
      let partialMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partialMessage += chunk;

        // 按行分割SSE数据
        const lines = partialMessage.split('\n');
        let shouldClearPartialMessage = false;

        try {
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6); // 移除 'data: ' 前缀
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.choices && data.choices[0] && data.choices[0].delta) {
                  const delta = data.choices[0].delta;
                  setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    let newMessage: Message;
                    if (lastMessage.role === "assistant") {
                      newMessage = {
                        role: "assistant" as const,
                        content: lastMessage.content + (delta.content || ""),
                        reasoning: lastMessage.reasoning || ""
                      };
                    } else {
                      newMessage = {
                        role: "assistant" as const,
                        content: delta.content || "",
                        reasoning: ""
                      };
                    }
                    
                    if (user) {
                      // 保存AI回复到数据库
                      const chatRef = ref(database, `chats/${user.uid}`);
                      const newMessageRef = push(chatRef);
                      set(newMessageRef, { ...newMessage, timestamp: Date.now() });
                    }
                    
                    return lastMessage.role === "assistant" ?
                      [...prev.slice(0, -1), newMessage] :
                      [...prev, newMessage];
                  });
                  shouldClearPartialMessage = true;
                }
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_error) {
                // JSON解析失败，可能是不完整的数据
                shouldClearPartialMessage = false;
              }
            }
          }

          if (shouldClearPartialMessage) {
            partialMessage = "";
          } else {
            // 保留最后一行，因为它可能是不完整的数据
            const lastNewlineIndex = partialMessage.lastIndexOf('\n');
            if (lastNewlineIndex !== -1) {
              partialMessage = partialMessage.slice(lastNewlineIndex + 1);
            }
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
          // 继续累积不完整的JSON
          continue;
        }
      }
    } catch (error) {
      setError("网络错误，请稍后重试");
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessages = useCallback(() => (
    messages.map((message, index) => (
      <MessageItem
        key={index}
        message={message}
        isLatest={index === messages.length - 1}
        currentMessage={currentMessage}
      />
    ))
  ), [messages, currentMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <nav className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI Chat</span>
            </div>
            <div className="flex items-center">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{user.email}</span>
                  <button
                    onClick={() => auth.signOut()}
                    className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative pt-16">
        {!user ? (
          <div className="flex-1 flex items-center justify-center">
            <AuthForm />
          </div>
        ) : (
          <>
            <div className="flex-1 w-full max-w-3xl mx-auto px-4 mt-8 mb-24">
              <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-[calc(100vh-12rem)]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {renderMessages()}
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
          </>
        )}
      </main>
    </div>
  );
}
