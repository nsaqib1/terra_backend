import {
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { VoteValue } from '../../generated/prisma/enums';

export class CreateVoteDto {
  @IsOptional()
  @IsUUID()
  @ValidateIf((o) => !o.commentId)
  postId?: string;

  @IsOptional()
  @IsUUID()
  @ValidateIf((o) => !o.postId)
  commentId?: string;

  @IsEnum(VoteValue)
  value!: VoteValue;
}