import nodemailer from 'nodemailer';
import { env } from '../config/env';
/** E-mail through configurable SMTP; with no SMTP_HOST the message is printed to the server console (local mode). */
const transport = env.SMTP_HOST ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined }) : null;
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transport) { console.info(`[mail:console] to=${to} subject="${subject}"\n${text}\n`); return false; }
  await transport.sendMail({ from: env.SMTP_FROM, to, subject, text }); return true;
}
