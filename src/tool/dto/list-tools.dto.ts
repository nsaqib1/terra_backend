import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToolCategory, ToolType } from '../../generated/prisma/enums';

export class ListToolsDto {
  @IsOptional() @IsEnum(ToolCategory) category?: ToolCategory;
  @IsOptional() @IsEnum(ToolType) type?: ToolType;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() communityId?: string;
}
