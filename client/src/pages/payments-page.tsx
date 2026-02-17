import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Payment } from "@shared/schema";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Очікує", variant: "outline", icon: Clock },
  paid: { label: "Оплачено", variant: "default", icon: CheckCircle },
  cancelled: { label: "Скасовано", variant: "destructive", icon: XCircle },
  processing: { label: "В обробці", variant: "secondary", icon: Loader2 },
};

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });
  const { toast } = useToast();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/payments/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Статус оновлено" });
    },
    onError: () => {
      toast({ title: "Помилка оновлення", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-payments-title">Оплати</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Всі оплати</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !payments?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-payments">
              Поки що немає оплат.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>Player ID</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const config = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                        <TableCell className="font-mono text-sm">{payment.tgId}</TableCell>
                        <TableCell className="font-mono text-sm">{payment.playerId}</TableCell>
                        <TableCell className="font-semibold">{payment.amount} ₴</TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("uk-UA") : "--"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={payment.status}
                            onValueChange={(val) => updateStatus.mutate({ id: payment.id, status: val })}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-status-${payment.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Очікує</SelectItem>
                              <SelectItem value="processing">В обробці</SelectItem>
                              <SelectItem value="paid">Оплачено</SelectItem>
                              <SelectItem value="cancelled">Скасовано</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
