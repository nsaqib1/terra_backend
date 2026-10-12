import { Controller, Get, Param, Query } from '@nestjs/common';
import { ToolService } from './tool.service';
import { ListToolsDto } from './dto/list-tools.dto';

@Controller('tools')
export class ToolController {
  constructor(private readonly toolService: ToolService) {}
  @Get() list(@Query() dto: ListToolsDto) { return this.toolService.list(dto); }
  @Get(':slug') findBySlug(@Param('slug') slug: string) { return this.toolService.findBySlug(slug); }
}
