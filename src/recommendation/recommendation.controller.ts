import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Body,
  Request,
  BadRequestException,
  Req,
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
import { Auth } from 'src/auth/decorators/auth.decorator';

// @ApiTags('recommendations')

@Auth()
@ApiBearerAuth('JWT')
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get recipe recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of recommended recipes',
    type: RecommendationResponseDto,
  })
  async getRecommendations(
    @Req() req: any,
    @Query() query: RecommendationRequestDto,
  ): Promise<RecommendationResponseDto> {
    console.log(req.user);
    if (!query.ingredientIds?.length && !query.includeCollaborative) {
      throw new BadRequestException(
        'At least one ingredient ID is required when collaborative filtering is disabled',
      );
    }

    return this.recommendationService.getRecommendations(req.user?.id, query);
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
  @ApiBearerAuth('JWT')
  @Auth()
  async getRecommendationsPost(
    @Req() req: any,
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
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Get content-based recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of content-based recommended recipes',
    type: RecommendationResponseDto,
  })
  async getContentBasedRecommendations(
    @Req() req: any,
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
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Get collaborative filtering recommendations' })
  @ApiResponse({
    status: 200,
    description:
      'Returns a list of collaborative filtering based recommended recipes',
    type: RecommendationResponseDto,
  })
  async getCollaborativeRecommendations(
    @Req() req: any,
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
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Get hybrid recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of hybrid recommended recipes',
    type: RecommendationResponseDto,
  })
  async getHybridRecommendations(
    @Req() req: any,
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
