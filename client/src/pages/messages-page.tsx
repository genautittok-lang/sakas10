import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ManagerMessage, MessageReply } from "@shared/schema";
import { Check, MessageSquare, Clock, CheckCircle, Send, Eye, Globe, MessageCircle, AlertTriangle } from "lucide-react";
import { SiTelegram } from "react-icons/si";

type MessageWithReplies = ManagerMessage & { replies?: MessageReply[] };

function relativeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "--";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;
  if (diffHr < 24) return `${diffHr} год тому`;
  if (diffDays < 7) return `${diffDays} дн тому`;
  return new Date(dateStr).toLocaleDateString("uk-UA");
}

export default function MessagesPage() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: messages, isLoading } = useQuery<ManagerMessage[]>({
    queryKey: ["/api/messages"],
  });
  const { toast } = useToast();

  const { data: messageDetail, isLoading: detailLoading } = useQuery<MessageWithReplies>({
    queryKey: ["/api/messages", selectedMessageId],
    enabled: !!selectedMessageId,
    staleTime: 0,
  });

  const resolveMsg = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/messages/${id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Позначено як вирішено" });
    },
  });

  const sendReply = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      await apiRequest("POST", `/api/messages/${id}/reply`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedMessageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setReplyText("");
      toast({ title: "Відповідь надіслано" });
    },
    onError: () => {
      toast({ title: "Помилка при відправці", variant: "destructive" });
    },
  });

  const totalMessages = messages?.length ?? 0;
  const pendingCount = messages?.filter(m => !m.resolved).length ?? 0;
  const resolvedCount = messages?.filter(m => m.resolved).length ?? 0;

  const handleOpenMessage = (id: string) => {
    setSelectedMessageId(id);
    setReplyText("");
  };

  const handleSendReply = () => {
    if (!selectedMessageId || !replyText.trim()) return;
    sendReply.mutate({ id: selectedMessageId, text: replyText });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-messages-title">Повідомлення менеджеру</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всього повідомлень</CardTitle>
            <div className="bg-blue-500/10 dark:bg-blue-400/10 p-2.5 rounded-lg">
              <MessageSquare className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-messages">{totalMessages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Очікують</CardTitle>
            <div className="bg-orange-500/10 dark:bg-orange-400/10 p-2.5 rounded-lg">
              <Clock className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-messages">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Вирішено</CardTitle>
            <div className="bg-emerald-500/10 dark:bg-emerald-400/10 p-2.5 rounded-lg">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved-messages">{resolvedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Запити від користувачів</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : !messages?.length ? (
            <div className="flex flex-col items-center gap-3 py-12" data-testid="text-no-messages">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Поки що немає повідомлень.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Крок</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow
                      key={msg.id}
                      className={`hover-elevate cursor-pointer ${!msg.resolved ? "border-l-2 border-l-destructive" : ""}`}
                      data-testid={`row-message-${msg.id}`}
                      onClick={() => handleOpenMessage(msg.id)}
                    >
                      <TableCell className="font-mono text-sm">{msg.tgId}</TableCell>
                      <TableCell>
                        {msg.username ? (
                          <span className="text-sm">@{msg.username}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{msg.userStep || "\u2014"}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="flex items-start gap-2">
                          {!msg.resolved && (
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm font-medium whitespace-pre-wrap break-words line-clamp-2">
                            {msg.reason || "\u2014"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {msg.resolved ? (
                          <Badge variant="default" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Вирішено
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
                            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                            Очікує
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {relativeTime(msg.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleOpenMessage(msg.id); }}
                            data-testid={`button-open-${msg.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Відкрити
                          </Button>
                          {!msg.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); resolveMsg.mutate(msg.id); }}
                              disabled={resolveMsg.isPending}
                              data-testid={`button-resolve-${msg.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Вирішити
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedMessageId} onOpenChange={(open) => { if (!open) setSelectedMessageId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <MessageSquare className="h-5 w-5" />
              Повідомлення
              {messageDetail && (
                messageDetail.resolved ? (
                  <Badge variant="default" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    Вирішено
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1.5 no-default-hover-elevate no-default-active-elevate">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                    Очікує
                  </Badge>
                )
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <div className="h-6 bg-muted rounded-md animate-pulse w-2/3" />
              <div className="h-4 bg-muted rounded-md animate-pulse w-1/2" />
              <div className="h-20 bg-muted rounded-md animate-pulse" />
            </div>
          ) : messageDetail ? (
            <div className="flex flex-col flex-1 min-h-0 gap-4">
              <div className="rounded-md border p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Telegram ID</span>
                    <span className="font-mono" data-testid="text-detail-tgid">{messageDetail.tgId}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Username</span>
                    <span data-testid="text-detail-username">
                      {messageDetail.username ? `@${messageDetail.username}` : "\u2014"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Крок</span>
                    <span>{messageDetail.userStep || "\u2014"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Дата</span>
                    <span>{messageDetail.createdAt ? new Date(messageDetail.createdAt).toLocaleString("uk-UA") : "\u2014"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Причина звернення</p>
                <p className="text-sm whitespace-pre-wrap break-words" data-testid="text-detail-reason">
                  {messageDetail.reason || "\u2014"}
                </p>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  Відповіді ({messageDetail.replies?.length ?? 0})
                </span>
              </div>

              <ScrollArea className="flex-1 min-h-0 max-h-[250px]">
                <div className="space-y-3 pr-3">
                  {(!messageDetail.replies || messageDetail.replies.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-replies">
                      Немає відповідей
                    </p>
                  ) : (
                    messageDetail.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-md bg-muted/40 p-3 space-y-1"
                        data-testid={`reply-${reply.id}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {reply.source === "telegram" ? (
                            <Badge variant="secondary" className="gap-1 text-xs no-default-hover-elevate no-default-active-elevate">
                              <SiTelegram className="h-3 w-3" />
                              Telegram
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs no-default-hover-elevate no-default-active-elevate">
                              <Globe className="h-3 w-3" />
                              Веб-панель
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {reply.createdAt ? relativeTime(reply.createdAt) : ""}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{reply.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <Separator />

              <div className="space-y-3">
                <Textarea
                  placeholder="Напишіть відповідь користувачу..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="resize-none"
                  rows={3}
                  data-testid="input-reply-text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      handleSendReply();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Ctrl+Enter для відправки
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!messageDetail.resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resolveMsg.mutate(messageDetail.id);
                          queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedMessageId] });
                        }}
                        disabled={resolveMsg.isPending}
                        data-testid="button-resolve-detail"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Вирішити
                      </Button>
                    )}
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sendReply.isPending}
                      data-testid="button-send-reply"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {sendReply.isPending ? "Надсилаю..." : "Надіслати"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
