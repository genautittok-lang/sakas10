import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ManagerMessage } from "@shared/schema";
import { Check } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-messages-title">Повідомлення менеджеру</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Запити від користувачів</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !messages?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-messages">
              Поки що немає повідомлень.
            </p>
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
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{msg.userStep || "--"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{msg.reason || "--"}</TableCell>
                      <TableCell>
                        {msg.resolved ? (
                          <Badge variant="default">Вирішено</Badge>
                        ) : (
                          <Badge variant="destructive">Очікує</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString("uk-UA") : "--"}
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
