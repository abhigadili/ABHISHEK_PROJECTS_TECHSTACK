import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { OrgNode } from '../../core/models/organization.models';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';

/**
 * One node of the org tree. The component renders its own children through its own selector (recursion), so the
 * tree depth is whatever the backend returns — no hardcoded levels. State (expanded/selected) is owned by the parent
 * and flows down as inputs; user intent flows up as outputs.
 */
@Component({
  selector: 'app-org-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ProfilePictureComponent],
  template: `
    <li role="treeitem" [attr.aria-expanded]="node().subordinates.length ? isOpen() : null" [attr.aria-selected]="selectedId() === node().id">
      <div class="row" [class.selected]="selectedId() === node().id" [class.on-path]="highlightPath().has(node().id)" [attr.data-testid]="'org-node-' + node().id">
        @if (node().subordinates.length) {
          <button type="button" class="toggle" (click)="toggled.emit(node().id)" [attr.aria-label]="(isOpen() ? 'Collapse ' : 'Expand ') + node().name">
            <mat-icon>{{ isOpen() ? 'expand_more' : 'chevron_right' }}</mat-icon>
          </button>
        } @else {
          <span class="toggle spacer"></span>
        }
        <button type="button" class="person" (click)="picked.emit(node().id)">
          <app-profile-picture [employeeId]="node().id" [hasPicture]="!!node().profilePictureUrl" [name]="node().name" [size]="32" />
          <span class="text">
            <strong>{{ node().name }}</strong>
            <small>{{ node().jobTitle || node().designation || '—' }}@if (node().department) { · {{ node().department!.name }} }</small>
          </span>
          @if (node().directReportCount) {
            <span class="count" [attr.title]="node().directReportCount + ' direct reports'">{{ node().directReportCount }}</span>
          }
        </button>
      </div>
      @if (node().subordinates.length && isOpen()) {
        <ul role="group">
          @for (child of node().subordinates; track child.id) {
            <app-org-node [node]="child" [expandedIds]="expandedIds()" [selectedId]="selectedId()" [highlightPath]="highlightPath()" (toggled)="toggled.emit($event)" (picked)="picked.emit($event)" />
          }
        </ul>
      }
    </li>
  `,
  styles: `
    :host { display: contents; }
    li { list-style: none; }
    ul { margin: 0; padding-left: 22px; border-left: 1px dashed var(--ems-border); margin-left: 14px; }
    .row { display: flex; align-items: center; border-radius: 8px; }
    .row.selected { background: var(--ems-primary-container); box-shadow: inset 3px 0 0 var(--ems-primary); }
    .row.on-path:not(.selected) { background: #f1f5fd; }
    .toggle { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; cursor: pointer; padding: 0; color: var(--ems-muted); }
    .toggle.spacer { cursor: default; }
    .person { display: flex; align-items: center; gap: 10px; flex: 1; text-align: left; background: none; border: 0; padding: 6px 8px; cursor: pointer; font: inherit; color: inherit; border-radius: 8px; }
    .person:hover { background: rgba(0, 0, 0, 0.04); }
    .text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    small { color: var(--ems-muted); }
    .count { background: var(--ems-primary); color: #fff; border-radius: 10px; font-size: 11px; padding: 0 7px; line-height: 18px; }
  `,
})
export class OrgNodeComponent {
  readonly node = input.required<OrgNode>();
  readonly expandedIds = input.required<ReadonlySet<number>>();
  readonly selectedId = input<number | null>(null);
  readonly highlightPath = input<ReadonlySet<number>>(new Set());
  readonly toggled = output<number>();
  readonly picked = output<number>();

  protected isOpen = () => this.expandedIds().has(this.node().id);
}
