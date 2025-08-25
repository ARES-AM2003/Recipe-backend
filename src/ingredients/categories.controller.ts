import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IngredientsService } from './ingredients.service';
import { IngredientCategory } from './entities/ingredient.entity';

@ApiTags('ingredient-categories')
@Controller('ingredients/categories')
export class CategoriesController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available ingredient categories' })
  @ApiResponse({
    status: 200,
    description: 'List of all ingredient categories',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
        },
        count: { type: 'number' },
      },
    },
  })
  async getAllCategories() {
    const categories = await this.ingredientsService.getCategories();
    return {
      categories,
      count: categories.length,
    };
  }

  @Get('enum')
  @ApiOperation({ summary: 'Get all predefined ingredient category enums' })
  @ApiResponse({
    status: 200,
    description: 'List of all predefined category enums',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
        },
        count: { type: 'number' },
      },
    },
  })
  async getCategoryEnums() {
    const categories = Object.values(IngredientCategory);
    return {
      categories,
      count: categories.length,
    };
  }

  @Get(':category')
  @ApiOperation({ summary: 'Get ingredients by category' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of ingredients for the specified category',
  })
  async getIngredientsByCategory(
    @Param('category') category: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.ingredientsService.findByCategory(category, page, limit);
  }

  @Get(':category/common')
  @ApiOperation({ summary: 'Get common ingredients by category' })
  @ApiResponse({
    status: 200,
    description: 'List of common ingredients for the specified category',
  })
  async getCommonIngredientsByCategory(@Param('category') category: string) {
    const ingredients =
      await this.ingredientsService.getCommonIngredientsByCategory(category);
    return {
      category,
      ingredients,
      count: ingredients.length,
    };
  }

  @Get(':category/stats')
  @ApiOperation({ summary: 'Get statistics for ingredients in a category' })
  @ApiResponse({
    status: 200,
    description: 'Statistics for ingredients in the specified category',
    schema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        totalCount: { type: 'number' },
        commonCount: { type: 'number' },
        averageCalories: { type: 'number' },
        averageProtein: { type: 'number' },
        averageCarbs: { type: 'number' },
        averageFat: { type: 'number' },
      },
    },
  })
  async getCategoryStats(@Param('category') category: string) {
    return this.ingredientsService.getCategoryStats(category);
  }
}
