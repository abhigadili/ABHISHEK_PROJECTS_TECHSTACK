export interface CoverageRow {
  /** operation id `<service>.<fn>` */ id: string; method: string; path: string;
  /** Java controller class that handles the endpoint */ controller: string;
  /** backend module (microservice) */ service: string; tag: string; summary: string;
  /** frontend feature module */ module: string;
  /** frontend pages / components that use it */ files: string[];
  /** Angular service class + method, e.g. LeaveApi.apply */ serviceMethod: string;
  /** how the UI integrates it: query (GET) or mutation (write) */ integration: 'query' | 'mutation';
  /** needs a Bearer JWT */ authenticated: boolean;
  /** raw @PreAuthorize expression (null = any authenticated user) */ authorize: string | null;
  status: 'integrated' | 'not-integrated' | 'infrastructure'; reason?: string; public: boolean; fn: string;
}
/** feature folder -> route used to deep-link the "related UI module" */
export const MODULE_ROUTE: Record<string, string> = { authentication: '/login', dashboard: '/', employees: '/employees', organization: '/organization', leaves: '/leave', holidays: '/holidays', attendance: '/attendance', payroll: '/payroll', tax: '/tax', performance: '/performance', customers: '/customers', projects: '/projects', timesheets: '/timesheets', 'exit-interviews': '/exit', documents: '/documents', approvals: '/approvals', reports: '/reports', notifications: '/notifications', administration: '/admin/users', profile: '/profile', layout: '/', core: '/' };
