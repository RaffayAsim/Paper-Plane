import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Send,
  Inbox,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Search,
  ChevronLeft,
  Circle,
  Reply,
  Forward,
  Download,
  Trash2,
  Loader2,
  Sparkles,
  CheckCheck,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Email {
  id: string;
  threadId: string;
  subject: string;
  body: string;
  fromEmail: string;
  toEmail: string;
  direction: "incoming" | "outgoing";
  isRead: boolean;
  createdAt: string;
  messageCount?: number;
  unreadCount?: number;
}

type Folder = "inbox" | "sent";
type ComposeMode = "new" | "reply" | "forward";

function decodeQuotedPrintable(text: string) {
  return text
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/=\r?\n/g, "");
}

function stripLeadingHeaders(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const headerPattern = /^[A-Za-z0-9-]+:\s?.*$/;

  let index = 0;
  let sawHeader = false;

  while (index < lines.length) {
    const line = lines[index];
    if (headerPattern.test(line)) {
      sawHeader = true;
      index += 1;
      continue;
    }

    if (sawHeader && (/^\s+/.test(line) || line.trim() === "")) {
      index += 1;
      continue;
    }

    break;
  }

  return sawHeader ? lines.slice(index).join("\n") : normalized;
}

function stripTransportNoise(text: string) {
  return text
    .replace(/^--[a-zA-Z0-9_.=-]+\s*$/gm, "")
    .replace(/^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version|BODY\[TEXT\]|Return-Path|Delivered-To|Received|Authentication-Results|Received-SPF|ARC-Seal|ARC-Message-Signature|ARC-Authentication-Results|DKIM-Signature|X-Google-DKIM-Signature|X-Gm-Message-State|X-Gm-Gg|X-Received|X-Spam-Score|X-Spam-Report|Message-ID|References|In-Reply-To):?.*(\n\s.*)*$/gim, "")
    .replace(/^Symbol:.*$/gim, "")
    .replace(/^Action:.*$/gim, "");
}

function htmlToText(text: string) {
  if (!(text.includes("<html") || text.includes("<body") || text.includes("<div") || text.includes("<p"))) {
    return text;
  }

  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatQuotedReplies(text: string) {
  return text
    .replace(/\nOn (.+?) wrote:\n?/g, "\n\nOn $1 wrote:\n")
    .replace(/\n>{1,}/g, "\n>")
    .replace(/\n{3,}/g, "\n\n");
}

function cleanEmailBody(raw: string): string {
  let text = raw ?? "";
  text = decodeQuotedPrintable(text);
  text = text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "");
  text = stripLeadingHeaders(text);
  text = stripTransportNoise(text);
  text = htmlToText(text);
  text = formatQuotedReplies(text);

  return text
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function EmailPage() {
  const navigate = useNavigate();
  const { subscriptionPlan } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadMessages, setSelectedThreadMessages] = useState<Email[]>([]);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [composing, setComposing] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("new");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [initialFetch, setInitialFetch] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: Email[] }>(`/emails?folder=${folder}`);
      setEmails(data.items || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (threadId: string) => {
    try {
      const data = await api.get<{ items: Email[] }>(`/emails/thread/${threadId}`);
      setSelectedThreadId(threadId);
      setSelectedThreadMessages(data.items || []);
      setComposing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fetchFromServer = async () => {
    setFetching(true);
    try {
      const data = await api.post<{ imported?: number }>("/emails/sync");
      toast({ title: `Fetched ${data?.imported || 0} new email(s) from server` });
      setLastSynced(new Date());
      await fetchEmails();
    } catch (err: any) {
      toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchFromServer().finally(() => setInitialFetch(false));
    const interval = setInterval(() => {
      void fetchFromServer();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void fetchEmails();
    setSelectedThreadId(null);
    setSelectedThreadMessages([]);
    setComposing(false);
  }, [folder]);

  useEffect(() => {
    const compose = searchParams.get("compose");
    const toParam = searchParams.get("to");
    const subjectParam = searchParams.get("subject");
    const bodyParam = searchParams.get("body");

    if (compose !== "new" || !toParam) return;

    setSelectedThreadId(null);
    setSelectedThreadMessages([]);
    setComposeMode("new");
    setComposing(true);
    setTo(toParam);
    setSubject(subjectParam ?? "");
    setBody(bodyParam ?? "");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("compose");
    nextParams.delete("to");
    nextParams.delete("subject");
    nextParams.delete("body");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const markAllAsRead = async () => {
    const unreadEmails = emails.filter((e) => !e.isRead);
    if (unreadEmails.length === 0) return;
    await Promise.allSettled(
      unreadEmails.map((e) => api.patch(`/emails/${e.id}/read`, { isRead: true }))
    );
    setEmails((prev) => prev.map((e) => ({ ...e, isRead: true, unreadCount: 0 })));
    toast({ title: `Marked ${unreadEmails.length} email(s) as read` });
  };

  const markAsRead = async (email: Email) => {
    if (!email.isRead) {
      await api.patch(`/emails/${email.id}/read`, { isRead: true });
    }
    await loadThread(email.threadId);
    setEmails((prev) =>
      prev.map((item) => (item.threadId === email.threadId ? { ...item, isRead: true, unreadCount: 0 } : item)),
    );
  };

  const deleteEmail = async (email: Email, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await api.delete(`/emails/${email.id}`);
      toast({ title: "Email deleted" });
      if (selectedThreadMessages.some((item) => item.id === email.id)) {
        const nextThread = selectedThreadMessages.filter((item) => item.id !== email.id);
        if (nextThread.length === 0) {
          setSelectedThreadId(null);
          setSelectedThreadMessages([]);
        } else {
          setSelectedThreadMessages(nextThread);
        }
      }
      await fetchEmails();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const startReply = (email: Email) => {
    setTo(email.fromEmail);
    setSubject(email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`);
    setBody(`\n\n--- Original Message ---\nFrom: ${email.fromEmail}\nDate: ${format(new Date(email.createdAt), "MMM d, yyyy 'at' h:mm a")}\n\n${email.body}`);
    setComposeMode("reply");
    setComposing(true);
  };

  const startForward = (email: Email) => {
    setTo("");
    setSubject(email.subject.startsWith("Fwd: ") ? email.subject : `Fwd: ${email.subject}`);
    setBody(`\n\n--- Forwarded Message ---\nFrom: ${email.fromEmail}\nTo: ${email.toEmail}\nDate: ${format(new Date(email.createdAt), "MMM d, yyyy 'at' h:mm a")}\nSubject: ${email.subject}\n\n${email.body}`);
    setComposeMode("forward");
    setComposing(true);
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({ title: "Missing fields", description: "Fill in all fields", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await api.post("/emails/send", {
        toEmail: to,
        subject,
        body,
      });
      toast({ title: "Email sent!" });
      setTo("");
      setSubject("");
      setBody("");
      setComposing(false);
      setComposeMode("new");
      setFolder("sent");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleAiEnhance = async () => {
    if (subscriptionPlan === "base") {
      toast({
        title: "AI Feature Locked",
        description: "AI Enhance is a premium feature. Please upgrade to unlock.",
      });
      return;
    }
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      toast({ title: "Add a draft first", description: "Write something in the email body before using AI Enhance.", variant: "destructive" });
      return;
    }

    setEnhancing(true);
    try {
      const data = await api.post<{
        item: { subject: string; body: string; provider?: string; model?: string };
      }>("/emails/ai-enhance", {
        toEmail: to,
        subject,
        body: trimmedBody,
      });

      setSubject(data.item.subject || subject);
      setBody(data.item.body || body);
      toast({
        title: "Email enhanced",
        description: data.item.provider ? `Refined with ${data.item.provider}${data.item.model ? ` (${data.item.model})` : ""}.` : "Your draft was rewritten into a more professional email.",
      });
    } catch (err: any) {
      toast({ title: "AI enhance failed", description: err.message, variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  const filtered = emails.filter(
    (email) =>
      email.subject.toLowerCase().includes(search.toLowerCase()) ||
      email.fromEmail.toLowerCase().includes(search.toLowerCase()) ||
      email.toEmail.toLowerCase().includes(search.toLowerCase()),
  );

  const unreadCount = emails.filter((email) => !email.isRead).length;
  const activeThreadMessage = selectedThreadMessages[selectedThreadMessages.length - 1] || null;

  // Generate a consistent color from email address for sender avatar
  const getAvatarColor = (email: string) => {
    const colors = [
      "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
      "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (email: string) => {
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  // Render email body — use iframe for HTML emails, pre-wrap for plain text
  const renderEmailBody = (body: string) => {
    const cleaned = body ?? "";
    const isHtml = /<html|<body|<div|<p\b|<table/i.test(cleaned);
    if (isHtml) {
      const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;margin:0;padding:12px;color:inherit;background:transparent}img{max-width:100%!important;height:auto}a{color:#6366f1}</style></head><body>${cleaned}</body></html>`;
      return (
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-same-origin allow-popups"
          className="w-full min-h-[200px] border-0 rounded"
          style={{ height: "400px" }}
          title="Email content"
        />
      );
    }
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {cleanEmailBody(cleaned)}
      </div>
    );
  };

  const formatLastSynced = (date: Date | null): string => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    return format(date, "MMM d, h:mm a");
  };

  return (
    <DashboardLayout fullBleed overflowHidden>
      <div className="flex h-full relative w-full">
        {initialFetch && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Fetching emails from server...</p>
            </div>
          </div>
        )}

        <div className="flex h-full w-full flex-col lg:hidden">
          {composing ? (
            <div className="flex flex-1 min-h-0 flex-col p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => { setComposing(false); setComposeMode("new"); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold text-foreground">
                  {composeMode === "reply" ? "Reply" : composeMode === "forward" ? "Forward" : "New Email"}
                </h2>
              </div>
              <div className="flex flex-1 min-h-0 flex-col space-y-3">
                <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea
                  placeholder="Write your email..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="flex-1 min-h-[240px]"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => void handleAiEnhance()} disabled={enhancing || sending} className="gap-2 sm:flex-1">
                    {enhancing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : subscriptionPlan === "base" ? (
                      <Lock className="h-4 w-4 text-orange-500" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {enhancing ? "Enhancing..." : "AI Enhance"}
                  </Button>
                  <Button onClick={() => void handleSend()} disabled={sending || enhancing} className="gap-2 sm:flex-1">
                    <Send className="h-4 w-4" />
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          ) : activeThreadMessage ? (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <div className="border-b border-border p-4">
                <div className="mb-3 flex items-start gap-3">
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedThreadId(null); setSelectedThreadMessages([]); }} className="shrink-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-foreground break-words">{activeThreadMessage.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activeThreadMessage.direction === "incoming" ? activeThreadMessage.fromEmail : `To: ${activeThreadMessage.toEmail}`}
                      </span>
                      <span>{format(new Date(activeThreadMessage.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => startReply(activeThreadMessage)} className="gap-1.5">
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startForward(activeThreadMessage)} className="gap-1.5">
                    <Forward className="h-3.5 w-3.5" /> Forward
                  </Button>
                  <Button variant="outline" size="sm" onClick={(event) => void deleteEmail(activeThreadMessage, event)} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  {selectedThreadMessages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            message.direction === "incoming"
                              ? "bg-orange-600 text-white hover:bg-orange-600"
                              : "bg-slate-500 text-white hover:bg-slate-500",
                          )}
                        >
                          {message.direction === "incoming" ? "Received" : "Sent"}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {message.direction === "incoming" ? message.fromEmail : `You to ${message.toEmail}`}
                        </span>
                        <span>{format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                      {renderEmailBody(message.body)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <>
              <div className="border-b border-border bg-muted/20 p-3 space-y-3">
                <Button
                  onClick={() => {
                    setComposing(true);
                    setSelectedThreadId(null);
                    setSelectedThreadMessages([]);
                    setComposeMode("new");
                    setTo("");
                    setSubject("");
                    setBody("");
                  }}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" /> Compose
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFolder("inbox")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      folder === "inbox" ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
                    )}
                  >
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                    {unreadCount > 0 && folder === "inbox" && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setFolder("sent")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      folder === "sent" ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
                    )}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Sent</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search emails..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void fetchFromServer()} disabled={fetching} className="shrink-0" title="Fetch from mail server">
                    <Download className={cn("h-4 w-4", fetching && "animate-bounce")} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void fetchEmails()} className="shrink-0" title="Refresh list">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </div>

                {lastSynced && (
                  <p className="text-[11px] text-muted-foreground">
                    Last synced {formatLastSynced(lastSynced)}
                  </p>
                )}
              </div>

              <ScrollArea className="flex-1">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No emails yet</div>
                ) : (
                  filtered.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => void markAsRead(email)}
                      className={cn(
                        "group w-full border-b border-border px-4 py-3 text-left transition-colors",
                        selectedThreadId === email.threadId ? "bg-primary/5" : "hover:bg-muted/50",
                        (email.unreadCount ?? 0) > 0 && "bg-primary/[0.03]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {(email.unreadCount ?? 0) > 0 && (
                          <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />
                        )}
                        <span className={cn("truncate text-sm", (email.unreadCount ?? 0) > 0 && "font-semibold")}>
                          {folder === "inbox" ? email.fromEmail : email.toEmail}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {format(new Date(email.createdAt), "MMM d")}
                        </span>
                      </div>
                      <p className={cn("mt-0.5 truncate text-sm", (email.unreadCount ?? 0) > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {email.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {cleanEmailBody(email.body).slice(0, 80)}
                      </p>
                      {(email.messageCount ?? 1) > 1 ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {email.messageCount} messages in thread
                        </p>
                      ) : null}
                    </button>
                  ))
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <ResizablePanelGroup direction="horizontal" className="hidden h-full w-full lg:flex">
          <ResizablePanel defaultSize={18} minSize={14} maxSize={26} className="min-w-0 border-r border-border bg-muted/30">
            <div className="flex h-full flex-col">
              <div className="p-4 border-b border-border space-y-3">
                <Button onClick={() => { setComposing(true); setSelectedThreadId(null); setSelectedThreadMessages([]); setComposeMode("new"); setTo(""); setSubject(""); setBody(""); }} className="w-full gap-2">
                  <Plus className="h-4 w-4" /> Compose
                </Button>
                {/* Inbox / Sent nav in left panel */}
                <div className="space-y-1">
                  <button
                    onClick={() => setFolder("inbox")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      folder === "inbox" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                    {unreadCount > 0 && folder === "inbox" && (
                      <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setFolder("sent")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      folder === "sent" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Sent</span>
                  </button>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={28} minSize={20} maxSize={40} className="min-w-0 border-r border-border">
            <div className="flex h-full flex-col">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search emails..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchFromServer()}
                  disabled={fetching}
                  className="shrink-0 gap-1.5 text-xs h-9 px-3"
                  title="Fetch new emails from your mail server"
                >
                  <Download className={cn("h-3.5 w-3.5", fetching && "animate-bounce")} />
                  {fetching ? "Fetching..." : "Fetch New"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchEmails()}
                  className="shrink-0 gap-1.5 text-xs h-9 px-3"
                  title="Refresh list"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              {lastSynced && (
                <div className="border-b border-border px-3 py-1.5 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Last synced {formatLastSynced(lastSynced)}
                  </p>
                  {unreadCount > 0 && folder === "inbox" && (
                    <button
                      onClick={() => void markAllAsRead()}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>
              )}
              <ScrollArea className="flex-1">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No emails yet</div>
                ) : (
                  filtered.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => void markAsRead(email)}
                      className={cn(
                        "group w-full text-left px-4 py-3 border-b border-border transition-colors",
                        selectedThreadId === email.threadId ? "bg-primary/5" : "hover:bg-muted/50",
                        !email.isRead && "bg-primary/[0.03]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* Sender avatar */}
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0",
                          getAvatarColor(folder === "inbox" ? email.fromEmail : email.toEmail)
                        )}>
                          {getInitials(folder === "inbox" ? email.fromEmail : email.toEmail)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            {!email.isRead && (
                              <Circle className="h-1.5 w-1.5 fill-primary text-primary shrink-0" />
                            )}
                            <span className={cn("text-sm truncate", !email.isRead && "font-semibold")}>
                              {folder === "inbox" ? email.fromEmail : email.toEmail}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                              {format(new Date(email.createdAt), "MMM d")}
                            </span>
                            <button
                              onClick={(event) => void deleteEmail(email, event)}
                              className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className={cn("text-sm truncate mt-0.5", !email.isRead ? "text-foreground" : "text-muted-foreground")}>
                            {email.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {cleanEmailBody(email.body).slice(0, 80)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={54} minSize={30} className="min-w-0">
              <div className="flex h-full min-w-0 flex-col overflow-hidden">
                {composing ? (
                  <div className="flex flex-1 min-h-0 flex-col p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => { setComposing(false); setComposeMode("new"); }}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground">
                      {composeMode === "reply" ? "Reply" : composeMode === "forward" ? "Forward" : "New Email"}
                    </h2>
                  </div>
                    <div className="flex flex-1 min-h-0 flex-col space-y-3">
                    <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
                    <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    <Textarea
                      placeholder="Write your email..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="flex-1 min-h-[200px]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => void handleAiEnhance()} disabled={enhancing || sending} className="gap-2">
                        {enhancing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : subscriptionPlan === "base" ? (
                          <Lock className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {enhancing ? "Enhancing..." : "AI Enhance"}
                      </Button>
                      <Button onClick={() => void handleSend()} disabled={sending || enhancing} className="gap-2">
                        <Send className="h-4 w-4" />
                        {sending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                </div>
                ) : activeThreadMessage ? (
                  <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
                  <div className="p-6 border-b border-border">
                    <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedThreadId(null); setSelectedThreadMessages([]); }} className="lg:hidden">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-foreground flex-1">{activeThreadMessage.subject}</h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => startReply(activeThreadMessage)} className="gap-1.5">
                          <Reply className="h-3.5 w-3.5" /> Reply
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startForward(activeThreadMessage)} className="gap-1.5">
                          <Forward className="h-3.5 w-3.5" /> Forward
                        </Button>
                        <Button variant="outline" size="sm" onClick={(event) => void deleteEmail(activeThreadMessage, event)} className="gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activeThreadMessage.direction === "incoming" ? activeThreadMessage.fromEmail : `To: ${activeThreadMessage.toEmail}`}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(activeThreadMessage.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-2 text-[10px]",
                          activeThreadMessage.direction === "incoming"
                            ? "bg-orange-600 text-white hover:bg-orange-600"
                            : "bg-slate-500 text-white hover:bg-slate-500",
                        )}
                      >
                        {activeThreadMessage.direction === "incoming" ? "Received" : "Sent"}
                      </Badge>
                    </div>
                  </div>
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="space-y-4 p-6">
                        {selectedThreadMessages.map((message) => (
                          <div key={message.id} className="rounded-2xl border border-border bg-card p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px]",
                                  message.direction === "incoming"
                                    ? "bg-orange-600 text-white hover:bg-orange-600"
                                    : "bg-slate-500 text-white hover:bg-slate-500",
                                )}
                              >
                                {message.direction === "incoming" ? "Received" : "Sent"}
                              </Badge>
                              <span className="font-medium text-foreground">
                                {message.direction === "incoming" ? message.fromEmail : `You to ${message.toEmail}`}
                              </span>
                              <span>{format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                            </div>
                            {renderEmailBody(message.body)}
                          </div>
                        ))}
                      </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Mail className="h-12 w-12 mx-auto opacity-30" />
                    <p className="text-sm">Select an email to read</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </DashboardLayout>
  );
}
