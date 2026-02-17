import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, MessageSquare, Gift, TrendingUp, Activity } from "lucide-react";

interface Stats {
  totalUsers: number;
  stepCounts: Record<string, number>;
  bonusClaimed: number;
  totalPayments: number;
  paidCount: number;
  totalRevenue: number;
  pendingMessages: number;
}

const STEP_LABELS: Record<string, string> = {
  HOME: "Головна",
  STEP_1: "Встановлення",
  STEP_2: "Вступ до клубу",
  STEP_3: "Бонус",
  PAYMENT: "Оплата",
};

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading || !stats) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Панель управління</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Користувачі", value: stats.totalUsers, icon: Users, color: "text-blue-500 dark:text-blue-400" },
    { title: "Оплати", value: stats.paidCount, icon: CreditCard, color: "text-green-500 dark:text-green-400" },
    { title: "Дохід", value: `${stats.totalRevenue} ₴`, icon: TrendingUp, color: "text-emerald-500 dark:text-emerald-400" },
    { title: "Повідомлення", value: stats.pendingMessages, icon: MessageSquare, color: "text-orange-500 dark:text-orange-400" },
    { title: "Бонуси", value: stats.bonusClaimed, icon: Gift, color: "text-purple-500 dark:text-purple-400" },
    { title: "Всього оплат", value: stats.totalPayments, icon: Activity, color: "text-cyan-500 dark:text-cyan-400" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Панель управління</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} data-testid={`card-stat-${card.title}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Воронка користувачів</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.stepCounts).map(([step, count]) => {
              const percentage = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
              return (
                <div key={step} className="space-y-1" data-testid={`funnel-step-${step}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">{STEP_LABELS[step] || step}</span>
                    <span className="text-sm text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
