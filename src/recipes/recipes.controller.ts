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
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { FilterRecipesDto } from './dto/filter-recipes.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-recipe.dto';
import { RecipeFilterService } from './recipe-filter.service';
import { ExcelParserService } from './utils/excel-parser.service';
import { LikesService } from './likes.service';
import { RecipeResponseDto } from './dto/recipe-with-likes.dto';

import { Request, Response } from 'express';
import { User } from '../users/entities/user.entity';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
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
    private readonly excelParserService: ExcelParserService,
    private readonly likesService: LikesService,
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
  @ApiOperation({
    summary: 'Get recipe by ID',
    description:
      'Returns a recipe with detailed information including the total number of likes',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipe found successfully',
    type: RecipeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Recipe not found',
  })
  async findOne(@Param('id') id: string): Promise<RecipeResponseDto> {
    return await this.recipesService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiBearerAuth('JWT')
  async update(
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.recipesService.update(id, updateRecipeDto, req.user.id);
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
  @ApiOperation({ summary: 'Like or unlike a recipe (toggle)' })
  async likeRecipe(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.likesService.toggleLike(id, req.user.id);
  }

  @Get('liked')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user liked recipes with advanced options' })
  async getLikedRecipes(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('cuisine') cuisine?: string,
    @Query('difficulty') difficulty?: string,
    @Query('sortBy') sortBy?: 'likedAt' | 'title' | 'rating' | 'cookTime',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.likesService.getUserLikedRecipes(req.user.id, {
      page,
      limit,
      cuisine,
      difficulty,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id/likes')
  @Public()
  @ApiOperation({ summary: 'Get detailed recipe like information' })
  async getRecipeLikes(@Param('id') id: string) {
    return this.likesService.getRecipeLikeDetails(id);
  }

  @Get(':id/is-liked')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if user has liked a recipe' })
  async checkIfLiked(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.likesService.checkUserLikeStatus(id, req.user.id);
  }

  @Get('likes/stats')
  @Public()
  @ApiOperation({ summary: 'Get platform-wide like statistics' })
  async getPlatformLikeStats() {
    return this.likesService.getPlatformLikeStats();
  }

  @Get('likes/activity')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user like activity and preferences' })
  async getUserLikeActivity(@Req() req: RequestWithUser) {
    return this.likesService.getUserLikeActivity(req.user.id);
  }

  @Post('likes/bulk')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Bulk like/unlike recipes' })
  @ApiBody({
    description: 'Recipe IDs to like',
    schema: {
      type: 'object',
      properties: {
        recipeIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['uuid1', 'uuid2', 'uuid3'],
        },
      },
      required: ['recipeIds'],
    },
  })
  async bulkLikeRecipes(
    @Body('recipeIds') recipeIds: string[],
    @Req() req: RequestWithUser,
  ) {
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      throw new BadRequestException('At least one recipe ID is required');
    }
    return this.likesService.bulkLikeRecipes(req.user.id, recipeIds);
  }

  @Post('upload-excel')
  @Auth()
  @ApiBearerAuth('JWT')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload recipes from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Excel file containing recipes',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx or .xls) with recipe data',
        },
      },
    },
  })
  async uploadRecipesFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ): Promise<BulkUploadResultDto> {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Please upload an Excel file (.xlsx or .xls)',
      );
    }

    // Parse Excel file
    const bulkRecipes = this.excelParserService.parseExcelFile(file.buffer);

    // Process bulk upload
    return this.recipesService.bulkUploadRecipes(bulkRecipes, req.user);
  }

  @Get('download-template')
  @ApiOperation({ summary: 'Download Excel template for bulk recipe upload' })
  downloadExcelTemplate(@Res() res: Response) {
    const templateBuffer = this.excelParserService.generateExcelTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="recipe-upload-template.xlsx"',
      'Content-Length': templateBuffer.length,
    });

    res.send(templateBuffer);
  }
}
