import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
