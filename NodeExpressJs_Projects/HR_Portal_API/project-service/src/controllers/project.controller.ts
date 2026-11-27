import type { Request, Response } from 'express';
import { created, noContent, ok } from '@hr/common';
import type { CustomerService } from '../services/customer.service';
import type { ProjectService } from '../services/project.service';

export class ProjectController {
  constructor(private readonly cust: CustomerService, private readonly proj: ProjectService) {}
  listCustomers = async (req: Request, res: Response) => ok(res, await this.cust.list(req.valid.query));
  getCustomer = async (req: Request, res: Response) => ok(res, await this.cust.get(req.params.id));
  createCustomer = async (req: Request, res: Response) => created(res, await this.cust.create(req.valid.body));
  updateCustomer = async (req: Request, res: Response) => ok(res, await this.cust.update(req.params.id, req.valid.body));
  deleteCustomer = async (req: Request, res: Response) => { await this.cust.remove(req.params.id); noContent(res); };
  listContacts = async (req: Request, res: Response) => ok(res, await this.cust.listContacts(req.params.id));
  addContact = async (req: Request, res: Response) => created(res, await this.cust.addContact(req.params.id, req.valid.body));
  updateContact = async (req: Request, res: Response) => ok(res, await this.cust.updateContact(req.params.id, req.params.contactId, req.valid.body));
  deleteContact = async (req: Request, res: Response) => { await this.cust.removeContact(req.params.id, req.params.contactId); noContent(res); };

  create = async (req: Request, res: Response) => created(res, await this.proj.create(req.valid.body, req.user!));
  list = async (req: Request, res: Response) => ok(res, await this.proj.list(req.user!, req.valid.query));
  get = async (req: Request, res: Response) => ok(res, await this.proj.get(req.params.id, req.user!));
  update = async (req: Request, res: Response) => ok(res, await this.proj.update(req.params.id, req.valid.body, req.user!));
  status = async (req: Request, res: Response) => ok(res, await this.proj.changeStatus(req.params.id, req.valid.body.status, req.valid.body.reason, req.user!));
  remove = async (req: Request, res: Response) => { await this.proj.remove(req.params.id, req.user!); noContent(res); };
  history = async (req: Request, res: Response) => ok(res, await this.proj.historyOf(req.params.id));
  allocate = async (req: Request, res: Response) => created(res, await this.proj.allocate(req.params.id, req.valid.body, req.user!));
  updateAlloc = async (req: Request, res: Response) => ok(res, await this.proj.updateAllocation(req.params.id, req.params.allocId, req.valid.body, req.user!));
  endAlloc = async (req: Request, res: Response) => ok(res, await this.proj.endAllocation(req.params.id, req.params.allocId, req.valid.body?.endDate, req.user!));
  check = async (req: Request, res: Response) => ok(res, await this.proj.allocationCheck(req.params.id, req.valid.query.employeeId, req.valid.query.date));
  employeeProjects = async (req: Request, res: Response) => ok(res, await this.proj.employeeProjects(req.params.employeeId, req.user!));
  summary = async (req: Request, res: Response) => ok(res, await this.proj.allocationSummary(req.params.employeeId, req.valid.query?.date, req.user!));
}
