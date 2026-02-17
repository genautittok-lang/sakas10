import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BotUser } from "@shared/schema";
import { Users, UserPlus, Search } from "lucide-react";

const STEP_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  HOME: "outline",
  STEP_1: "secondary",
  STEP_2: "secondary",
  STEP_3: "default",
  PAYMENT: "default",
};

const STEP_LABELS: Record<string, string> = {
  HOME: "Головна",
  STEP_1: "Встановлення",
  STEP_2: "Клуб",
  STEP_3: "Бонус",
  PAYMENT: "Оплата",
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
  if (diffDays === 1) return "вчора";
  if (diffDays < 7) return `${diffDays} дн тому`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} тиж тому`;
  return new Date(dateStr).toLocaleDateString("uk-UA");
}

export default function UsersPage() {
  const { data: users, isLoading } = useQuery<BotUser[]>({
    queryKey: ["/api/users"],
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.tgId.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const totalUsers = users?.length ?? 0;
  const stepCounts: Record<string, number> = {};
  users?.forEach((u) => {
    stepCounts[u.currentStep] = (stepCounts[u.currentStep] || 0) + 1;
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-users-title">Користувачі</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всього користувачів</CardTitle>
            <div className="bg-blue-500/10 dark:bg-blue-400/10 p-2.5 rounded-lg">
              <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Розподіл по кроках</CardTitle>
            <div className="bg-violet-500/10 dark:bg-violet-400/10 p-2.5 rounded-lg">
              <UserPlus className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2" data-testid="display-step-distribution">
              {Object.entries(stepCounts).map(([step, count]) => (
                <Badge
                  key={step}
                  variant={STEP_VARIANT[step] || "outline"}
                  className="no-default-hover-elevate no-default-active-elevate"
                >
                  {STEP_LABELS[step] || step}: {count}
                </Badge>
              ))}
              {Object.keys(stepCounts).length === 0 && (
                <span className="text-sm text-muted-foreground">--</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-lg">Всі користувачі бота</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Пошук за username або ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : !users?.length ? (
            <div className="flex flex-col items-center gap-3 py-12" data-testid="text-no-users">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Поки що немає користувачів. Запустіть бота та надішліть /start.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>Користувач</TableHead>
                    <TableHead>Крок</TableHead>
                    <TableHead>Бонус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Нічого не знайдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user, index) => {
                      const letter = user.username ? user.username[0].toUpperCase() : "#";
                      const colorClass = getAvatarColor(user.username || user.tgId);
                      return (
                        <TableRow
                          key={user.id}
                          data-testid={`row-user-${user.id}`}
                          className={index % 2 === 1 ? "bg-muted/30" : ""}
                        >
                          <TableCell className="font-mono text-sm">{user.tgId}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={`${colorClass} text-white text-xs font-semibold`}>
                                  {letter}
                                </AvatarFallback>
                              </Avatar>
                              {user.username ? (
                                <span className="text-sm font-medium">@{user.username}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">--</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STEP_VARIANT[user.currentStep] || "outline"}
                              className="no-default-hover-elevate no-default-active-elevate"
                            >
                              {STEP_LABELS[user.currentStep] || user.currentStep}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.claimedBonus ? (
                              <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">Так</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Ні</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {relativeTime(user.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-3" data-testid="text-search-result-count">
                  Знайдено: {filteredUsers.length} з {totalUsers}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
