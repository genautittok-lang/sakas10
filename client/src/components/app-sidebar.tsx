import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold" data-testid="text-sidebar-title">TG Bot Admin</p>
            <p className="text-xs text-muted-foreground">Панель управління</p>
          </div>
        </div>
      </SidebarHeader>
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
    </Sidebar>
  );
}
