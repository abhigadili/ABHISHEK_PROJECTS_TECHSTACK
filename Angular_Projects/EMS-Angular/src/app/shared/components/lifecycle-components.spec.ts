import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LiveClockComponent } from './live-clock.component';
import { PasswordStrengthComponent } from './password-strength.component';

@Component({ standalone: true, imports: [PasswordStrengthComponent], template: `<app-password-strength [password]="pw" />` })
class StrengthHostComponent { pw = ''; }

describe('PasswordStrengthComponent (ngOnChanges + legacy directives)', () => {
  let fixture: ComponentFixture<StrengthHostComponent>;
  const text = () => fixture.nativeElement.textContent as string;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StrengthHostComponent] });
    fixture = TestBed.createComponent(StrengthHostComponent);
    fixture.detectChanges();
  });
  const type = (pw: string) => { fixture.componentInstance.pw = pw; fixture.detectChanges(); };

  it('renders nothing for an empty password', () => expect(text().trim()).toBe(''));

  it('recomputes rules, level and meter width every time the input changes (ngOnChanges)', () => {
    type('abc');
    expect(text()).toContain('Weak password');
    expect(fixture.debugElement.query(By.css('.bar')).nativeElement.style.width).toBe('20%');
    type('Abcdefgh1');
    expect(text()).toContain('Fair');
    type('Abcdefgh1!x');
    expect(text()).toContain('Strong password');
    expect(fixture.debugElement.query(By.css('.bar')).nativeElement.classList).toContain('strong');
    expect(fixture.debugElement.queryAll(By.css('li.ok')).length).toBe(5);
  });

  it('*ngFor with trackBy keeps the same <li> nodes across updates', () => {
    type('a');
    const before = fixture.debugElement.queryAll(By.css('li')).map((e) => e.nativeElement);
    type('aB');
    const after = fixture.debugElement.queryAll(By.css('li')).map((e) => e.nativeElement);
    expect(after).toEqual(before);
  });
});

describe('LiveClockComponent (ngOnInit / takeUntil / ngOnDestroy / markForCheck)', () => {
  it('ticks every second after init and stops completely when destroyed', fakeAsync(() => {
    const fixture = TestBed.createComponent(LiveClockComponent);
    fixture.detectChanges(); // ngOnInit
    tick(0);
    const first = fixture.nativeElement.querySelector('time').getAttribute('datetime');
    tick(2000);
    fixture.detectChanges();
    const later = fixture.nativeElement.querySelector('time').getAttribute('datetime');
    expect(new Date(later).getTime()).toBeGreaterThan(new Date(first).getTime());
    fixture.destroy(); // ngOnDestroy → destroy$ → takeUntil unsubscribes the timer
    tick(5000); // would throw "1 periodic timer(s) still in the queue" if the subscription leaked
    discardPeriodicTasks();
  }));
});
