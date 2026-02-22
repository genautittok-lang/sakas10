import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, X, CheckCircle, Footprints } from "lucide-react";
import type { BotConfig } from "@shared/schema";

interface StepField {
  key: string;
  label: string;
  type: "textarea" | "video";
  placeholder: string;
}

interface StepDefinition {
  number: number;
  title: string;
  fields: StepField[];
}

const STEPS: StepDefinition[] = [
  {
    number: 1,
    title: "Крок 1: Привітання",
    fields: [
      { key: "welcome_text", label: "Текст привітання", type: "textarea", placeholder: "Вітаємо! Оберіть дію:" },
      { key: "welcome_image", label: "Зображення привітання", type: "video", placeholder: "https://example.com/welcome.jpg" },
    ],
  },
  {
    number: 2,
    title: "Відео Android",
    fields: [
      { key: "android_video", label: "Відео інструкція для Android", type: "video", placeholder: "https://example.com/android.mp4" },
    ],
  },
  {
    number: 3,
    title: "Відео iOS",
    fields: [
      { key: "ios_video", label: "Відео інструкція для iOS", type: "video", placeholder: "https://example.com/ios.mp4" },
    ],
  },
  {
    number: 4,
    title: "Відео Windows",
    fields: [
      { key: "windows_video", label: "Відео інструкція для Windows", type: "video", placeholder: "https://example.com/windows.mp4" },
    ],
  },
  {
    number: 5,
    title: "Крок 2: Вступ до клубу",
    fields: [
      { key: "step2_text", label: "Текст кроку 2", type: "textarea", placeholder: "Крок 2: Вступ до клубу" },
      { key: "step2_video", label: "Відео кроку 2", type: "video", placeholder: "https://example.com/video2.mp4" },
    ],
  },
  {
    number: 6,
    title: "Крок 3: Бонус",
    fields: [
      { key: "bonus_text", label: "Текст бонусу", type: "textarea", placeholder: "Крок 3: Бонус" },
    ],
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
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isImage = value && /\.(jpg|jpeg|png|gif|webp)$/i.test(value);
  const isVideo = value && /\.(mp4|mov|avi|webm)$/i.test(value);

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
      {value && (
        <div className="relative rounded-md overflow-hidden border bg-muted">
          {isImage && (
            <img
              src={value}
              alt="Preview"
              className="max-h-40 w-auto object-contain mx-auto"
              data-testid={`preview-image-${fieldKey}`}
            />
          )}
          {isVideo && (
            <video
              src={value}
              controls
              className="max-h-40 w-full"
              data-testid={`preview-video-${fieldKey}`}
            />
          )}
          {!isImage && !isVideo && (
            <p className="p-3 text-sm text-muted-foreground truncate" data-testid={`text-current-${fieldKey}`}>
              {value}
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 bg-background/80"
            onClick={() => onChange("")}
            data-testid={`button-clear-${fieldKey}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileUpload}
        className="hidden"
        data-testid={`input-file-${fieldKey}`}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full"
        data-testid={`button-upload-${fieldKey}`}
      >
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? "Завантаження..." : "Завантажити з галереї"}
      </Button>
      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            data-testid={`input-url-${fieldKey}`}
          />
          <Button variant="ghost" size="icon" onClick={() => setShowUrlInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => setShowUrlInput(true)}
          data-testid={`button-show-url-${fieldKey}`}
        >
          або вставити URL
        </button>
      )}
    </div>
  );
}

export default function StepsPage() {
  const { data: configList, isLoading } = useQuery<BotConfig[]>({
    queryKey: ["/api/config"],
  });
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      setRecentlySaved(variables.key);
      setTimeout(() => setRecentlySaved(null), 2000);
      toast({ title: "Збережено" });
    },
    onError: () => {
      toast({ title: "Помилка збереження", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Кроки бота</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Footprints className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-steps-title">Кроки бота</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-steps-subtitle">
          Керуйте контентом кожного кроку бота
        </p>
      </div>

      <div className="space-y-6">
        {STEPS.map((step) => (
          <Card key={step.number} data-testid={`card-step-${step.number}`}>
            <CardHeader className="flex flex-row items-center gap-3 pb-4">
              <div className="flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-9 w-9 text-sm font-bold shrink-0">
                {step.number}
              </div>
              <CardTitle className="text-lg" data-testid={`text-step-title-${step.number}`}>
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step.fields.map((field) => {
                const isSaved = recentlySaved === field.key;
                return (
                  <div
                    key={field.key}
                    className="space-y-2"
                    data-testid={`field-row-${field.key}`}
                  >
                    <Label className="text-sm font-medium">{field.label}</Label>
                    {field.type === "video" ? (
                      <VideoUploadField
                        fieldKey={field.key}
                        value={values[field.key] || ""}
                        onChange={(val) => setValues(prev => ({ ...prev, [field.key]: val }))}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Textarea
                        value={values[field.key] || ""}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={4}
                        data-testid={`input-step-${field.key}`}
                      />
                    )}
                    <Button
                      size="sm"
                      onClick={() => saveConfig.mutate({ key: field.key, value: values[field.key] || "" })}
                      disabled={saveConfig.isPending}
                      data-testid={`button-save-${field.key}`}
                    >
                      {isSaved ? (
                        <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      {isSaved ? "Збережено" : "Зберегти"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
