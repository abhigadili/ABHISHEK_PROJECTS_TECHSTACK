import { Observable, catchError, map, of, startWith } from 'rxjs';
import { ApiError, type LoadState } from '../../core/models/api-error';

/**
 * Turns any Observable into a stream of LoadState (loading → loaded | error): the RxJS pattern behind every data view.
 * startWith emits `loading` immediately, map wraps the value, catchError converts failures into a state instead of killing the stream.
 */
export function toLoadState<T>(source$: Observable<T>): Observable<LoadState<T>> {
  return source$.pipe(
    map((data): LoadState<T> => ({ status: 'loaded', data })),
    startWith<LoadState<T>>({ status: 'loading' }),
    catchError((e: unknown) => of<LoadState<T>>({ status: 'error', error: ApiError.from(e) })),
  );
}
