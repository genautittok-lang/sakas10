import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, Bot } from "lucide-react";
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

const menuItems = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard },
  { title: "Користувачі", url: "/users", icon: Users },
  { title: "Оплати", url: "/payments", icon: CreditCard },
  { title: "Повідомлення", url: "/messages", icon: MessageSquare },
  { title: "Налаштування", url: "/config", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
