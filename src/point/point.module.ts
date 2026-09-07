import { Module } from '@nestjs/common';

import { PointController } from './point.controller';
import { PointService } from './point.service';
import { DailyVisitService } from './daily-visit.service';

@Module({
  controllers: [PointController],
  providers: [
    PointService,
    DailyVisitService,
  ],
  exports: [
    PointService,
    DailyVisitService,
  ],
})
export class PointModule { }