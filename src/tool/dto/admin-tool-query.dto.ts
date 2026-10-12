import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToolCategory, ToolStatus, ToolType } from '../../generated/prisma/enums';

export class AdminToolQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ToolStatus) status?: ToolStatus;
  @IsOptional() @IsEnum(ToolCategory) category?: ToolCategory;
  @IsOptional() @IsEnum(ToolType) type?: ToolType;
  @IsOptional() @IsString() communityId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
