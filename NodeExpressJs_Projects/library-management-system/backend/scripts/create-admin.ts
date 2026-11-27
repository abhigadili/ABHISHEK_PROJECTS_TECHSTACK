/* Bootstrap the first administrator (production-safe).
 *   ADMIN_EMAIL=you@example.org ADMIN_NAME="Your Name" npm run admin:create
 * The password is read from ADMIN_PASSWORD, or typed at a hidden prompt, or - if neither - generated
 * and printed once. Nothing is stored in the repo and there is no default password.
 */
import crypto from 'node:crypto';
import readline from 'node:readline';
import { env } from '../src/config/env';
import { closePool, exec, queryOne } from '../src/lib/db';
import { hashPassword, passwordSchema } from '../src/lib/password';

async function ask(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    (rl as any)._writeToOutput = (s: string) => { if (s.includes(prompt)) process.stdout.write(s); };
    rl.question(prompt, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address');
  const name = (process.env.ADMIN_NAME ?? 'Library Administrator').trim();
  let password = process.env.ADMIN_PASSWORD ?? (await ask('New admin password (blank to generate): '));
  let generated = false;
  if (!password) { password = `${crypto.randomBytes(9).toString('base64url')}aA1`; generated = true; }
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(`Weak password: ${check.error.issues.map((i) => i.message).join(', ')}`);
  if (await queryOne('SELECT 1 FROM users WHERE email = ?', [email])) throw new Error('A user with that email already exists');
  await exec("INSERT INTO users (email, password_hash, full_name, role_id, status) VALUES (?,?,?,1,'active')", [email, await hashPassword(password), name]);
  console.log(`Administrator created: ${email} (database ${env.DB_NAME})`);
  if (generated) console.log(`Generated password (shown once, change it after first login): ${password}`);
}
main().then(() => closePool()).catch((e) => { console.error(e.message); closePool().finally(() => process.exit(1)); });
