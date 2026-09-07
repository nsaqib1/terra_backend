import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import {
  PointEventType,
  PointSourceType,
} from '../generated/prisma/enums';

@Injectable()
export class DailyVisitService {
  private readonly DAILY_VISIT_POINTS = 1;

  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async record(userId: string) {
    const now = new Date();

    const visitDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );

    return this.prisma.$transaction(async (tx) => {
      const existingVisit =
        await tx.dailyVisit.findUnique({
          where: {
            userId_visitDate: {
              userId,
              visitDate,
            },
          },
        });

      if (existingVisit) {
        return {
          awarded: false,
          points: 0,
        };
      }

      await tx.dailyVisit.create({
        data: {
          userId,
          visitDate,
        },
      });

      await tx.pointEvent.create({
        data: {
          userId,
          points: this.DAILY_VISIT_POINTS,
          type: PointEventType.DAILY_VISIT,
          sourceType: PointSourceType.SYSTEM,
        },
      });

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          points: {
            increment: this.DAILY_VISIT_POINTS,
          },
        },
      });

      return {
        awarded: true,
        points: this.DAILY_VISIT_POINTS,
      };
    });
  }
}