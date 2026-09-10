import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  CommunityMaturity,
  CommunityStatus,
  GovernanceMode,
} from '../../generated/prisma/enums';

export class AdminCommunityQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CommunityStatus)
  status?: CommunityStatus;

  @IsOptional()
  @IsEnum(CommunityMaturity)
  maturity?: CommunityMaturity;

  @IsOptional()
  @IsEnum(GovernanceMode)
  governanceMode?: GovernanceMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'name' | 'membersCount' | 'postsCount' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
