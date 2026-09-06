import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { VoteService } from './vote.service';
import { CreateVoteDto } from './dto/create-vote.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('votes')
export class VoteController {
  constructor(
    private readonly voteService: VoteService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  async vote(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateVoteDto,
  ) {
    return this.voteService.vote(
      req.user.userId,
      dto,
    );
  }
}