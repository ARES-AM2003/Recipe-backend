import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { User } from '../users/entities/user.entity';

export interface LikeStats {
  totalLikes: number;
  likesThisWeek: number;
  likesThisMonth: number;
  topLikedRecipes: {
    id: string;
    title: string;
    likeCount: number;
    author: string;
  }[];
}

export interface UserLikeActivity {
  totalLiked: number;
  recentlyLiked: {
    id: string;
    title: string;
    likedAt: Date;
  }[];
  favoriteAuthors: {
    authorId: string;
    authorName: string;
    recipesLiked: number;
  }[];
}

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipesRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Toggle like status for a recipe
   */
  async toggleLike(
    recipeId: string,
    userId: string,
  ): Promise<{
    isLiked: boolean;
    likeCount: number;
    message: string;
  }> {
    // First, verify both recipe and user exist
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['likedBy'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const userAlreadyLiked = recipe.likedBy.some((u) => u.id === userId);

    if (userAlreadyLiked) {
      // Remove like - remove user from recipe's likedBy array
      recipe.likedBy = recipe.likedBy.filter((u) => u.id !== userId);
    } else {
      // Add like - add user to recipe's likedBy array
      recipe.likedBy.push(user);
    }

    // Save the updated recipe
    await this.recipesRepository.save(recipe);

    return {
      isLiked: !userAlreadyLiked,
      likeCount: recipe.likedBy.length,
      message: userAlreadyLiked
        ? 'Recipe unliked successfully'
        : 'Recipe liked successfully',
    };
  }

  /**
   * Get detailed like statistics for a recipe
   */
  async getRecipeLikeDetails(recipeId: string): Promise<{
    likeCount: number;
    likedBy: Array<{
      id: string;
      name: string;
      email: string;
      likedAt?: Date;
    }>;
    isPopular: boolean;
    popularityRank?: number;
  }> {
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['likedBy'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    // Get popularity ranking
    const allRecipesWithLikes = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedBy')
      .select(['recipe.id'])
      .addSelect('COUNT(likedBy.id)', 'likeCount')
      .groupBy('recipe.id')
      .orderBy('likeCount', 'DESC')
      .getRawMany();

    const currentRecipeRank =
      allRecipesWithLikes.findIndex((r) => r.recipe_id === recipeId) + 1;

    const isPopular = recipe.likedBy.length >= 10; // Consider popular if 10+ likes

    return {
      likeCount: recipe.likedBy.length,
      likedBy: recipe.likedBy.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
      isPopular,
      popularityRank: currentRecipeRank || undefined,
    };
  }

  /**
   * Get user's liked recipes with advanced filtering
   */
  async getUserLikedRecipes(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      cuisine?: string;
      difficulty?: string;
      sortBy?: 'likedAt' | 'title' | 'rating' | 'cookTime';
      sortOrder?: 'ASC' | 'DESC';
    } = {},
  ): Promise<{
    data: Recipe[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: {
      totalLiked: number;
      cuisineBreakdown: Record<string, number>;
      difficultyBreakdown: Record<string, number>;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      cuisine,
      difficulty,
      sortBy = 'likedAt',
      sortOrder = 'DESC',
    } = options;

    let query = this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedUser')
      .where('likedUser.id = :userId', { userId });

    // Apply filters
    if (cuisine) {
      query = query.andWhere('recipe.cuisine = :cuisine', { cuisine });
    }

    if (difficulty) {
      query = query.andWhere('recipe.difficulty = :difficulty', { difficulty });
    }

    // Apply sorting
    switch (sortBy) {
      case 'title':
        query = query.orderBy('recipe.title', sortOrder);
        break;
      case 'rating':
        query = query.orderBy('recipe.averageRating', sortOrder);
        break;
      case 'cookTime':
        query = query.orderBy('recipe.cookTime', sortOrder);
        break;
      default:
        query = query.orderBy('recipe.createdAt', sortOrder);
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get summary statistics
    const allLikedRecipes = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedUser')
      .where('likedUser.id = :userId', { userId })
      .getMany();

    const cuisineBreakdown = allLikedRecipes.reduce(
      (acc, recipe) => {
        acc[recipe.cuisine] = (acc[recipe.cuisine] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const difficultyBreakdown = allLikedRecipes.reduce(
      (acc, recipe) => {
        acc[recipe.difficulty] = (acc[recipe.difficulty] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalLiked: allLikedRecipes.length,
        cuisineBreakdown,
        difficultyBreakdown,
      },
    };
  }

  /**
   * Get overall like statistics for the platform
   */
  async getPlatformLikeStats(): Promise<LikeStats> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Get total likes
    const totalLikesResult = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedBy')
      .select('COUNT(likedBy.id)', 'total')
      .getRawOne();

    const totalLikes = parseInt(totalLikesResult.total) || 0;

    // Get top liked recipes
    const topLikedRecipes = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedBy')
      .leftJoinAndSelect('recipe.author', 'author')
      .select(['recipe.id', 'recipe.title', 'author.name'])
      .addSelect('COUNT(likedBy.id)', 'likeCount')
      .groupBy('recipe.id, author.id')
      .orderBy('likeCount', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalLikes,
      likesThisWeek: 0, // Would need to track like timestamps for this
      likesThisMonth: 0, // Would need to track like timestamps for this
      topLikedRecipes: topLikedRecipes.map((recipe) => ({
        id: recipe.recipe_id,
        title: recipe.recipe_title,
        likeCount: parseInt(recipe.likeCount),
        author: recipe.author_name,
      })),
    };
  }

  /**
   * Get user's like activity and preferences
   */
  async getUserLikeActivity(userId: string): Promise<UserLikeActivity> {
    const likedRecipes = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoin('recipe.likedBy', 'likedUser')
      .where('likedUser.id = :userId', { userId })
      .orderBy('recipe.createdAt', 'DESC')
      .getMany();

    // Get favorite authors
    const authorLikeCounts = likedRecipes.reduce(
      (acc, recipe) => {
        const authorId = recipe.author.id;
        const authorName = recipe.author.name;

        if (!acc[authorId]) {
          acc[authorId] = { authorId, authorName, count: 0 };
        }
        acc[authorId].count++;

        return acc;
      },
      {} as Record<
        string,
        { authorId: string; authorName: string; count: number }
      >,
    );

    const favoriteAuthors = Object.values(authorLikeCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((author) => ({
        authorId: author.authorId,
        authorName: author.authorName,
        recipesLiked: author.count,
      }));

    return {
      totalLiked: likedRecipes.length,
      recentlyLiked: likedRecipes.slice(0, 10).map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        likedAt: recipe.createdAt, // Using createdAt as proxy for likedAt
      })),
      favoriteAuthors,
    };
  }

  /**
   * Check if user has liked a recipe
   */
  async checkUserLikeStatus(
    recipeId: string,
    userId: string,
  ): Promise<{
    isLiked: boolean;
    likeCount: number;
  }> {
    const recipe = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.likedBy', 'likedBy')
      .where('recipe.id = :recipeId', { recipeId })
      .getOne();

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    const isLiked = recipe.likedBy.some((user) => user.id === userId);

    return {
      isLiked,
      likeCount: recipe.likedBy.length,
    };
  }

  /**
   * Get recipes liked by multiple users (social discovery)
   */
  async getRecipesLikedByUsers(
    userIds: string[],
    page = 1,
    limit = 10,
  ): Promise<{
    data: Array<{
      recipe: Recipe;
      likedByCount: number;
      likedByUsers: string[];
    }>;
    total: number;
  }> {
    if (userIds.length === 0) {
      return { data: [], total: 0 };
    }

    const recipes = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedBy')
      .where('likedBy.id IN (:...userIds)', { userIds })
      .groupBy('recipe.id, author.id')
      .having('COUNT(DISTINCT likedBy.id) >= :minLikes', {
        minLikes: Math.min(2, userIds.length),
      })
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Get detailed like information for each recipe
    const recipesWithLikeInfo = await Promise.all(
      recipes.map(async (recipe) => {
        const recipeWithLikes = await this.recipesRepository.findOne({
          where: { id: recipe.id },
          relations: ['likedBy'],
        });

        const likedByTargetUsers = recipeWithLikes!.likedBy
          .filter((user) => userIds.includes(user.id))
          .map((user) => user.id);

        return {
          recipe,
          likedByCount: likedByTargetUsers.length,
          likedByUsers: likedByTargetUsers,
        };
      }),
    );

    return {
      data: recipesWithLikeInfo,
      total: recipes.length,
    };
  }

  /**
   * Remove all likes for a recipe (admin functionality)
   */
  async removeAllLikesFromRecipe(recipeId: string): Promise<{
    removedLikes: number;
    message: string;
  }> {
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['likedBy'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    const removedLikes = recipe.likedBy.length;
    recipe.likedBy = [];

    await this.recipesRepository.save(recipe);

    return {
      removedLikes,
      message: `Removed ${removedLikes} likes from recipe`,
    };
  }

  /**
   * Bulk like operations for a user
   */
  async bulkLikeRecipes(
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
        await this.toggleLike(recipeId, userId);
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
}
