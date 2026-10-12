import { IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateToolVersionDto {
  @IsOptional() @IsString() @MaxLength(5000) releaseNotes?: string;
}
