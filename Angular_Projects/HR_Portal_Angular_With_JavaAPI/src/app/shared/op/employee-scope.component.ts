import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmployeePickerComponent } from '../components/employee.components';
import { EmptyStateComponent } from '../components/ui.components';

/** Pick an employee, then render per-employee tools for them (`<ng-template let-id>` receives the employee id). */
@Component({
  selector: 'app-employee-scope', standalone: true, imports: [EmployeePickerComponent, FormsModule, EmptyStateComponent, NgTemplateOutlet], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mb-3" style="max-width:420px"><app-employee-picker [label]="label()" [ngModel]="id()" (ngModelChange)="id.set($event)" /></div>
    @if (id()) { <ng-container [ngTemplateOutlet]="tpl()!" [ngTemplateOutletContext]="{ $implicit: id() }" /> } @else { <app-empty-state title="Select an employee" hint="Search by name or code to load their records." /> }`,
})
export class EmployeeScopeComponent { label = input('Employee'); initial = input<string>(); id = signal<string | null>(null); tpl = contentChild(TemplateRef); constructor() { queueMicrotask(() => { if (this.initial()) this.id.set(this.initial()!); }); } }
