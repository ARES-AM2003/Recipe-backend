import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { Recipe } from '../../src/recipes/entities/recipe.entity';
import { User } from '../../src/users/entities/user.entity';
import { Ingredient } from '../../src/ingredients/entities/ingredient.entity';
import { UserRole } from '../../src/common/enums/user-role.enum';

describe('RecipesController (e2e)', () => {
  let app: INestApplication;
  let recipeRepository: Repository<Recipe>;
  let userRepository: Repository<User>;
  let ingredientRepository: Repository<Ingredient>;
  let jwtService: JwtService;
  let accessToken: string;
  let adminAccessToken: string;
  let testUser: User;
  let testAdmin: User;
  let testIngredient: Ingredient;
  let testRecipe: Recipe;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    recipeRepository = moduleFixture.get<Repository<Recipe>>(getRepositoryToken(Recipe));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    ingredientRepository = moduleFixture.get<Repository<Ingredient>>(getRepositoryToken(Ingredient));
    jwtService = moduleFixture.get<JwtService>(JwtService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);

    // Create test data
    testUser = await userRepository.save({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedPassword',
      role: UserRole.USER,
    });

    testAdmin = await userRepository.save({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'hashedPassword',
      role: UserRole.ADMIN,
    });

    testIngredient = await ingredientRepository.save({
      name: 'Test Ingredient',
      description: 'Test Description',
      category: 'test',
      calories: 100,
      protein: 10,
      carbs: 5,
      fat: 2,
      fiber: 1,
      sugar: 1,
      sodium: 100,
      isCommon: true,
    });

    // Generate JWT tokens
    accessToken = jwtService.sign(
      { sub: testUser.id, email: testUser.email, role: testUser.role },
      { secret: configService.get('JWT_ACCESS_SECRET') },
    );

    adminAccessToken = jwtService.sign(
      { sub: testAdmin.id, email: testAdmin.email, role: testAdmin.role },
      { secret: configService.get('JWT_ACCESS_SECRET') },
    );
  });

  afterAll(async () => {
    await recipeRepository.delete({});
    await ingredientRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('POST /recipes', () => {
    it('should create a new recipe', async () => {
      const createRecipeDto = {
        title: 'Test Recipe',
        description: 'Test Description',
        instructions: ['Step 1', 'Step 2'],
        prepTime: 10,
        cookTime: 20,
        servings: 4,
        cuisine: 'Test Cuisine',
        mealType: 'lunch',
        tags: ['test', 'easy'],
        calories: 300,
        protein: 20,
        carbs: 30,
        fat: 10,
        fiber: 5,
        sugar: 5,
        sodium: 500,
        ingredients: [
          {
            ingredientId: testIngredient.id,
            amount: 100,
            unit: 'g',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/recipes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createRecipeDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(createRecipeDto.title);
      expect(response.body.author.id).toBe(testUser.id);

      // Save the recipe for later tests
      testRecipe = response.body;
    });

    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/recipes')
        .send({})
        .expect(401);
    });
  });

  describe('GET /recipes', () => {
    it('should return an array of recipes', async () => {
      const response = await request(app.getHttpServer())
        .get('/recipes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter recipes by title', async () => {
      const response = await request(app.getHttpServer())
        .get('/recipes?search=Test Recipe')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].title).toContain('Test Recipe');
    });
  });

  describe('GET /recipes/:id', () => {
    it('should return a single recipe by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/recipes/${testRecipe.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testRecipe.id);
      expect(response.body.title).toBe(testRecipe.title);
    });

    it('should return 404 if recipe not found', async () => {
      await request(app.getHttpServer())
        .get('/recipes/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /recipes/:id', () => {
    it('should update a recipe', async () => {
      const updateData = {
        title: 'Updated Test Recipe',
        description: 'Updated Description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/recipes/${testRecipe.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
    });

    it('should return 403 if user is not the author', async () => {
      // Create another user
      const otherUser = await userRepository.save({
        name: 'Other User',
        email: 'other@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
      });

      const otherUserToken = jwtService.sign(
        { sub: otherUser.id, email: otherUser.email, role: otherUser.role },
        { secret: process.env.JWT_ACCESS_SECRET },
      );

      await request(app.getHttpServer())
        .patch(`/recipes/${testRecipe.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);

      // Clean up
      await userRepository.delete(otherUser.id);
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('should delete a recipe', async () => {
      // Create a recipe to delete
      const recipeToDelete = await recipeRepository.save({
        title: 'Recipe to Delete',
        description: 'Will be deleted',
        author: testUser,
        instructions: [],
        prepTime: 10,
        cookTime: 10,
        servings: 2,
      });

      await request(app.getHttpServer())
        .delete(`/recipes/${recipeToDelete.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify deletion
      const deletedRecipe = await recipeRepository.findOne({ where: { id: recipeToDelete.id } });
      expect(deletedRecipe).toBeNull();
    });

    it('should allow admin to delete any recipe', async () => {
      // Create a recipe as regular user
      const userRecipe = await recipeRepository.save({
        title: 'User Recipe',
        description: 'Will be deleted by admin',
        author: testUser,
        instructions: [],
        prepTime: 5,
        cookTime: 5,
        servings: 1,
      });

      await request(app.getHttpServer())
        .delete(`/recipes/${userRecipe.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      // Verify deletion
      const deletedRecipe = await recipeRepository.findOne({ where: { id: userRecipe.id } });
      expect(deletedRecipe).toBeNull();
    });
  });

  describe('POST /recipes/:id/like', () => {
    it('should like a recipe', async () => {
      const recipe = await recipeRepository.save({
        title: 'Recipe to Like',
        description: 'Test like functionality',
        author: testUser,
        instructions: [],
        prepTime: 5,
        cookTime: 5,
        servings: 1,
      });

      await request(app.getHttpServer())
        .post(`/recipes/${recipe.id}/like`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Verify like was added
      const updatedRecipe = await recipeRepository.findOne({
        where: { id: recipe.id },
        relations: ['likedBy'],
      });
      
      expect(updatedRecipe.likedBy.some(user => user.id === testUser.id)).toBe(true);
    });
  });
});
