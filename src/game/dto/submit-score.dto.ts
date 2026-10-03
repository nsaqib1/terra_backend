import { IsInt, Max, Min } from 'class-validator';

export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  score!: number;
}