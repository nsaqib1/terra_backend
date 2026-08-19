import {
  Body,
  Controller,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { ReviewCommunityProposalDto } from './dto/review-community-proposal.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) { }

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