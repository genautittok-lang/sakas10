import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface Stats {
  totalUsers: number;
  pendingMessages: number;
  pendingPayments: number;
}

const menuItems = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard, badgeKey: null },
  { title: "Користувачі", url: "/users", icon: Users, badgeKey: null },
  { title: "Оплати", url: "/payments", icon: CreditCard, badgeKey: "pendingPayments" as const },
  { title: "Повідомлення", url: "/messages", icon: MessageSquare, badgeKey: "pendingMessages" as const },
  { title: "Налаштування", url: "/config", icon: Settings, badgeKey: null },
];

export function AppSidebar() {
  const [location] = useLocation();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 15000,
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg bg-primary text-primary-foreground p-2">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold tracking-tight" data-testid="text-sidebar-title">TG Bot Admin</p>
              <span className="relative flex h-2.5 w-2.5" data-testid="status-bot-online">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Панель управління</p>
          </div>
        </div>
      </SidebarHeader>
      <Separator className="mx-4 w-auto opacity-50" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навігація</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const badgeCount = item.badgeKey && stats ? stats[item.badgeKey] : 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {badgeCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto text-xs no-default-hover-elevate no-default-active-elevate"
                            data-testid={`badge-${item.badgeKey}`}
                          >
                            {badgeCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Separator className="mb-3 opacity-50" />
        <p className="text-xs text-muted-foreground text-center" data-testid="text-sidebar-version">
          v1.0 build 2026.02
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
