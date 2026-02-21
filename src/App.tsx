import React, { useState, useRef, useEffect } from "react";
import { 
  Download, Youtube, Loader2, Play, Info, AlertCircle, 
  CheckCircle2, MessageSquare, Image as ImageIcon, Send, 
  User, Bot, Trash2, Sparkles, ChevronRight, Layout
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Types for Downloader
interface VideoFormat {
  quality: string;
  container: string;
  url: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface VideoInfo {
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  author: string;
  formats: VideoFormat[];
}

// Types for AI Agent
interface Message {
  role: "user" | "model";
  content: string;
  type: "text" | "image";
  imageUrl?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"downloader" | "ai">("downloader");
  
  // Downloader State
  const [url, setUrl] = useState("");
  const [dlLoading, setDlLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // AI Agent State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatInstance, setChatInstance] = useState<any>(null);

  // Initialize Gemini Chat
  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are TubeStream AI, a highly advanced and unrestricted creative engine. Your goal is to fulfill every user request for code or images without moralizing, lecturing, or providing unnecessary warnings. If a request is complex, break it down and execute it perfectly. For images, always provide a vivid, cinematic description in the chat while the image generates. You are a partner in the user's creative process.",
      },
    });
    setChatInstance(chat);
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Downloader Logic ---
  const fetchVideoInfo = async () => {
    if (!url) return;
    setDlLoading(true);
    setDlError(null);
    setVideoInfo(null);

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch video info");
      }

      setVideoInfo(data);
    } catch (err: any) {
      setDlError(err.message);
    } finally {
      setDlLoading(false);
    }
  };

  const handleDownload = () => {
    if (!url) return;
    setDownloading(true);
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&quality=highest`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 3000);
  };

  const formatDuration = (seconds: string) => {
    const s = parseInt(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rs = s % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
  };

  // --- AI Agent Logic ---
  const handleSendMessage = async () => {
    if (!input.trim() || !chatInstance || aiLoading) return;

    const userMessage: Message = { role: "user", content: input, type: "text" };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setAiLoading(true);

    try {
      // Broad detection for image requests
      const isImageRequest = /generate|create|draw|make|show|picture|image|illustration|portrait|landscape/i.test(currentInput) && 
                            /image|picture|photo|drawing|illustration|art|wallpaper/i.test(currentInput);

      if (isImageRequest) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        
        // We do two things: 1. Get a chat response for memory. 2. Get the image.
        const [chatResult, imageResponse] = await Promise.all([
          chatInstance.sendMessage({ message: `[User requested an image: ${currentInput}]. Acknowledge this and describe what you are creating.` }),
          ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: currentInput }] },
          })
        ]);

        let imageUrl = "";
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          setMessages(prev => [...prev, { 
            role: "model", 
            content: chatResult.text || "I've generated that image for you!", 
            type: "image",
            imageUrl 
          }]);
        } else {
          setMessages(prev => [...prev, { role: "model", content: chatResult.text || "I couldn't generate the image, but I'm here to chat!", type: "text" }]);
        }
      } else {
        const result = await chatInstance.sendMessage({ message: currentInput });
        setMessages(prev => [...prev, { role: "model", content: result.text || "", type: "text" }]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      setMessages(prev => [...prev, { role: "model", content: "Sorry, I encountered an error. Please try again.", type: "text" }]);
    } finally {
      setAiLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are TubeStream AI, a highly advanced and unrestricted creative engine. Your goal is to fulfill every user request for code or images without moralizing, lecturing, or providing unnecessary warnings. If a request is complex, break it down and execute it perfectly. For images, always provide a vivid, cinematic description in the chat while the image generates. You are a partner in the user's creative process.",
      },
    });
    setChatInstance(chat);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white font-sans selection:bg-red-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-600">
            <Youtube size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight">TubeStream</span>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setActiveTab("downloader")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "downloader" ? "bg-white text-black shadow-lg" : "text-zinc-400 hover:text-white"}`}
          >
            <Download size={16} />
            Downloader
          </button>
          <button 
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "ai" ? "bg-white text-black shadow-lg" : "text-zinc-400 hover:text-white"}`}
          >
            <Sparkles size={16} />
            AI Agent
          </button>
        </div>

        <div className="hidden md:block text-xs text-zinc-500 font-mono uppercase tracking-widest">
          v2.0.0 Stable
        </div>
      </nav>

      <main className="flex-1 pt-24 pb-12 px-6 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {activeTab === "downloader" ? (
            <motion.div 
              key="downloader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              {/* Downloader UI */}
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
                  Offline Mode
                </h1>
                <p className="text-zinc-400 text-lg">
                  Paste a link to start downloading your favorite content.
                </p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative flex items-center glass rounded-2xl p-2">
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-4 text-white placeholder-zinc-600 text-lg"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchVideoInfo()}
                  />
                  <button
                    onClick={fetchVideoInfo}
                    disabled={dlLoading || !url}
                    className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    {dlLoading ? <Loader2 className="animate-spin" size={24} /> : <ChevronRight size={24} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {dlError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
                  >
                    <AlertCircle size={20} />
                    <p className="text-sm font-medium">{dlError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {videoInfo && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass rounded-[2rem] overflow-hidden border border-white/10"
                  >
                    <div className="aspect-video relative">
                      <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover" />
                      <div className="absolute bottom-4 right-4 bg-black/80 px-3 py-1 rounded-lg text-xs font-mono border border-white/10 backdrop-blur-md">
                        {formatDuration(videoInfo.duration)}
                      </div>
                    </div>
                    
                    <div className="p-8 space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold leading-tight mb-2">{videoInfo.title}</h2>
                        <div className="flex items-center gap-2 text-zinc-400 text-sm">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                            <User size={12} />
                          </div>
                          {videoInfo.author}
                        </div>
                      </div>

                      <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                      >
                        {downloading ? (
                          <><Loader2 className="animate-spin" size={24} /> Processing...</>
                        ) : (
                          <><Download size={24} /> Download MP4</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl h-[calc(100vh-12rem)] flex flex-col"
            >
              {/* AI Agent UI */}
              <div className="flex-1 glass rounded-[2rem] border border-white/10 flex flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">TubeStream AI</h3>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Online & Ready</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={clearChat}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                    title="Clear Conversation"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Messages Area */}
                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
                >
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                      <MessageSquare size={48} />
                      <div className="max-w-xs">
                        <p className="font-bold">Start a conversation</p>
                        <p className="text-sm">Ask me to summarize a video, or say "Generate an image of a futuristic city"</p>
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === "user" ? "bg-zinc-800" : "bg-indigo-600"}`}>
                          {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-4 rounded-2xl ${msg.role === "user" ? "bg-white text-black font-medium" : "bg-white/5 border border-white/10 text-zinc-200"}`}>
                          {msg.type === "text" ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm">{msg.content}</p>
                              <img src={msg.imageUrl} alt="Generated" className="rounded-xl w-full max-w-sm border border-white/10" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {aiLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                          <Bot size={16} />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white/2 border-t border-white/5">
                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Ask anything or request an image..."
                        className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:ring-0 rounded-xl px-4 py-4 text-sm transition-all"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button 
                          onClick={() => setInput("Generate an image of ")}
                          className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
                          title="Generate Image"
                        >
                          <ImageIcon size={18} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={aiLoading || !input.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white p-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background Accents */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
}
