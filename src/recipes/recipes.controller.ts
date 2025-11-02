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
import {
  CreateRecipeDto,
  BulkCreateRecipeDto,
  BulkCreateRecipeResultDto,
} from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { FilterRecipesDto } from './dto/filter-recipes.dto';
import { BulkUploadResultDto } from './dto/bulk-upload-recipe.dto';
import { ExtractRecipeFromUrlDto } from './dto/extract-recipe-from-url.dto';
import { RecipeFilterService } from './recipe-filter.service';
import { RecipeExtractorService } from './recipe-extractor.service';
import { ExcelParserService } from './utils/excel-parser.service';
import { LikesService } from './likes.service';
import { SavedRecipesService } from './saved-recipes.service';
import { RatingsService } from './ratings.service';
import { RateRecipeDto } from './dto/rate-recipe.dto';
import { RecipeResponseDto } from './dto/recipe-with-likes.dto';
import {
  SaveRecipeResponseDto,
  UnsaveRecipeResponseDto,
  ToggleSaveRecipeResponseDto,
  CheckSaveStatusResponseDto,
  GetUserSavedRecipesResponseDto,
  GetRecipeSaveDetailsResponseDto,
  PlatformSaveStatsResponseDto,
  UserSaveActivityResponseDto,
  BulkSaveResponseDto,
  GetRecipesSavedByUsersResponseDto,
} from './dto/saved-recipe-response.dto';

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
    private readonly recipeExtractorService: RecipeExtractorService,
    private readonly excelParserService: ExcelParserService,
    private readonly likesService: LikesService,
    private readonly savedRecipesService: SavedRecipesService,
    private readonly ratingsService: RatingsService,
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

  @Get('test-api-key')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Test if OpenRouter API key is working',
    description: 'Makes a simple test call to verify the API key is valid',
  })
  @ApiResponse({
    status: 200,
    description: 'API key is working',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        model: { type: 'string' },
        testResponse: { type: 'string' },
      },
    },
  })
  async testApiKey() {
    try {
      const result = await this.recipeExtractorService.testApiKey();
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.toString(),
      };
    }
  }

  @Post('extract-from-url')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Extract and create recipe from URL using AI',
    description:
      'Fetches a recipe from a URL, extracts recipe data using Groq AI, and creates the recipe in the database',
  })
  @ApiResponse({
    status: 201,
    description: 'Recipe extracted and created successfully',
    type: RecipeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL or extraction failed',
  })
  async extractRecipeFromUrl(
    @Body() extractDto: ExtractRecipeFromUrlDto,
    @Req() req: RequestWithUser,
  ) {
    // Extract recipe data from URL using AI
    const extractedData =
      await this.recipeExtractorService.extractRecipeFromUrl(
        extractDto.url,
        extractDto.additionalInstructions,
        extractDto.rawHtml,
      );

    // Create recipe from extracted data
    const recipe = await this.recipesService.createRecipeFromExtractedData(
      extractedData,
      req.user,
    );

    return recipe;
  }

  @Post('bulk')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create multiple recipes in bulk via JSON' })
  @ApiResponse({
    status: 201,
    description: 'Recipes processed successfully',
    type: BulkCreateRecipeResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  async bulkCreate(
    @Body() bulkCreateDto: BulkCreateRecipeDto,
    @Req() req: RequestWithUser,
  ): Promise<BulkCreateRecipeResultDto> {
    return await this.recipesService.bulkCreate(bulkCreateDto, req.user);
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
  @Get('liked')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user liked recipes with advanced options' })
  async getLikedRecipes(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.likesService.getUserLikedRecipes(req.user.id, {
      page,
      limit,
    });
  }
  @Get('saved')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all saved recipes for the current user' })
  @ApiResponse({
    status: 200,
    description: 'User saved recipes retrieved successfully',
    type: GetUserSavedRecipesResponseDto,
  })
  async getUserSavedRecipes(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<GetUserSavedRecipesResponseDto> {
    return this.savedRecipesService.getUserSavedRecipes(req.user.id, {
      page,
      limit,
    });
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

  // ======================== SAVED RECIPES ENDPOINTS ========================

  @Post(':id/save')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Save a recipe for later' })
  @ApiResponse({
    status: 201,
    description: 'Recipe saved successfully',
    type: SaveRecipeResponseDto,
  })
  async saveRecipe(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<SaveRecipeResponseDto> {
    return this.savedRecipesService.saveRecipe(id, req.user.id);
  }

  @Delete(':id/save')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Unsave a recipe' })
  @ApiResponse({
    status: 200,
    description: 'Recipe unsaved successfully',
    type: UnsaveRecipeResponseDto,
  })
  async unsaveRecipe(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<UnsaveRecipeResponseDto> {
    return this.savedRecipesService.unsaveRecipe(id, req.user.id);
  }

  @Post(':id/save/toggle')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Toggle save status for a recipe (save/unsave)' })
  @ApiResponse({
    status: 200,
    description: 'Recipe save status toggled successfully',
    type: ToggleSaveRecipeResponseDto,
  })
  async toggleSaveRecipe(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<ToggleSaveRecipeResponseDto> {
    return this.savedRecipesService.toggleSaveRecipe(id, req.user.id);
  }

  @Get(':id/is-saved')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if a recipe is saved by the current user' })
  @ApiResponse({
    status: 200,
    description: 'Recipe save status retrieved successfully',
    type: CheckSaveStatusResponseDto,
  })
  async checkSaveStatus(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<CheckSaveStatusResponseDto> {
    return this.savedRecipesService.checkSaveStatus(id, req.user.id);
  }

  @Get(':id/saves')
  @Public()
  @ApiOperation({ summary: 'Get detailed save information for a recipe' })
  @ApiResponse({
    status: 200,
    description: 'Recipe save details retrieved successfully',
    type: GetRecipeSaveDetailsResponseDto,
  })
  async getRecipeSaveDetails(
    @Param('id') id: string,
  ): Promise<GetRecipeSaveDetailsResponseDto> {
    return this.savedRecipesService.getRecipeSaveDetails(id);
  }

  @Get('saves/stats')
  @Public()
  @ApiOperation({ summary: 'Get platform-wide save statistics' })
  @ApiResponse({
    status: 200,
    description: 'Platform save statistics retrieved successfully',
    type: PlatformSaveStatsResponseDto,
  })
  async getPlatformSaveStats(): Promise<PlatformSaveStatsResponseDto> {
    return this.savedRecipesService.getPlatformSaveStats();
  }

  @Get('saves/activity')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user save activity and preferences' })
  @ApiResponse({
    status: 200,
    description: 'User save activity retrieved successfully',
    type: UserSaveActivityResponseDto,
  })
  async getUserSaveActivity(
    @Req() req: RequestWithUser,
  ): Promise<UserSaveActivityResponseDto> {
    return this.savedRecipesService.getUserSaveActivity(req.user.id);
  }

  @Post('saves/bulk')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Bulk save multiple recipes' })
  @ApiBody({
    description: 'Recipe IDs to save',
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
  @ApiResponse({
    status: 200,
    description: 'Bulk save operation completed',
    type: BulkSaveResponseDto,
  })
  async bulkSaveRecipes(
    @Body('recipeIds') recipeIds: string[],
    @Req() req: RequestWithUser,
  ): Promise<BulkSaveResponseDto> {
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      throw new BadRequestException('At least one recipe ID is required');
    }
    return this.savedRecipesService.bulkSaveRecipes(req.user.id, recipeIds);
  }

  @Delete('saves/bulk')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Bulk unsave multiple recipes' })
  @ApiBody({
    description: 'Recipe IDs to unsave',
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
  @ApiResponse({
    status: 200,
    description: 'Bulk unsave operation completed',
    type: BulkSaveResponseDto,
  })
  async bulkUnsaveRecipes(
    @Body('recipeIds') recipeIds: string[],
    @Req() req: RequestWithUser,
  ): Promise<BulkSaveResponseDto> {
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      throw new BadRequestException('At least one recipe ID is required');
    }
    return this.savedRecipesService.bulkUnsaveRecipes(req.user.id, recipeIds);
  }

  @Post('saves/by-users')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get recipes saved by multiple users (collaborative discovery)',
  })
  @ApiBody({
    description: 'User IDs and pagination options',
    schema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['user1', 'user2', 'user3'],
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
      required: ['userIds'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Recipes saved by multiple users retrieved successfully',
    type: GetRecipesSavedByUsersResponseDto,
  })
  async getRecipesSavedByUsers(
    @Body('userIds') userIds: string[],
    @Body('page') page: number = 1,
    @Body('limit') limit: number = 10,
  ): Promise<GetRecipesSavedByUsersResponseDto> {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException('At least one user ID is required');
    }
    return this.savedRecipesService.getRecipesSavedByUsers(
      userIds,
      page,
      limit,
    );
  }

  // ======================== RATINGS ENDPOINTS ========================

  @Post(':id/rate')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Rate or update rating for a recipe (1-5)' })
  async rateRecipe(
    @Param('id') id: string,
    @Body() dto: RateRecipeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.ratingsService.rateRecipe(req.user.id, id, dto);
  }

  @Delete(':id/rating')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove my rating for a recipe' })
  async removeMyRating(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.ratingsService.removeRating(req.user.id, id);
  }

  @Get(':id/rating')
  @Auth()
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my rating for a recipe' })
  async getMyRating(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.ratingsService.getUserRatingForRecipe(req.user.id, id);
  }

  @Get(':id/ratings')
  @Public()
  @ApiOperation({ summary: 'List ratings for a recipe (paginated)' })
  async listRatingsForRecipe(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.ratingsService.getRatingsForRecipe(id, page, limit);
  }

  @Get(':id/rating-summary')
  @Public()
  @ApiOperation({
    summary: 'Get rating summary (average and count) for a recipe',
  })
  async getRatingSummary(@Param('id') id: string) {
    return this.ratingsService.getRecipeRatingSummary(id);
  }
}
