import { HttpEvent, HttpEventType, HttpProgressEvent, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, filter, map, scan, startWith } from 'rxjs';

export type UploadProgress = { readonly state: 'progress'; readonly percent: number } | { readonly state: 'done'; readonly body: unknown };

/** File service: blob downloads and upload progress mapping (HttpEvent / progress events / Blob responses). */
@Injectable({ providedIn: 'root' })
export class FileService {
  /** Saves a blob through a temporary object URL. */
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  saveText(text: string, fileName: string, mime = 'text/plain'): void {
    this.save(new Blob([text], { type: mime }), fileName);
  }
  /** Extracts a file name from Content-Disposition. */
  fileNameOf(res: HttpResponse<Blob>, fallback = 'download'): string {
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('content-disposition') ?? '');
    return m ? decodeURIComponent(m[1]!) : fallback;
  }
  /** HttpEvent stream → progress percentages followed by the final body (RxJS: filter, map, scan, startWith). */
  progress<T>(events$: Observable<HttpEvent<T>>): Observable<UploadProgress> {
    return events$.pipe(
      filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e): UploadProgress => { if (e.type === HttpEventType.Response) return { state: 'done', body: (e as HttpResponse<T>).body }; const p = e as HttpProgressEvent; return { state: 'progress', percent: p.total ? Math.round((100 * p.loaded) / p.total) : 0 }; }),
      scan((prev, cur) => (prev.state === 'done' ? prev : cur), { state: 'progress', percent: 0 } as UploadProgress),
      startWith({ state: 'progress', percent: 0 } as UploadProgress),
    );
  }
}
