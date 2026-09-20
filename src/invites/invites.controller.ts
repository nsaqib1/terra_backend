import { Controller, Get, Param } from '@nestjs/common';
import { InvitesService } from './invites.service';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Public endpoint to validate an invite code before signup
   */
  @Get('validate/:code')
  async validateInvite(@Param('code') code: string) {
    return this.invitesService.validateInviteCode(code);
  }

  /**
   * Public endpoint to check if invite-only registration is enforced
   */
  @Get('status')
  async getInviteOnlyStatus() {
    return {
      isInviteOnlyEnabled: this.invitesService.isInviteOnlyEnabled(),
    };
  }
}
