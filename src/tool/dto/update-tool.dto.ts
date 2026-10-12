import { IsEnum, IsOptional, IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { ToolCategory, ToolStatus, ToolType } from '../../generated/prisma/enums';

export class UpdateToolDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) thumbnailUrl?: string;
  @IsOptional() @IsEnum(ToolCategory) category?: ToolCategory;
  @IsOptional() @IsEnum(ToolType) type?: ToolType;
  @IsOptional() @IsEnum(ToolStatus) status?: ToolStatus;
}
