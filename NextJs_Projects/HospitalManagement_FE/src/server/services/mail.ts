import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/configuration/env";

/** SMTP when SMTP_HOST is configured; otherwise the e-mail is written to the server console (local demonstration mode). */
const transport = env.smtp.host
    ? nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.port === 465,
          auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      })
    : null;
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
    if (!transport) {
        console.info(`[mail:console] to=${to} subject="${subject}"\n${text}\n`);
        return false;
    }
    await transport.sendMail({ from: env.smtp.from, to, subject, text });
    return true;
}
