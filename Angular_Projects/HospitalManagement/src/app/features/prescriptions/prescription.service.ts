import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { PharmacyApiService } from '../../core/api/pharmacy-api.service';
import { FileService } from '../../core/services/file.service';
import type { Medicine, Prescription } from '../../core/models';

/**
 * Feature service for prescriptions.
 *  - `medicines$` is cached with shareReplay(1): the pharmacy catalogue is requested ONCE and reused by the autocomplete AND by the async
 *    medicine validators (API caching);  `names$` is derived from it.
 *  - export methods load the HTML builder with a dynamic import() (code splitting).
 */
@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private readonly pharmacy = inject(PharmacyApiService);
  private readonly files = inject(FileService);
  readonly medicines$: Observable<readonly Medicine[]> = this.pharmacy.medicines().pipe(map((m) => m.filter((x) => x.active)), shareReplay({ bufferSize: 1, refCount: false }));
  readonly names$: Observable<readonly string[]> = this.medicines$.pipe(map((m) => m.map((x) => `${x.name} ${x.genericName ?? ''}`)));

  async download(p: Prescription): Promise<void> {
    const { prescriptionToHtml } = await import('./prescription-export');
    this.files.saveText(prescriptionToHtml(p), `prescription-${p.id}.html`, 'text/html');
  }
  async print(p: Prescription): Promise<void> {
    const { prescriptionToHtml } = await import('./prescription-export');
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(prescriptionToHtml(p)); w.document.close(); w.focus(); w.print();
  }
}
