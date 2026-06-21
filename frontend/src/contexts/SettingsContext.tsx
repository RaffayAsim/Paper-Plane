import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

interface WebhookConfig {
  mapLeads: string;
  yelpLeads: string;
  yellowPageLeads: string;
  mapMessage: string;
  yelpMessage: string;
  yellowPageMessage: string;
  mapTable: string;
  yelpTable: string;
  yellowPageTable: string;
  dynamicButtons: { name: string; url: string }[];
}

interface SettingsContextType {
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  airtableApiKey: string;
  setAirtableApiKey: (key: string) => void;
  airtableBaseId: string;
  setAirtableBaseId: (id: string) => void;
  airtableTableName: string;
  setAirtableTableName: (name: string) => void;
  webhooks: WebhookConfig;
  setWebhook: (key: keyof Omit<WebhookConfig, "dynamicButtons">, url: string) => void;
  setDynamicButtons: (buttons: { name: string; url: string }[]) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function emptyWebhooks(): WebhookConfig {
  return {
    mapLeads: "",
    yelpLeads: "",
    yellowPageLeads: "",
    mapMessage: "",
    yelpMessage: "",
    yellowPageMessage: "",
    mapTable: "",
    yelpTable: "",
    yellowPageTable: "",
    dynamicButtons: [],
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [airtableApiKey, setAirtableApiKey] = useState("");
  const [airtableBaseId, setAirtableBaseId] = useState("");
  const [airtableTableName, setAirtableTableName] = useState("Leads");
  const [webhooks, setWebhooks] = useState<WebhookConfig>(emptyWebhooks);

  useEffect(() => {
    if (role !== "super_admin") return;

    const load = async () => {
      try {
        const data = await api.get<{
          app: {
            leadCampaignWebhook: string;
            airtableApiKey: string;
            airtableBaseId: string;
            airtableTableName: string;
          };
          webhooks: WebhookConfig;
        }>("/settings");
        setWebhookUrl(data.app.leadCampaignWebhook || "");
        setAirtableApiKey(data.app.airtableApiKey || "");
        setAirtableBaseId(data.app.airtableBaseId || "");
        setAirtableTableName(data.app.airtableTableName || "Leads");
        setWebhooks({ ...emptyWebhooks(), ...data.webhooks });
      } catch {
        setWebhooks(emptyWebhooks());
      }
    };

    void load();
  }, [role]);

  const persist = async (
    config: WebhookConfig,
    appOverride?: Partial<{
      webhookUrl: string;
      airtableApiKey: string;
      airtableBaseId: string;
      airtableTableName: string;
    }>,
  ) => {
    const nextApp = {
      leadCampaignWebhook: appOverride?.webhookUrl ?? webhookUrl,
      airtableApiKey: appOverride?.airtableApiKey ?? airtableApiKey,
      airtableBaseId: appOverride?.airtableBaseId ?? airtableBaseId,
      airtableTableName: appOverride?.airtableTableName ?? airtableTableName,
    };

    await api.put("/settings", {
      app: nextApp,
      webhooks: config,
    });
    setWebhooks(config);
    setWebhookUrl(nextApp.leadCampaignWebhook);
    setAirtableApiKey(nextApp.airtableApiKey);
    setAirtableBaseId(nextApp.airtableBaseId);
    setAirtableTableName(nextApp.airtableTableName);
  };

  const updateWebhookUrl = (url: string) => { setWebhookUrl(url); };
  const updateAirtableApiKey = (key: string) => { setAirtableApiKey(key); };
  const updateAirtableBaseId = (id: string) => { setAirtableBaseId(id); };
  const updateAirtableTableName = (name: string) => { setAirtableTableName(name); };

  const setWebhook = (key: keyof Omit<WebhookConfig, "dynamicButtons">, url: string) => {
    void persist({ ...webhooks, [key]: url });
  };

  const setDynamicButtons = (buttons: { name: string; url: string }[]) => {
    void persist({ ...webhooks, dynamicButtons: buttons });
  };

  return (
    <SettingsContext.Provider
      value={{
        webhookUrl, setWebhookUrl: updateWebhookUrl,
        airtableApiKey, setAirtableApiKey: updateAirtableApiKey,
        airtableBaseId, setAirtableBaseId: updateAirtableBaseId,
        airtableTableName, setAirtableTableName: updateAirtableTableName,
        webhooks, setWebhook, setDynamicButtons,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
