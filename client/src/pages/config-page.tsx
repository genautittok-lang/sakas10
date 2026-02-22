import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Link as LinkIcon, Smartphone, CreditCard, Cog, ChevronDown, CheckCircle, Shield, Trash2, UserPlus, Key, Users, Plus } from "lucide-react";
import type { BotConfig } from "@shared/schema";

interface ConfigField {
  key: string;
  label: string;
  description: string;
  type: "text" | "textarea" | "url";
  placeholder: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: "club_id", label: "Club ID", description: "ID клубу для відображення на кроці 2", type: "text", placeholder: "CLUB123" },
  { key: "rules_link", label: "Посилання \u00AB\u041F\u0440\u0430\u0432\u0438\u043B\u0430\u00BB", description: "URL кнопки \u00AB\u041F\u0440\u0430\u0432\u0438\u043B\u0430\u00BB (відкривається у браузері)", type: "url", placeholder: "https://example.com/rules" },
  { key: "club_join_link", label: "\u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u00AB\u0412\u0441\u0442\u0443\u043F\u0438\u0442\u0438 \u0432 \u043A\u043B\u0443\u0431\u00BB", description: "URL \u043A\u043D\u043E\u043F\u043A\u0438 \u00AB\u0412\u0441\u0442\u0443\u043F\u0438\u0442\u0438 \u0432 \u043A\u043B\u0443\u0431\u00BB \u0432 \u0433\u043E\u043B\u043E\u0432\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E", type: "url", placeholder: "https://example.com/club" },
  { key: "android_link", label: "Посилання Android", description: "URL для завантаження на Android", type: "url", placeholder: "https://play.google.com/..." },
  { key: "ios_link", label: "Посилання iOS", description: "URL для завантаження на iOS", type: "url", placeholder: "https://apps.apple.com/..." },
  { key: "windows_link", label: "Посилання Windows", description: "URL для завантаження на Windows", type: "url", placeholder: "https://example.com/download" },
  { key: "payment_amounts", label: "Суми оплати", description: "Фіксовані суми для кнопок оплати (через кому)", type: "text", placeholder: "100, 200, 500, 1000, 2000, 5000" },
  { key: "convert2pay_api_url", label: "Convert2pay URL", description: "URL сторінки оплати. Сума додається автоматично (?amount=X). Або шаблон з {amount}, {player_id}, {payment_id}", type: "text", placeholder: "https://cabinet.konvert2pay.me/Landing/..." },
  { key: "convert2pay_merchant_id", label: "Convert2pay Merchant ID", description: "Ідентифікатор мерчанта Convert2pay", type: "text", placeholder: "merchant_123" },
  { key: "convert2pay_secret_key", label: "Convert2pay Secret Key", description: "Секретний ключ API Convert2pay", type: "text", placeholder: "sk_live_..." },
  { key: "convert2pay_currency", label: "Convert2pay валюта", description: "Код валюти (за замовчуванням UAH)", type: "text", placeholder: "UAH" },
];

const SECTIONS = [
  {
    title: "Основні",
    description: "Головні ідентифікатори бота",
    icon: Cog,
    keys: ["club_id", "rules_link"],
  },
  {
    title: "Посилання на додаток",
    description: "URL для завантаження додатку на різні платформи",
    icon: Smartphone,
    keys: ["android_link", "ios_link", "windows_link", "club_join_link"],
  },
  {
    title: "Оплата",
    description: "Налаштування платіжної системи Convert2pay",
    icon: CreditCard,
    keys: ["payment_amounts", "convert2pay_api_url", "convert2pay_merchant_id", "convert2pay_secret_key", "convert2pay_currency"],
  },
];

function ModeratorSection({ configList }: { configList: BotConfig[] | undefined }) {
  const { toast } = useToast();
  const [moderators, setModerators] = useState<string[]>(["", "", ""]);
  const [isOpen, setIsOpen] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (configList) {
      const entry = configList.find(c => c.key === "manager_chat_id");
      const raw = entry?.value || "";
      const parts = raw.split(",").map(s => s.trim());
      setModerators([parts[0] || "", parts[1] || "", parts[2] || ""]);
    }
  }, [configList]);

  const saveModerators = useMutation({
    mutationFn: async () => {
      const value = moderators.filter(m => m.trim()).join(",");
      await apiRequest("POST", "/api/config", { key: "manager_chat_id", value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      toast({ title: "Збережено" });
    },
    onError: () => {
      toast({ title: "Помилка збереження", variant: "destructive" });
    },
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-3">
        <CollapsibleTrigger className="w-full" data-testid="button-toggle-section-moderators">
          <div className="flex items-center justify-between gap-4 hover-elevate rounded-md p-2 -ml-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <h2 className="text-lg font-semibold" data-testid="text-section-moderators">Модератори</h2>
                <p className="text-sm text-muted-foreground">Telegram Chat ID модераторів бота (до 3)</p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground">Числовий Chat ID (не юзернейм!). Надішліть /start боту @userinfobot щоб дізнатися свій ID</p>
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="space-y-1">
                    <Label className="text-sm font-medium">Модератор {i + 1}</Label>
                    <Input
                      value={moderators[i]}
                      onChange={(e) => {
                        const updated = [...moderators];
                        updated[i] = e.target.value;
                        setModerators(updated);
                      }}
                      placeholder="123456789"
                      data-testid={`input-moderator-${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => saveModerators.mutate()}
                disabled={saveModerators.isPending}
                data-testid="button-save-moderators"
              >
                {isSaved ? (
                  <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                {isSaved ? "Збережено" : "Зберегти"}
              </Button>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface SocialLink {
  name: string;
  url: string;
}

function SocialLinksSection({ configList }: { configList: BotConfig[] | undefined }) {
  const { toast } = useToast();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (configList) {
      const entry = configList.find(c => c.key === "social_links");
      if (entry?.value) {
        try {
          const parsed = JSON.parse(entry.value);
          if (Array.isArray(parsed)) setLinks(parsed);
        } catch {}
      }
    }
  }, [configList]);

  const saveLinks = useMutation({
    mutationFn: async (updatedLinks: SocialLink[]) => {
      await apiRequest("POST", "/api/config", { key: "social_links", value: JSON.stringify(updatedLinks) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      toast({ title: "Збережено" });
    },
    onError: () => {
      toast({ title: "Помилка збереження", variant: "destructive" });
    },
  });

  const addLink = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const updated = [...links, { name: newName.trim(), url: newUrl.trim() }];
    setLinks(updated);
    setNewName("");
    setNewUrl("");
    saveLinks.mutate(updated);
  };

  const removeLink = (index: number) => {
    const updated = links.filter((_, i) => i !== index);
    setLinks(updated);
    saveLinks.mutate(updated);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-3">
        <CollapsibleTrigger className="w-full" data-testid="button-toggle-section-social">
          <div className="flex items-center justify-between gap-4 hover-elevate rounded-md p-2 -ml-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <h2 className="text-lg font-semibold" data-testid="text-section-social">Соціальні мережі</h2>
                <p className="text-sm text-muted-foreground">Посилання у вітальному повідомленні (клікабельний текст)</p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4 space-y-4">
              {links.length === 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-no-social-links">Немає доданих посилань</p>
              )}
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 p-3 border rounded-md" data-testid={`social-link-row-${index}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-social-name-${index}`}>{link.name}</p>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-social-url-${index}`}>{link.url}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLink(index)}
                      disabled={saveLinks.isPending}
                      data-testid={`button-delete-social-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 pt-2 border-t flex-wrap">
                <div className="flex-1 min-w-[120px] space-y-1">
                  <Label className="text-xs">Назва</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Telegram канал"
                    data-testid="input-new-social-name"
                  />
                </div>
                <div className="flex-1 min-w-[120px] space-y-1">
                  <Label className="text-xs">Посилання</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://t.me/channel"
                    data-testid="input-new-social-url"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={addLink}
                  disabled={!newName.trim() || !newUrl.trim() || saveLinks.isPending}
                  data-testid="button-add-social"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Додати
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface AdminUser {
  id: string;
  username: string;
}

function AdminManagementSection() {
  const { data: admins, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admins"],
  });
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const addAdmin = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admins", { username: newUsername, password: newPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setNewUsername("");
      setNewPassword("");
      toast({ title: "Адміністратора додано" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Помилка", variant: "destructive" });
    },
  });

  const deleteAdmin = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      toast({ title: "Адміністратора видалено" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Помилка", variant: "destructive" });
    },
  });

  const changePassword = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await apiRequest("PATCH", `/api/admins/${id}/password`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admins"] });
      setChangingPasswordId(null);
      setNewPasswordValue("");
      toast({ title: "Пароль змінено" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Помилка", variant: "destructive" });
    },
  });

  const maxReached = (admins?.length || 0) >= 3;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-3">
        <CollapsibleTrigger className="w-full" data-testid="button-toggle-section-admins">
          <div className="flex items-center justify-between gap-4 hover-elevate rounded-md p-2 -ml-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <h2 className="text-lg font-semibold" data-testid="text-section-admins">Адміністратори</h2>
                <p className="text-sm text-muted-foreground">Управління доступом до адмін панелі</p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4 space-y-4">
              {isLoading ? (
                <div className="h-16 bg-muted rounded animate-pulse" />
              ) : (
                <div className="space-y-3">
                  {admins?.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between gap-2 flex-wrap p-3 border rounded-md" data-testid={`admin-row-${admin.id}`}>
                      <span className="text-sm font-medium" data-testid={`text-admin-username-${admin.id}`}>{admin.username}</span>
                      <div className="flex items-center gap-1">
                        {changingPasswordId === admin.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="password"
                              placeholder="Новий пароль"
                              value={newPasswordValue}
                              onChange={(e) => setNewPasswordValue(e.target.value)}
                              className="w-40"
                              data-testid={`input-change-password-${admin.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => changePassword.mutate({ id: admin.id, password: newPasswordValue })}
                              disabled={!newPasswordValue || changePassword.isPending}
                              data-testid={`button-save-password-${admin.id}`}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Зберегти
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setChangingPasswordId(null); setNewPasswordValue(""); }}
                              data-testid={`button-cancel-password-${admin.id}`}
                            >
                              Скасувати
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setChangingPasswordId(admin.id)}
                            data-testid={`button-change-password-${admin.id}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteAdmin.mutate(admin.id)}
                          disabled={deleteAdmin.isPending || (admins?.length || 0) <= 1}
                          data-testid={`button-delete-admin-${admin.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {maxReached ? (
                <p className="text-sm text-muted-foreground" data-testid="text-max-admins">Максимальна кількість адміністраторів (3) досягнута</p>
              ) : (
                <div className="flex items-end gap-2 pt-2 border-t flex-wrap">
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-xs">Логін</Label>
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Логін"
                      data-testid="input-new-admin-username"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-xs">Пароль</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Пароль"
                      data-testid="input-new-admin-password"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addAdmin.mutate()}
                    disabled={!newUsername || !newPassword || addAdmin.isPending}
                    data-testid="button-add-admin"
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Додати
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function ConfigPage() {
  const { data: configList, isLoading } = useQuery<BotConfig[]>({
    queryKey: ["/api/config"],
  });
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SECTIONS.forEach(s => { initial[s.title] = true; });
    return initial;
  });
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

  const fieldsByKey = CONFIG_FIELDS.reduce<Record<string, ConfigField>>((acc, field) => {
    acc[field.key] = field;
    return acc;
  }, {});

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

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
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold" data-testid="text-config-title">Налаштування бота</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-config-subtitle">Керуйте налаштуваннями бота</p>
      </div>

      <div className="space-y-6">
        <ModeratorSection configList={configList} />
        <SocialLinksSection configList={configList} />

        {SECTIONS.map((section) => (
          <Collapsible
            key={section.title}
            open={openSections[section.title]}
            onOpenChange={() => toggleSection(section.title)}
          >
            <div className="space-y-3">
              <CollapsibleTrigger className="w-full" data-testid={`button-toggle-section-${section.title}`}>
                <div className="flex items-center justify-between gap-4 hover-elevate rounded-md p-2 -ml-2">
                  <div className="flex items-center gap-2">
                    <section.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <h2 className="text-lg font-semibold" data-testid={`text-section-${section.title}`}>{section.title}</h2>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openSections[section.title] ? "rotate-180" : ""}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card>
                  <CardContent className="p-0">
                    {section.keys.map((key) => {
                      const field = fieldsByKey[key];
                      if (!field) return null;
                      const isSaved = recentlySaved === field.key;
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
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}

        <AdminManagementSection />
      </div>
    </div>
  );
}
