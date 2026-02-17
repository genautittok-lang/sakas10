import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, MessageSquare, Gift, TrendingUp, Activity, RefreshCw } from "lucide-react";

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

const STEP_COLORS = {
  HOME: { bg: "bg-blue-500/10", text: "text-blue-500", dark: "dark:bg-blue-400/10 dark:text-blue-400", gradient: "from-blue-500 to-blue-600" },
  STEP_1: { bg: "bg-cyan-500/10", text: "text-cyan-500", dark: "dark:bg-cyan-400/10 dark:text-cyan-400", gradient: "from-cyan-500 to-cyan-600" },
  STEP_2: { bg: "bg-purple-500/10", text: "text-purple-500", dark: "dark:bg-purple-400/10 dark:text-purple-400", gradient: "from-purple-500 to-purple-600" },
  STEP_3: { bg: "bg-pink-500/10", text: "text-pink-500", dark: "dark:bg-pink-400/10 dark:text-pink-400", gradient: "from-pink-500 to-pink-600" },
  PAYMENT: { bg: "bg-emerald-500/10", text: "text-emerald-500", dark: "dark:bg-emerald-400/10 dark:text-emerald-400", gradient: "from-emerald-500 to-emerald-600" },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const { data: stats, isLoading, dataUpdatedAt, isFetching } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-6">
          <div className="h-8 w-56 bg-muted rounded animate-pulse" />
          <div className="h-4 w-40 bg-muted rounded animate-pulse mt-3" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-11 w-11 bg-muted rounded-lg animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Користувачі", value: stats.totalUsers, description: "всього у системі", icon: Users, bgColor: "bg-blue-500/10", textColor: "text-blue-500", darkClass: "dark:bg-blue-400/10 dark:text-blue-400" },
    { title: "Оплати", value: stats.paidCount, description: "успішних операцій", icon: CreditCard, bgColor: "bg-green-500/10", textColor: "text-green-500", darkClass: "dark:bg-green-400/10 dark:text-green-400" },
    { title: "Дохід", value: `${stats.totalRevenue.toLocaleString("uk-UA")} ₴`, description: "загальний дохід", icon: TrendingUp, bgColor: "bg-emerald-500/10", textColor: "text-emerald-500", darkClass: "dark:bg-emerald-400/10 dark:text-emerald-400" },
    { title: "Повідомлення", value: stats.pendingMessages, description: "у очікуванні", icon: MessageSquare, bgColor: "bg-orange-500/10", textColor: "text-orange-500", darkClass: "dark:bg-orange-400/10 dark:text-orange-400" },
    { title: "Бонуси", value: stats.bonusClaimed, description: "виданих користувачам", icon: Gift, bgColor: "bg-purple-500/10", textColor: "text-purple-500", darkClass: "dark:bg-purple-400/10 dark:text-purple-400" },
    { title: "Всього оплат", value: stats.totalPayments, description: "всіх платежів", icon: Activity, bgColor: "bg-cyan-500/10", textColor: "text-cyan-500", darkClass: "dark:bg-cyan-400/10 dark:text-cyan-400" },
  ];

  const stepOrder = ["HOME", "STEP_1", "STEP_2", "STEP_3", "PAYMENT"];
  const orderedSteps = stepOrder.filter(step => step in stats.stepCounts);

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-primary/5 via-primary/8 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent p-6">
        <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Панель управління</h1>
        <p className="text-muted-foreground mt-1">Огляд активності бота</p>
        <div className="flex items-center gap-2 mt-3">
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} data-testid="icon-auto-refresh" />
          <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
            Оновлено о {dataUpdatedAt ? formatTime(new Date(dataUpdatedAt)) : "--"}
          </span>
          <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
            кожні 30с
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Статистика</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => (
            <Card key={card.title} data-testid={`card-stat-${card.title}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`${card.bgColor} ${card.darkClass} p-3 rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.textColor} ${card.darkClass.split(" ").pop()}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Воронка користувачів</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {orderedSteps.map((step, index) => {
                const count = stats.stepCounts[step];
                const percentage = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                const colors = STEP_COLORS[step as keyof typeof STEP_COLORS] || STEP_COLORS.HOME;
                
                return (
                  <div key={step} data-testid={`funnel-step-${step}`}>
                    {index > 0 && (
                      <div className="flex justify-center py-1">
                        <div className="w-px h-4 bg-border" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${colors.bg} ${colors.dark}`}>
                          <span className={`text-sm font-bold ${colors.text} ${colors.dark.split(" ").pop()}`}>{index + 1}</span>
                        </div>
                        <span className="text-sm font-medium">{STEP_LABELS[step] || step}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{count}</span>
                        <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-700`}
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
    </div>
  );
}
