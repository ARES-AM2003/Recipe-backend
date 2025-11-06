import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { PantryItem } from '../pantry/entities/pantry-item.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as word2vec from 'word2vec';

interface RecommendationFilters {
  difficulty?: string;
  cuisine?: string;
  mealType?: string;
  maxPrepTime?: number; // Total time: prepTime + cookTime
  minRating?: number;
  tags?: string[];
  minCosineSimilarity?: number;
}

@Injectable()
export class RecommendationVecService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationVecService.name);
  private embeddings: Record<string, number[]> = {};
  private embeddingsLoaded = false;
  private word2vecModel: any = null;
  private word2vecLoaded = false;
  private embeddingPath: string;
  private readonly MIN_COSINE_SIMILARITY = 0.35;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Recipe) private recipesRepo: Repository<Recipe>,
    @InjectRepository(PantryItem) private pantryRepo: Repository<PantryItem>,
  ) {}

  async onModuleInit() {
    await this.initializeEmbeddings();
  }

  private async initializeEmbeddings(forceReload: boolean = false) {
    if (this.embeddingsLoaded && !forceReload) return;

    this.embeddingPath = path.resolve(
      __dirname,
      '../../ingredients/ingredents-embeddings/ingredient_embeddings.json',
    );

    if (!fs.existsSync(this.embeddingPath)) {
      throw new Error('Embedding file not found at ' + this.embeddingPath);
    }

    this.embeddings = JSON.parse(fs.readFileSync(this.embeddingPath, 'utf-8'));
    this.embeddingsLoaded = true;
    this.logger.log(
      `✅ Loaded embeddings for ${Object.keys(this.embeddings).length} ingredients`,
    );

    // Load Word2Vec model
    await this.loadWord2VecModel();
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

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  private normalizeIngredient(word: string) {
    return word.toLowerCase().replace(/\s+/g, '_');
  }

  private async getVector(word: string): Promise<number[] | null> {
    const key = this.normalizeIngredient(word);

    // First, check if embedding exists in JSON
    if (this.embeddingsLoaded && this.embeddings[key]) {
      this.logger.debug(`📋 Found cached embedding for: ${word}`);
      return this.embeddings[key];
    }

    // If not found in JSON and Word2Vec model is available, calculate using Word2Vec
    if (this.word2vecLoaded && this.word2vecModel) {
      try {
        // Add timeout to prevent hanging on getVector calls
        const vectorPromise = new Promise<number[] | null>((resolve) => {
          this.word2vecModel.getVector(word, (error: any, vector: number[]) => {
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
          });
        });

        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 2000); // 2 second timeout for individual queries
        });

        const vector = await Promise.race([vectorPromise, timeoutPromise]);

        if (vector && Array.isArray(vector)) {
          // Cache the new embedding in memory and save to JSON
          this.embeddings[key] = vector;
          await this.saveEmbeddingToFile(key, vector);
          this.logger.log(
            `🔄 Generated and cached embedding for ingredient: ${word} (length: ${vector.length})`,
          );
          return vector;
        } else {
          this.logger.debug(
            `🚫 Word2Vec model returned no vector for: ${word}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to generate embedding for ${word}:`,
          error?.message || 'Unknown error',
        );
      }
    }

    // Smart fallback: Try to find similar ingredients in the existing embeddings
    const fallbackVector = this.findSimilarIngredientVector(word);
    if (fallbackVector) {
      this.logger.log(`🔍 Found similar ingredient for "${word}"`);
      return fallbackVector;
    }

    // If Word2Vec fails or is not available, log but don't fail the entire operation
    if (!this.embeddingsLoaded || !this.embeddings[key]) {
      this.logger.debug(`No embedding found for ingredient: ${word}`);
    }

    return null;
  }

  private findSimilarIngredientVector(ingredient: string): number[] | null {
    const normalized = this.normalizeIngredient(ingredient);

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
          if (this.embeddings[alt]) {
            this.logger.debug(
              `📍 Found exact alternative: ${alt} for ${ingredient}`,
            );
            return this.embeddings[alt];
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
          for (const [key, embedding] of Object.entries(this.embeddings)) {
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
          if (commonMappings[word] && this.embeddings[commonMappings[word]]) {
            this.logger.debug(
              `📍 Found common mapping: ${commonMappings[word]} for ${ingredient}`,
            );
            return this.embeddings[commonMappings[word]];
          }
        }

        // Check reverse mappings
        for (const [common, mapped] of Object.entries(commonMappings)) {
          if (normalized.includes(common) && this.embeddings[mapped]) {
            this.logger.debug(
              `📍 Found reverse mapping: ${mapped} for ${ingredient}`,
            );
            return this.embeddings[mapped];
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
      const updatedEmbeddings = { ...this.embeddings };
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

  async getRecommendations(
    userId: string,
    filters: RecommendationFilters = {},
  ): Promise<Recipe[]> {
    await this.initializeEmbeddings();

    // Log incoming filters
    this.logger.log('🔍 Incoming filters:', JSON.stringify(filters));
    if (filters.maxPrepTime) {
      this.logger.log(
        `⏱️ Max prep time filter: ${filters.maxPrepTime} minutes (total time)`,
      );
    }

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['pantryItems', 'pantryItems.ingredient'],
    });
    if (!user) throw new Error('User not found');

    const userAllergies = (user.allergies || []).map((a) =>
      a
        .replace(/[\[\]']+/g, '')
        .trim()
        .toLowerCase(),
    );

    console.log('🧾 Cleaned User allergies:', userAllergies);

    const pantryIngredients =
      user.pantryItems?.map((pi) => pi.ingredient.name.toLowerCase()) || [];

    console.log('🧾 User allergies:', userAllergies);
    console.log('🥫 User pantry:', pantryIngredients);

    const allRecipes = await this.recipesRepo.find({
      relations: ['ingredients'],
    });

    // Filter out unsafe recipes
    const safeRecipes = allRecipes.filter(
      (r) =>
        !r.ingredients.some((ing) =>
          userAllergies.some((allergy) =>
            ing.name.toLowerCase().includes(allergy),
          ),
        ),
    );
    console.log('✅ Safe recipes count:', safeRecipes.length);

    // Map pantry ingredients to vectors (now async)
    const pantryVectorPromises = pantryIngredients.map((i) =>
      this.getVector(i),
    );
    const pantryVectors = (await Promise.all(pantryVectorPromises)).filter(
      (v): v is number[] => v !== null,
    );

    if (!pantryVectors.length) {
      console.warn(
        '⚠️ No pantry ingredient embeddings found. Recommendations will be based only on filters.',
      );
    }

    // Score recipes and filter by minimum cosine similarity
    const minSimilarity =
      filters.minCosineSimilarity ?? this.MIN_COSINE_SIMILARITY;

    const allScoredRecipes = await Promise.all(
      safeRecipes.map(async (recipe) => {
        const recipeVectorPromises = recipe.ingredients.map((i) =>
          this.getVector(i.name),
        );
        const recipeVectors = (await Promise.all(recipeVectorPromises)).filter(
          (v): v is number[] => v !== null,
        );

        if (!recipeVectors.length || !pantryVectors.length)
          return { recipe, score: 0 };

        const score =
          recipeVectors.reduce((sum, rVec) => {
            const maxSim = pantryVectors.reduce(
              (max, pVec) => Math.max(max, this.cosineSimilarity(pVec, rVec)),
              0,
            );
            return sum + maxSim;
          }, 0) / recipeVectors.length;

        return { recipe, score };
      }),
    );

    const scoredRecipes = allScoredRecipes.filter(({ score, recipe }) => {
      // Filter out recipes with cosine similarity below threshold
      const meetsThreshold = score >= minSimilarity;
      if (!meetsThreshold) {
        console.log(
          `[Similarity Filter] ${recipe.title}: ${score.toFixed(3)} < ${minSimilarity} ❌`,
        );
      } else {
        console.log(
          `[Similarity Filter] ${recipe.title}: ${score.toFixed(3)} >= ${minSimilarity} ✅`,
        );
      }
      return meetsThreshold;
    });

    console.log(
      `📊 Recipes with similarity >= ${minSimilarity}:`,
      scoredRecipes.length,
    );
    console.log(scoredRecipes);

    // Apply other filters and log
    const filteredRecipes = scoredRecipes
      .filter(({ recipe }) => {
        let passed = true;

        if (filters.difficulty) {
          if (recipe.difficulty !== filters.difficulty) {
            console.log(`[Filter] ${recipe.title} ❌ difficulty`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ difficulty`);
          }
        }

        if (filters.cuisine) {
          if (recipe.cuisine !== filters.cuisine) {
            console.log(`[Filter] ${recipe.title} ❌ cuisine`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ cuisine`);
          }
        }

        if (filters.mealType) {
          if (recipe.mealType !== filters.mealType) {
            console.log(`[Filter] ${recipe.title} ❌ mealType`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ mealType`);
          }
        }

        if (filters.maxPrepTime) {
          const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
          if (totalTime > filters.maxPrepTime) {
            this.logger.log(
              `[Filter] ${recipe.title} ❌ maxPrepTime (prep:${recipe.prepTime}, cook:${recipe.cookTime}, total:${totalTime} > ${filters.maxPrepTime})`,
            );
            passed = false;
          } else {
            this.logger.log(
              `[Filter] ${recipe.title} ✅ maxPrepTime (prep:${recipe.prepTime}, cook:${recipe.cookTime}, total:${totalTime} <= ${filters.maxPrepTime})`,
            );
          }
        }

        if (filters.minRating) {
          if (recipe.averageRating < filters.minRating) {
            console.log(`[Filter] ${recipe.title} ❌ minRating`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ minRating`);
          }
        }

        if (filters.tags && filters.tags.length > 0) {
          if (!recipe.tags?.some((t) => filters.tags?.includes(t))) {
            console.log(`[Filter] ${recipe.title} ❌ tags`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ tags`);
          }
        }

        return passed;
      })
      .sort((a, b) => {
        const diff = b.score - a.score;
        if (diff !== 0) return diff;
        return b.recipe.averageRating - a.recipe.averageRating;
      });

    return filteredRecipes.map((r) => r.recipe);
  }

  /**
   * Reload embeddings from file without restarting the server
   * Useful when new ingredients are added to the system
   */
  async reloadEmbeddings(): Promise<{
    success: boolean;
    ingredientCount: number;
    message: string;
  }> {
    try {
      this.logger.log('🔄 Reloading embeddings from file...');

      // Force reload embeddings
      this.embeddingsLoaded = false;
      await this.initializeEmbeddings(true);

      const count = Object.keys(this.embeddings).length;

      return {
        success: true,
        ingredientCount: count,
        message: `Successfully reloaded ${count} ingredient embeddings`,
      };
    } catch (error: any) {
      this.logger.error('Error reloading embeddings', error?.stack || error);
      return {
        success: false,
        ingredientCount: 0,
        message: `Failed to reload embeddings: ${error?.message || 'Unknown error'}`,
      };
    }
  }
}
