import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { FilterRecipesDto } from './dto/filter-recipes.dto';
import { RecipeFilterService } from './recipe-filter.service';

import { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Public } from 'src/auth/decorators/public.decorator';

export interface RequestWithUser extends Request {
  user: User;
}

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly recipeFilterService: RecipeFilterService,
  ) {}

  @Post()
  @Auth()
  @ApiBearerAuth('JWT')
  async create(
    @Body() createRecipeDto: CreateRecipeDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.recipesService.create(createRecipeDto, req.user);
  }
  @Auth()
  @ApiBearerAuth('JWT')
  @Get('mine')
  async findMyRecipes(@Req() req: RequestWithUser) {
    return await this.recipesService.findMyRecipes(req.user.id);
  }

  @Public()
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.recipesService.findAll(page, limit);
  }

  @Public()
  @Get('filter')
  @ApiOperation({ summary: 'Filter recipes with comprehensive options' })
  async filterRecipes(@Query() filterDto: FilterRecipesDto) {
    return this.recipeFilterService.filterRecipes(filterDto);
  }

  @Public()
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }
    return this.recipesService.searchRecipes(query, page, limit);
  }

  @Public()
  @Post('by-ingredients')
  @ApiOperation({ summary: 'Find recipes by ingredient IDs' })
  @ApiBody({
    description: 'Ingredient IDs and optional pagination',
    schema: {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: { type: 'string' },
          example: ['1', '2', '3'],
        },
        page: {
          type: 'integer',
          example: 1,
          default: 1,
        },
        limit: {
          type: 'integer',
          example: 10,
          default: 10,
        },
      },
      required: ['ingredients'],
    },
  })
  async findByIngredients(
    @Body('ingredients') ingredients: string[],
    @Body('page') page: number = 1,
    @Body('limit') limit: number = 10,
  ) {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw new BadRequestException('At least one ingredient ID is required');
    }

    return this.recipesService.findByIngredients(ingredients, page, limit);
  }
  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.recipesService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiBearerAuth('JWT')
  async update(
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
    @GetUser() user: User,
  ) {
    return this.recipesService.update(id, updateRecipeDto, user.id);
  }

  @Delete(':id')
  @Auth()
  @ApiBearerAuth('JWT')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.recipesService.remove(id, req.user.id);
  }

  @Post(':id/like')
  @Auth()
  @ApiBearerAuth('JWT')
  async likeRecipe(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.recipesService.likeRecipe(id, req.user.id);
  }
}
