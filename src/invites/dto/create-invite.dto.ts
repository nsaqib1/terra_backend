import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInviteDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number = 1;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
