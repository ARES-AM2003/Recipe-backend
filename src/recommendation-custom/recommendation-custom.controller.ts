import {
  Controller,
  Get,
  Query,
  Req,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { RecommendationCustomService } from './recommendation-custom.service';
import {
  CustomRecommendationRequestDto,
  CustomRecommendationResponseDto,
} from './dto/custom-recommendation.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Custom TF-IDF Recommendations')
@Auth()
@ApiBearerAuth('JWT')
@Controller('recommendations-custom')
export class RecommendationCustomController {
  constructor(
    private readonly recommendationCustomService: RecommendationCustomService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get recipe recommendations using custom TF-IDF implementation',
    description:
      'This endpoint uses a from-scratch TF-IDF implementation (no external NLP libraries) to demonstrate understanding of the algorithm. It works identically to the package-based endpoint but with custom code.',
  })
  @ApiQuery({
    name: 'ingredientIds',
    description: 'Comma-separated ingredient IDs',
    required: true,
    example:
      '123e4567-e89b-12d3-a456-426614174000,223e4567-e89b-12d3-a456-426614174001',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of recommendations to return',
    required: false,
    example: 10,
  })
  @ApiQuery({
    name: 'minCosineSimilarity',
    description: 'Minimum cosine similarity threshold (0-1)',
    required: false,
    example: 0.6,
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns a list of recommended recipes based on custom TF-IDF algorithm',
    type: CustomRecommendationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing or invalid ingredient IDs',
  })
  async getRecommendations(
    @Req() req: Request & { user: { id: string } },
    @Query('ingredientIds') ingredientIds?: string,
    @Query('limit') limit?: string,
    @Query('minCosineSimilarity') minCosineSimilarity?: string,
  ): Promise<CustomRecommendationResponseDto> {
    if (!ingredientIds) {
      throw new BadRequestException(
        'At least one ingredient ID is required for custom TF-IDF recommendations',
      );
    }

    const ingredientIdArray = ingredientIds
      .split(',')
      .filter((id) => id.trim().length > 0);

    if (ingredientIdArray.length === 0) {
      throw new BadRequestException('Valid ingredient IDs are required');
    }

    const requestDto: CustomRecommendationRequestDto = {
      ingredientIds: ingredientIdArray,
      limit: limit ? parseInt(limit, 10) : 10,
      minCosineSimilarity: minCosineSimilarity
        ? parseFloat(minCosineSimilarity)
        : 0.6,
    };

    return this.recommendationCustomService.getRecommendations(
      req.user.id,
      requestDto,
    );
  }
}
