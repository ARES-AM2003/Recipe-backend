import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedRecipe } from './entities/saved-recipe.entity';
import { Recipe } from './entities/recipe.entity';
import { User } from '../users/entities/user.entity';

export interface SavedRecipeStats {
  totalSaved: number;
  savedThisWeek: number;
  savedThisMonth: number;
  topSavedRecipes: {
    id: string;
    title: string;
    saveCount: number;
    author: string;
  }[];
}

export interface UserSavedActivity {
  totalSaved: number;
  recentlySaved: {
    id: string;
    title: string;
    savedAt: Date;
  }[];
  favoriteCategories: {
    cuisine: string;
    count: number;
  }[];
}

@Injectable()
export class SavedRecipesService {
  constructor(
    @InjectRepository(SavedRecipe)
    private readonly savedRecipeRepository: Repository<SavedRecipe>,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Save a recipe for a user
   */
  async saveRecipe(
    recipeId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    message: string;
    savedAt: Date;
  }> {
    // Verify recipe exists
    const recipe = await this.recipeRepository.findOne({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Check if already saved
    const existingSave = await this.savedRecipeRepository.findOne({
      where: { userId, recipeId },
    });

    if (existingSave) {
      throw new ConflictException('Recipe is already saved');
    }

    // Create new saved recipe
    const savedRecipe = this.savedRecipeRepository.create({
      userId,
      recipeId,
    });

    const result = await this.savedRecipeRepository.save(savedRecipe);

    return {
      success: true,
      message: 'Recipe saved successfully',
      savedAt: result.savedAt,
    };
  }

  /**
   * Unsave a recipe for a user
   */
  async unsaveRecipe(
    recipeId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // Find the saved recipe
    const savedRecipe = await this.savedRecipeRepository.findOne({
      where: { userId, recipeId },
    });

    if (!savedRecipe) {
      throw new NotFoundException('Recipe is not saved');
    }

    await this.savedRecipeRepository.remove(savedRecipe);

    return {
      success: true,
      message: 'Recipe unsaved successfully',
    };
  }

  /**
   * Toggle save status for a recipe
   */
  async toggleSaveRecipe(
    recipeId: string,
    userId: string,
  ): Promise<{
    isSaved: boolean;
    saveCount: number;
    message: string;
    savedAt?: Date;
  }> {
    // Check if already saved
    const existingSave = await this.savedRecipeRepository.findOne({
      where: { userId, recipeId },
    });

    let isSaved: boolean;
    let savedAt: Date | undefined;

    if (existingSave) {
      // Unsave the recipe
      await this.savedRecipeRepository.remove(existingSave);
      isSaved = false;
    } else {
      // Save the recipe
      const result = await this.saveRecipe(recipeId, userId);
      isSaved = true;
      savedAt = result.savedAt;
    }

    // Get total save count for this recipe
    const saveCount = await this.savedRecipeRepository.count({
      where: { recipeId },
    });

    return {
      isSaved,
      saveCount,
      message: isSaved
        ? 'Recipe saved successfully'
        : 'Recipe unsaved successfully',
      savedAt,
    };
  }

  /**
   * Check if a recipe is saved by a user
   */
  async checkSaveStatus(
    recipeId: string,
    userId: string,
  ): Promise<{
    isSaved: boolean;
    saveCount: number;
    savedAt?: Date;
  }> {
    // Verify recipe exists
    const recipe = await this.recipeRepository.findOne({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    // Check if saved by user
    const savedRecipe = await this.savedRecipeRepository.findOne({
      where: { userId, recipeId },
    });

    // Get total save count for this recipe
    const saveCount = await this.savedRecipeRepository.count({
      where: { recipeId },
    });

    return {
      isSaved: !!savedRecipe,
      saveCount,
      savedAt: savedRecipe?.savedAt,
    };
  }

  /**
   * Get all saved recipes for a user
   */
  async getUserSavedRecipes(
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    data: Array<{
      recipe: Recipe;
      savedAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10 } = options;

    const query = this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .leftJoinAndSelect('savedRecipe.recipe', 'recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .where('savedRecipe.userId = :userId', { userId });

    // Default sorting by savedAt DESC (most recently saved first)
    query.orderBy('savedRecipe.savedAt', 'DESC');

    const [savedRecipes, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = savedRecipes.map((savedRecipe) => ({
      recipe: savedRecipe.recipe,
      savedAt: savedRecipe.savedAt,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed save statistics for a recipe
   */
  async getRecipeSaveDetails(recipeId: string): Promise<{
    saveCount: number;
    savedBy: Array<{
      id: string;
      name: string;
      email: string;
      savedAt: Date;
    }>;
    isPopular: boolean;
    popularityRank?: number;
  }> {
    const recipe = await this.recipeRepository.findOne({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    // Get all users who saved this recipe
    const savedRecipes = await this.savedRecipeRepository.find({
      where: { recipeId },
      relations: ['user'],
      order: { savedAt: 'DESC' },
    });

    // Get popularity ranking
    const recipeSaveCounts = await this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .select('savedRecipe.recipeId', 'recipeId')
      .addSelect('COUNT(*)', 'saveCount')
      .groupBy('savedRecipe.recipeId')
      .orderBy('"saveCount"', 'DESC')
      .getRawMany();

    const currentRecipeRank =
      recipeSaveCounts.findIndex((r: any) => r.recipeId === recipeId) + 1;

    const isPopular = savedRecipes.length >= 5; // Consider popular if 5+ saves

    return {
      saveCount: savedRecipes.length,
      savedBy: savedRecipes.map((savedRecipe) => ({
        id: savedRecipe.user.id,
        name: savedRecipe.user.name,
        email: savedRecipe.user.email,
        savedAt: savedRecipe.savedAt,
      })),
      isPopular,
      popularityRank: currentRecipeRank || undefined,
    };
  }

  /**
   * Get platform-wide save statistics
   */
  async getPlatformSaveStats(): Promise<SavedRecipeStats> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Get total saves
    const totalSaved = await this.savedRecipeRepository.count();

    // Get saves this week
    const savedThisWeek = await this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .where('savedRecipe.savedAt >= :oneWeekAgo', { oneWeekAgo })
      .getCount();

    // Get saves this month
    const savedThisMonth = await this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .where('savedRecipe.savedAt >= :oneMonthAgo', { oneMonthAgo })
      .getCount();

    // Get top saved recipes
    const topSavedRecipes = await this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .leftJoin('savedRecipe.recipe', 'recipe')
      .leftJoin('recipe.author', 'author')
      .select(['recipe.id', 'recipe.title', 'author.name'])
      .addSelect('COUNT(savedRecipe.id)', 'saveCount')
      .groupBy('recipe.id, author.id')
      .orderBy('"saveCount"', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalSaved,
      savedThisWeek,
      savedThisMonth,
      topSavedRecipes: topSavedRecipes.map((recipe: any) => ({
        id: recipe.recipe_id as string,
        title: recipe.recipe_title as string,
        saveCount: parseInt(recipe.saveCount as string),
        author: recipe.author_name as string,
      })),
    };
  }

  /**
   * Get user's save activity and preferences
   */
  async getUserSaveActivity(userId: string): Promise<UserSavedActivity> {
    const savedRecipes = await this.savedRecipeRepository.find({
      where: { userId },
      relations: ['recipe', 'recipe.author'],
      order: { savedAt: 'DESC' },
    });

    // Get favorite cuisines
    const cuisineCounts = savedRecipes.reduce(
      (acc, savedRecipe) => {
        const cuisine = savedRecipe.recipe.cuisine;
        acc[cuisine] = (acc[cuisine] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const favoriteCategories = Object.entries(cuisineCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cuisine, count]) => ({ cuisine, count }));

    return {
      totalSaved: savedRecipes.length,
      recentlySaved: savedRecipes.slice(0, 10).map((savedRecipe) => ({
        id: savedRecipe.recipe.id,
        title: savedRecipe.recipe.title,
        savedAt: savedRecipe.savedAt,
      })),
      favoriteCategories,
    };
  }

  /**
   * Bulk save recipes for a user
   */
  async bulkSaveRecipes(
    userId: string,
    recipeIds: string[],
  ): Promise<{
    successful: string[];
    failed: Array<{ recipeId: string; error: string }>;
    message: string;
  }> {
    const successful: string[] = [];
    const failed: Array<{ recipeId: string; error: string }> = [];

    for (const recipeId of recipeIds) {
      try {
        await this.saveRecipe(recipeId, userId);
        successful.push(recipeId);
      } catch (error) {
        failed.push({
          recipeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      successful,
      failed,
      message: `Processed ${recipeIds.length} recipes. ${successful.length} successful, ${failed.length} failed.`,
    };
  }

  /**
   * Bulk unsave recipes for a user
   */
  async bulkUnsaveRecipes(
    userId: string,
    recipeIds: string[],
  ): Promise<{
    successful: string[];
    failed: Array<{ recipeId: string; error: string }>;
    message: string;
  }> {
    const successful: string[] = [];
    const failed: Array<{ recipeId: string; error: string }> = [];

    for (const recipeId of recipeIds) {
      try {
        await this.unsaveRecipe(recipeId, userId);
        successful.push(recipeId);
      } catch (error) {
        failed.push({
          recipeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      successful,
      failed,
      message: `Processed ${recipeIds.length} recipes. ${successful.length} successful, ${failed.length} failed.`,
    };
  }

  /**
   * Get recipes saved by multiple users (for collaborative features)
   */
  async getRecipesSavedByUsers(
    userIds: string[],
    page = 1,
    limit = 10,
  ): Promise<{
    data: Array<{
      recipe: Recipe;
      savedByCount: number;
      savedByUsers: string[];
    }>;
    total: number;
  }> {
    if (userIds.length === 0) {
      return { data: [], total: 0 };
    }

    const query = this.savedRecipeRepository
      .createQueryBuilder('savedRecipe')
      .leftJoinAndSelect('savedRecipe.recipe', 'recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .where('savedRecipe.userId IN (:...userIds)', { userIds })
      .groupBy('recipe.id, author.id')
      .having('COUNT(DISTINCT savedRecipe.userId) >= :minSaves', {
        minSaves: Math.min(2, userIds.length),
      });

    const [savedRecipes, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get detailed save information for each recipe
    const recipesWithSaveInfo = await Promise.all(
      savedRecipes.map(async (savedRecipe) => {
        const saves = await this.savedRecipeRepository
          .createQueryBuilder('savedRecipe')
          .leftJoinAndSelect('savedRecipe.user', 'user')
          .where('savedRecipe.recipeId = :recipeId', {
            recipeId: savedRecipe.recipe.id,
          })
          .andWhere('savedRecipe.userId IN (:...userIds)', { userIds })
          .getMany();

        return {
          recipe: savedRecipe.recipe,
          savedByCount: saves.length,
          savedByUsers: saves.map((save) => save.userId),
        };
      }),
    );

    return {
      data: recipesWithSaveInfo,
      total,
    };
  }
}
