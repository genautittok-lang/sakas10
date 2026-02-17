import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ManagerMessage } from "@shared/schema";
import { Check, MessageSquare, Clock, CheckCircle } from "lucide-react";

export default function MessagesPage() {
  const { data: messages, isLoading } = useQuery<ManagerMessage[]>({
    queryKey: ["/api/messages"],
  });
  const { toast } = useToast();

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

  const totalMessages = messages?.length ?? 0;
  const pendingCount = messages?.filter(m => !m.resolved).length ?? 0;
  const resolvedCount = messages?.filter(m => m.resolved).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-messages-title">Повідомлення менеджеру</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всього повідомлень</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-messages">{totalMessages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Очікують</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-messages">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Вирішено</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
                    <TableRow key={msg.id} data-testid={`row-message-${msg.id}`}>
                      <TableCell className="font-mono text-sm">{msg.tgId}</TableCell>
                      <TableCell>
                        {msg.username ? (
                          <span className="text-sm">@{msg.username}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{msg.userStep || "—"}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm font-medium whitespace-pre-wrap break-words">
                          {msg.reason || "—"}
                        </p>
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
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString("uk-UA") : "—"}
                      </TableCell>
                      <TableCell>
                        {!msg.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveMsg.mutate(msg.id)}
                            disabled={resolveMsg.isPending}
                            data-testid={`button-resolve-${msg.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Вирішити
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
