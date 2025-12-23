"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "./logo.png";
import {
  Folder,
  House,
  MessageCircle,
  Paperclip,
  Settings,
} from "lucide-react";

interface UploadedDocument {
  id: string;
  title: string;
  fileType: string;
  uploadedAt: string;
  chunkCount: number;
  contentLength: number;
}

interface Citation {
  index: number;
  title: string;
  chunkId: string;
  confidence: number;
  vectorScore: number;
  keywordScore: number;
  explanation: string;
}

interface MessageMetadata {
  citations?: Citation[];
  retrievalInfo?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  metadata?: MessageMetadata;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "chat" | "documents">(
    "home"
  );
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showRetrievalInfo, setShowRetrievalInfo] = useState(false);
  const [showMainInterface, setShowMainInterface] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentRequestId = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get current conversation
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Load documents and conversation history on mount
  useEffect(() => {
    fetchDocuments();

    // Load conversation history from sessionStorage
    if (typeof window !== "undefined") {
      const savedData = sessionStorage.getItem("conversations");

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const conversationsWithDates = parsed.conversations.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }));
          setConversations(conversationsWithDates);
          setCurrentConversationId(parsed.currentConversationId);
          if (conversationsWithDates.length > 0) {
            setShowMainInterface(true);
            // Keep on home tab to show conversation overview
          }
        } catch (error) {
          console.error("Failed to load conversation history:", error);
        }
      }
    }
  }, []);

  // Save conversations to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && conversations.length > 0) {
      const data = {
        conversations,
        currentConversationId,
      };
      sessionStorage.setItem("conversations", JSON.stringify(data));
    }
  }, [conversations, currentConversationId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/upload");
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  const cancelResponse = async () => {
    if (currentRequestId.current) {
      try {
        await fetch("/api/chat", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: currentRequestId.current }),
        });
      } catch (error) {
        console.error("Failed to cancel request:", error);
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(false);
    currentRequestId.current = null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Upload failed");
        return;
      }

      alert(
        `✅ Uploaded: ${file.name}\n${data.document.chunkCount} chunks created with embeddings`
      );
      fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  // Create a new conversation
  const createNewConversation = () => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setShowMainInterface(true);
    setActiveTab("chat");
    setIsSidebarOpen(false);
  };

  // Handle tab change and close sidebar on mobile
  const handleTabChange = (tab: "home" | "chat" | "documents") => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // Update conversation messages
  const updateConversationMessages = (
    conversationId: string,
    newMessages: Message[]
  ) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: newMessages,
              updatedAt: new Date(),
              // Update title based on first user message
              title:
                newMessages.length > 0 && conv.title === "New conversation"
                  ? newMessages[0].content.substring(0, 50) +
                    (newMessages[0].content.length > 50 ? "..." : "")
                  : conv.title,
            }
          : conv
      )
    );
  };

  const handleSubmit = async (e?: React.FormEvent, customMessage?: string) => {
    e?.preventDefault();
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    setInput("");
    setShowMainInterface(true);
    setActiveTab("chat"); // Switch to chat tab when message is sent

    // Create new conversation if none exists
    if (!currentConversationId) {
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        title:
          messageToSend.substring(0, 50) +
          (messageToSend.length > 50 ? "..." : ""),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
    }

    // Add user message to current conversation
    const userMessage: Message = { role: "user", content: messageToSend };
    const conversationId =
      currentConversationId ||
      `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    updateConversationMessages(conversationId, [...messages, userMessage]);
    setIsLoading(true);

    // Generate request ID for cancellation
    const requestId = `req_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    currentRequestId.current = requestId;

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, requestId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let metadata: MessageMetadata = {};
      let metadataCollected = false;

      const emptyAssistantMsg: Message = {
        role: "assistant",
        content: "",
        metadata,
      };
      updateConversationMessages(conversationId, [
        ...messages,
        userMessage,
        emptyAssistantMsg,
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Check for metadata
        if (!metadataCollected && chunk.includes("__META__")) {
          const metaMatch = chunk.match(/__META__(.+?)__META__/);
          if (metaMatch) {
            try {
              metadata = JSON.parse(metaMatch[1]);
              metadataCollected = true;
              // Remove metadata from chunk
              const cleanChunk = chunk.replace(/__META__.+?__META__\n\n/, "");
              assistantMessage += cleanChunk;
            } catch (e) {
              console.error("Failed to parse metadata:", e);
              assistantMessage += chunk;
            }
          }
        } else {
          assistantMessage += chunk;
        }

        // Update the last message (assistant's response) in real-time
        const updatedMessages = [
          ...messages,
          userMessage,
          {
            role: "assistant" as const,
            content: assistantMessage,
            metadata,
          },
        ];
        updateConversationMessages(conversationId, updatedMessages);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Request cancelled by user");
      } else {
        console.error("Error:", error);
        const errorMsg: Message = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        updateConversationMessages(conversationId, [
          ...messages,
          userMessage,
          errorMsg,
        ]);
      }
    } finally {
      setIsLoading(false);
      currentRequestId.current = null;
      abortControllerRef.current = null;
    }
  };

  // Show chat interface if user has started interacting
  if (showMainInterface) {
    return (
      <div className="flex h-screen bg-white overflow-hidden">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-gray-900 text-white p-4 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createNewConversation}
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 mb-4"
          >
            <span className="text-xl">+</span>
            <span>New Chat</span>
          </motion.button>

          {/* Tab Navigation */}
          <div className="space-y-2 mb-4">
            <button
              onClick={() => handleTabChange("home")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "home"
                  ? "bg-gray-800"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <span>
                <House />
              </span>
              <span>Home</span>
            </button>
            <button
              onClick={() => handleTabChange("chat")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "chat"
                  ? "bg-gray-800"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <span>
                <MessageCircle />
              </span>
              <span>Chat</span>
            </button>
            <button
              onClick={() => handleTabChange("documents")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                activeTab === "documents"
                  ? "bg-gray-800"
                  : "text-gray-400 hover:bg-gray-800"
              }`}
            >
              <span>
                <Folder />
              </span>
              <span>Documents ({documents.length})</span>
            </button>
          </div>

          {/* Conversation History */}
          {activeTab === "chat" && conversations.length > 0 && (
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-3">
                Recent Chats
              </div>
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setCurrentConversationId(conv.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      conv.id === currentConversationId
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <div className="truncate">{conv.title}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {conv.messages.length} messages
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm text-gray-400 mt-auto">
            AI Knowledge Assistant
            <div className="text-xs mt-2 text-gray-500">
              Hybrid Search • RAG
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header with Hamburger */}
          <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-6 h-6 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              AI Knowledge Assistant
            </h1>
          </div>

          {activeTab === "home" ? (
            /* Home View - Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
              {/* Gradient Orb */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Image
                  src={logo}
                  alt="logo"
                  height={96}
                  width={96}
                  className="mb-6 md:mb-10 w-16 h-16 md:w-24 md:h-24"
                />
              </motion.div>

              {/* Greeting */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 mb-2 text-center"
              >
                Good Afternoon
              </motion.h1>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 md:mb-12 text-center px-4"
              >
                What's on{" "}
                <span className="bg-gradient-to-r from-violet-900 to-pink-600 text-transparent bg-clip-text">
                  your mind?
                </span>
              </motion.h2>

              {/* Input Box */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="w-full max-w-3xl mb-8 md:mb-12 px-4"
              >
                <form onSubmit={handleSubmit} className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask AI a question or make a request..."
                    rows={4}
                    className="w-full rounded-2xl border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-gray-900 shadow-sm text-sm sm:text-base"
                  />
                  <motion.button
                    type="submit"
                    disabled={!input.trim()}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 w-8 h-8 sm:w-10 sm:h-10 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center text-base sm:text-lg"
                  >
                    ↑
                  </motion.button>
                </form>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 px-2">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.txt,.md"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <span>
                        <Paperclip />
                      </span>
                      <span className="hidden sm:inline">
                        {isUploading ? "Uploading..." : "Attach"}
                      </span>
                    </label>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">
                    {documents.length} documents • Hybrid search ready
                  </div>
                </div>
              </motion.div>
            </div>
          ) : activeTab === "chat" ? (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
                <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-gray-500 py-12"
                    >
                      <p>No messages yet. Start a conversation below!</p>
                    </motion.div>
                  )}
                  <AnimatePresence mode="popLayout">
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                      >
                      <div className="flex gap-4">
                        {message.role === "user" ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm">U</span>
                            </div>
                            <div className="flex-1 pt-1">
                              <p className="text-gray-900">{message.content}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm">AI</span>
                            </div>
                            <div className="flex-1 pt-1 min-w-0">
                              {/* Citation chips */}
                              {message.metadata?.citations &&
                                message.metadata.citations.length > 0 && (
                                  <div className="mb-3 flex flex-wrap gap-1.5 sm:gap-2">
                                    {message.metadata.citations.map(
                                      (citation, idx) => (
                                        <motion.div
                                          key={citation.index}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ duration: 0.2, delay: idx * 0.05 }}
                                          whileHover={{ scale: 1.05 }}
                                          className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-50 border border-purple-200 rounded-full text-xs sm:text-sm cursor-pointer hover:bg-purple-100 transition-colors"
                                          title={`${
                                            citation.explanation
                                          } - Semantic: ${(
                                            citation.vectorScore * 100
                                          ).toFixed(0)}%, Keywords: ${(
                                            citation.keywordScore * 100
                                          ).toFixed(0)}%`}
                                        >
                                          <span className="text-purple-700 font-medium">
                                            [{citation.index}]
                                          </span>
                                          <span className="text-gray-700 truncate max-w-[120px] sm:max-w-none">
                                            {citation.title}
                                          </span>
                                          <span className="text-purple-600 text-xs">
                                            {(
                                              citation.confidence * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        </motion.div>
                                      )
                                    )}

                                    {/* Show retrieval info button */}
                                    {message.metadata.retrievalInfo && (
                                      <button
                                        onClick={() =>
                                          setShowRetrievalInfo(
                                            !showRetrievalInfo
                                          )
                                        }
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm hover:bg-blue-100 transition-colors"
                                      >
                                        <span className="text-blue-700">
                                          🔍
                                        </span>
                                        <span className="text-blue-700 text-xs">
                                          {showRetrievalInfo ? "Hide" : "Show"}{" "}
                                          Retrieval Analysis
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                )}

                              {/* Retrieval transparency */}
                              {showRetrievalInfo &&
                                message.metadata?.retrievalInfo && (
                                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                                    <pre className="whitespace-pre-wrap font-sans text-gray-700">
                                      {message.metadata.retrievalInfo}
                                    </pre>
                                  </div>
                                )}

                              <p className="text-gray-900 whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm">AI</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex space-x-2 pt-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={cancelResponse}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-3 sm:p-4">
                <div className="max-w-3xl mx-auto">
                  <form onSubmit={handleSubmit} className="relative">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      disabled={isLoading}
                      rows={3}
                      className="w-full rounded-2xl border border-gray-300 px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 resize-none text-gray-900 text-sm sm:text-base"
                    />
                    <motion.button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 w-7 h-7 sm:w-8 sm:h-8 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base"
                    >
                      <span>↑</span>
                    </motion.button>
                  </form>
                </div>
              </div>
            </>
          ) : (
            /* Documents View */
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                  Your Documents
                </h2>

                {/* Upload Area */}
                <div className="mb-6 sm:mb-8 p-6 sm:p-8 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="text-3xl sm:text-4xl mb-2">📤</div>
                    <p className="text-base sm:text-lg text-gray-700 mb-1">
                      {isUploading
                        ? "Uploading & creating embeddings..."
                        : "Click to upload document"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Supports PDF, TXT, MD files (max 10MB)
                    </p>
                  </label>
                </div>

                {/* Document List */}
                {documents.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-gray-500 py-12"
                  >
                    <p className="text-lg">No documents uploaded yet</p>
                    <p className="text-sm mt-2">
                      Upload your first document to enable hybrid search!
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {documents.map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, borderColor: "#a855f7" }}
                        className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-purple-500 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base truncate">
                              {doc.title}
                            </h3>
                            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                              <span>📄 {doc.fileType}</span>
                              <span>📊 {doc.chunkCount} chunks</span>
                              <span className="hidden sm:inline">
                                📏 {(doc.contentLength / 1000).toFixed(1)}k
                                chars
                              </span>
                              <span>
                                📅{" "}
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-purple-600">
                              ✓ Embeddings generated • Hybrid search enabled
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show welcome screen if no messages
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 text-white p-4 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }
      `}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400"></div>
          <span className="font-semibold">Knowledge AI</span>
        </div>

        <nav className="space-y-2 flex-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 text-left">
            <span>
              <House />
            </span>
            <span>Home</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("documents");
              setShowMainInterface(true);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-gray-400"
          >
            <span>
              <Folder />
            </span>
            <span>Documents ({documents.length})</span>
          </button>
        </nav>

        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-gray-400">
            <span>
              <Settings />
            </span>
            <span>Settings</span>
          </button>
          <div className="text-xs text-gray-500 px-3 py-2">
            Hybrid Search • BM25 + Embeddings
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg
              className="w-6 h-6 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            AI Knowledge Assistant
          </h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          {/* Gradient Orb */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Image
              src={logo}
              alt="logo"
              height={96}
              width={96}
              className="mb-6 md:mb-10 w-16 h-16 md:w-24 md:h-24"
            />
          </motion.div>

          {/* Greeting */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 mb-2 text-center"
          >
            Good Afternoon
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 md:mb-12 text-center px-4"
          >
            What's on{" "}
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
              your mind?
            </span>
          </motion.h2>

          {/* Input Box */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-3xl mb-8 md:mb-12 px-4"
          >
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Ask AI a question or make a request..."
                rows={4}
                className="w-full rounded-2xl border border-gray-300 px-4 sm:px-6 py-3 sm:py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-gray-900 shadow-sm text-sm sm:text-base"
              />
              <motion.button
                type="submit"
                disabled={!input.trim()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 w-8 h-8 sm:w-10 sm:h-10 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center text-base sm:text-lg"
              >
                ↑
              </motion.button>
            </form>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 px-2">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <span>
                    <Paperclip />
                  </span>
                  <span className="hidden sm:inline">
                    {isUploading ? "Uploading..." : "Attach"}
                  </span>
                </label>
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {documents.length} documents • Hybrid search ready
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
