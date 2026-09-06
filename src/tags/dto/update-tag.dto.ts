import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { TagStatus } from '../../generated/prisma/enums';

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsEnum(TagStatus)
  status?: TagStatus;
}