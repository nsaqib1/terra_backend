import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PointService } from './point.service';
import { DailyVisitService } from './daily-visit.service';
import { ListPointEventsDto } from './dto/list-point-events.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('points')
export class PointController {
  constructor(
    private readonly pointsService: PointService,
    private readonly dailyVisitService: DailyVisitService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post('daily-visit')
  async dailyVisit(@Req() request: AuthenticatedRequest) {
    return this.dailyVisitService.record(
      request.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history(
    @Req() request: AuthenticatedRequest,
    @Query() dto: ListPointEventsDto,
  ) {
    return this.pointsService.getHistory(
      request.user.userId,
      dto,
    );
  }
}