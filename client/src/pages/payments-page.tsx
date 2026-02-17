import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Payment } from "@shared/schema";
import { CheckCircle, XCircle, Clock, Loader2, CreditCard, DollarSign, AlertCircle, Filter } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Очікує", variant: "outline", icon: Clock },
  paid: { label: "Оплачено", variant: "default", icon: CheckCircle },
  cancelled: { label: "Скасовано", variant: "destructive", icon: XCircle },
  processing: { label: "В обробці", variant: "secondary", icon: Loader2 },
};

const STATUS_DOT_COLOR: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-emerald-500",
  cancelled: "bg-red-500",
  processing: "bg-blue-500",
};

const FILTER_OPTIONS = [
  { value: "all", label: "Всі статуси" },
  { value: "pending", label: "Очікує" },
  { value: "processing", label: "В обробці" },
  { value: "paid", label: "Оплачено" },
  { value: "cancelled", label: "Скасовано" },
];

function formatAmount(amount: number): string {
  return amount.toLocaleString("uk-UA");
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (statusFilter === "all") return payments;
    return payments.filter(p => p.status === statusFilter);
  }, [payments, statusFilter]);

  const totalPayments = payments?.length ?? 0;
  const totalPaid = payments?.filter(p => p.status === "paid").reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;
  const pendingCount = payments?.filter(p => p.status === "pending").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-payments-title">Оплати</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всього оплат</CardTitle>
            <div className="bg-blue-500/10 dark:bg-blue-400/10 p-2.5 rounded-lg">
              <CreditCard className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">{totalPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Оплачено</CardTitle>
            <div className="bg-emerald-500/10 dark:bg-emerald-400/10 p-2.5 rounded-lg">
              <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-paid">{formatAmount(totalPaid)} ₴</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Очікують</CardTitle>
            <div className="bg-orange-500/10 dark:bg-orange-400/10 p-2.5 rounded-lg">
              <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-payments">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg">Всі оплати</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : !payments?.length ? (
            <div className="flex flex-col items-center gap-3 py-12" data-testid="text-no-payments">
              <CreditCard className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Поки що немає оплат.
              </p>
            </div>
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
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Немає оплат з обраним статусом
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const config = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                      const dotColor = STATUS_DOT_COLOR[payment.status] || STATUS_DOT_COLOR.pending;
                      return (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="font-mono text-sm">{payment.tgId}</TableCell>
                          <TableCell className="font-mono text-sm">{payment.playerId}</TableCell>
                          <TableCell>
                            <span className="font-semibold tabular-nums">{formatAmount(payment.amount)}</span>
                            <span className="text-muted-foreground ml-1">₴</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={config.variant}
                              className="gap-1.5 no-default-hover-elevate no-default-active-elevate"
                            >
                              <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
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
                              <SelectTrigger className="w-[130px]" data-testid={`select-status-${payment.id}`}>
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
                    })
                  )}
                </TableBody>
              </Table>
              {statusFilter !== "all" && (
                <p className="text-xs text-muted-foreground mt-3" data-testid="text-filter-result-count">
                  Показано: {filteredPayments.length} з {totalPayments}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
