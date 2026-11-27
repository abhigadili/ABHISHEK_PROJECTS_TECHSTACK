import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Safe file picker: validates type and size on the client (the backend re-validates MIME *and* content signature),
 * then emits the File. Uses viewChild() to reset the native input after each selection.
 */
@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input #picker type="file" hidden [accept]="accept().join(',')" (change)="onPick($event)" data-testid="file-input" />
    <button mat-stroked-button type="button" [disabled]="disabled()" (click)="picker.click()">
      <mat-icon>{{ icon() }}</mat-icon> {{ label() }}
    </button>
    @if (problem(); as p) {
      <p class="problem" role="alert">{{ p }}</p>
    }
  `,
  styles: `.problem { color: #c5221f; font-size: 12px; margin: 4px 0 0; }`,
})
export class FileUploadComponent {
  readonly label = input('Choose file');
  readonly icon = input('upload');
  readonly accept = input<readonly string[]>(['image/jpeg', 'image/png', 'image/webp']);
  readonly maxBytes = input(2 * 1024 * 1024);
  readonly disabled = input(false);
  readonly fileSelected = output<File>();

  protected readonly problem = signal<string | null>(null);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.accept().includes(file.type)) {
      this.problem.set(`Unsupported file type. Allowed: ${this.accept().map((t) => t.split('/')[1]).join(', ')}`);
    } else if (file.size > this.maxBytes()) {
      this.problem.set(`File is too large (max ${Math.round(this.maxBytes() / 1024 / 1024 * 10) / 10} MB)`);
    } else {
      this.problem.set(null);
      this.fileSelected.emit(file);
    }
    this.picker().nativeElement.value = ''; // allow re-selecting the same file
  }
}
