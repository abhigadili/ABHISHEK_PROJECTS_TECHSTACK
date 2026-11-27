import type { Request, Response } from 'express';
import { created, ok } from '@hr/common';
import type { ComputationService } from '../services/computation.service';
import type { DeclarationService } from '../services/declaration.service';

export class TaxController {
  constructor(private readonly decl: DeclarationService, private readonly comp: ComputationService) {}
  create = async (req: Request, res: Response) => created(res, await this.decl.create(req.user!, req.valid.body));
  list = async (req: Request, res: Response) => ok(res, await this.decl.list(req.user!, req.valid.query));
  mine = async (req: Request, res: Response) => ok(res, await this.decl.mine(req.user!, req.params.fy));
  get = async (req: Request, res: Response) => ok(res, await this.decl.get(req.params.id, req.user!));
  regime = async (req: Request, res: Response) => ok(res, await this.decl.setRegime(req.params.id, req.valid.body.regime, req.user!));
  addInvestment = async (req: Request, res: Response) => created(res, await this.decl.addInvestment(req.params.id, req.valid.body, req.user!));
  removeInvestment = async (req: Request, res: Response) => ok(res, await this.decl.removeInvestment(req.params.id, req.params.invId, req.user!));
  submit = async (req: Request, res: Response) => ok(res, await this.decl.submit(req.params.id, req.user!));
  proof = async (req: Request, res: Response) => created(res, await this.decl.submitProof(req.params.id, req.valid.body, req.user!));
  verifyProof = async (req: Request, res: Response) => ok(res, await this.decl.verifyProof(req.params.proofId, req.valid.body, req.user!));
  rejectProof = async (req: Request, res: Response) => ok(res, await this.decl.rejectProof(req.params.proofId, req.valid.body.comment, req.user!));
  approve = async (req: Request, res: Response) => ok(res, await this.decl.approve(req.params.id, req.valid.body?.comment, req.user!));
  reject = async (req: Request, res: Response) => ok(res, await this.decl.reject(req.params.id, req.valid.body.comment, req.user!));
  reminders = async (req: Request, res: Response) => ok(res, { reminded: await this.decl.sendReminders(req.params.fy) });

  rules = async (req: Request, res: Response) => ok(res, await this.comp.listRules(req.query.financialYear as string));
  upsertRule = async (req: Request, res: Response) => ok(res, await this.comp.upsertRule(req.valid.body));
  computeMine = async (req: Request, res: Response) => ok(res, await this.comp.compute(req.user!, req.user!.employeeId ?? '', req.valid.query.financialYear, req.valid.query.grossIncome, req.valid.query.regime, false));
  compute = async (req: Request, res: Response) => ok(res, await this.comp.compute(req.user!, req.params.employeeId, req.valid.query.financialYear, req.valid.query.grossIncome, req.valid.query.regime));
  tds = async (req: Request, res: Response) => ok(res, await this.comp.monthlyTds(req.user!, req.params.employeeId, req.params.month));
  summary = async (req: Request, res: Response) => ok(res, await this.comp.annualSummary(req.user!, req.params.employeeId, req.params.fy));
  statement = async (req: Request, res: Response) => {
    const pdf = await this.comp.statementPdf(req.user!, req.params.employeeId, req.params.fy);
    res.setHeader('content-type', 'application/pdf'); res.setHeader('content-disposition', `attachment; filename="tax-statement-${req.params.fy}.pdf"`); res.send(pdf);
  };
  registerDocument = async (req: Request, res: Response) => created(res, await this.comp.registerDocument(req.valid.body));
  documents = async (req: Request, res: Response) => ok(res, await this.comp.listDocuments(req.user!, req.params.employeeId, req.query.financialYear as string));
}
