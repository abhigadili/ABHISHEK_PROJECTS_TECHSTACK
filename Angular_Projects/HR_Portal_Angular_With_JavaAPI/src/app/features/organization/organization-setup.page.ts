import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';

const crud = (list: string, create: string, update: string, del: string, get: string) => ({ list: { op: list, query: { size: 100 } }, create: { op: create }, update: { op: update, path: (r: any) => ({ id: r.id }) }, remove: { op: del, path: (r: any) => ({ id: r.id }) }, view: { op: get, path: (r: any) => ({ id: r.id }) } });

@Component({
  selector: 'app-organization-setup-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, CrudSectionComponent, OpButtonComponent, OpViewComponent],
  template: `<app-page-header [title]="'hr.org.setup' | translate" subtitle="Organizations, business units, departments, designations, job grades and locations" />
  <app-tabs>
    <ng-template appTab="dept" [label]="'common.department' | translate"><app-crud-section [title]="'common.department' | translate" tableId="org-dept" [list]="c.dept.list" [create]="c.dept.create" [update]="c.dept.update" [remove]="c.dept.remove" [view]="c.dept.view" [extraRowActions]="head" /></ng-template>
    <ng-template appTab="desig" [label]="'common.designation' | translate"><app-crud-section [title]="'common.designation' | translate" tableId="org-desig" [list]="c.desig.list" [create]="c.desig.create" [update]="c.desig.update" [remove]="c.desig.remove" [view]="c.desig.view" /></ng-template>
    <ng-template appTab="grade" label="Job grades"><app-crud-section title="Job grades" tableId="org-grade" [list]="c.grade.list" [create]="c.grade.create" [update]="c.grade.update" [remove]="c.grade.remove" [view]="c.grade.view" /></ng-template>
    <ng-template appTab="loc" [label]="'common.location' | translate"><app-crud-section [title]="'common.location' | translate" tableId="org-loc" [list]="c.loc.list" [create]="c.loc.create" [update]="c.loc.update" [remove]="c.loc.remove" [view]="c.loc.view" /></ng-template>
    <ng-template appTab="bu" label="Business units"><app-crud-section title="Business units" tableId="org-bu" [list]="c.bu.list" [create]="c.bu.create" [update]="c.bu.update" [remove]="c.bu.remove" [view]="c.bu.view" /></ng-template>
    <ng-template appTab="org" label="Organizations"><app-crud-section title="Organizations" tableId="org-org" [list]="c.org.list" [create]="c.org.create" [update]="c.org.update" [remove]="c.org.remove" [view]="c.org.view" /></ng-template>
    <ng-template appTab="hc" label="Headcount"><app-op-view op="organization.headcount" /></ng-template>
  </app-tabs>
  <ng-template #head let-r><app-op-button op="organization.assignHead" [path]="{ id: r.id }" label="Head" icon="pi-user-edit" variant="ghost" /></ng-template>`,
})
export class OrganizationSetupPage {
  c = {
    dept: crud('organization.listDepartments', 'organization.createDepartments', 'organization.updateDepartments', 'organization.deleteDepartments', 'organization.getDepartments'),
    desig: crud('organization.listDesignations', 'organization.createDesignations', 'organization.updateDesignations', 'organization.deleteDesignations', 'organization.getDesignations'),
    grade: crud('organization.listJobGrades', 'organization.createJobGrades', 'organization.updateJobGrades', 'organization.deleteJobGrades', 'organization.getJobGrades'),
    loc: crud('organization.listLocations', 'organization.createLocations', 'organization.updateLocations', 'organization.deleteLocations', 'organization.getLocations'),
    bu: crud('organization.listBusinessUnits', 'organization.createBusinessUnits', 'organization.updateBusinessUnits', 'organization.deleteBusinessUnits', 'organization.getBusinessUnits'),
    org: crud('organization.list', 'organization.create', 'organization.update', 'organization.delete', 'organization.get'),
  };
}
export default OrganizationSetupPage;
