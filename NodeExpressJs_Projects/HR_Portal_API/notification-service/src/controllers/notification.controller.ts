import type { Request, Response } from 'express';
import { created, ok } from '@hr/common';
import type { NotificationService } from '../services/notification.service';

export class NotificationController {
  constructor(private readonly svc: NotificationService) {}
  mine = async (req: Request, res: Response) => ok(res, await this.svc.mine(req.user!, req.valid.query));
  unread = async (req: Request, res: Response) => ok(res, await this.svc.unreadCount(req.user!));
  read = async (req: Request, res: Response) => ok(res, await this.svc.markRead(req.user!, req.params.id));
  unreadMark = async (req: Request, res: Response) => ok(res, await this.svc.markUnread(req.user!, req.params.id));
  readAll = async (req: Request, res: Response) => ok(res, await this.svc.markAllRead(req.user!));
  delivery = async (req: Request, res: Response) => ok(res, await this.svc.delivery(req.valid.query));
  templates = async (_q: Request, res: Response) => ok(res, await this.svc.listTemplates());
  upsertTemplate = async (req: Request, res: Response) => ok(res, await this.svc.upsertTemplate(req.valid.body));
  preview = async (req: Request, res: Response) => ok(res, await this.svc.preview(req.params.code, req.valid.body.variables));
  settings = async (_q: Request, res: Response) => ok(res, await this.svc.getSettings());
  updateSettings = async (req: Request, res: Response) => ok(res, await this.svc.updateSettings(req.valid.body));
  manual = async (req: Request, res: Response) => created(res, await this.svc.manual(req.valid.body, req.user!));
  history = async (req: Request, res: Response) => ok(res, await this.svc.eventHistory(req.valid.query));
  eventDetail = async (req: Request, res: Response) => ok(res, await this.svc.eventDetail(req.params.id));
  topics = async (_q: Request, res: Response) => ok(res, await this.svc.topics());
}
