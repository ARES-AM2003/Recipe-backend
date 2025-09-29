import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import {
  RecommendationResponseDto,
  RecommendationItemDto,
} from './dto/recommendation-response.dto';
import * as natural from 'natural';
import * as tf from '@tensorflow/tfjs-node';
import { ConfigService } from '@nestjs/config';

type RecipeVector = {
  recipe: Recipe;
  vector: number[];
};

interface UserSimilarity {
  userId: string;
  similarity: number;
  commonLikes: number;
}

interface UserLikeMatrix {
  [userId: string]: Set<string>; // Set of liked recipe IDs
}

interface CollaborativeFilters {
  minScore?: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private tfidf: natural.TfIdf;
  private recipeVectors: RecipeVector[] = [];
  private model: tf.LayersModel | null = null;
  private userLikeMatrix: UserLikeMatrix = {};
  private lastMatrixUpdate: Date = new Date(0);
  private readonly MATRIX_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_COLLABORATIVE_SCORE = 0.6; // Default minimum score for collaborative recommendations

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly configService: ConfigService,
  ) {
    this.initializeRecommendationEngine();
  }

  private async initializeRecommendationEngine() {
    try {
      // Initialize TF-IDF for content-based filtering
      this.tfidf = new natural.TfIdf();

      // Use pagination to avoid memory issues
      const batchSize = 100;
      let offset = 0;
      let hasMore = true;

      this.logger.log('Starting recommendation engine initialization...');

      while (hasMore) {
        const recipes = await this.recipeRepository.find({
          relations: ['ingredients'],
          take: batchSize,
          skip: offset,
        });

        if (recipes.length === 0) {
          hasMore = false;
          break;
        }

        // Process batch asynchronously
        await this.processBatch(recipes);
        offset += batchSize;

        this.logger.debug(`Processed ${offset} recipes...`);
      }

      // Load or initialize collaborative filtering model
      await this.loadCollaborativeModel();
      await this.updateUserLikeMatrix();

      this.logger.log(
        `Recommendation engine initialized with ${this.recipeVectors.length} recipes`,
      );
    } catch (error) {
      this.logger.error(
        'Error initializing recommendation engine',
        error.stack,
      );
    }
  }

  private async processBatch(recipes: Recipe[]) {
    const promises = recipes.map((recipe) => this.processRecipe(recipe));
    await Promise.all(promises);
  }

  private async processRecipe(recipe: Recipe) {
    try {
      const text = [
        recipe.title,
        recipe.description,
        ...recipe.instructions,
        ...(recipe.tags || []),
        ...recipe.ingredients.map((i) => i.name),
      ].join(' ');

      this.tfidf.addDocument(text);

      // Store recipe with its vector (will be calculated later)
      this.recipeVectors.push({
        recipe,
        vector: [], // Will be populated after all documents are added
      });
    } catch (error) {
      this.logger.error(`Error processing recipe ${recipe.id}`, error.stack);
    }
  }

  private getTfidfVector(text: string): number[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const documentCount = this.tfidf.documents.length;
    const vector: number[] = Array(documentCount).fill(0);

    this.tfidf.tfidfs(text, (i, measure) => {
      if (i >= 0 && i < vector.length) {
        vector[i] = measure;
      }
    });

    return vector;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    const dotProduct = vecA.reduce(
      (sum, val, i) => sum + val * (vecB[i] || 0),
      0,
    );
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  private async updateUserLikeMatrix() {
    try {
      const now = new Date();
      if (
        now.getTime() - this.lastMatrixUpdate.getTime() <
        this.MATRIX_CACHE_DURATION
      ) {
        return; // Use cached matrix
      }

      this.logger.log('Updating user-like matrix...');

      const users = await this.userRepository.find({
        relations: ['likedRecipes'],
        select: ['id'],
      });

      this.userLikeMatrix = {};

      for (const user of users) {
        this.userLikeMatrix[user.id] = new Set(
          user.likedRecipes?.map((recipe) => recipe.id) || [],
        );
      }

      this.lastMatrixUpdate = now;
      this.logger.log(`Updated user-like matrix for ${users.length} users`);
    } catch (error) {
      this.logger.error('Error updating user-like matrix', error.stack);
    }
  }

  private async findSimilarUsers(
    userId: string,
    limit: number = 10,
  ): Promise<UserSimilarity[]> {
    await this.updateUserLikeMatrix();

    const targetUserLikes = this.userLikeMatrix[userId];
    if (!targetUserLikes || targetUserLikes.size === 0) {
      this.logger.warn(`No likes found for user ${userId}`);
      return [];
    }

    const similarities: UserSimilarity[] = [];

    for (const [otherUserId, otherUserLikes] of Object.entries(
      this.userLikeMatrix,
    )) {
      if (otherUserId === userId || otherUserLikes.size === 0) continue;

      const similarity = this.jaccardSimilarity(
        targetUserLikes,
        otherUserLikes,
      );
      const commonLikes = new Set(
        [...targetUserLikes].filter((x) => otherUserLikes.has(x)),
      ).size;

      if (similarity > 0 && commonLikes >= 2) {
        // Require at least 2 common likes
        similarities.push({
          userId: otherUserId,
          similarity,
          commonLikes,
        });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private async loadCollaborativeModel() {
    try {
      this.logger.log('Initializing collaborative filtering model...');

      // For now, we use user-based collaborative filtering
      // In production, you could load a pre-trained matrix factorization model here
      this.model = null;
    } catch (error) {
      this.logger.error('Error loading collaborative model', error.stack);
      this.model = null;
    }
  }

  private async getContentBasedRecommendations(
    ingredientIds: string[],
    limit: number,
    excludeRecipeIds: string[] = [],
  ): Promise<RecommendationItemDto[]> {
    try {
      // Get ingredients for the query
      const ingredients = await this.ingredientRepository.find({
        where: { id: In(ingredientIds) },
      });

      if (ingredients.length === 0) {
        return [];
      }

      // Create a query string from ingredients
      const queryText = ingredients.map((i) => i.name).join(' ');
      const queryVector = this.getTfidfVector(queryText);

      // Calculate similarity scores
      const scoredRecipes = this.recipeVectors
        .filter((rv) => !excludeRecipeIds.includes(rv.recipe.id))
        .map((rv) => ({
          recipe: rv.recipe,
          score: this.cosineSimilarity(queryVector, rv.vector),
        }))
        .filter((item) => item.score > 0) // Filter out zero-similarity recipes
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scoredRecipes.map((item) => ({
        recipe: item.recipe,
        score: item.score,
        type: 'content' as const,
        reason: `Similar to ingredients: ${ingredients.map((i) => i.name).join(', ')}`,
      }));
    } catch (error) {
      this.logger.error('Error in content-based recommendations', error.stack);
      return [];
    }
  }

  private async getCollaborativeRecommendations(
    userId: string,
    limit: number,
    excludeRecipeIds: string[] = [],
    filters: CollaborativeFilters = {},
  ): Promise<RecommendationItemDto[]> {
    try {
      // Find users with similar preferences
      const similarUsers = await this.findSimilarUsers(userId, 20);

      if (similarUsers.length === 0) {
        this.logger.warn(
          `No similar users found for user ${userId}, falling back to popular recipes`,
        );
        return this.getFallbackRecommendations(limit, excludeRecipeIds);
      }

      this.logger.log(
        `Found ${similarUsers.length} similar users for collaborative filtering`,
      );

      // Get recipes liked by similar users but not by current user
      const targetUserLikes = this.userLikeMatrix[userId] || new Set();
      const candidateRecipes = new Map<
        string,
        { score: number; reason: string[] }
      >();

      for (const similarUser of similarUsers) {
        const similarUserLikes = this.userLikeMatrix[similarUser.userId];
        if (!similarUserLikes) continue;

        for (const recipeId of similarUserLikes) {
          if (
            targetUserLikes.has(recipeId) ||
            excludeRecipeIds.includes(recipeId)
          ) {
            continue; // Skip recipes already liked or excluded
          }

          if (!candidateRecipes.has(recipeId)) {
            candidateRecipes.set(recipeId, { score: 0, reason: [] });
          }

          const candidate = candidateRecipes.get(recipeId)!;
          candidate.score += similarUser.similarity; // Weight by user similarity
          candidate.reason.push(`${similarUser.commonLikes} common likes`);
        }
      }

      // Get recipe details and sort by score
      const recipeIds = Array.from(candidateRecipes.keys()).slice(0, limit * 2);

      if (recipeIds.length === 0) {
        this.logger.warn('No candidate recipes found from similar users');
        return this.getFallbackRecommendations(limit, excludeRecipeIds);
      }

      const recipes = await this.recipeRepository.find({
        where: { id: In(recipeIds) },
      });

      const minScore = filters.minScore ?? this.MIN_COLLABORATIVE_SCORE;

      const recommendations = recipes
        .map((recipe) => {
          const candidate = candidateRecipes.get(recipe.id)!;
          return {
            recipe,
            score: candidate.score / similarUsers.length, // Normalize score
            type: 'collaborative' as const,
            reason: `Liked by ${candidate.reason.length} similar users`,
          };
        })
        .filter(({ score, recipe }) => {
          const meetsThreshold = score >= minScore;
          if (!meetsThreshold) {
            this.logger.log(
              `[Collaborative Filter] ${recipe.title}: ${score.toFixed(3)} < ${minScore} ❌`,
            );
          } else {
            this.logger.log(
              `[Collaborative Filter] ${recipe.title}: ${score.toFixed(3)} >= ${minScore} ✅`,
            );
          }
          return meetsThreshold;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(
        `Generated ${recommendations.length} collaborative recommendations (min score: ${minScore})`,
      );
      return recommendations;
    } catch (error) {
      this.logger.error('Error in collaborative recommendations', error.stack);
      return this.getFallbackRecommendations(limit, excludeRecipeIds, filters);
    }
  }

  private async getFallbackRecommendations(
    limit: number,
    excludeRecipeIds: string[] = [],
    filters: CollaborativeFilters = {},
  ): Promise<RecommendationItemDto[]> {
    // Fallback to popular recipes when collaborative filtering fails
    const minScore = filters.minScore ?? this.MIN_COLLABORATIVE_SCORE;

    // With high threshold (0.6), fallback should return empty results
    // This forces the system to rely on true collaborative filtering or other methods
    if (minScore >= 0.6) {
      this.logger.warn(
        `High collaborative threshold (${minScore}) - no fallback recommendations provided. Users need more interaction data for collaborative filtering.`,
      );
      return [];
    }

    const popularRecipes = await this.recipeRepository.find({
      where: { id: Not(In(excludeRecipeIds)) },
      order: { averageRating: 'DESC', reviewCount: 'DESC' },
      take: limit,
    });

    const fallbackRecommendations = popularRecipes.map((recipe, index) => ({
      recipe,
      score: Math.max(0.4 - index * 0.05, 0.1), // Realistic fallback scores, don't inflate
      type: 'collaborative' as const,
      reason:
        'Popular recipe (insufficient user data for collaborative filtering)',
    }));

    this.logger.log(
      `Generated ${fallbackRecommendations.length} fallback recommendations (scores too low for threshold ${minScore})`,
    );

    return fallbackRecommendations;
  }

  private async getHybridRecommendations(
    contentRecs: RecommendationItemDto[],
    collabRecs: RecommendationItemDto[],
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    try {
      // Simple hybrid approach: combine and re-rank
      const combined = [...contentRecs, ...collabRecs];

      // Group by recipe ID and combine scores
      const recipeMap = new Map<string, RecommendationItemDto>();

      combined.forEach((rec) => {
        const existing = recipeMap.get(rec.recipe.id);
        if (existing) {
          // Weighted average: content-based gets 40%, collaborative gets 60%
          const contentWeight = rec.type === 'content' ? 0.4 : 0.6;
          existing.score = existing.score + rec.score * contentWeight;
          existing.type = 'hybrid';
          existing.reason = `Hybrid: ${existing.reason} + ${rec.reason}`;
        } else {
          recipeMap.set(rec.recipe.id, { ...rec });
        }
      });

      return Array.from(recipeMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error in hybrid recommendations', error.stack);
      return [];
    }
  }

  private async filterByNutrition(
    recipes: RecommendationItemDto[],
    filters: {
      maxCalories?: number;
      minProtein?: number;
      maxCarbs?: number;
      maxFat?: number;
    },
  ): Promise<RecommendationItemDto[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return recipes;
    }

    return recipes.filter((item) => {
      const recipe = item.recipe;

      if (
        filters.maxCalories !== undefined &&
        recipe.calories > filters.maxCalories
      ) {
        return false;
      }

      if (
        filters.minProtein !== undefined &&
        recipe.protein < filters.minProtein
      ) {
        return false;
      }

      if (filters.maxCarbs !== undefined && recipe.carbs > filters.maxCarbs) {
        return false;
      }

      if (filters.maxFat !== undefined && recipe.fat > filters.maxFat) {
        return false;
      }

      return true;
    });
  }

  async getRecommendations(
    userId: string,
    request: RecommendationRequestDto,
  ): Promise<RecommendationResponseDto> {
    try {
      const startTime = Date.now();
      const {
        ingredientIds = [],
        limit = 10,
        includeContentBased = true,
        includeCollaborative = true,
        includeHybrid = true,
        ...filters
      } = request;

      // Get user's liked/saved recipes to exclude from recommendations
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['likedRecipes'],
      });

      const excludeRecipeIds = user?.likedRecipes?.map((r) => r.id) || [];

      // Get recommendations from different strategies
      const [contentRecs, collabRecs] = await Promise.all([
        includeContentBased && ingredientIds?.length > 0
          ? this.getContentBasedRecommendations(
              ingredientIds,
              limit * 2,
              excludeRecipeIds,
            )
          : [],
        includeCollaborative
          ? this.getCollaborativeRecommendations(
              userId,
              limit * 2,
              excludeRecipeIds,
              { minScore: filters.minCosineSimilarity }, // Use same threshold as vector recommendations
            )
          : [],
      ]);

      // Get hybrid recommendations if enabled
      const hybridRecs =
        includeHybrid && (contentRecs.length > 0 || collabRecs.length > 0)
          ? await this.getHybridRecommendations(
              contentRecs,
              collabRecs,
              limit * 2,
            )
          : [];

      // Combine all recommendations
      let allRecommendations: RecommendationItemDto[] = [];

      if (includeHybrid && hybridRecs.length > 0) {
        allRecommendations = [...hybridRecs];
      } else {
        if (includeContentBased) allRecommendations.push(...contentRecs);
        if (includeCollaborative) allRecommendations.push(...collabRecs);
      }

      // Filter by nutrition if requested
      if (Object.keys(filters).length > 0) {
        allRecommendations = await this.filterByNutrition(
          allRecommendations,
          filters,
        );
      }

      // Remove duplicates and sort by score
      const uniqueRecipes = new Map<string, RecommendationItemDto>();
      allRecommendations.forEach((rec) => {
        if (!uniqueRecipes.has(rec.recipe.id)) {
          uniqueRecipes.set(rec.recipe.id, rec);
        }
      });

      const sortedRecommendations = Array.from(uniqueRecipes.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Count recommendations by type
      const contentCount = sortedRecommendations.filter(
        (r) => r.type === 'content',
      ).length;
      const collabCount = sortedRecommendations.filter(
        (r) => r.type === 'collaborative',
      ).length;
      const hybridCount = sortedRecommendations.filter(
        (r) => r.type === 'hybrid',
      ).length;

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Generated ${sortedRecommendations.length} recommendations in ${processingTime}ms`,
      );

      return {
        recommendations: sortedRecommendations,
        metadata: {
          totalRecommendations: sortedRecommendations.length,
          contentBasedCount: contentCount,
          collaborativeCount: collabCount,
          hybridCount: hybridCount,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Error generating recommendations', error.stack);
      return {
        recommendations: [],
        metadata: {
          totalRecommendations: 0,
          contentBasedCount: 0,
          collaborativeCount: 0,
          hybridCount: 0,
          timestamp: new Date(),
        },
      };
    }
  }
}
