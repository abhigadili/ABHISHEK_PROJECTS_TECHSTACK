import { environment } from '@env/environment';
export const APP = {
  name: environment.appName,
  apiBaseUrl: environment.apiBaseUrl,
  requestTimeoutMs: 30_000,
  languages: [
    { code: 'en', label: 'English', locale: 'en-IN' },
    { code: 'te', label: 'తెలుగు', locale: 'te-IN' },
    { code: 'hi', label: 'हिन्दी', locale: 'hi-IN' },
  ],
  roles: { admin: ['HR_ADMIN', 'SUPER_ADMIN'] },
} as const;
export type LangCode = 'en' | 'te' | 'hi';
