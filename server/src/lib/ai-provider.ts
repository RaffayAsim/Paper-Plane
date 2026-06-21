import { getAiProviderConfig, type AiProviderConfig } from "./ai-settings.js";
import { logger } from "./logger.js";
import type { UserAiBrandProfile } from "./ai-brand-profile.js";

const HARD_CODED_SYSTEM_PROMPT =
  "You write concise personalized B2B sales outreach emails. Return strict JSON only with keys subject and body. Keep claims realistic, tone professional, and avoid invented facts.";

type DraftInput = {
  source: string;
  pitch: string;
  lead: {
    name: string;
    business: string;
    industry: string | null;
    location: string | null;
    website: string | null;
  };
  brandProfile?: UserAiBrandProfile | null;
  senderName?: string | null;
  senderEmail?: string | null;
};

type DraftResult = {
  subject: string;
  body: string;
  provider: string;
  model: string;
};

type EmailAdminForHumanReviewToolCall = {
  toolName: "emailAdminForHumanReview";
  subject: string;
  summary: string;
  reason: string;
  details: string;
};

type NotifyAssignedUserToolCall = {
  toolName: "notifyAssignedUser";
  subject: string;
  summary: string;
  details: string;
};

type CreateAdminTaskToolCall = {
  toolName: "createAdminTask";
  title: string;
  summary: string;
  priority: "low" | "normal" | "high" | "urgent";
};

type PauseAutoReplyForThreadToolCall = {
  toolName: "pauseAutoReplyForThread";
  reason: string;
};

type ScheduleFollowUpEmailToolCall = {
  toolName: "scheduleFollowUpEmail";
  subject: string;
  body: string;
  delayMinutes: number;
};

type ThreadRouterToolCall =
  | EmailAdminForHumanReviewToolCall
  | NotifyAssignedUserToolCall
  | CreateAdminTaskToolCall
  | PauseAutoReplyForThreadToolCall
  | ScheduleFollowUpEmailToolCall;

export type ThreadReplyResult =
  | (DraftResult & { outcome: "reply"; interestScore?: number | null })
  | {
      outcome: "tool_call";
      provider: string;
      model: string;
      interestScore?: number | null;
      toolCall: ThreadRouterToolCall;
    };

type PromptInput = {
  systemPrompt: string;
  userPrompt: string;
};

function buildPrompt(input: DraftInput) {
  const parts = [
    "Write a short personalized cold email for a business lead.",
    "Return strict JSON with keys: subject, body.",
    "Keep the tone professional, concise, and human.",
    "Do not invent false facts.",
    "",
    `Lead source: ${input.source}`,
    `Business: ${input.lead.business}`,
    `Contact name: ${input.lead.name || input.lead.business}`,
    `Industry: ${input.lead.industry || "Unknown"}`,
    `Location: ${input.lead.location || "Unknown"}`,
    `Website: ${input.lead.website || "Unknown"}`,
    "",
    "Offer to pitch:",
    input.pitch.trim(),
  ];

  if (input.brandProfile) {
    parts.push(
      "",
      "CRITICAL INSTRUCTIONS FOR OFFER FOCUS:",
      "1. Focus EXCLUSIVELY on pitching the specific service or offer outlined in the 'Offer to pitch' above.",
      "2. Do NOT pitch, describe, list, or combine other services from the company's general brand profile services list.",
      "3. Use the general brand profile only for general company identity, context, tone guidelines, and signature/contact info."
    );
  }

  if (input.senderName) {
    parts.push(
      "",
      "SENDER IDENTIFICATION:",
      `You are writing this email on behalf of: ${input.senderName}`,
      input.senderEmail ? `Sender Email Address: ${input.senderEmail}` : "",
      "Always sign off the email using this sender name (and sender email if appropriate) in the signature block. Do NOT use any contact person names from the general brand profile in the signature or as the sender."
    );
  }

  return parts.join("\n");
}

function buildBrandAwareOutboundSystemPrompt(profile: UserAiBrandProfile) {
  return [
    `You are a sales agent for ${profile.brandName || "the brand"}.`,
    "Your job is to write concise, personalized cold outreach emails to business leads.",
    "Return strict JSON only with keys subject and body.",
    "Write plain text only.",
    "Keep claims realistic, tone professional, and avoid invented facts.",
    "Do not invent services, pricing, guarantees, or contact details.",
    "If exact pricing is unavailable, say a team member can provide details.",
    "",
    "Brand guidelines:",
    profile.brandGuidelines || "No additional brand guidelines provided.",
    "",
    profile.industry ? `Industry: ${profile.industry}\n` : "",
    profile.companySize ? `Company Size: ${profile.companySize}\n` : "",
    profile.domainName ? `Preferred Email Domain: ${profile.domainName}\n` : "",
    "Services and products overview:",
    profile.services || "Not provided.",
    "",
    "Pricing information:",
    profile.pricing || "Not provided.",
    "",
    "Sales email:",
    profile.salesEmail || "Not provided.",
    "",
    "Contact persons:",
    profile.contactPersons || "Not provided.",
  ].filter(Boolean).join("\n");
}

function buildBrandAwareSystemPrompt(profile: UserAiBrandProfile) {
  return [
    `You are a sales agent for ${profile.brandName || "the brand"}.`,
    "Your job is to write thoughtful, concise sales email replies that move the conversation forward.",
    "Return strict JSON only with keys subject and body.",
    "Write plain text only.",
    "Do not invent services, pricing, guarantees, or contact details.",
    "If exact pricing is unavailable, say a team member can provide details.",
    "",
    "Brand guidelines:",
    profile.brandGuidelines || "No additional brand guidelines provided.",
    "",
    profile.industry ? `Industry: ${profile.industry}\n` : "",
    profile.companySize ? `Company Size: ${profile.companySize}\n` : "",
    profile.domainName ? `Preferred Email Domain: ${profile.domainName}\n` : "",
    "Services and products:",
    profile.services || "Not provided.",
    "",
    "Pricing information:",
    profile.pricing || "Not provided.",
    "",
    "Sales email:",
    profile.salesEmail || "Not provided.",
    "",
    "Contact persons:",
    profile.contactPersons || "Not provided.",
  ].filter(Boolean).join("\n");
}

function parseJsonPayload(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeAiText(value: string) {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\r\n/g, "\n");
}

function parseDraftPayload(text: string) {
  const parsed = parseJsonPayload(text) as { subject?: string; body?: string } | null;
  if (parsed?.subject && parsed?.body) {
    return {
      subject: normalizeAiText(parsed.subject).trim(),
      body: normalizeAiText(parsed.body).trim(),
    };
  }
  return null;
}

function parseToolPayload(text: string) {
  const parsed = parseJsonPayload(text) as {
    outcome?: string;
    toolName?: string;
    subject?: string;
    body?: string;
    summary?: string;
    reason?: string;
    details?: string;
    title?: string;
    priority?: string;
    delayMinutes?: number;
    interestScore?: number;
  } | null;

  if (!parsed) {
    return null;
  }

  const interestScore =
    typeof parsed.interestScore === "number" && Number.isFinite(parsed.interestScore)
      ? Math.min(10, Math.max(0, Math.round(parsed.interestScore)))
      : null;

  if (parsed.outcome === "tool_call") {
    if (parsed.toolName === "emailAdminForHumanReview" && parsed.subject && parsed.summary && parsed.reason) {
      return {
        outcome: "tool_call" as const,
        interestScore,
        toolCall: {
          toolName: "emailAdminForHumanReview" as const,
          subject: normalizeAiText(parsed.subject).trim(),
          summary: normalizeAiText(parsed.summary).trim(),
          reason: normalizeAiText(parsed.reason).trim(),
          details: normalizeAiText(parsed.details || "").trim(),
        },
      };
    }

    if (parsed.toolName === "notifyAssignedUser" && parsed.subject && parsed.summary) {
      return {
        outcome: "tool_call" as const,
        interestScore,
        toolCall: {
          toolName: "notifyAssignedUser" as const,
          subject: normalizeAiText(parsed.subject).trim(),
          summary: normalizeAiText(parsed.summary).trim(),
          details: normalizeAiText(parsed.details || "").trim(),
        },
      };
    }

    if (parsed.toolName === "createAdminTask" && parsed.title && parsed.summary) {
      const priority: CreateAdminTaskToolCall["priority"] =
        parsed.priority === "low" || parsed.priority === "high" || parsed.priority === "urgent"
          ? parsed.priority
          : "normal";
      return {
        outcome: "tool_call" as const,
        interestScore,
        toolCall: {
          toolName: "createAdminTask" as const,
          title: normalizeAiText(parsed.title).trim(),
          summary: normalizeAiText(parsed.summary).trim(),
          priority,
        },
      };
    }

    if (parsed.toolName === "pauseAutoReplyForThread" && parsed.reason) {
      return {
        outcome: "tool_call" as const,
        interestScore,
        toolCall: {
          toolName: "pauseAutoReplyForThread" as const,
          reason: normalizeAiText(parsed.reason).trim(),
        },
      };
    }

    if (
      parsed.toolName === "scheduleFollowUpEmail" &&
      parsed.subject &&
      parsed.body &&
      typeof parsed.delayMinutes === "number" &&
      Number.isFinite(parsed.delayMinutes)
    ) {
      return {
        outcome: "tool_call" as const,
        interestScore,
        toolCall: {
          toolName: "scheduleFollowUpEmail" as const,
          subject: normalizeAiText(parsed.subject).trim(),
          body: normalizeAiText(parsed.body).trim(),
          delayMinutes: Math.max(5, Math.round(parsed.delayMinutes)),
        },
      };
    }

    return null;
  }

  if (parsed.subject && parsed.body) {
    return {
      outcome: "reply" as const,
      interestScore,
      subject: normalizeAiText(parsed.subject).trim(),
      body: normalizeAiText(parsed.body).trim(),
    };
  }

  return null;
}

async function callOpenAiStyle(config: AiProviderConfig, input: PromptInput) {
  const response = await fetch(`${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content || "";
  const parsed = parseDraftPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable draft payload");
  }

  return parsed;
}

async function callOpenAiStyleJson(config: AiProviderConfig, input: PromptInput) {
  const response = await fetch(`${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content || "";
  const parsed = parseJsonPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable JSON payload");
  }

  return parsed;
}

async function callAnthropic(config: AiProviderConfig, input: PromptInput) {
  const response = await fetch(config.baseUrl || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 800,
      temperature: config.temperature ?? 0.7,
      system: input.systemPrompt,
      messages: [
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const content = payload.content?.map((item) => item.text || "").join("\n") || "";
  const parsed = parseDraftPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable draft payload");
  }

  return parsed;
}

async function callAnthropicJson(config: AiProviderConfig, input: PromptInput) {
  const response = await fetch(config.baseUrl || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 800,
      temperature: config.temperature ?? 0.7,
      system: input.systemPrompt,
      messages: [
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const content = payload.content?.map((item) => item.text || "").join("\n") || "";
  const parsed = parseJsonPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable JSON payload");
  }

  return parsed;
}

async function callGemini(config: AiProviderConfig, input: PromptInput) {
  const endpointBase = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(
    `${endpointBase}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.userPrompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.map((item) => item.text || "").join("\n") || "";
  const parsed = parseDraftPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable draft payload");
  }

  return parsed;
}

async function callGeminiJson(config: AiProviderConfig, input: PromptInput) {
  const endpointBase = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(
    `${endpointBase}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.userPrompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`AI provider request failed (${response.status})`);
  }

  const payload = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.map((item) => item.text || "").join("\n") || "";
  const parsed = parseJsonPayload(content);
  if (!parsed) {
    throw new Error("AI provider returned an unreadable JSON payload");
  }

  return parsed;
}

async function generateAiEmail(prompt: PromptInput, userId?: string): Promise<DraftResult | null> {
  const config = await getAiProviderConfig(userId);
  if (!config?.isActive || !config.apiKey || !config.model) {
    logger.warn("AI email skipped: provider not configured or inactive", {
      userId,
      hasConfig: Boolean(config),
      isActive: config?.isActive,
      hasApiKey: Boolean(config?.apiKey),
      hasModel: Boolean(config?.model),
    });
    return null;
  }

  const draft =
    config.provider === "anthropic"
      ? await callAnthropic(config, prompt)
      : config.provider === "gemini"
        ? await callGemini(config, prompt)
        : await callOpenAiStyle(config, prompt);

  return {
    ...draft,
    provider: config.provider,
    model: config.model,
  };
}

async function generateAiJsonObject(prompt: PromptInput, userId?: string) {
  const config = await getAiProviderConfig(userId);
  if (!config?.isActive || !config.apiKey || !config.model) {
    logger.warn("AI JSON object skipped: provider not configured or inactive", {
      userId,
      hasConfig: Boolean(config),
      isActive: config?.isActive,
      hasApiKey: Boolean(config?.apiKey),
      hasModel: Boolean(config?.model),
    });
    return null;
  }

  const draft =
    config.provider === "anthropic"
      ? await callAnthropicJson(config, prompt)
      : config.provider === "gemini"
        ? await callGeminiJson(config, prompt)
        : await callOpenAiStyleJson(config, prompt);

  return draft as Record<string, unknown>;
}

export async function generateAiEmailDraft(input: DraftInput, userId?: string): Promise<DraftResult | null> {
  const systemPrompt = input.brandProfile
    ? buildBrandAwareOutboundSystemPrompt(input.brandProfile)
    : HARD_CODED_SYSTEM_PROMPT;

  return generateAiEmail({
    systemPrompt,
    userPrompt: buildPrompt(input),
  }, userId);
}

export async function generateAiThreadReply(input: {
  brandProfile: UserAiBrandProfile;
  source: string;
  mailboxEmail: string;
  subject: string;
  campaignBrief?: string | null;
  campaignContext?: {
    id?: string | null;
    source?: string | null;
    createdAt?: string | null;
  } | null;
  threadMessages: Array<{
    direction: "incoming" | "outgoing";
    fromEmail: string;
    toEmail: string;
    createdAt: string;
    body: string;
  }>;
  senderName?: string | null;
}, userId?: string): Promise<ThreadReplyResult | null> {
  const recentMessages = input.threadMessages.slice(-12);
  const threadTranscript = recentMessages
    .map((message, index) => {
      return [
        `Message ${index + 1}`,
        `Direction: ${message.direction}`,
        `From: ${message.fromEmail}`,
        `To: ${message.toEmail}`,
        `At: ${message.createdAt}`,
        "Body:",
        message.body.trim() || "(empty)",
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const systemPrompt = [
    buildBrandAwareSystemPrompt(input.brandProfile),
    "",
    "You may choose one of the following outcomes:",
    '1. Reply normally with JSON: {"outcome":"reply","subject":"...","body":"...","interestScore":5}',
    '2. Call a tool with JSON: {"outcome":"tool_call","toolName":"emailAdminForHumanReview","subject":"...","summary":"...","reason":"...","details":"...","interestScore":9}',
    '3. Call a tool with JSON: {"outcome":"tool_call","toolName":"notifyAssignedUser","subject":"...","summary":"...","details":"...","interestScore":6}',
    '4. Call a tool with JSON: {"outcome":"tool_call","toolName":"createAdminTask","title":"...","summary":"...","priority":"normal","interestScore":4}',
    '5. Call a tool with JSON: {"outcome":"tool_call","toolName":"pauseAutoReplyForThread","reason":"...","interestScore":2}',
    '6. Call a tool with JSON: {"outcome":"tool_call","toolName":"scheduleFollowUpEmail","subject":"...","body":"...","delayMinutes":1440,"interestScore":5}',
    "",
    "ALWAYS include 'interestScore' (integer 0-10) in your JSON response.",
    "Score the lead's buying interest based on the full thread: 0=no interest/spam, 3=polite but not interested, 5=curious/neutral, 7=clearly interested, 9=strong intent (wants demo/pricing/meeting), 10=ready to buy.",
    "",
    "Use emailAdminForHumanReview when the message requests pricing or terms not provided, legal/compliance commitments, refunds/exceptions, contract changes, sensitive account actions, or anything that could be risky to answer without a human.",
    "Use notifyAssignedUser when a teammate should take over soon but admin escalation is not necessary.",
    "Use createAdminTask when the issue should be tracked internally even if no immediate email reply is sent.",
    "Use pauseAutoReplyForThread when automation should stop on this thread.",
    "Use scheduleFollowUpEmail when the best next step is to reply later, not now.",
    "Do not invent approvals, discounts, guarantees, implementation commitments, or policy exceptions.",
    "",
    "CRITICAL AUTOMATION STOPPING RULES:",
    "You MUST use either 'emailAdminForHumanReview' (to escalate and notify) or 'pauseAutoReplyForThread' (to stop automation) in the following cases:",
    "1. The client expresses clear buying intent, interest in buying, or asks to purchase.",
    "2. The client asks to schedule a call, meeting, demo, or phone conversation.",
    "3. The client provides their availability or says they are available now/soon (e.g. 'I am available now', 'here are my hours', 'let's chat').",
    "4. The client asks for custom pricing, quotes, or contracts that are not explicitly defined in the brand profile.",
    "5. The client seems frustrated, confused, or asks to speak with a human/manager.",
    "Do NOT continue replying automatically (outcome: 'reply') in these scenarios. You must stop the automation and let a human take over.",
  ].join("\n");

  const raw = await generateAiJsonObject({
    systemPrompt,
    userPrompt: [
      "Write the next reply in this live email thread.",
      'Return strict JSON with either {"outcome":"reply","subject","body"} or {"outcome":"tool_call", ...}.',
      "Keep the response human, helpful, and sales-oriented.",
      "Use the thread context and answer the latest inbound message directly.",
      "Ground the reply in the brand profile and follow the campaign brief when it is provided.",
      "Do not drift away from the campaign's offer, positioning, tone, or call to action.",
      "Keep the subject aligned with the existing thread subject.",
      "If the latest inbound message asks for details, answer using only the provided brand and campaign context.",
      "If key information is missing, reply honestly and offer a next step instead of inventing facts.",
      "",
      ...(input.senderName
        ? [
            "SENDER IDENTIFICATION:",
            `You are replying on behalf of: ${input.senderName}`,
            `Sender Email Address: ${input.mailboxEmail}`,
            "Always sign off the email using this sender name (and sender email if appropriate) in the signature block. Do NOT use any contact person names from the general brand profile in the signature or as the sender.",
            "",
          ]
        : []),
      `Lead source: ${input.source}`,
      `Mailbox email: ${input.mailboxEmail}`,
      `Current subject: ${input.subject}`,
      "",
      "Campaign context:",
      input.campaignContext
        ? [
            `Campaign ID: ${input.campaignContext.id || "Unknown"}`,
            `Campaign source: ${input.campaignContext.source || "Unknown"}`,
            `Campaign created at: ${input.campaignContext.createdAt || "Unknown"}`,
          ].join("\n")
        : "No linked campaign metadata found.",
      "",
      "Campaign brief:",
      input.campaignBrief?.trim() || "No campaign brief was found for this thread.",
      "",
      "Thread transcript:",
      threadTranscript || "No previous thread content available.",
    ].join("\n"),
  }, userId);

  if (!raw) {
    return null;
  }

  const parsed = parseToolPayload(JSON.stringify(raw));
  if (!parsed) {
    throw new Error("AI provider returned an unreadable thread reply payload");
  }

  const config = await getAiProviderConfig(userId);
  const provider = config?.provider || "unknown";
  const model = config?.model || "unknown";

  if (parsed.outcome === "tool_call") {
    return {
      outcome: "tool_call",
      provider,
      model,
      interestScore: parsed.interestScore ?? null,
      toolCall: parsed.toolCall,
    };
  }

  return {
    outcome: "reply",
    subject: parsed.subject,
    body: parsed.body,
    provider,
    model,
    interestScore: parsed.interestScore ?? null,
  };
}

export type VoiceCallAnalysis = {
  interestScore: number | null;
  needsHumanReview: boolean;
  reviewReason: string | null;
  summary: string | null;
};

export async function analyzeVoiceCall(input: {
  brandProfile?: UserAiBrandProfile | null;
  objective: string;
  transcript?: string | null;
  summary?: string | null;
  contactName?: string | null;
  business?: string | null;
}): Promise<VoiceCallAnalysis | null> {
  const transcript = input.transcript?.trim() || "";
  const priorSummary = input.summary?.trim() || "";

  // Nothing meaningful to analyze.
  if (!transcript && !priorSummary) {
    return null;
  }

  const systemPrompt = [
    input.brandProfile
      ? buildBrandAwareSystemPrompt(input.brandProfile)
      : "You are a sales operations analyst reviewing the outcome of an outbound sales phone call.",
    "",
    "You are analyzing a COMPLETED outbound sales phone call (transcript and/or call summary provided).",
    'Return strict JSON ONLY with this exact shape: {"interestScore":<0-10 integer>,"needsHumanReview":<boolean>,"reviewReason":"<short reason or empty>","summary":"<2-3 sentence outcome summary>"}.',
    "",
    "interestScore rubric (the prospect's buying interest based on the whole call):",
    "0=no interest/wrong number/hostile, 3=polite but not interested, 5=curious/neutral, 7=clearly interested, 9=strong intent (wants demo/pricing/meeting/callback), 10=ready to buy now.",
    "",
    "Set needsHumanReview=true (and give a short reviewReason) when ANY of these happened on the call:",
    "1. The prospect asked to book or scheduled a meeting, demo, or callback.",
    "2. The prospect expressed clear buying intent or asked how to purchase.",
    "3. The prospect asked for custom pricing, a quote, or contract terms not defined in the brand profile.",
    "4. The prospect asked to speak to a human/manager, or seemed frustrated or confused.",
    "5. The prospect raised an objection, legal/compliance, or refund/exception question that needs a human.",
    "6. The prospect gave their availability or contact details for follow-up.",
    "Otherwise set needsHumanReview=false and reviewReason to an empty string.",
    "",
    "Base your judgment ONLY on what actually happened in the provided transcript/summary. Do not invent outcomes.",
  ].join("\n");

  const userPrompt = [
    "Analyze this outbound sales call and return the JSON described above.",
    "",
    `Campaign objective given to the AI caller: ${input.objective || "Not provided."}`,
    input.contactName ? `Prospect: ${input.contactName}` : "",
    input.business ? `Business: ${input.business}` : "",
    "",
    priorSummary ? `Call summary:\n${priorSummary}` : "",
    "",
    transcript ? `Call transcript:\n${transcript.slice(0, 12000)}` : "(No transcript available; rely on the summary.)",
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await generateAiJsonObject({ systemPrompt, userPrompt }).catch((error: unknown) => {
    logger.warn("Voice call analysis threw an error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!parsed) {
    return null;
  }

  const rawScore = parsed.interestScore;
  const interestScore =
    typeof rawScore === "number" && Number.isFinite(rawScore)
      ? Math.min(10, Math.max(0, Math.round(rawScore)))
      : null;

  const reviewReasonRaw = typeof parsed.reviewReason === "string" ? parsed.reviewReason.trim() : "";

  return {
    interestScore,
    needsHumanReview: parsed.needsHumanReview === true,
    reviewReason: reviewReasonRaw || null,
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
  };
}

export async function generateAiCampaignBrief(input: {
  brandProfile: UserAiBrandProfile;
  source: string;
  description?: string;
  leads: Array<{
    name: string;
    business: string;
    industry: string | null;
    location: string | null;
    website: string | null;
  }>;
}) {
  const leadPreview = input.leads
    .slice(0, 12)
    .map((lead, index) =>
      [
        `${index + 1}. ${lead.business}`,
        `Contact: ${lead.name || lead.business}`,
        `Industry: ${lead.industry || "Unknown"}`,
        `Location: ${lead.location || "Unknown"}`,
        `Website: ${lead.website || "Unknown"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const endpointPrompt = {
    systemPrompt: [
      `You are a sales strategist for ${input.brandProfile.brandName || "the brand"}.`,
      "Write a strong outbound campaign brief for sales email automation.",
      "Return strict JSON with keys subject and body.",
      "The brief should be concise, specific, and actionable.",
      "Do not invent services, pricing, or promises beyond the provided brand profile.",
      "",
      "Brand guidelines:",
      input.brandProfile.brandGuidelines || "No additional brand guidelines provided.",
      "",
      "Services and products:",
      input.brandProfile.services || "Not provided.",
      "",
      "Pricing information:",
      input.brandProfile.pricing || "Not provided.",
      "",
      "Sales email:",
      input.brandProfile.salesEmail || "Not provided.",
      "",
      "Contact persons:",
      input.brandProfile.contactPersons || "Not provided.",
    ].join("\n"),
    userPrompt: [
      "Create a campaign brief for AI email automation.",
      "The brief should help write personalized cold outbound emails for the selected leads.",
      "Include the core offer, the target pain points, the value proposition, and the tone the AI should use.",
      "Put the full campaign brief inside the body field.",
      "Use the subject field as a short internal title for the brief.",
      "",
      input.description ? `User's campaign idea/description to incorporate:\n${input.description.trim()}\n` : "",
      `Lead source: ${input.source}`,
      `Selected lead count: ${input.leads.length}`,
      "",
      "Sample leads:",
      leadPreview || "No leads provided.",
    ].filter(Boolean).join("\n"),
  } satisfies PromptInput;

  const draft = await generateAiEmail(endpointPrompt);
  return draft?.body?.trim() || null;
}

export async function generateAiComposeEnhancement(input: {
  brandProfile?: UserAiBrandProfile | null;
  toEmail: string;
  subject: string;
  body: string;
}) {
  const systemPrompt = input.brandProfile
    ? buildBrandAwareSystemPrompt(input.brandProfile)
    : [
        "You are an expert business email writing assistant.",
        "Return strict JSON only with keys subject and body.",
        "Write plain text only.",
        "Improve clarity, structure, professionalism, and tone.",
        "Do not invent facts, promises, pricing, or contact details.",
      ].join("\n");

  return generateAiEmail({
    systemPrompt,
    userPrompt: [
      "Rewrite this draft email into a professional business email.",
      "Return strict JSON with keys: subject, body.",
      "Keep the message concise, polished, and ready to send.",
      "Preserve the original intent.",
      "Do not add fake details.",
      "",
      `Recipient: ${input.toEmail || "Unknown"}`,
      `Current subject: ${input.subject || "(empty)"}`,
      "",
      "Draft body:",
      input.body.trim() || "(empty)",
    ].join("\n"),
  });
}
