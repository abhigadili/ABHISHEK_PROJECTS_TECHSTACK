import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

/** File upload control: viewChild() reaches the hidden input; drag & drop; type/size validation mirrors the backend rule (PDF/PNG/JPEG ≤ 5 MB). */
@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors dark:border-slate-600" [class.border-brand-500]="over()" [class.border-slate-300]="!over()"
      role="button" tabindex="0" aria-label="Choose a file" (click)="input().nativeElement.click()" (keydown.enter)="input().nativeElement.click()"
      (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="$event.preventDefault(); over.set(false); take($event.dataTransfer?.files?.[0] ?? null)">
      @if (file(); as f) { <b>{{ f.name }}</b> <span class="text-slate-500">({{ (f.size / 1024).toFixed(1) }} KB)</span> }
      @else { <span class="text-slate-500">Drop a PDF, PNG or JPEG here or <span class="font-medium text-brand-600">browse</span> (max 5 MB)</span> }
      <input #fileInput type="file" hidden [accept]="accept" (change)="take($any($event.target).files?.[0] ?? null)" data-testid="file-input" />
    </div>
    @if (error()) { <p role="alert" class="mt-1 text-xs text-red-600">{{ error() }}</p> }`,
})
export class FileDropzoneComponent {
  readonly maxBytes = input(5 * 1024 * 1024);
  readonly fileSelected = output<File | null>();
  protected readonly input = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly accept = 'application/pdf,image/png,image/jpeg';
  protected readonly file = signal<File | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly over = signal(false);

  protected take(f: File | null) {
    this.error.set(null);
    if (f && !this.accept.split(',').includes(f.type)) return this.error.set('Only PDF, PNG or JPEG files are accepted.');
    if (f && f.size > this.maxBytes()) return this.error.set('File is too large (max 5 MB).');
    this.file.set(f);
    this.fileSelected.emit(f);
  }
  /** Public API for parents (called through viewChild). */
  clear() { this.input().nativeElement.value = ''; this.take(null); }
}
