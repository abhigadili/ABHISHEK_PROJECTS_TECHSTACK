import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface RecentSearch { fromId: number; fromName: string; toId: number; toName: string; at: number }
const KEY = 'ttb.recent-searches';
/** BehaviorSubject-backed list of the last few searches (non-sensitive UI preference, kept in localStorage - guarded for private mode). */
@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  private readonly subject = new BehaviorSubject<RecentSearch[]>(this.read());
  readonly recent$ = this.subject.asObservable();
  private read(): RecentSearch[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentSearch[]; } catch { return []; } }
  add(s: Omit<RecentSearch, 'at'>) {
    const next = [{ ...s, at: Date.now() }, ...this.subject.value.filter((x) => !(x.fromId === s.fromId && x.toId === s.toId))].slice(0, 5);
    this.subject.next(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }
  clear() { this.subject.next([]); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
}
