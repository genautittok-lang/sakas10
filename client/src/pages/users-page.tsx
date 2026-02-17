import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BotUser } from "@shared/schema";

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

export default function UsersPage() {
  const { data: users, isLoading } = useQuery<BotUser[]>({
    queryKey: ["/api/users"],
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" data-testid="text-users-title">Користувачі</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Всі користувачі бота</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !users?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center" data-testid="text-no-users">
              Поки що немає користувачів. Запустіть бота та надішліть /start.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Крок</TableHead>
                    <TableHead>Бонус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-mono text-sm">{user.tgId}</TableCell>
                      <TableCell>
                        {user.username ? (
                          <span className="text-sm">@{user.username}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STEP_VARIANT[user.currentStep] || "outline"}>
                          {STEP_LABELS[user.currentStep] || user.currentStep}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.claimedBonus ? (
                          <Badge variant="default">Так</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Ні</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("uk-UA") : "--"}
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
