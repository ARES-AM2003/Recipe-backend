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
import * as fs from 'fs';
import * as path from 'path';
import * as word2vec from 'word2vec';

type RecipeVector = {
  recipe: Recipe;
  vector: number[];
  ingredientVector: number[];
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

interface IngredientEmbeddings {
  [ingredientName: string]: number[];
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
  private readonly MIN_COLLABORATIVE_SCORE = 0.6;
  private ingredientEmbeddings: IngredientEmbeddings = {};
  private embeddingsLoaded = false;
  private word2vecModel: any = null;
  private word2vecLoaded = false;
  private embeddingPath: string;

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly configService: ConfigService,
  ) {
    void this.initializeRecommendationEngine();
  }

  private async initializeRecommendationEngine() {
    try {
      // Initialize TF-IDF for content-based filtering
      this.tfidf = new natural.TfIdf();

      // Load ingredient embeddings and Word2Vec model
      await this.loadIngredientEmbeddings();
      await this.loadWord2VecModel();

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

      // Load collaborative filtering model
      await this.loadCollaborativeModel();
      await this.updateUserLikeMatrix();

      // Calculate vectors for all recipes
      await this.calculateRecipeVectors();

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

  private async loadIngredientEmbeddings() {
    try {
      this.embeddingPath = path.resolve(
        __dirname,
        '../../ingredients/ingredents-embeddings/ingredient_embeddings.json',
      );

      if (fs.existsSync(this.embeddingPath)) {
        this.ingredientEmbeddings = JSON.parse(
          fs.readFileSync(this.embeddingPath, 'utf-8'),
        );
        this.embeddingsLoaded = true;
        this.logger.log(
          `✅ Loaded embeddings for ${Object.keys(this.ingredientEmbeddings).length} ingredients`,
        );
      } else {
        this.logger.warn(
          '⚠️ Ingredient embeddings not found, using fallback similarity',
        );
      }
    } catch (error: any) {
      this.logger.error('Error loading ingredient embeddings', error.stack);
    }
  }

  private async loadWord2VecModel() {
    try {
      const modelPath = path.resolve(
        __dirname,
        '../../ingredients/ingredents-embeddings/ingredient_w2v.model',
      );

      if (fs.existsSync(modelPath)) {
        // Set a timeout for model loading to prevent hanging
        const modelPromise = new Promise((resolve, reject) => {
          word2vec.loadModel(modelPath, (error: any, model: any) => {
            if (error) {
              reject(new Error(error));
            } else {
              resolve(model);
            }
          });
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Model loading timeout')), 10000); // 10 second timeout
        });

        this.word2vecModel = await Promise.race([modelPromise, timeoutPromise]);
        this.word2vecLoaded = true;
        this.logger.log('✅ Loaded Word2Vec model successfully');
      } else {
        this.logger.warn(
          '⚠️ Word2Vec model not found, embeddings limited to JSON only',
        );
      }
    } catch (error: any) {
      this.logger.error(
        'Error loading Word2Vec model:',
        error?.message || 'Unknown error',
      );
      this.logger.warn(
        'Continuing without Word2Vec model - using JSON embeddings only',
      );
      this.word2vecLoaded = false;
      this.word2vecModel = null;
    }
  }

  private normalizeIngredientName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  private async getIngredientVector(
    ingredientName: string,
  ): Promise<number[] | null> {
    const key = this.normalizeIngredientName(ingredientName);

    // First, check if embedding exists in JSON
    if (this.embeddingsLoaded && this.ingredientEmbeddings[key]) {
      this.logger.debug(`📋 Found cached embedding for: ${ingredientName}`);
      return this.ingredientEmbeddings[key];
    }

    // If not found in JSON and Word2Vec model is available, calculate using Word2Vec
    if (this.word2vecLoaded && this.word2vecModel) {
      try {
        // Add timeout to prevent hanging on getVector calls
        const vectorPromise = new Promise<number[] | null>((resolve) => {
          this.word2vecModel.getVector(
            ingredientName,
            (error: any, vector: number[]) => {
              if (error || !vector) {
                // Try with normalized name
                this.word2vecModel.getVector(
                  key,
                  (error2: any, vector2: number[]) => {
                    resolve(error2 || !vector2 ? null : vector2);
                  },
                );
              } else {
                resolve(vector);
              }
            },
          );
        });

        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 2000); // 2 second timeout for individual queries
        });

        const vector = await Promise.race([vectorPromise, timeoutPromise]);

        if (vector && Array.isArray(vector)) {
          // Cache the new embedding in memory and save to JSON
          this.ingredientEmbeddings[key] = vector;
          await this.saveEmbeddingToFile(key, vector);
          this.logger.log(
            `🔄 Generated and cached embedding for ingredient: ${ingredientName} (length: ${vector.length})`,
          );
          return vector;
        } else {
          this.logger.debug(
            `🚫 Word2Vec model returned no vector for: ${ingredientName}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to generate embedding for ${ingredientName}:`,
          error?.message || 'Unknown error',
        );
      }
    }

    // Smart fallback: Try to find similar ingredients in the existing embeddings
    const fallbackVector = this.findSimilarIngredientVector(ingredientName);
    if (fallbackVector) {
      this.logger.log(`🔍 Found similar ingredient for "${ingredientName}"`);
      return fallbackVector;
    }

    // If Word2Vec fails or is not available, log but don't fail the entire operation
    if (!this.embeddingsLoaded || !this.ingredientEmbeddings[key]) {
      this.logger.debug(`No embedding found for ingredient: ${ingredientName}`);
    }

    return null;
  }

  private async saveEmbeddingToFile(
    key: string,
    vector: number[],
  ): Promise<void> {
    try {
      // Validate input
      if (!key || !Array.isArray(vector) || vector.length === 0) {
        this.logger.warn(`Invalid embedding data for key: ${key}`);
        return;
      }

      // Write the updated embeddings back to the JSON file
      const updatedEmbeddings = { ...this.ingredientEmbeddings };
      updatedEmbeddings[key] = vector;

      await fs.promises.writeFile(
        this.embeddingPath,
        JSON.stringify(updatedEmbeddings, null, 2),
        'utf-8',
      );
      this.logger.debug(`💾 Saved embedding for ${key} to file`);
    } catch (error: any) {
      this.logger.error(
        'Error saving embedding to file:',
        error?.stack || error?.message || 'Unknown error',
      );
    }
  }

  private findSimilarIngredientVector(ingredient: string): number[] | null {
    const normalized = this.normalizeIngredientName(ingredient);

    // Try various matching strategies
    const strategies = [
      // Strategy 1: Exact match with different normalization
      () => {
        const alternatives = [
          ingredient.toLowerCase(),
          ingredient.toLowerCase().replace(/[^a-z]/g, ''),
          ingredient.toLowerCase().replace(/\s+/g, ''),
          normalized.replace(/_/g, ''),
        ];

        for (const alt of alternatives) {
          if (this.ingredientEmbeddings[alt]) {
            this.logger.debug(
              `📍 Found exact alternative: ${alt} for ${ingredient}`,
            );
            return this.ingredientEmbeddings[alt];
          }
        }
        return null;
      },

      // Strategy 2: Partial word matching
      () => {
        const words = ingredient
          .toLowerCase()
          .split(/[\s\-_()]+/)
          .filter((w) => w.length > 2);

        for (const word of words) {
          // Look for embeddings that contain this word
          for (const [key, embedding] of Object.entries(
            this.ingredientEmbeddings,
          )) {
            if (key.includes(word) || word.includes(key.replace(/_/g, ''))) {
              this.logger.debug(
                `📍 Found partial match: ${key} for ${ingredient} (word: ${word})`,
              );
              return embedding;
            }
          }
        }
        return null;
      },

      // Strategy 3: Common ingredient mappings
      () => {
        const commonMappings: Record<string, string> = {
          beef: 'beef',
          chicken: 'chicken',
          pork: 'pork',
          tomato: 'tomatoes',
          onion: 'onions',
          garlic: 'garlic',
          olive_oil: 'oil',
          vegetable_oil: 'oil',
          salt: 'salt',
          pepper: 'pepper',
          basil: 'basil',
          oregano: 'oregano',
          thyme: 'thyme',
          paprika: 'paprika',
          cumin: 'cumin',
          ginger: 'ginger',
          lemon: 'lemon',
          lime: 'lime',
          butter: 'butter',
          cheese: 'cheese',
          milk: 'milk',
          cream: 'cream',
          flour: 'flour',
          sugar: 'sugar',
          egg: 'eggs',
          rice: 'rice',
          pasta: 'pasta',
          bread: 'bread',
          potato: 'potatoes',
          carrot: 'carrots',
          celery: 'celery',
          bell_pepper: 'pepper',
          mushroom: 'mushrooms',
          spinach: 'spinach',
        };

        // Check if any part of the ingredient matches common mappings
        const words = normalized.split('_');
        for (const word of words) {
          if (
            commonMappings[word] &&
            this.ingredientEmbeddings[commonMappings[word]]
          ) {
            this.logger.debug(
              `📍 Found common mapping: ${commonMappings[word]} for ${ingredient}`,
            );
            return this.ingredientEmbeddings[commonMappings[word]];
          }
        }

        // Check reverse mappings
        for (const [common, mapped] of Object.entries(commonMappings)) {
          if (
            normalized.includes(common) &&
            this.ingredientEmbeddings[mapped]
          ) {
            this.logger.debug(
              `📍 Found reverse mapping: ${mapped} for ${ingredient}`,
            );
            return this.ingredientEmbeddings[mapped];
          }
        }

        return null;
      },
    ];

    // Try each strategy in order
    for (const strategy of strategies) {
      const result = strategy();
      if (result) {
        return result;
      }
    }

    return null;
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

      // Store recipe with vectors (will be calculated later)
      this.recipeVectors.push({
        recipe,
        vector: [], // TF-IDF vector
        ingredientVector: [], // Ingredient embedding vector
      });
    } catch (error) {
      this.logger.error(`Error processing recipe ${recipe.id}`, error.stack);
    }
  }

  private async calculateRecipeVectors() {
    this.logger.log('Calculating vectors for all recipes...');

    if (!this.tfidf || this.tfidf.documents.length === 0) {
      this.logger.error('❌ TF-IDF model not properly initialized');
      return;
    }

    // Get all unique terms for consistent vocabulary
    const allTerms = new Set<string>();
    for (let i = 0; i < this.tfidf.documents.length; i++) {
      this.tfidf.listTerms(i).forEach((item) => allTerms.add(item.term));
    }
    const vocabulary = Array.from(allTerms).sort();

    for (let i = 0; i < this.recipeVectors.length; i++) {
      const recipeVector = this.recipeVectors[i];

      // Calculate TF-IDF vector
      const tfidfVector: number[] = new Array(vocabulary.length).fill(0);
      vocabulary.forEach((term, index) => {
        tfidfVector[index] = this.tfidf.tfidf(term, i);
      });
      recipeVector.vector = tfidfVector;

      // Calculate ingredient embedding vector (average of all ingredient embeddings)
      const ingredientVectorPromises = recipeVector.recipe.ingredients.map(
        (ing) => this.getIngredientVector(ing.name),
      );
      const ingredientVectors = (
        await Promise.all(ingredientVectorPromises)
      ).filter((vec): vec is number[] => vec !== null);

      if (ingredientVectors.length > 0) {
        const avgVector = new Array(ingredientVectors[0].length).fill(0);
        ingredientVectors.forEach((vec) => {
          vec.forEach((val, idx) => {
            avgVector[idx] += val;
          });
        });
        // Average the vectors
        recipeVector.ingredientVector = avgVector.map(
          (val) => val / ingredientVectors.length,
        );
      }

      if (i % 100 === 0) {
        this.logger.debug(
          `Calculated vectors for ${i + 1}/${this.recipeVectors.length} recipes`,
        );
      }
    }

    this.logger.log(
      `✅ Calculated vectors for ${this.recipeVectors.length} recipes`,
    );
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    const dotProduct = vecA.reduce(
      (sum, val, i) => sum + val * (vecB[i] || 0),
      0,
    );
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private calculateIngredientSimilarity(
    queryIngredients: string[],
    recipeIngredients: string[],
  ): number {
    if (queryIngredients.length === 0 || recipeIngredients.length === 0) {
      return 0;
    }

    // Normalize ingredient names for comparison
    const normalizeIngredient = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '');

    const normalizedQuery = queryIngredients.map(normalizeIngredient);
    const normalizedRecipe = recipeIngredients.map(normalizeIngredient);

    let exactMatches = 0;
    let partialMatches = 0;

    for (const queryIng of normalizedQuery) {
      // Check for exact match
      if (normalizedRecipe.includes(queryIng)) {
        exactMatches++;
      } else {
        // Check for partial match (contains)
        const partialMatch = normalizedRecipe.some(
          (recipeIng) =>
            recipeIng.includes(queryIng) || queryIng.includes(recipeIng),
        );
        if (partialMatch) {
          partialMatches++;
        }
      }
    }

    // Calculate Jaccard similarity with weighted matches
    const totalMatches = exactMatches + partialMatches * 0.5;
    const totalPossible = queryIngredients.length;

    return totalMatches / totalPossible;
  }

  private async calculateEmbeddingSimilarity(
    queryIngredients: string[],
    recipeIngredients: string[],
  ): Promise<number> {
    if (queryIngredients.length === 0 || recipeIngredients.length === 0) {
      return 0;
    }

    // Get embeddings for query ingredients (now async)
    const queryVectorPromises = queryIngredients.map((ing) =>
      this.getIngredientVector(ing),
    );
    const queryVectors = (await Promise.all(queryVectorPromises)).filter(
      (vec): vec is number[] => vec !== null,
    );

    // Get embeddings for recipe ingredients (now async)
    const recipeVectorPromises = recipeIngredients.map((ing) =>
      this.getIngredientVector(ing),
    );
    const recipeVectors = (await Promise.all(recipeVectorPromises)).filter(
      (vec): vec is number[] => vec !== null,
    );

    // Log embedding success rates
    const querySuccessRate =
      (queryVectors.length / queryIngredients.length) * 100;
    const recipeSuccessRate =
      (recipeVectors.length / recipeIngredients.length) * 100;

    if (
      queryVectors.length < queryIngredients.length ||
      recipeVectors.length < recipeIngredients.length
    ) {
      this.logger.debug(
        `📊 Embedding coverage - Query: ${querySuccessRate.toFixed(1)}% (${queryVectors.length}/${queryIngredients.length}), Recipe: ${recipeSuccessRate.toFixed(1)}% (${recipeVectors.length}/${recipeIngredients.length})`,
      );
    }

    if (queryVectors.length === 0 || recipeVectors.length === 0) {
      this.logger.debug(
        `⚠️ No valid embeddings found - Query vectors: ${queryVectors.length}, Recipe vectors: ${recipeVectors.length}`,
      );
      return 0;
    }

    // Calculate max similarity between any query ingredient and any recipe ingredient
    let maxSimilarity = 0;
    for (const qVec of queryVectors) {
      for (const rVec of recipeVectors) {
        const similarity = this.cosineSimilarity(qVec, rVec);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    return maxSimilarity;
  }

  private calculateCuisineCompatibility(
    queryIngredients: string[],
    recipe: Recipe,
  ): number {
    // Simple cuisine compatibility based on ingredient-cuisine associations
    const cuisineIngredients = {
      Italian: ['tomato', 'basil', 'mozzarella', 'parmesan', 'olive', 'garlic'],
      Mexican: ['chili', 'cumin', 'lime', 'cilantro', 'jalapeño', 'avocado'],
      Indian: ['turmeric', 'cumin', 'coriander', 'garam masala', 'cardamom'],
      Asian: ['soy sauce', 'ginger', 'sesame', 'rice', 'noodles'],
    };

    const recipeCuisineIngredients = cuisineIngredients[recipe.cuisine] || [];
    const matches = queryIngredients.filter((ing) =>
      recipeCuisineIngredients.some((cui) =>
        ing.toLowerCase().includes(cui.toLowerCase()),
      ),
    );

    return matches.length / Math.max(queryIngredients.length, 1);
  }

  private calculateIngredientRarityBonus(recipeIngredients: string[]): number {
    // Common ingredients that appear in many recipes
    const commonIngredients = [
      'salt',
      'pepper',
      'oil',
      'water',
      'flour',
      'sugar',
      'butter',
      'onion',
      'garlic',
      'tomato',
      'egg',
      'milk',
      'cheese',
    ];

    const totalIngredients = recipeIngredients.length;
    if (totalIngredients === 0) return 0;

    const rareIngredients = recipeIngredients.filter(
      (ing) =>
        !commonIngredients.some((common) =>
          ing.toLowerCase().includes(common.toLowerCase()),
        ),
    );

    // Calculate rarity ratio: more rare ingredients = higher bonus
    const rarityRatio = rareIngredients.length / totalIngredients;

    // Scale to 0-1 range, giving higher bonus for more unique recipes
    return Math.min(rarityRatio * 1.5, 1.0);
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
      this.model = null;
    } catch (error: any) {
      this.logger.error('Error loading collaborative model', error.stack);
      this.model = null;
    }
  }

  private async getContentBasedRecommendations(
    ingredientIds: string[],
    limit: number,
    excludeRecipeIds: string[] = [],
    minScore: number = 0.6,
  ): Promise<RecommendationItemDto[]> {
    try {
      this.logger.log(
        `🔍 Content-based recommendation started (threshold: ${minScore})`,
      );
      this.logger.log(`📋 Input ingredient IDs: ${ingredientIds.join(', ')}`);

      // Get ingredients for the query
      const ingredients = await this.ingredientRepository.find({
        where: { id: In(ingredientIds) },
      });

      this.logger.log(
        `✅ Found ${ingredients.length}/${ingredientIds.length} ingredients in database`,
      );

      if (ingredients.length === 0) {
        this.logger.warn(
          `❌ No valid ingredients found for IDs: ${ingredientIds.join(', ')}`,
        );
        return [];
      }

      const queryIngredientNames = ingredients.map((i) => i.name);
      this.logger.log(
        `🥬 Query ingredients: ${queryIngredientNames.join(', ')}`,
      );

      this.logger.log(`🗂️ Total recipe vectors: ${this.recipeVectors.length}`);
      this.logger.log(
        `🚫 Excluding recipe IDs: ${excludeRecipeIds.length > 0 ? excludeRecipeIds.join(', ') : 'none'}`,
      );

      const availableRecipes = this.recipeVectors.filter(
        (rv) => !excludeRecipeIds.includes(rv.recipe.id),
      );

      // Debug: Log which recipes are available
      availableRecipes.forEach((rv) => {
        this.logger.log(
          `📋 Available recipe: "${rv.recipe.title}" (ID: ${rv.recipe.id})`,
        );
      });

      this.logger.log(
        `🍳 Available recipes after exclusion: ${availableRecipes.length}`,
      );

      const allScoredRecipes = await Promise.all(
        availableRecipes.map(async (rv) => {
          const recipeIngredientNames = rv.recipe.ingredients.map(
            (i) => i.name,
          );

          // 1. Exact ingredient matching (40% weight)
          const exactScore = this.calculateIngredientSimilarity(
            queryIngredientNames,
            recipeIngredientNames,
          );

          // 2. Semantic similarity using embeddings (30% weight)
          const embeddingScore = await this.calculateEmbeddingSimilarity(
            queryIngredientNames,
            recipeIngredientNames,
          );

          // 3. Recipe quality factors (20% weight)
          const qualityScore = Math.min(
            (rv.recipe.averageRating / 5.0) * 0.7 +
              (Math.min(rv.recipe.reviewCount, 100) / 100) * 0.3,
            1.0,
          );

          // 4. Ingredient rarity bonus (10% weight)
          const rarityBonus = this.calculateIngredientRarityBonus(
            recipeIngredientNames,
          );

          // Combine all factors
          const finalScore =
            exactScore * 0.4 +
            embeddingScore * 0.3 +
            qualityScore * 0.2 +
            rarityBonus * 0.1;

          if (finalScore > 0.01) {
            this.logger.log(`📈 ${rv.recipe.title}:`);
            this.logger.log(
              `   - Exact: ${exactScore.toFixed(3)} | Embedding: ${embeddingScore.toFixed(3)} | Quality: ${qualityScore.toFixed(3)} | Rarity: ${rarityBonus.toFixed(3)}`,
            );
            this.logger.log(`   - Final: ${finalScore.toFixed(3)}`);
            this.logger.log(
              `   - Recipe ingredients: ${recipeIngredientNames.join(', ')}`,
            );
          }

          this.logger.log(
            `🔢 Recipe "${rv.recipe.title}" final score: ${finalScore.toFixed(3)}`,
          );

          return {
            recipe: rv.recipe,
            score: finalScore,
          };
        }),
      );

      const scoredRecipes = allScoredRecipes
        .filter((item) => {
          const meetsThreshold = item.score >= minScore;
          if (!meetsThreshold) {
            this.logger.log(
              `[Content Filter] ${item.recipe.title}: ${item.score.toFixed(3)} < ${minScore} ❌`,
            );
          } else {
            this.logger.log(
              `[Content Filter] ${item.recipe.title}: ${item.score.toFixed(3)} >= ${minScore} ✅`,
            );
          }
          return meetsThreshold;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(
        `🎯 Final content recommendations with threshold >= ${minScore}: ${scoredRecipes.length}`,
      );

      if (scoredRecipes.length > 0) {
        this.logger.log(
          `🏆 Top recommendation: ${scoredRecipes[0].recipe.title} (${scoredRecipes[0].score.toFixed(3)})`,
        );
      }

      return scoredRecipes.map((item) => ({
        recipe: item.recipe,
        score: item.score,
        type: 'content' as const,
        reason: `Similar to ingredients: ${queryIngredientNames.join(', ')}`,
      }));
    } catch (error: any) {
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
      const similarUsers = await this.findSimilarUsers(userId, 20);

      if (similarUsers.length === 0) {
        this.logger.warn(
          `No similar users found for user ${userId}, falling back to popular recipes`,
        );
        return this.getFallbackRecommendations(
          limit,
          excludeRecipeIds,
          filters,
        );
      }

      this.logger.log(
        `Found ${similarUsers.length} similar users for collaborative filtering`,
      );

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
            continue;
          }

          if (!candidateRecipes.has(recipeId)) {
            candidateRecipes.set(recipeId, { score: 0, reason: [] });
          }

          const candidate = candidateRecipes.get(recipeId)!;
          candidate.score += similarUser.similarity;
          candidate.reason.push(`${similarUser.commonLikes} common likes`);
        }
      }

      const recipeIds = Array.from(candidateRecipes.keys()).slice(0, limit * 2);

      if (recipeIds.length === 0) {
        this.logger.warn('No candidate recipes found from similar users');
        return this.getFallbackRecommendations(
          limit,
          excludeRecipeIds,
          filters,
        );
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
            score: candidate.score / similarUsers.length,
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
    const minScore = filters.minScore ?? this.MIN_COLLABORATIVE_SCORE;

    if (minScore >= 0.6) {
      this.logger.warn(
        `High collaborative threshold (${minScore}) - no fallback recommendations provided.`,
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
      score: Math.max(0.4 - index * 0.05, 0.1),
      type: 'collaborative' as const,
      reason:
        'Popular recipe (insufficient user data for collaborative filtering)',
    }));

    this.logger.log(
      `Generated ${fallbackRecommendations.length} fallback recommendations`,
    );

    return fallbackRecommendations;
  }

  private async getHybridRecommendations(
    contentRecs: RecommendationItemDto[],
    collabRecs: RecommendationItemDto[],
    limit: number,
    minScore: number = 0.6,
  ): Promise<RecommendationItemDto[]> {
    try {
      this.logger.log(`🔀 Starting hybrid recommendation generation`);
      this.logger.log(
        `📊 Input: ${contentRecs.length} content + ${collabRecs.length} collaborative`,
      );

      if (contentRecs.length === 0 && collabRecs.length === 0) {
        this.logger.warn(`⚠️ No input recommendations for hybrid filtering`);
        return [];
      }

      const combined = [...contentRecs, ...collabRecs];
      const recipeMap = new Map<string, RecommendationItemDto>();

      combined.forEach((rec) => {
        const existing = recipeMap.get(rec.recipe.id);
        if (existing) {
          // Weighted combination: content-based gets 60%, collaborative gets 40%
          const newScore =
            rec.type === 'content'
              ? existing.score * 0.4 + rec.score * 0.6
              : existing.score * 0.6 + rec.score * 0.4;

          existing.score = newScore;
          existing.type = 'hybrid';
          existing.reason = `Hybrid: ${existing.reason} + ${rec.reason}`;
        } else {
          recipeMap.set(rec.recipe.id, { ...rec });
        }
      });

      const hybridRecommendations = Array.from(recipeMap.values())
        .filter(({ score, recipe }) => {
          const meetsThreshold = score >= minScore;
          if (!meetsThreshold) {
            this.logger.log(
              `[Hybrid Filter] ${recipe.title}: ${score.toFixed(3)} < ${minScore} ❌`,
            );
          } else {
            this.logger.log(
              `[Hybrid Filter] ${recipe.title}: ${score.toFixed(3)} >= ${minScore} ✅`,
            );
          }
          return meetsThreshold;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      this.logger.log(
        `✅ Generated ${hybridRecommendations.length} hybrid recommendations (min score: ${minScore})`,
      );

      return hybridRecommendations;
    } catch (error: any) {
      this.logger.error('Error in collaborative recommendations', error.stack);
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

      this.logger.log(
        `🔍 Starting recommendation generation for user ${userId}`,
      );
      this.logger.log(
        `📊 Request: content=${includeContentBased}, collaborative=${includeCollaborative}, hybrid=${includeHybrid}`,
      );

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
              filters.minCosineSimilarity ?? 0.6,
            )
          : [],
        includeCollaborative
          ? this.getCollaborativeRecommendations(
              userId,
              limit * 2,
              excludeRecipeIds,
              { minScore: filters.minCosineSimilarity },
            )
          : [],
      ]);

      this.logger.log(`📈 Content recommendations: ${contentRecs.length}`);
      this.logger.log(`👥 Collaborative recommendations: ${collabRecs.length}`);

      // Get hybrid recommendations if enabled
      const hybridRecs =
        includeHybrid && (contentRecs.length > 0 || collabRecs.length > 0)
          ? await this.getHybridRecommendations(
              contentRecs,
              collabRecs,
              limit * 2,
              filters.minCosineSimilarity ?? 0.6,
            )
          : [];

      this.logger.log(`🔀 Hybrid recommendations: ${hybridRecs.length}`);

      // Combine all recommendations
      let allRecommendations: RecommendationItemDto[] = [];

      if (includeHybrid && hybridRecs.length > 0) {
        this.logger.log(
          `Using hybrid recommendations (${hybridRecs.length} recipes)`,
        );
        allRecommendations = [...hybridRecs];
      } else {
        if (includeContentBased) {
          this.logger.log(
            `Adding ${contentRecs.length} content-based recommendations`,
          );
          allRecommendations.push(...contentRecs);
        }
        if (includeCollaborative) {
          this.logger.log(
            `Adding ${collabRecs.length} collaborative recommendations`,
          );
          allRecommendations.push(...collabRecs);
        }
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
