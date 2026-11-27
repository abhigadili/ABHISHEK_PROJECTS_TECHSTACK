import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { BROWSER_STORAGE } from '../tokens/tokens';

export interface UserPreferences {
  displayName: string;
  landingPage: 'dashboard' | 'employees' | 'attendance' | 'leaves';
  pageSize: number;
  density: 'comfortable' | 'compact';
  emailDigest: boolean;
  notifyLeaveDecisions: boolean;
  notifyBirthdays: boolean;
  sidebarCollapsed: boolean;
}

const KEY = 'ems.preferences';
export const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: '',
  landingPage: 'dashboard',
  pageSize: 10,
  density: 'comfortable',
  emailDigest: false,
  notifyLeaveDecisions: true,
  notifyBirthdays: true,
  sidebarCollapsed: false,
};

/**
 * Per-browser UI preferences (the backend has no preferences API, and these are presentation settings, not business data).
 * A signal is the single source of truth; an effect persists it (a true side effect — not derived state).
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly _prefs = signal<UserPreferences>(this.read());
  readonly prefs = this._prefs.asReadonly();

  constructor() {
    effect(() => {
      const value = this._prefs();
      untracked(() => this.write(value));
    });
  }

  update(patch: Partial<UserPreferences>): void {
    this._prefs.update((p) => ({ ...p, ...patch }));
  }

  private read(): UserPreferences {
    try {
      const raw = this.storage.getItem(KEY);
      return raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) } : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private write(value: UserPreferences): void {
    try {
      this.storage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}
