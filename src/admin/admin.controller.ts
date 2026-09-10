import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { AdminCommunityQueryDto } from './dto/admin-community-query.dto';
import { CommunityProposalQueryDto } from './dto/community-proposal-query.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReviewCommunityProposalDto } from './dto/review-community-proposal.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AdminGuard } from './guards/admin.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  /**
   * Summary overview stats for dashboard
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /**
   * Community Management CRUD
   */
  @Get('communities')
  async getCommunities(@Query() query: AdminCommunityQueryDto) {
    return this.adminService.getCommunities(query);
  }

  @Get('communities/:id')
  async getCommunityById(@Param('id') id: string) {
    return this.adminService.getCommunityById(id);
  }

  @Post('communities')
  async createCommunity(@Body() dto: CreateCommunityDto) {
    return this.adminService.createCommunity(dto);
  }

  @Patch('communities/:id')
  async updateCommunity(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.adminService.updateCommunity(id, dto);
  }

  @Delete('communities/:id')
  async deleteCommunity(@Param('id') id: string) {
    return this.adminService.deleteCommunity(id);
  }

  /**
   * Citizen Community Proposals
   */
  @Get('community-proposals')
  async getCommunityProposals(@Query() query: CommunityProposalQueryDto) {
    return this.adminService.getCommunityProposals(query);
  }

  @Patch('community-proposals/:id/review')
  async reviewCommunityProposal(
    @Req() request: AuthenticatedRequest,
    @Param('id') proposalId: string,
    @Body() dto: ReviewCommunityProposalDto,
  ) {
    return this.adminService.reviewCommunityProposal(
      request.user.userId,
      proposalId,
      dto,
    );
  }
}