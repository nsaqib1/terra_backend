import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CommunitiesService } from './communities.service';
import { ProposeCommunityDto } from './dto/propose-community.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityMemberQueryDto } from './dto/community-member-query.dto';

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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findJoined(@Req() request: AuthenticatedRequest) {
    return this.communitiesService.findJoinedByUser(
      request.user.userId,
    );
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.communitiesService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/join')
  async join(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.communitiesService.join(
      request.user.userId,
      slug,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':slug/leave')
  async leave(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.communitiesService.leave(
      request.user.userId,
      slug,
    );
  }

  @Get(':slug/members')
  async getMembers(
    @Param('slug') slug: string,
    @Query() query: CommunityMemberQueryDto,
  ) {
    return this.communitiesService.getMembers(slug, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':slug/membership')
  async getMembership(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ) {
    return this.communitiesService.getMembership(
      request.user.userId,
      slug,
    );
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