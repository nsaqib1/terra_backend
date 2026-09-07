import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';


import {
  PointEventType,
  PointSourceType,
} from 'src/generated/prisma/enums';
import { ListPointEventsDto } from './dto/list-point-events.dto';

@Injectable()
export class PointService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async award(
    userId: string,
    points: number,
    type: PointEventType,
    sourceType: PointSourceType,
    sourceId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.pointEvent.create({
        data: {
          userId,
          points,
          type,
          sourceType,
          sourceId: sourceId ?? null,
        },
      });

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          points: {
            increment: points,
          },
        },
      });

      return event;
    });
  }

  async getHistory(
    userId: string,
    dto: ListPointEventsDto,
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where = {
      userId,
    };

    const [data, total] =
      await this.prisma.$transaction([
        this.prisma.pointEvent.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            type: true,
            points: true,
            sourceType: true,
            sourceId: true,
            createdAt: true,
          },
        }),

        this.prisma.pointEvent.count({
          where,
        }),
      ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}