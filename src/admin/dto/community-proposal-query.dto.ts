import { IsEnum, IsOptional } from 'class-validator';
import { CommunityProposalStatus } from '../../generated/prisma/enums';

export class CommunityProposalQueryDto {
  @IsOptional()
  @IsEnum(CommunityProposalStatus)
  status?: CommunityProposalStatus;
}