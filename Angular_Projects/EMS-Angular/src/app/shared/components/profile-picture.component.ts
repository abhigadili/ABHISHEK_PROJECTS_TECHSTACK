import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { PictureService } from '../../core/services/picture.service';

/**
 * Avatar: shows the protected profile picture (fetched as a Blob) or falls back to initials.
 * Input signals feed a switchMap so a fast-changing `employeeId` cancels the previous request.
 */
@Component({
  selector: 'app-profile-picture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as s) {
      <img [src]="s" [alt]="name() + ' profile picture'" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span class="initials" [style.width.px]="size()" [style.height.px]="size()" [style.fontSize.px]="size() * 0.4" aria-hidden="true">{{ initials() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    img, .initials { border-radius: 50%; object-fit: cover; flex: none; }
    .initials { display: inline-flex; align-items: center; justify-content: center; background: var(--ems-primary-container); color: var(--ems-primary); font-weight: 500; }
  `,
})
export class ProfilePictureComponent {
  private readonly pictures = inject(PictureService);

  readonly employeeId = input<number | null>(null);
  readonly hasPicture = input(false);
  readonly name = input('');
  readonly size = input(40);

  /** Bridge: signal inputs → observable pipeline (switchMap cancels stale loads) → back to a signal. */
  protected readonly src = toSignal(
    combineLatest([toObservable(this.employeeId), toObservable(this.hasPicture), toObservable(this.pictures.version)]).pipe(
      switchMap(([id, has]) => (id && has ? this.pictures.forEmployee(id).pipe(catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null },
  );

  protected readonly initials = computed(() =>
    this.name().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?',
  );
}
