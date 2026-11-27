import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, zip } from 'rxjs';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { toISODate } from '../../shared/utilities/helpers';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { Doctor } from '../../core/models';

/** Side-by-side comparison of up to three doctors from the NgRx compare tray (Material dialog). */
@Component({
  selector: 'app-doctor-compare-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>Compare doctors</h2><mat-dialog-content>
    <table class="w-full text-sm"><thead><tr><th></th>@for (d of doctors; track d.id) { <th class="p-2 text-left">{{ d.fullName }}</th> }</tr></thead><tbody>
      @for (r of rows; track r.label) { <tr class="border-t"><td class="p-2 text-slate-500">{{ r.label }}</td>@for (d of doctors; track d.id) { <td class="p-2">{{ r.get(d) }}</td> }</tr> }
      <tr class="border-t"><td class="p-2 text-slate-500">Free slots today</td>@for (d of doctors; track d.id; let i = $index) { <td class="p-2">{{ freeToday()?.[i] ?? '…' }}</td> }</tr>
    </tbody></table></mat-dialog-content><mat-dialog-actions align="end"><button mat-button mat-dialog-close>Close</button></mat-dialog-actions>`,
})
export class DoctorCompareDialogComponent {
  protected readonly doctors = inject<Doctor[]>(MAT_DIALOG_DATA);
  /** zip(): one request per doctor, emitted together IN ORDER as [n1, n2, …] (index i matches doctors[i]). */
  protected readonly freeToday = toSignal(zip(...this.doctors.map((d) => inject(DoctorApiService).slots(d.id, toISODate(new Date())).pipe(map((s) => s.length), catchError(() => of(0))))));
  private readonly money = new CurrencyPipe('en-IN');
  protected readonly rows: { label: string; get: (d: Doctor) => string }[] = [
    { label: 'Specialization', get: (d) => d.specialization }, { label: 'Qualification', get: (d) => d.qualification ?? '—' },
    { label: 'Experience', get: (d) => (d.experienceYears !== null ? `${d.experienceYears} years` : '—') }, { label: 'Consultation fee', get: (d) => this.money.transform(d.consultationFee, 'INR') ?? '—' },
    { label: 'Licence', get: (d) => d.licenseNumber }, { label: 'Status', get: (d) => (d.active ? 'Active' : 'Inactive') },
  ];
}
