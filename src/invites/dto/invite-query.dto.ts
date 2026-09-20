import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum InviteStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  DEPLETED = 'depleted',
}

export class InviteQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(InviteStatusFilter)
  status?: InviteStatusFilter = InviteStatusFilter.ALL;
}
