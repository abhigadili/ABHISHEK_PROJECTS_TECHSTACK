import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, uploadSingle, validate, z, zId } from '@hr/common';
import { DocumentController } from '../controllers/document.controller';
import { categoryDto, decisionDto, expiringQuery, grantDto, listQuery, rejectDto } from '../dto/document.dto';
import { DocumentService } from '../services/document.service';

export function documentRoutes(r: Router, db: Db): void {
  const c = new DocumentController(new DocumentService(db));
  const verify = requirePermission('DOCUMENT_VERIFY'); const self = requirePermission('SELF_SERVICE');
  r.get('/documents/categories', h(c.listCategories));
  r.post('/documents/categories', verify, validate({ body: categoryDto }), h(c.createCategory));
  r.put('/documents/categories/:id', verify, validate({ params: idParam, body: categoryDto.partial() }), h(c.updateCategory));
  r.get('/documents/expiring', verify, validate({ query: expiringQuery }), h(c.expiring));
  r.post('/documents/expiring/remind', verify, h(c.remind));
  r.post('/documents', self, uploadSingle('file'), h(c.upload));
  r.get('/documents', validate({ query: listQuery }), h(c.list));
  r.get('/documents/:id', validate({ params: idParam }), h(c.get));
  r.get('/documents/:id/download', validate({ params: idParam }), h(c.download));
  r.post('/documents/:id/verify', verify, validate({ params: idParam, body: decisionDto }), h(c.verify));
  r.post('/documents/:id/approve', verify, validate({ params: idParam, body: decisionDto }), h(c.approve));
  r.post('/documents/:id/reject', verify, validate({ params: idParam, body: rejectDto }), h(c.reject));
  r.delete('/documents/:id', validate({ params: idParam }), h(c.remove));
  r.get('/documents/:id/permissions', validate({ params: idParam }), h(c.grants));
  r.post('/documents/:id/permissions', validate({ params: idParam, body: grantDto }), h(c.grant));
  r.delete('/documents/:id/permissions/:grantId', validate({ params: z.object({ id: zId, grantId: zId }) }), h(c.revoke));
}
