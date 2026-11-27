import { Router } from 'express';
import { Db, asyncHandler as h, idParam, requirePermission, validate } from '@hr/common';
import { HolidayController } from '../controllers/holiday.controller';
import { countQuery, holidayDto, holidayQuery, holidayUpdateDto, holidayYearDto, upcomingQuery } from '../dto/holiday.dto';
import { HolidayService } from '../services/holiday.service';

export function holidayRoutes(r: Router, db: Db): void {
  const c = new HolidayController(new HolidayService(db));
  const manage = requirePermission('HOLIDAY_MANAGE');
  r.get('/holidays', validate({ query: holidayQuery }), h(c.list));
  r.get('/holidays/calendar', validate({ query: holidayQuery }), h(c.calendar));
  r.get('/holidays/upcoming', validate({ query: upcomingQuery }), h(c.upcoming));
  r.get('/holidays/count', validate({ query: countQuery }), h(c.count));
  r.get('/holidays/years', h(c.listYears));
  r.post('/holidays/years', manage, validate({ body: holidayYearDto }), h(c.createYear));
  r.put('/holidays/years/:id', manage, validate({ params: idParam, body: holidayYearDto.innerType().partial() as any }), h(c.updateYear));
  r.get('/holidays/:id', validate({ params: idParam }), h(c.get));
  r.post('/holidays', manage, validate({ body: holidayDto }), h(c.create));
  r.put('/holidays/:id', manage, validate({ params: idParam, body: holidayUpdateDto }), h(c.update));
  r.delete('/holidays/:id', manage, validate({ params: idParam }), h(c.remove));
}
