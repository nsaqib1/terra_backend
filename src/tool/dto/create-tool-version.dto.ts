import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
export class CreateToolVersionDto {
  @IsString() @MaxLength(50) @Matches(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/) version!: string;
  @IsOptional() @IsString() @MaxLength(5000) releaseNotes?: string;
}
