import type { Request, Response } from 'express';
import { created, noContent, ok, ValidationError } from '@hr/common';
import { uploadFields } from '../dto/document.dto';
import type { DocumentService } from '../services/document.service';

export class DocumentController {
  constructor(private readonly svc: DocumentService) {}
  listCategories = async (_q: Request, res: Response) => ok(res, await this.svc.listCategories());
  createCategory = async (req: Request, res: Response) => created(res, await this.svc.createCategory(req.valid.body));
  updateCategory = async (req: Request, res: Response) => ok(res, await this.svc.updateCategory(req.params.id, req.valid.body));
  upload = async (req: Request, res: Response) => {
    const parsed = uploadFields.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid upload fields', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    const f = (req as any).file as { buffer: Buffer; originalname: string; mimetype: string } | undefined;
    created(res, await this.svc.upload(req.user!, parsed.data, f && { buffer: f.buffer, fileName: f.originalname, contentType: f.mimetype }));
  };
  list = async (req: Request, res: Response) => ok(res, await this.svc.list(req.user!, req.valid.query));
  get = async (req: Request, res: Response) => ok(res, await this.svc.get(req.user!, req.params.id));
  download = async (req: Request, res: Response) => {
    const f = await this.svc.download(req.user!, req.params.id);
    res.setHeader('content-type', f.contentType); res.setHeader('content-length', String(f.sizeBytes));
    res.setHeader('content-disposition', `attachment; filename="${f.fileName.replace(/[^\w.\- ]/g, '_')}"`); res.setHeader('x-content-type-options', 'nosniff');
    f.stream.pipe(res);
  };
  verify = async (req: Request, res: Response) => ok(res, await this.svc.verify(req.user!, req.params.id));
  approve = async (req: Request, res: Response) => ok(res, await this.svc.approve(req.user!, req.params.id));
  reject = async (req: Request, res: Response) => ok(res, await this.svc.reject(req.user!, req.params.id, req.valid.body.reason));
  remove = async (req: Request, res: Response) => { await this.svc.remove(req.user!, req.params.id); noContent(res); };
  grant = async (req: Request, res: Response) => created(res, await this.svc.grant(req.user!, req.params.id, req.valid.body));
  grants = async (req: Request, res: Response) => ok(res, await this.svc.listGrants(req.user!, req.params.id));
  revoke = async (req: Request, res: Response) => { await this.svc.revoke(req.user!, req.params.id, req.params.grantId); noContent(res); };
  expiring = async (req: Request, res: Response) => ok(res, await this.svc.expiring(req.valid.query.days));
  remind = async (_q: Request, res: Response) => ok(res, { reminded: await this.svc.remindExpiring() });
}
