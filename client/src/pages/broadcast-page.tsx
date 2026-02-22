import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Plus, X, Upload, Image } from "lucide-react";

interface InlineButton {
  text: string;
  url: string;
}

interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
}

export default function BroadcastPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [buttons, setButtons] = useState<InlineButton[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPhotoUrl(data.url);
      toast({ title: "Фото завантажено" });
    } catch {
      toast({ title: "Помилка завантаження", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { text: "", url: "" }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: "text" | "url", value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    setButtons(updated);
  };

  const handleSend = async () => {
    if (!text.trim()) {
      toast({ title: "Введіть текст розсилки", variant: "destructive" });
      return;
    }

    const validButtons = buttons.filter(b => b.text.trim() && b.url.trim());

    const confirmed = window.confirm(
      `Ви впевнені, що хочете надіслати розсилку всім користувачам?`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    try {
      const body: any = { text: text.trim() };
      if (photoUrl) body.photoUrl = photoUrl;
      if (validButtons.length > 0) body.buttons = validButtons;

      const res = await apiRequest("POST", "/api/broadcast", body);
      const data = await res.json();
      setResult(data);
      toast({ title: `Розсилку завершено: ${data.sent} надіслано, ${data.failed} помилок` });
    } catch {
      toast({ title: "Помилка при розсилці", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const validButtons = buttons.filter(b => b.text.trim() && b.url.trim());

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-broadcast-title">Розсилка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="broadcast-text">Текст повідомлення *</Label>
                <Textarea
                  id="broadcast-text"
                  placeholder="Введіть текст розсилки..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  data-testid="input-broadcast-text"
                />
              </div>

              <div className="space-y-2">
                <Label>Фото (необов'язково)</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById("broadcast-photo-input")?.click()}
                    data-testid="button-upload-photo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Завантаження..." : "Завантажити фото"}
                  </Button>
                  {photoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhotoUrl("")}
                      data-testid="button-remove-photo"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Видалити
                    </Button>
                  )}
                </div>
                <input
                  id="broadcast-photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  data-testid="input-broadcast-photo"
                />
                {photoUrl && (
                  <div className="mt-2">
                    <img
                      src={photoUrl}
                      alt="Preview"
                      className="max-h-32 rounded-md border"
                      data-testid="img-broadcast-photo-preview"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Inline кнопки (макс. 3)</CardTitle>
              {buttons.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  data-testid="button-add-inline-button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Додати кнопку
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {buttons.length === 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-no-buttons">
                  Кнопки не додано
                </p>
              )}
              {buttons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Текст кнопки"
                    value={btn.text}
                    onChange={(e) => updateButton(i, "text", e.target.value)}
                    className="flex-1 min-w-[120px]"
                    data-testid={`input-button-text-${i}`}
                  />
                  <Input
                    placeholder="URL"
                    value={btn.url}
                    onChange={(e) => updateButton(i, "url", e.target.value)}
                    className="flex-1 min-w-[120px]"
                    data-testid={`input-button-url-${i}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeButton(i)}
                    data-testid={`button-remove-inline-${i}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            disabled={!text.trim() || sending}
            onClick={handleSend}
            data-testid="button-send-broadcast"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Надсилання..." : "Надіслати розсилку"}
          </Button>

          {result && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2" data-testid="broadcast-result">
                  <p className="text-lg font-semibold" data-testid="text-result-title">Результат розсилки</p>
                  <div className="flex items-center justify-center gap-6 flex-wrap">
                    <div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-result-sent">{result.sent}</p>
                      <p className="text-sm text-muted-foreground">Надіслано</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-result-failed">{result.failed}</p>
                      <p className="text-sm text-muted-foreground">Помилки</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-result-total">{result.total}</p>
                      <p className="text-sm text-muted-foreground">Всього</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base" data-testid="text-preview-title">Попередній перегляд</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 space-y-3 bg-muted/30" data-testid="broadcast-preview">
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="Photo"
                    className="w-full rounded-md"
                    data-testid="img-preview-photo"
                  />
                )}
                {text ? (
                  <p className="whitespace-pre-wrap text-sm" data-testid="text-preview-message">{text}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic" data-testid="text-preview-empty">
                    Введіть текст повідомлення...
                  </p>
                )}
                {validButtons.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t">
                    {validButtons.map((btn, i) => (
                      <div
                        key={i}
                        className="text-center py-1.5 text-sm rounded-md bg-primary/10 text-primary font-medium"
                        data-testid={`preview-button-${i}`}
                      >
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
