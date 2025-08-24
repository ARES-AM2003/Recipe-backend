import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Post,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { NutritionService } from './nutrition.service';
import { NutritionFiltersDto } from './dto/nutrition-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('nutrition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get('recipes')
  @ApiOperation({ summary: 'Get recipes filtered by nutritional values' })
  @ApiResponse({ status: 200, description: 'Returns filtered recipes' })
  getRecipesByNutrition(
    @Query() filters: NutritionFiltersDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    console.log(filters);
    console.log(page);
    console.log(limit);
    return this.nutritionService.getRecipesByNutrition(filters, page, limit);
  }

  @Get('insights')
  @ApiOperation({
    summary: 'Get nutritional insights based on saved/liked recipes',
  })
  @ApiResponse({ status: 200, description: 'Returns nutritional insights' })
  getNutritionalInsights(@Request() req) {
    return this.nutritionService.getNutritionalInsights(req.user.id);
  }

  @Get('goals')
  @ApiOperation({ summary: 'Get recommended nutritional goals' })
  @ApiResponse({
    status: 200,
    description: 'Returns recommended nutritional goals',
  })
  getNutritionalGoals(@Request() req) {
    return this.nutritionService.getNutritionalGoals(req.user);
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze a recipe or meal for nutritional content' })
  @ApiResponse({ status: 200, description: 'Returns nutritional analysis' })
  analyzeNutrition(@Body() recipe: any) {
    // This would analyze a recipe object and return its nutritional content
    return this.nutritionService.calculateNutritionalSummary([recipe]);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get nutritional trends over time' })
  @ApiResponse({ status: 200, description: 'Returns nutritional trends' })
  getNutritionalTrends(@Request() req) {
    // This would return trends based on the user's meal history
    // Implementation would depend on how meal history is stored
    return {
      message: 'Nutritional trends endpoint - implementation pending',
      data: [],
    };
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized nutrition recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns personalized recommendations',
  })
  getPersonalizedRecommendations(@Request() req) {
    // This would provide personalized nutrition recommendations
    // based on the user's goals, preferences, and history
    return {
      recommendations: [
        'Increase your fiber intake by adding more vegetables to your meals.',
        'Consider adding a source of omega-3 fatty acids, like salmon or flaxseeds.',
        'You might benefit from more plant-based protein sources like beans and lentils.',
      ],
    };
  }
}
