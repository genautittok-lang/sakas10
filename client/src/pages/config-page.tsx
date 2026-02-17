import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings } from "lucide-react";
import type { BotConfig } from "@shared/schema";

interface ConfigField {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "url";
  placeholder: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: "manager_chat_id", label: "Chat ID менеджера", description: "Telegram Chat ID менеджера для отримання сповіщень", type: "text", placeholder: "123456789" },
  { key: "club_id", label: "Club ID", description: "ID клубу для відображення на кроці 2", type: "text", placeholder: "CLUB123" },
  { key: "welcome_text", label: "Текст привітання", description: "Повідомлення на головному екрані", type: "textarea", placeholder: "Вітаємо! Оберіть дію:" },
  { key: "step1_text", label: "Текст кроку 1", description: "Інструкція для встановлення додатку", type: "textarea", placeholder: "📱 Крок 1: Встановіть додаток" },
  { key: "step1_video", label: "Відео кроку 1 (URL)", description: "Посилання на відео для кроку 1", type: "url", placeholder: "https://example.com/video1.mp4" },
  { key: "step2_text", label: "Текст кроку 2", description: "Інструкція для вступу до клубу", type: "textarea", placeholder: "🏠 Крок 2: Вступ до клубу" },
  { key: "step2_video", label: "Відео кроку 2 (URL)", description: "Посилання на відео для кроку 2", type: "url", placeholder: "https://example.com/video2.mp4" },
  { key: "bonus_text", label: "Текст бонусу", description: "Опис бонусу на кроці 3", type: "textarea", placeholder: "🎁 Крок 3: Бонус" },
  { key: "rules_text", label: "Правила", description: "Текст правил", type: "textarea", placeholder: "📋 Правила:" },
  { key: "android_link", label: "Посилання Android", description: "URL для завантаження на Android", type: "url", placeholder: "https://play.google.com/..." },
  { key: "ios_link", label: "Посилання iOS", description: "URL для завантаження на iOS", type: "url", placeholder: "https://apps.apple.com/..." },
  { key: "windows_link", label: "Посилання Windows", description: "URL для завантаження на Windows", type: "url", placeholder: "https://example.com/download" },
  { key: "payment_link_template", label: "Шаблон посилання оплати", description: "Використовуйте {amount}, {player_id}, {payment_id}", type: "url", placeholder: "https://pay.example.com/?amount={amount}&pid={player_id}&id={payment_id}" },
];

export default function ConfigPage() {
  const { data: configList, isLoading } = useQuery<BotConfig[]>({
    queryKey: ["/api/config"],
  });
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configList) {
      const map: Record<string, string> = {};
      configList.forEach(c => { map[c.key] = c.value; });
      setValues(map);
    }
  }, [configList]);

  const saveConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("POST", "/api/config", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({ title: "Збережено" });
    },
    onError: () => {
      toast({ title: "Помилка збереження", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Налаштування бота</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold" data-testid="text-config-title">Налаштування бота</h1>
      </div>

      <div className="grid gap-4">
        {CONFIG_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{field.label}</CardTitle>
              <CardDescription className="text-sm">{field.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  {field.type === "textarea" ? (
                    <Textarea
                      value={values[field.key] || ""}
                      onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      data-testid={`input-config-${field.key}`}
                    />
                  ) : (
                    <Input
                      value={values[field.key] || ""}
                      onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      data-testid={`input-config-${field.key}`}
                    />
                  )}
                </div>
                <Button
                  onClick={() => saveConfig.mutate({ key: field.key, value: values[field.key] || "" })}
                  disabled={saveConfig.isPending}
                  data-testid={`button-save-${field.key}`}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Зберегти
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
