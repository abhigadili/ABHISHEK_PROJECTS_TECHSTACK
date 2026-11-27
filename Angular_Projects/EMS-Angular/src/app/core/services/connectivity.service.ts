import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, map, merge } from 'rxjs';

/**
 * Browser connectivity as a stream. A BehaviorSubject always holds the *current* value (so a component that subscribes
 * late still gets "online"/"offline" immediately), fed by the window online/offline events merged into one stream.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly state$ = new BehaviorSubject<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly online$: Observable<boolean> = this.state$.asObservable();

  constructor() {
    merge(fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false))).subscribe((v) => this.state$.next(v));
  }

  get isOnline(): boolean {
    return this.state$.value;
  }
}
