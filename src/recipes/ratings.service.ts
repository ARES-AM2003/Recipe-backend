import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { Recipe } from './entities/recipe.entity';
import { RateRecipeDto } from './dto/rate-recipe.dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
  ) {}

  /**
   * Create or update a user's rating for a recipe.
   * Also recalculates and updates the recipe's averageRating and reviewCount atomically.
   */
  async rateRecipe(
    userId: string,
    recipeId: string,
    dto: RateRecipeDto,
  ): Promise<{
    rating: Rating;
    averageRating: number;
    reviewCount: number;
    isUpdate: boolean;
    message: string;
  }> {
    if (dto.value < 1 || dto.value > 5) {
      throw new BadRequestException('Rating value must be between 1 and 5');
    }

    // Execute in a transaction for consistency (rating + aggregates)
    return await this.ratingRepository.manager.transaction(async (em) => {
      const ratingRepo = em.getRepository(Rating);
      const recipeRepo = em.getRepository(Recipe);

      // Ensure the recipe exists
      const recipe = await recipeRepo.findOne({ where: { id: recipeId } });
      if (!recipe) {
        throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
      }

      // Upsert rating
      let isUpdate = false;
      let rating = await ratingRepo.findOne({ where: { userId, recipeId } });

      if (rating) {
        isUpdate = true;
        rating.value = dto.value;
        rating.comment = dto.comment ?? rating.comment ?? null;
        rating = await ratingRepo.save(rating);
      } else {
        rating = ratingRepo.create({
          userId,
          recipeId,
          value: dto.value,
          comment: dto.comment ?? null,
        });
        rating = await ratingRepo.save(rating);
      }

      // Recompute aggregates from authoritative source (ratings table)
      const agg = await ratingRepo
        .createQueryBuilder('r')
        .select('AVG(r.value)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.recipeId = :recipeId', { recipeId })
        .getRawOne<{ avg: string | null; count: string }>();
      const averageRating = agg?.avg ? Number(agg.avg) : 0;
      const reviewCount = agg?.count ? Number(agg.count) : 0;

      // Persist new aggregates into the recipe
      await recipeRepo.update(recipeId, {
        averageRating,
        reviewCount,
      });

      return {
        rating,
        averageRating,
        reviewCount,
        isUpdate,
        message: isUpdate
          ? 'Rating updated successfully'
          : 'Rating created successfully',
      };
    });
  }

  /**
   * Remove a user's rating for a recipe.
   * Also updates the recipe's averageRating and reviewCount.
   */
  async removeRating(
    userId: string,
    recipeId: string,
  ): Promise<{
    removed: boolean;
    averageRating: number;
    reviewCount: number;
    message: string;
  }> {
    return await this.ratingRepository.manager.transaction(async (em) => {
      const ratingRepo = em.getRepository(Rating);
      const recipeRepo = em.getRepository(Recipe);

      // Ensure the recipe exists
      const recipe = await recipeRepo.findOne({ where: { id: recipeId } });
      if (!recipe) {
        throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
      }

      const existing = await ratingRepo.findOne({
        where: { userId, recipeId },
      });
      if (!existing) {
        return {
          removed: false,
          averageRating: recipe.averageRating,
          reviewCount: recipe.reviewCount,
          message: 'No rating to remove',
        };
      }

      await ratingRepo.remove(existing);

      const agg = await ratingRepo
        .createQueryBuilder('r')
        .select('AVG(r.value)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.recipeId = :recipeId', { recipeId })
        .getRawOne<{ avg: string | null; count: string }>();
      const averageRating = agg?.avg ? Number(agg.avg) : 0;
      const reviewCount = agg?.count ? Number(agg.count) : 0;

      await recipeRepo.update(recipeId, {
        averageRating,
        reviewCount,
      });

      return {
        removed: true,
        averageRating,
        reviewCount,
        message: 'Rating removed successfully',
      };
    });
  }

  /**
   * Get a specific user's rating for a recipe (if any).
   */
  async getUserRatingForRecipe(
    userId: string,
    recipeId: string,
  ): Promise<Rating | null> {
    return await this.ratingRepository.findOne({ where: { userId, recipeId } });
  }

  /**
   * List ratings for a recipe (paginated).
   */
  async getRatingsForRecipe(
    recipeId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: Array<{
      id: string;
      userId: string;
      value: number;
      comment: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const qb = this.ratingRepository
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.userId',
        'r.value',
        'r.comment',
        'r.createdAt',
        'r.updatedAt',
      ])
      .where('r.recipeId = :recipeId', { recipeId })
      .orderBy('r.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        value: r.value,
        comment: r.comment ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get rating summary (average and count) for a recipe.
   */
  async getRecipeRatingSummary(
    recipeId: string,
  ): Promise<{ averageRating: number; reviewCount: number }> {
    const agg = await this.ratingRepository
      .createQueryBuilder('r')
      .select('AVG(r.value)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.recipeId = :recipeId', { recipeId })
      .getRawOne<{ avg: string | null; count: string }>();

    return {
      averageRating: agg?.avg ? Number(agg.avg) : 0,
      reviewCount: agg?.count ? Number(agg.count) : 0,
    };
  }
}
