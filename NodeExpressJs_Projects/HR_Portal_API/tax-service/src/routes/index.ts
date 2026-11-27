import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate, z, zId } from '@hr/common';
import { TaxController } from '../controllers/tax.controller';
import { computeQuery, createDeclarationDto, decisionDto, declarationListQuery, fyParam, investmentDto, proofDto, regimeDto, rejectDto, ruleDto, taxDocumentDto, tdsParams, verifyProofDto } from '../dto/tax.dto';
import { ComputationService } from '../services/computation.service';
import { DeclarationService } from '../services/declaration.service';

export function taxRoutes(r: Router, db: Db): void {
  const c = new TaxController(new DeclarationService(db), new ComputationService(db));
  const self = requirePermission('SELF_SERVICE'); const review = requirePermission('TAX_REVIEW'); const config = requirePermission('TAX_CONFIG');
  const emp = z.object({ employeeId: zId, fy: fyParam.optional() });
  const empFy = z.object({ employeeId: zId, fy: fyParam });

  r.post('/tax/declarations', self, validate({ body: createDeclarationDto }), h(c.create));
  r.get('/tax/declarations', validate({ query: declarationListQuery }), h(c.list));
  r.get('/tax/declarations/me/:fy', validate({ params: z.object({ fy: fyParam }) }), h(c.mine));
  r.post('/tax/declarations/reminders/:fy', review, validate({ params: z.object({ fy: fyParam }) }), h(c.reminders));
  r.get('/tax/declarations/:id', validate({ params: idParam }), h(c.get));
  r.put('/tax/declarations/:id/regime', self, validate({ params: idParam, body: regimeDto }), h(c.regime));
  r.post('/tax/declarations/:id/investments', self, validate({ params: idParam, body: investmentDto }), h(c.addInvestment));
  r.delete('/tax/declarations/:id/investments/:invId', self, validate({ params: z.object({ id: zId, invId: zId }) }), h(c.removeInvestment));
  r.post('/tax/declarations/:id/submit', self, validate({ params: idParam }), h(c.submit));
  r.post('/tax/declarations/:id/proofs', self, validate({ params: idParam, body: proofDto }), h(c.proof));
  r.post('/tax/declarations/:id/approve', review, validate({ params: idParam, body: decisionDto }), h(c.approve));
  r.post('/tax/declarations/:id/reject', review, validate({ params: idParam, body: rejectDto }), h(c.reject));
  r.post('/tax/proofs/:proofId/verify', review, validate({ params: z.object({ proofId: zId }), body: verifyProofDto }), h(c.verifyProof));
  r.post('/tax/proofs/:proofId/reject', review, validate({ params: z.object({ proofId: zId }), body: rejectDto }), h(c.rejectProof));

  r.get('/tax/rules', review, h(c.rules));
  r.put('/tax/rules', config, validate({ body: ruleDto }), h(c.upsertRule));
  r.get('/tax/compute/me', validate({ query: computeQuery }), h(c.computeMine));
  r.get('/tax/compute/:employeeId', validate({ params: emp, query: computeQuery }), h(c.compute));
  r.get('/tax/tds/:employeeId/:month', requirePermission('TAX_REVIEW', 'PAYROLL_PROCESS'), validate({ params: tdsParams }), h(c.tds));
  r.get('/tax/summary/:employeeId/:fy', validate({ params: empFy }), h(c.summary));
  r.get('/tax/statement/:employeeId/:fy', validate({ params: empFy }), h(c.statement));
  r.post('/tax/documents', review, validate({ body: taxDocumentDto }), h(c.registerDocument));
  r.get('/tax/documents/:employeeId', validate({ params: z.object({ employeeId: zId }) }), h(c.documents));
}
