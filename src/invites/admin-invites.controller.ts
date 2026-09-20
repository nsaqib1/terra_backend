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
import { AdminGuard } from '../admin/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteQueryDto } from './dto/invite-query.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { InvitesService } from './invites.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('admin/invites')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Summary overview stats for invites and beta access
   */
  @Get('stats')
  async getStats() {
    return this.invitesService.getInviteStats();
  }

  /**
   * List all invite codes
   */
  @Get()
  async listInvites(@Query() query: InviteQueryDto) {
    return this.invitesService.listInvites(query);
  }

  /**
   * Create a new invite link
   */
  @Post()
  async createInvite(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(dto, request.user.userId);
  }

  /**
   * Update an invite link (e.g. toggle status, max uses, expiration)
   */
  @Patch(':id')
  async updateInvite(
    @Param('id') id: string,
    @Body() dto: UpdateInviteDto,
  ) {
    return this.invitesService.updateInvite(id, dto);
  }

  /**
   * Delete an invite link
   */
  @Delete(':id')
  async deleteInvite(@Param('id') id: string) {
    return this.invitesService.deleteInvite(id);
  }
}
