"use client";

import { MarkdownMessage } from "@/components/markdown-message";
import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Mic,
  ArrowUp,
  Plus,
  FileText,
  Code,
  BookOpen,
  PenTool,
  Bot,
  AlertCircle,
  Loader2,
  Volume2,
  Square,
  Download,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  Trash2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MAX_PROMPT_LENGTH = 1000;
const MAX_VOICE_LENGTH = 800; // matches the cap in /api/tts
const CHAT_ID_KEY = "fast-ai:chat-id";

type Message = {
  role: "user" | "assistant" | "error" | "voice";
  content: string;
  voice?: boolean; // true for messages typed in "Generate voice" mode
  audioUrl?: string; // set on role "voice" messages
  saveState?: "saved" | "failed"; // NEW: whether the audio was stored
};

type ChatSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

// NEW: shape of the messages returned by /api/chats/[id]
type ApiMessage = {
  role: "user" | "assistant";
  kind: "chat" | "voice";
  content: string;
  audioId: string | null;
};

// NEW: turns saved messages into what the UI shows. A saved voice message
// becomes the user's text bubble plus an audio card.
function toUiMessages(rows: ApiMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of rows) {
    if (m.kind === "voice") {
      out.push({ role: "user", content: m.content, voice: true });
      if (m.audioId) {
        out.push({
          role: "voice",
          content: m.content,
          audioUrl: `/api/audio/${m.audioId}`,
          saveState: "saved",
        });
      }
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

export function AIAssistantInterface() {
  const [inputValue, setInputValue] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [loadingKind, setLoadingKind] = useState<"chat" | "voice" | "saving">(
    "chat"
  ); // NEW: "saving" while the audio is stored
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showUploadAnimation, setShowUploadAnimation] = useState(false);
  const [activeCommandCategory, setActiveCommandCategory] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // sidebar state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [listedAt, setListedAt] = useState(0); // time the list was fetched
  const [chatsLoading, setChatsLoading] = useState(true);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);
  const openRequestRef = useRef(0); // invalidates stale chat loads
  const voiceUrlsRef = useRef<string[]>([]);
  const [audioState, setAudioState] = useState<{
    index: number;
    status: "loading" | "playing";
  } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // free generated audio files when the component unmounts
  useEffect(() => {
    const urls = voiceUrlsRef;
    return () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Fetch the list of previous chats for the sidebar
  const loadChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }
      if (!res.ok) throw new Error("Failed to load chats");

      const data = await res.json();
      setChats(data.chats as ChatSummary[]);
      setListedAt(Date.now()); // used to group chats by day
      setSidebarError(null);
    } catch {
      setSidebarError("Couldn't load your chats.");
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // On page load, reopen the chat the user was in (from the database)
  useEffect(() => {
    let cancelled = false;
    const token = openRequestRef.current;

    const restore = async () => {
      let savedId: string | null = null;
      try {
        savedId = localStorage.getItem(CHAT_ID_KEY);
      } catch {
        // storage unavailable: just start empty
      }

      if (!savedId) {
        setIsRestoring(false);
        return;
      }

      try {
        const res = await fetch(`/api/chats/${savedId}`);

        if (res.status === 401) {
          window.location.href = "/sign-in";
          return;
        }

        if (!res.ok) {
          // chat missing or not ours: forget it and start fresh
          try {
            localStorage.removeItem(CHAT_ID_KEY);
          } catch {}
          return;
        }

        const data = await res.json();
        // skip if unmounted, or the user already opened/started a chat
        if (cancelled || openRequestRef.current !== token) return;

        setChatId(data.chatId);
        setMessages(toUiMessages(data.messages as ApiMessage[])); // CHANGED
      } catch {
        // network error: leave the chat empty, the saved id stays for next time
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const commandSuggestions = {
    learn: [
      "Explain the Big Bang theory",
      "How does photosynthesis work?",
      "What are black holes?",
      "Explain quantum computing",
      "How does the human brain work?",
    ],
    code: [
      "Create a React component for a todo list",
      "Write a Python function to sort a list",
      "How to implement authentication in Next.js",
      "Explain async/await in JavaScript",
      "Create a CSS animation for a button",
    ],
    write: [
      "Write a professional email to a client",
      "Create a product description for a smartphone",
      "Draft a blog post about AI",
      "Write a creative story about space exploration",
      "Create a social media post about sustainability",
    ],
  };

  const handleUploadFile = () => {
    setShowUploadAnimation(true);

    // Simulate file upload with timeout
    setTimeout(() => {
      const newFile = `Document.pdf`;
      setUploadedFiles((prev) => [...prev, newFile]);
      setShowUploadAnimation(false);
    }, 1500);
  };

  const handleCommandSelect = (command: string) => {
    setInputValue(command);
    setActiveCommandCategory(null);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const rememberChatId = (id: string) => {
    setChatId(id);
    try {
      localStorage.setItem(CHAT_ID_KEY, id);
    } catch {
      // ignore: the chat is still saved in the database
    }
  };

  const stopAudio = () => {
    requestIdRef.current += 1; // invalidates any in-flight request
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    setAudioState(null);
  };

  const revokeVoiceUrls = () => {
    voiceUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    voiceUrlsRef.current = [];
  };

  // Clears the screen and forgets the active chat (used by New chat and delete)
  const resetConversation = () => {
    openRequestRef.current += 1; // drop any in-flight chat load
    setOpeningId(null);
    stopAudio();
    revokeVoiceUrls();

    setMessages([]);
    setChatId(null);
    setInputValue("");
    setActiveCommandCategory(null);
    try {
      localStorage.removeItem(CHAT_ID_KEY);
    } catch {}
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    if (isLoading) return;
    resetConversation();
    setSidebarOpen(false);
  };

  // Open a previous chat from the sidebar
  const openChat = async (id: string) => {
    if (isLoading) return;
    if (id === chatId) {
      setSidebarOpen(false);
      return;
    }

    stopAudio();
    const myOpen = ++openRequestRef.current;
    setOpeningId(id);
    setSidebarError(null);

    try {
      const res = await fetch(`/api/chats/${id}`);
      if (myOpen !== openRequestRef.current) return; // a newer click won

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (res.status === 404) {
        // chat no longer exists: drop it from the list
        setChats((prev) => prev.filter((c) => c.id !== id));
        setSidebarError("That chat no longer exists.");
        return;
      }

      if (!res.ok) throw new Error("Failed to open chat");

      const data = await res.json();
      if (myOpen !== openRequestRef.current) return;

      revokeVoiceUrls(); // fresh audio from the chat being left
      setMessages(toUiMessages(data.messages as ApiMessage[])); // CHANGED
      rememberChatId(data.chatId);
      setActiveCommandCategory(null);
      setSidebarOpen(false);
    } catch {
      if (myOpen === openRequestRef.current) {
        setSidebarError("Couldn't open that chat. Please try again.");
      }
    } finally {
      if (myOpen === openRequestRef.current) setOpeningId(null);
    }
  };

  const deleteChat = async (id: string) => {
    if (isLoading) return;
    if (
      !window.confirm(
        "Delete this chat and its saved audio? This can't be undone."
      )
    )
      return;

    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }
      // 404 means it was already gone, which is the outcome we wanted
      if (!res.ok && res.status !== 404) throw new Error("Delete failed");

      setChats((prev) => prev.filter((c) => c.id !== id));
      setSidebarError(null);
      if (id === chatId) resetConversation();
    } catch {
      setSidebarError("Couldn't delete that chat. Please try again.");
    }
  };

  // NEW: store a generated audio file (database + private storage)
  const saveVoiceFile = async (
    audio: Blob,
    text: string
  ): Promise<"saved" | "failed"> => {
    try {
      const form = new FormData();
      form.append("audio", audio, "voice.wav");
      form.append("text", text);
      if (chatId) form.append("chatId", chatId);

      const res = await fetch("/api/audio", { method: "POST", body: form });

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return "failed";
      }
      if (!res.ok) return "failed";

      const data = await res.json();
      if (data.chatId) rememberChatId(data.chatId);
      return "saved";
    } catch {
      return "failed";
    }
  };

  // "Generate voice" mode: turn the user's text straight into an audio file
  const generateVoiceFile = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not generate voice");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      voiceUrlsRef.current.push(url);

      // show the player right away
      setMessages((prev) => [
        ...prev,
        { role: "voice", content: text, audioUrl: url },
      ]);

      // then store it so it survives a refresh (CHANGED)
      setLoadingKind("saving");
      const saveState = await saveVoiceFile(blob, text);
      setMessages((prev) =>
        prev.map((m) => (m.audioUrl === url ? { ...m, saveState } : m))
      );
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content:
            error instanceof Error
              ? error.message
              : "Could not generate voice. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      loadChats(); // NEW: refresh the sidebar (new chat, new order)
    }
  };

  const handleSendMessage = async () => {
    const limit = voiceEnabled ? MAX_VOICE_LENGTH : MAX_PROMPT_LENGTH;
    const prompt = inputValue.trim().slice(0, limit);
    if (!prompt || isLoading || isRestoring || openingId) return;

    const userMessage: Message = {
      role: "user",
      content: prompt,
      voice: voiceEnabled,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setActiveCommandCategory(null);
    setLoadingKind(voiceEnabled ? "voice" : "chat");
    setIsLoading(true);

    if (voiceEnabled) {
      await generateVoiceFile(prompt);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server loads earlier turns from the database,
        // so only the new prompt and the chat id are sent.
        body: JSON.stringify({
          chatId,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      // Keep the chat id even if the model failed: the user message was saved
      if (data.chatId) rememberChatId(data.chatId);

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content:
            error instanceof Error
              ? error.message
              : "We couldn't generate a response. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      loadChats(); // refresh the sidebar: new chat, new title, new order
    }
  };

  const handleListen = async (index: number, content: string) => {
    // clicking the message that is already loading/playing stops it
    if (audioState?.index === index) {
      stopAudio();
      return;
    }
    stopAudio();

    // strip markdown so the voice doesn't read symbols aloud
    const plain = content
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`#>|~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    if (!plain) return;

    const myRequest = requestIdRef.current;
    setAudioState({ index, status: "loading" });

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plain }),
      });

      if (myRequest !== requestIdRef.current) return; // stopped or switched

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not generate audio");
      }

      const blob = await res.blob();
      if (myRequest !== requestIdRef.current) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) {
          audioRef.current = null;
          setAudioState(null);
        }
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;

      setAudioState({ index, status: "playing" });
      await audio.play();
    } catch (error) {
      // An interrupted play() (user hit Stop, switched messages) is not a failure
      if (error instanceof DOMException && error.name === "AbortError") return;

      setAudioState(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content:
            error instanceof Error
              ? error.message
              : "Could not generate audio. Please try again.",
        },
      ]);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-white">
      <ChatSidebar
        chats={chats}
        now={listedAt}
        loading={chatsLoading}
        error={sidebarError}
        activeId={chatId}
        openingId={openingId}
        busy={isLoading}
        open={sidebarOpen}
        onSelect={openChat}
        onDelete={deleteChat}
        onNew={handleNewChat}
        onRetry={loadChats}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
          {/* Mobile: open the chat history */}
          <div className="mb-4 flex w-full md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <PanelLeft className="w-3.5 h-3.5" />
              History
            </button>
          </div>

          {/* Loading state while the saved chat is fetched */}
          {isRestoring && (
            <div className="mb-8 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your chat...
            </div>
          )}

          {/* Logo + welcome only before the conversation starts */}
          {!isRestoring && !hasMessages && (
            <>
              {/* Logo with animated gradient */}
              <div className="mb-8 w-20 h-20 relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 200 200"
                  width="100%"
                  height="100%"
                  className="w-full h-full"
                >
                  <g clipPath="url(#cs_clip_1_ellipse-12)">
                    <mask
                      id="cs_mask_1_ellipse-12"
                      style={{ maskType: "alpha" }}
                      width="200"
                      height="200"
                      x="0"
                      y="0"
                      maskUnits="userSpaceOnUse"
                    >
                      <path
                        fill="#fff"
                        fillRule="evenodd"
                        d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z"
                        clipRule="evenodd"
                      ></path>
                    </mask>
                    <g mask="url(#cs_mask_1_ellipse-12)">
                      <path fill="#fff" d="M200 0H0v200h200V0z"></path>
                      <path
                        fill="#0066FF"
                        fillOpacity="0.33"
                        d="M200 0H0v200h200V0z"
                      ></path>
                      <g
                        filter="url(#filter0_f_844_2811)"
                        className="animate-gradient"
                      >
                        <path fill="#0066FF" d="M110 32H18v68h92V32z"></path>
                        <path fill="#0044FF" d="M188-24H15v98h173v-98z"></path>
                        <path fill="#0099FF" d="M175 70H5v156h170V70z"></path>
                        <path fill="#00CCFF" d="M230 51H100v103h130V51z"></path>
                      </g>
                    </g>
                  </g>
                  <defs>
                    <filter
                      id="filter0_f_844_2811"
                      width="385"
                      height="410"
                      x="-75"
                      y="-104"
                      colorInterpolationFilters="sRGB"
                      filterUnits="userSpaceOnUse"
                    >
                      <feFlood
                        floodOpacity="0"
                        result="BackgroundImageFix"
                      ></feFlood>
                      <feBlend
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                      ></feBlend>
                      <feGaussianBlur
                        result="effect1_foregroundBlur_844_2811"
                        stdDeviation="40"
                      ></feGaussianBlur>
                    </filter>
                    <clipPath id="cs_clip_1_ellipse-12">
                      <path fill="#fff" d="M0 0H200V200H0z"></path>
                    </clipPath>
                  </defs>
                  <g
                    style={{ mixBlendMode: "overlay" }}
                    mask="url(#cs_mask_1_ellipse-12)"
                  >
                    <path
                      fill="gray"
                      stroke="transparent"
                      d="M200 0H0v200h200V0z"
                      filter="url(#cs_noise_1_ellipse-12)"
                    ></path>
                  </g>
                  <defs>
                    <filter
                      id="cs_noise_1_ellipse-12"
                      width="100%"
                      height="100%"
                      x="0%"
                      y="0%"
                      filterUnits="objectBoundingBox"
                    >
                      <feTurbulence
                        baseFrequency="0.6"
                        numOctaves="5"
                        result="out1"
                        seed="4"
                      ></feTurbulence>
                      <feComposite
                        in="out1"
                        in2="SourceGraphic"
                        operator="in"
                        result="out2"
                      ></feComposite>
                      <feBlend
                        in="SourceGraphic"
                        in2="out2"
                        mode="overlay"
                        result="out3"
                      ></feBlend>
                    </filter>
                  </defs>
                </svg>
              </div>

              {/* Welcome message */}
              <div className="mb-10 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center"
                >
                  <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 mb-2">
                    Ready to assist you
                  </h1>
                  <p className="text-gray-500 max-w-md">
                    Ask me anything or try one of the suggestions below
                  </p>
                </motion.div>
              </div>
            </>
          )}

          {/* Conversation */}
          {hasMessages && (
            <div className="w-full mb-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              {messages.map((message, index) => {
                if (message.role === "user") {
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    </motion.div>
                  );
                }

                if (message.role === "voice") {
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-gray-500">
                          Your audio is ready
                        </p>
                        <audio
                          controls
                          src={message.audioUrl}
                          className="w-full"
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <a
                            href={message.audioUrl}
                            download="voice.wav"
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download audio
                          </a>
                          {message.saveState === "saved" && (
                            <span className="text-xs text-gray-400">
                              Saved to this chat
                            </span>
                          )}
                          {message.saveState === "failed" && (
                            <span className="text-xs text-amber-600">
                              Couldn&apos;t save this audio. You can still
                              download it now.
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (message.role === "error") {
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
                      <span>{message.content}</span>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 break-words">
                        <MarkdownMessage content={message.content} />
                      </div>
                      <button
                        onClick={() => handleListen(index, message.content)}
                        className="mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        {audioState?.index === index ? (
                          audioState.status === "loading" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating voice...
                            </>
                          ) : (
                            <>
                              <Square className="w-3.5 h-3.5" />
                              Stop
                            </>
                          )
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            Listen
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {loadingKind === "voice"
                      ? "Generating voice..."
                      : loadingKind === "saving"
                      ? "Saving audio..."
                      : "Thinking..."}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input area with integrated functions and file upload */}
          <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="p-4">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  voiceEnabled
                    ? "Type the text you want turned into audio..."
                    : "Ask me anything..."
                }
                value={inputValue}
                maxLength={voiceEnabled ? MAX_VOICE_LENGTH : MAX_PROMPT_LENGTH}
                autoComplete="off"
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="w-full text-gray-700 text-base outline-none placeholder:text-gray-400"
              />
            </div>

            {/* Uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-gray-50 py-1 px-2 rounded-md border border-gray-200"
                    >
                      <FileText className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-gray-700">{file}</span>
                      <button
                        onClick={() =>
                          setUploadedFiles((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search, Deep Research, Generate voice functions and actions */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSearchEnabled(!searchEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    searchEnabled
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
                <button
                  onClick={() => setDeepResearchEnabled(!deepResearchEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    deepResearchEnabled
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={
                      deepResearchEnabled ? "text-blue-600" : "text-gray-400"
                    }
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="8" cy="8" r="3" fill="currentColor" />
                  </svg>
                  <span>Deep Research</span>
                </button>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    voiceEnabled
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <Volume2
                    className={`w-4 h-4 ${
                      voiceEnabled ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  <span>Generate voice</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={
                    !inputValue.trim() || isLoading || isRestoring || !!openingId
                  }
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    inputValue.trim() && !isLoading && !isRestoring && !openingId
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Upload files */}
            <div className="px-4 py-2 border-t border-gray-100">
              <button
                onClick={handleUploadFile}
                className="flex items-center gap-2 text-gray-600 text-sm hover:text-gray-900 transition-colors"
              >
                {showUploadAnimation ? (
                  <motion.div
                    className="flex space-x-1"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: {
                        transition: {
                          staggerChildren: 0.1,
                        },
                      },
                    }}
                  >
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                        variants={{
                          hidden: { opacity: 0, y: 5 },
                          visible: {
                            opacity: 1,
                            y: 0,
                            transition: {
                              duration: 0.4,
                              repeat: Infinity,
                              repeatType: "mirror",
                              delay: i * 0.1,
                            },
                          },
                        }}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Upload Files</span>
              </button>
            </div>
          </div>

          {/* Command categories */}
          <div className="w-full grid grid-cols-3 gap-4 mb-4">
            <CommandButton
              icon={<BookOpen className="w-5 h-5" />}
              label="Learn"
              isActive={activeCommandCategory === "learn"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "learn" ? null : "learn"
                )
              }
            />
            <CommandButton
              icon={<Code className="w-5 h-5" />}
              label="Code"
              isActive={activeCommandCategory === "code"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "code" ? null : "code"
                )
              }
            />
            <CommandButton
              icon={<PenTool className="w-5 h-5" />}
              label="Write"
              isActive={activeCommandCategory === "write"}
              onClick={() =>
                setActiveCommandCategory(
                  activeCommandCategory === "write" ? null : "write"
                )
              }
            />
          </div>

          {/* Command suggestions */}
          <AnimatePresence>
            {activeCommandCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full mb-6 overflow-hidden"
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700">
                      {activeCommandCategory === "learn"
                        ? "Learning suggestions"
                        : activeCommandCategory === "code"
                        ? "Coding suggestions"
                        : "Writing suggestions"}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {commandSuggestions[
                      activeCommandCategory as keyof typeof commandSuggestions
                    ].map((suggestion, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleCommandSelect(suggestion)}
                        className="p-3 hover:bg-gray-50 cursor-pointer transition-colors duration-75"
                      >
                        <div className="flex items-center gap-3">
                          {activeCommandCategory === "learn" ? (
                            <BookOpen className="w-4 h-4 text-blue-600" />
                          ) : activeCommandCategory === "code" ? (
                            <Code className="w-4 h-4 text-blue-600" />
                          ) : (
                            <PenTool className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="text-sm text-gray-700">
                            {suggestion}
                          </span>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Sidebar ----------------------------- */

// takes `now` (a timestamp captured when the list was fetched)
// instead of calling new Date() during render
function groupChats(chats: ChatSummary[], now: number) {
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const groups: { label: string; items: ChatSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of chats) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= today) groups[0].items.push(c);
    else if (t >= today - DAY) groups[1].items.push(c);
    else if (t >= today - 7 * DAY) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

interface ChatSidebarProps {
  chats: ChatSummary[];
  now: number;
  loading: boolean;
  error: string | null;
  activeId: string | null;
  openingId: string | null;
  busy: boolean; // a reply is being generated: block switching and deleting
  open: boolean; // mobile drawer state
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function ChatSidebar({
  chats,
  now,
  loading,
  error,
  activeId,
  openingId,
  busy,
  open,
  onSelect,
  onDelete,
  onNew,
  onRetry,
  onClose,
}: ChatSidebarProps) {
  const groups = groupChats(chats, now);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-gray-200 bg-white transition-transform md:sticky md:top-16 md:z-0 md:h-[calc(100vh-4rem)] md:translate-x-0 md:self-start ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={onNew}
            disabled={busy}
            className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus className="w-4 h-4 text-blue-600" />
            New chat
          </button>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading && (
            <div className="space-y-2 px-1 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mx-1 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p>{error}</p>
              <button
                onClick={onRetry}
                className="mt-1 font-medium underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && chats.length === 0 && (
            <p className="px-3 pt-2 text-xs text-gray-400">
              No chats yet. Send a message to start one.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((c) => {
                  const isActive = c.id === activeId;
                  const isOpening = c.id === openingId;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        onClick={() => onSelect(c.id)}
                        disabled={busy}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 pr-9 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {isOpening ? (
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
                        ) : (
                          <MessageSquare
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? "text-blue-600" : "text-gray-400"
                            }`}
                          />
                        )}
                        <span className="truncate">
                          {c.title?.trim() || "Untitled chat"}
                        </span>
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        disabled={busy}
                        aria-label="Delete chat"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-gray-200 hover:text-red-600 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

interface CommandButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function CommandButton({ icon, label, isActive, onClick }: CommandButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
        isActive
          ? "bg-blue-50 border-blue-200 shadow-sm"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className={`${isActive ? "text-blue-600" : "text-gray-500"}`}>
        {icon}
      </div>
      <span
        className={`text-sm font-medium ${
          isActive ? "text-blue-700" : "text-gray-700"
        }`}
      >
        {label}
      </span>
    </motion.button>
  );
}