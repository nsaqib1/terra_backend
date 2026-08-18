import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CommunitiesService } from './communities.service';
import { ProposeCommunityDto } from './dto/propose-community.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communitiesService: CommunitiesService,
  ) { }

  @Get()
  async findAll() {
    return this.communitiesService.findAll();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.communitiesService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post('proposals')
  async propose(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ProposeCommunityDto,
  ) {
    return this.communitiesService.propose(
      request.user.userId,
      dto,
    );
  }
}