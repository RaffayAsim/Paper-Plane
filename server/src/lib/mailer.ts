import nodemailer from "nodemailer";
import { config } from "./config.js";
import { getSmtpConfigs, type SmtpConfig } from "./email-settings.js";

export function createTransportForConfig(selected: SmtpConfig) {
  return nodemailer.createTransport({
    host: selected.host,
    port: selected.port,
    secure: selected.secure,
    auth: {
      user: selected.user,
      pass: selected.pass,
    },
  });
}

export async function getMailer() {
  const storedConfigs = await getSmtpConfigs();
  const sharedConfigs = storedConfigs.filter((item) => !item.ownerUserId);
  const selected = sharedConfigs.find((item) => item.isDefault && item.isActive)
    ?? sharedConfigs.find((item) => item.isActive);

  if (selected) {
    return createTransportForConfig(selected);
  }

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error("SMTP is not configured");
  }

  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
}

export async function getDefaultFromEmail() {
  const storedConfigs = await getSmtpConfigs();
  const sharedConfigs = storedConfigs.filter((item) => !item.ownerUserId);
  const selected = sharedConfigs.find((item) => item.isDefault && item.isActive)
    ?? sharedConfigs.find((item) => item.isActive);

  return selected?.fromEmail || config.SMTP_FROM || config.SMTP_USER || "noreply@example.com";
}
