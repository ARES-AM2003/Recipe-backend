// src/recommendation-vec/recommendation-vec.controller.ts
import { Controller, Get, Query, Param, Req, Post } from '@nestjs/common';
import { RecommendationVecService } from './recommendation-vec.service';
import { GetRecommendationDto } from './dto/get-recommendations.dto/get-recommendations.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('recommendations-vec')
export class RecommendationVecController {
  constructor(private readonly recService: RecommendationVecService) {}

  @Auth()
  @ApiBearerAuth('JWT')
  @Get()
  async getUserRecommendations(
    @Req() req: any,
    @Query() filters: GetRecommendationDto,
  ) {
    return await this.recService.getRecommendations(req.user.id, filters);
  }

  @Auth()
  @ApiBearerAuth('JWT')
  @Post('reload-embeddings')
  @ApiOperation({
    summary: 'Reload ingredient embeddings without restarting the server',
    description:
      'This endpoint reloads the ingredient embeddings from the JSON file. Useful when new ingredients have been added to the system.',
  })
  @ApiResponse({
    status: 200,
    description: 'Embeddings reloaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        ingredientCount: { type: 'number', example: 450 },
        message: {
          type: 'string',
          example: 'Successfully reloaded 450 ingredient embeddings',
        },
      },
    },
  })
  async reloadEmbeddings() {
    return await this.recService.reloadEmbeddings();
  }
}
