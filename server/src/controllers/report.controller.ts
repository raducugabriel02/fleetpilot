import type { Request, Response } from 'express';
import { monthlyReportQuerySchema } from '@fleetpilot/shared';
import type { MonthlyReportDto } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as reportService from '../services/report.service';

export async function monthly(req: Request, res: Response<MonthlyReportDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const query = monthlyReportQuerySchema.parse(req.query);
  res.json(await reportService.getMonthlyReport(companyId, query));
}
