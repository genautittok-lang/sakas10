import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import UsersPage from "@/pages/users-page";
import PaymentsPage from "@/pages/payments-page";
import MessagesPage from "@/pages/messages-page";
import ConfigPage from "@/pages/config-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/users" component={UsersPage} />
      <Route path="/payments" component={PaymentsPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/config" component={ConfigPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2 p-2 border-b sticky top-0 z-50 bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <span className="text-sm font-medium text-muted-foreground">Telegram Bot Admin Panel</span>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
