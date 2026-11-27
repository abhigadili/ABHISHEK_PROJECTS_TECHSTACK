import { ServiceClient, cache, key } from '@hr/common';

export interface OrgRef { id: string; name?: string; title?: string; code?: string }

/** Employee Service -> Organization Service (synchronous REST). Reference data is cached in Redis. */
export class OrganizationClient {
  private readonly http = new ServiceClient('organization');
  private async ref(kind: 'departments' | 'designations' | 'locations', id: string): Promise<OrgRef | null> {
    return cache.getOrLoad<OrgRef | null>(key('org', kind, id), 600, async () => {
      try { return await this.http.get<OrgRef>(`/api/v1/organization/${kind}/${id}`); } catch (e: any) { if (e.status === 404) return null; throw e; }
    });
  }
  department = (id: string) => this.ref('departments', id);
  designation = (id: string) => this.ref('designations', id);
  location = (id: string) => this.ref('locations', id);
}
