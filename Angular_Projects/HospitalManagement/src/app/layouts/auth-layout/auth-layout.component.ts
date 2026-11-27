import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Public layout (login / registration): Tailwind CSS Grid – brand panel on large screens, single column on mobile. */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 to-[#0f2744] p-10 text-white lg:flex">
        <div class="text-lg font-bold">HospitalCare</div>
        <div class="max-w-md space-y-5">
          <h2 class="text-4xl font-bold leading-tight">One workspace for every part of patient care.</h2>
          <ul class="space-y-2 text-sky-100"><li>• Book and manage appointments in real time</li><li>• Lab requests, results and reports</li><li>• Role-based access to clinical and billing data</li></ul>
        </div>
        <p class="text-xs text-sky-200">Hospital Management · Angular frontend</p>
      </section>
      <section class="flex items-center justify-center p-6"><div class="w-full max-w-lg"><router-outlet /></div></section>
    </div>`,
})
export class AuthLayoutComponent {}
