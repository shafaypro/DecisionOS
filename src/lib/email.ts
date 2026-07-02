/**
 * Email sending utility for DecisionOS.
 *
 * Configure via environment variables:
 *   SMTP_HOST     - SMTP server hostname (e.g. smtp.gmail.com)
 *   SMTP_PORT     - port (default 587)
 *   SMTP_USER     - login username
 *   SMTP_PASS     - login password or app password
 *   SMTP_FROM     - from address (e.g. decisions@yourcompany.com)
 *
 * If SMTP_HOST is not set, emails are logged to console in development
 * and silently skipped in production.
 */

import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: parseInt(process.env.SMTP_PORT ?? "587", 10) === 465,
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  });
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: SendMailOptions): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    // No SMTP configured - log in development, skip in production
    if (process.env.NODE_ENV !== "production") {
      logger.info("email skipped (no SMTP configured)", {
        to: opts.to,
        subject: opts.subject,
        text: opts.text ?? "(html only)",
      });
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "decisions@decisionos.com",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return true;
  } catch (err) {
    logger.error("email send failed", { to: opts.to, subject: opts.subject, err });
    return false;
  }
}

/** Base URL for generating magic links and decision URLs. */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}
