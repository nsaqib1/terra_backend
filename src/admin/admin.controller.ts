import { mkdirSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { AdminCommunityQueryDto } from './dto/admin-community-query.dto';
import { CommunityProposalQueryDto } from './dto/community-proposal-query.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReviewCommunityProposalDto } from './dto/review-community-proposal.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AdminGuard } from './guards/admin.guard';
import { ResourcesService } from '../resources/resources.service';
import { ResourceTagsService } from '../resources/resource-tags.service';
import { ListResourcesDto } from '../resources/dto/list-resources.dto';
import { CreateResourceTagDto } from '../resources/dto/create-resource-tag.dto';
import { UpdateResourceTagDto } from '../resources/dto/update-resource-tag.dto';
import { UpdateResourceDto } from '../resources/dto/update-resource.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

function getResourceTempDir(): string {
  const configuredPath = process.env.RESOURCE_TEMP_PATH;
  if (configuredPath) {
    try {
      mkdirSync(configuredPath, { recursive: true });
      return configuredPath;
    } catch {
      // Fallback if configured path is not writable
    }
  }
  const fallbackPath = join(process.cwd(), 'storage', 'resource-temp');
  mkdirSync(fallbackPath, { recursive: true });
  return fallbackPath;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly resourcesService: ResourcesService,
    private readonly resourceTagsService: ResourceTagsService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('communities')
  async getCommunities(@Query() query: AdminCommunityQueryDto) {
    return this.adminService.getCommunities(query);
  }

  @Get('communities/:id')
  async getCommunityById(@Param('id') id: string) {
    return this.adminService.getCommunityById(id);
  }

  @Post('communities')
  async createCommunity(@Body() dto: CreateCommunityDto) {
    return this.adminService.createCommunity(dto);
  }

  @Patch('communities/:id')
  async updateCommunity(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.adminService.updateCommunity(id, dto);
  }

  @Delete('communities/:id')
  async deleteCommunity(@Param('id') id: string) {
    return this.adminService.deleteCommunity(id);
  }

  @Get('community-proposals')
  async getCommunityProposals(@Query() query: CommunityProposalQueryDto) {
    return this.adminService.getCommunityProposals(query);
  }

  @Patch('community-proposals/:id/review')
  async reviewCommunityProposal(
    @Req() request: AuthenticatedRequest,
    @Param('id') proposalId: string,
    @Body() dto: ReviewCommunityProposalDto,
  ) {
    return this.adminService.reviewCommunityProposal(
      request.user.userId,
      proposalId,
      dto,
    );
  }

  @Get('resources')
  async getResources(@Query() query: ListResourcesDto) {
    return this.resourcesService.list(query, true);
  }

  @Post('resources')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, getResourceTempDir());
        },
      }),
      limits: {
        fileSize: Number(
          process.env.RESOURCE_MAX_FILE_SIZE || 104857600,
        ),
      },
    }),
  )
  async createResource(
    @Req() request: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: Number(
              process.env.RESOURCE_MAX_FILE_SIZE || 104857600,
            ),
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('communityId') communityId: string,
    @Body('title') title: string,
    @Body('description') description?: string,
    @Body('tagIds') tagIdsRaw?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.resourcesService.createFromUpload(
      request.user.userId,
      file,
      communityId,
      title,
      description,
      this.parseTagIds(tagIdsRaw),
    );
  }

  @Get('resources/:id')
  async getResource(@Param('id') id: string) {
    return this.resourcesService.getAdminById(id);
  }

  @Patch('resources/:id')
  async updateResource(
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(id, dto);
  }

  @Delete('resources/:id')
  async archiveResource(@Param('id') id: string) {
    return this.resourcesService.archive(id);
  }

  @Get('resource-tags')
  async getResourceTags(
    @Query('communityId') communityId: string,
    @Query('q') q?: string,
  ) {
    if (!communityId) {
      throw new BadRequestException('communityId is required');
    }
    return this.resourceTagsService.list(communityId, q);
  }

  @Post('resource-tags')
  async createResourceTag(@Body() dto: CreateResourceTagDto) {
    return this.resourceTagsService.create(dto);
  }

  @Patch('resource-tags/:id')
  async updateResourceTag(
    @Param('id') id: string,
    @Body() dto: UpdateResourceTagDto,
  ) {
    return this.resourceTagsService.update(id, dto);
  }

  private parseTagIds(value?: string) {
    if (!value?.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      if (
        Array.isArray(parsed) &&
        parsed.every((id) => typeof id === 'string')
      ) {
        return [...new Set(parsed)];
      }
    } catch {
      // Accept comma-separated IDs for simple multipart clients.
    }

    return [
      ...new Set(
        value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
  }
}
