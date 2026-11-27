import { Observable, interval, map, startWith, takeWhile } from 'rxjs';

/** "Starts in 2 h 15 min": interval(30 s) ticks, takeWhile ends the stream (inclusive) once the target time has passed. */
export function countdown$(target: Date): Observable<string> {
  return interval(30_000).pipe(
    startWith(0),
    map(() => target.getTime() - Date.now()),
    takeWhile((ms) => ms > 0, true),
    map((ms) => {
      if (ms <= 0) return 'started';
      const min = Math.floor(ms / 60_000);
      const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
      return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    }),
  );
}
