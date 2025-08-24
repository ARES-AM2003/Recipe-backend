import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';

// @ApiTags('recommendations')
// @ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  @ApiOperation({ summary: 'Get recipe recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of recommended recipes',
    type: RecommendationResponseDto,
  })
  async getRecommendations(
    @Request() req,
    @Query() query: RecommendationRequestDto,
  ): Promise<RecommendationResponseDto> {
    if (!query.ingredientIds?.length && !query.includeCollaborative) {
      throw new BadRequestException(
        'At least one ingredient ID is required when collaborative filtering is disabled',
      );
    }

    return this.recommendationService.getRecommendations(req.user.id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Get recipe recommendations with advanced filtering',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns a list of recommended recipes based on the provided criteria',
    type: RecommendationResponseDto,
  })
  async getRecommendationsPost(
    @Request() req,
    @Body() body: RecommendationRequestDto,
  ): Promise<RecommendationResponseDto> {
    if (!body.ingredientIds?.length && !body.includeCollaborative) {
      throw new BadRequestException(
        'At least one ingredient ID is required when collaborative filtering is disabled',
      );
    }

    return this.recommendationService.getRecommendations(req.user.id, body);
  }

  @Get('content')
  @ApiOperation({ summary: 'Get content-based recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of content-based recommended recipes',
    type: RecommendationResponseDto,
  })
  async getContentBasedRecommendations(
    @Request() req,
    @Query('ingredients') ingredientIds: string,
    @Query('limit') limit = '10',
  ): Promise<RecommendationResponseDto> {
    if (!ingredientIds) {
      throw new BadRequestException('At least one ingredient ID is required');
    }

    return this.recommendationService.getRecommendations(req.user.id, {
      ingredientIds: ingredientIds.split(','),
      limit: parseInt(limit, 10) || 10,
      includeContentBased: true,
      includeCollaborative: false,
      includeHybrid: false,
    });
  }

  @Get('collaborative')
  @ApiOperation({ summary: 'Get collaborative filtering recommendations' })
  @ApiResponse({
    status: 200,
    description:
      'Returns a list of collaborative filtering based recommended recipes',
    type: RecommendationResponseDto,
  })
  async getCollaborativeRecommendations(
    @Request() req,
    @Query('limit') limit = '10',
  ): Promise<RecommendationResponseDto> {
    return this.recommendationService.getRecommendations(req.user.id, {
      limit: parseInt(limit, 10) || 10,
      includeContentBased: false,
      includeCollaborative: true,
      includeHybrid: false,
    });
  }

  @Get('hybrid')
  @ApiOperation({ summary: 'Get hybrid recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of hybrid recommended recipes',
    type: RecommendationResponseDto,
  })
  async getHybridRecommendations(
    @Request() req,
    @Query('ingredients') ingredientIds: string,
    @Query('limit') limit = '10',
  ): Promise<RecommendationResponseDto> {
    return this.recommendationService.getRecommendations(req.user.id, {
      ingredientIds: ingredientIds ? ingredientIds.split(',') : [],
      limit: parseInt(limit, 10) || 10,
      includeContentBased: true,
      includeCollaborative: true,
      includeHybrid: true,
    });
  }
}
