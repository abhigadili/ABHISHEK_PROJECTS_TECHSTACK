import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SearchBoxComponent } from './search-box.component';

@Component({ standalone: true, imports: [SearchBoxComponent], template: `<app-search-box [(value)]="text" (searchChange)="emitted.push($event)" [debounce]="300" />` })
class HostComponent {
  text = signal('');
  emitted: string[] = [];
}

describe('SearchBoxComponent (debounceTime + distinctUntilChanged + model())', () => {
  let fixture: ComponentFixture<HostComponent>;
  const input = () => fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
  const type = (v: string) => { input().value = v; input().dispatchEvent(new Event('input')); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNoopAnimations()] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('emits once after the user pauses, not per keystroke', fakeAsync(() => {
    type('e'); tick(100); type('ev'); tick(100); type('eve');
    expect(fixture.componentInstance.emitted).toEqual([]);
    tick(300);
    expect(fixture.componentInstance.emitted).toEqual(['eve']);
    expect(fixture.componentInstance.text()).toBe('eve'); // two-way model() updated
  }));

  it('trims, and does not re-emit an unchanged value', fakeAsync(() => {
    type('  bob '); tick(300);
    type('bob'); tick(300);
    expect(fixture.componentInstance.emitted).toEqual(['bob']);
  }));

  it('parent → child: setting the bound value updates the input without emitting a search', fakeAsync(() => {
    fixture.componentInstance.text.set('from-url');
    fixture.detectChanges();
    TestBed.flushEffects();
    tick(400);
    expect(input().value).toBe('from-url');
    expect(fixture.componentInstance.emitted).toEqual([]);
  }));

  it('the clear button empties the field and emits an empty search', fakeAsync(() => {
    type('abc'); tick(300);
    fixture.detectChanges();
    (fixture.debugElement.query(By.css('button[aria-label="Clear search"]')).nativeElement as HTMLButtonElement).click();
    tick(300);
    expect(fixture.componentInstance.emitted).toEqual(['abc', '']);
  }));
});
