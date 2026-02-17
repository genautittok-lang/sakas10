import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Upload, Link as LinkIcon, MessageSquare, Film, Smartphone, CreditCard, Cog } from "lucide-react";
import type { BotConfig } from "@shared/schema";

interface ConfigField {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "url" | "video";
  placeholder: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: "manager_chat_id", label: "Chat ID менеджера", description: "Telegram Chat ID менеджера для отримання сповіщень", type: "text", placeholder: "123456789" },
  { key: "club_id", label: "Club ID", description: "ID клубу для відображення на кроці 2", type: "text", placeholder: "CLUB123" },
  { key: "welcome_text", label: "Текст привітання", description: "Повідомлення на головному екрані", type: "textarea", placeholder: "Вітаємо! Оберіть дію:" },
  { key: "step1_text", label: "Текст кроку 1", description: "Інструкція для встановлення додатку", type: "textarea", placeholder: "Крок 1: Встановіть додаток" },
  { key: "step1_video", label: "Відео кроку 1", description: "Відео для кроку 1 (URL або завантажити файл)", type: "video", placeholder: "https://example.com/video1.mp4" },
  { key: "step2_text", label: "Текст кроку 2", description: "Інструкція для вступу до клубу", type: "textarea", placeholder: "Крок 2: Вступ до клубу" },
  { key: "step2_video", label: "Відео кроку 2", description: "Відео для кроку 2 (URL або завантажити файл)", type: "video", placeholder: "https://example.com/video2.mp4" },
  { key: "bonus_text", label: "Текст бонусу", description: "Опис бонусу на кроці 3", type: "textarea", placeholder: "Крок 3: Бонус" },
  { key: "rules_text", label: "Правила", description: "Текст правил", type: "textarea", placeholder: "Правила:" },
  { key: "android_link", label: "Посилання Android", description: "URL для завантаження на Android", type: "url", placeholder: "https://play.google.com/..." },
  { key: "ios_link", label: "Посилання iOS", description: "URL для завантаження на iOS", type: "url", placeholder: "https://apps.apple.com/..." },
  { key: "windows_link", label: "Посилання Windows", description: "URL для завантаження на Windows", type: "url", placeholder: "https://example.com/download" },
  { key: "payment_amounts", label: "Суми оплати", description: "Фіксовані суми для кнопок оплати (через кому)", type: "text", placeholder: "100, 200, 500, 1000, 2000, 5000" },
  { key: "convert2pay_api_url", label: "Convert2pay API URL", description: "URL ендпоінту Convert2pay API", type: "url", placeholder: "https://api.convert2pay.com/v1/payment" },
  { key: "convert2pay_merchant_id", label: "Convert2pay Merchant ID", description: "Ідентифікатор мерчанта Convert2pay", type: "text", placeholder: "merchant_123" },
  { key: "convert2pay_secret_key", label: "Convert2pay Secret Key", description: "Секретний ключ API Convert2pay", type: "text", placeholder: "sk_live_..." },
  { key: "convert2pay_currency", label: "Convert2pay валюта", description: "Код валюти (за замовчуванням UAH)", type: "text", placeholder: "UAH" },
];

const SECTIONS = [
  {
    title: "Основні",
    description: "Головні ідентифікатори бота",
    icon: Cog,
    keys: ["manager_chat_id", "club_id"],
  },
  {
    title: "Тексти бота",
    description: "Повідомлення та інструкції для користувачів",
    icon: MessageSquare,
    keys: ["welcome_text", "step1_text", "step2_text", "bonus_text", "rules_text"],
  },
  {
    title: "Медіа",
    description: "Відео для кроків інструкції",
    icon: Film,
    keys: ["step1_video", "step2_video"],
  },
  {
    title: "Посилання на додаток",
    description: "URL для завантаження додатку на різні платформи",
    icon: Smartphone,
    keys: ["android_link", "ios_link", "windows_link"],
  },
  {
    title: "Оплата",
    description: "Налаштування платіжної системи Convert2pay",
    icon: CreditCard,
    keys: ["payment_amounts", "convert2pay_api_url", "convert2pay_merchant_id", "convert2pay_secret_key", "convert2pay_currency"],
  },
];

function VideoUploadField({
  fieldKey,
  value,
  onChange,
  placeholder,
}: {
  fieldKey: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      toast({ title: "Файл завантажено" });
    } catch {
      toast({ title: "Помилка завантаження", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Button
          variant={mode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("url")}
          data-testid={`button-mode-url-${fieldKey}`}
        >
          <LinkIcon className="h-3 w-3 mr-1" />
          URL
        </Button>
        <Button
          variant={mode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("upload")}
          data-testid={`button-mode-upload-${fieldKey}`}
        >
          <Upload className="h-3 w-3 mr-1" />
          Завантажити
        </Button>
      </div>
      {mode === "url" ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`input-config-${fieldKey}`}
        />
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,image/*"
            onChange={handleFileUpload}
            className="hidden"
            data-testid={`input-file-${fieldKey}`}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full justify-start"
            data-testid={`button-upload-${fieldKey}`}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Завантаження..." : "Обрати файл"}
          </Button>
          {value && (
            <p className="text-xs text-muted-foreground truncate" data-testid={`text-uploaded-${fieldKey}`}>
              Поточне: {value}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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

  const fieldsByKey = CONFIG_FIELDS.reduce<Record<string, ConfigField>>((acc, field) => {
    acc[field.key] = field;
    return acc;
  }, {});

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
    <div className="p-6 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-config-title">Налаштування бота</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-config-subtitle">Керуйте налаштуваннями бота</p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <section.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold" data-testid={`text-section-${section.title}`}>{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {section.keys.map((key) => {
                  const field = fieldsByKey[key];
                  if (!field) return null;
                  return (
                    <div
                      key={field.key}
                      className="flex flex-col gap-3 p-4 border-b last:border-b-0"
                      data-testid={`field-row-${field.key}`}
                    >
                      <div>
                        <Label className="text-sm font-medium">{field.label}</Label>
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      </div>
                      <div className="flex gap-2 items-end justify-between flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          {field.type === "video" ? (
                            <VideoUploadField
                              fieldKey={field.key}
                              value={values[field.key] || ""}
                              onChange={(val) => setValues(prev => ({ ...prev, [field.key]: val }))}
                              placeholder={field.placeholder}
                            />
                          ) : field.type === "textarea" ? (
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
                          size="sm"
                          onClick={() => saveConfig.mutate({ key: field.key, value: values[field.key] || "" })}
                          disabled={saveConfig.isPending}
                          data-testid={`button-save-${field.key}`}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Зберегти
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
