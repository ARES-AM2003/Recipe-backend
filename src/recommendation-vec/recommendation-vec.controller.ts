// src/recommendation-vec/recommendation-vec.controller.ts
import { Controller, Get, Query, Param, Req } from '@nestjs/common';
import { RecommendationVecService } from './recommendation-vec.service';
import { GetRecommendationDto } from './dto/get-recommendations.dto/get-recommendations.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

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
}
