import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { ToolCategory, ToolStatus, ToolType } from '../../generated/prisma/enums';

export class CreateToolDto {
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsString() @MinLength(2) @MaxLength(100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) thumbnailUrl?: string;
  @IsOptional() @IsEnum(ToolCategory) category?: ToolCategory = ToolCategory.OTHER;
  @IsOptional() @IsEnum(ToolType) type?: ToolType = ToolType.CLIENT;
  @IsOptional() @IsEnum(ToolStatus) status?: ToolStatus = ToolStatus.DRAFT;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) communityIds?: string[];
}
