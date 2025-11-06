# Smart Recipe Recommendation System - API Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Database Schema](#database-schema)
5. [API Modules & Endpoints](#api-modules--endpoints)
6. [Recommendation Engine](#recommendation-engine)
7. [Technology Stack](#technology-stack)
8. [Setup & Installation](#setup--installation)
9. [Environment Configuration](#environment-configuration)

---

## 📖 Project Overview

The Smart Recipe Recommendation System is a NestJS-based REST API that provides intelligent recipe recommendations using multiple recommendation algorithms including:
- **Content-Based Filtering** (TF-IDF + Word2Vec embeddings)
- **Collaborative Filtering** (User-based similarity)
- **Hybrid Recommendations** (Combined approach)

### Key Features
- User authentication with JWT (cookies-based)
- Recipe management (CRUD operations)
- Pantry management for ingredient tracking
- Nutritional analysis and filtering
- Multiple recommendation strategies
- Recipe likes, ratings, and saves
- Bulk operations via Excel upload
- Web scraping for recipe extraction

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│         (Frontend Apps, Mobile Apps, API Consumers)              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/HTTPS Requests
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NestJS Application (Port 3001)                          │   │
│  │  - CORS Enabled                                          │   │
│  │  - Cookie Parser (JWT Authentication)                    │   │
│  │  - Request Validation & Transformation                   │   │
│  │  - Rate Limiting (100 req/60s)                          │   │
│  │  - Global Exception Handling                            │   │
│  │  - Swagger Documentation (/api/docs)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE LAYER                               │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐              │
│  │ JWT Guard  │  │ Roles      │  │ Throttler    │              │
│  │ (Global)   │  │ Guard      │  │ Guard        │              │
│  └────────────┘  └────────────┘  └──────────────┘              │
│  ┌────────────┐  ┌────────────┐                                │
│  │ HTTP       │  │ Transform  │                                │
│  │ Exception  │  │ Interceptor│                                │
│  │ Filter     │  │            │                                │
│  └────────────┘  └────────────┘                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Auth    │ │  Users   │ │ Recipes  │ │ Pantry   │          │
│  │ Module   │ │  Module  │ │  Module  │ │  Module  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐           │
│  │Ingredients│ │Nutrition │ │   Recommendation     │           │
│  │  Module  │ │  Module  │ │      Modules         │           │
│  └──────────┘ └──────────┘ │  - Standard          │           │
│                             │  - Vec (Word2Vec)    │           │
│                             │  - Custom (TF-IDF)   │           │
│                             └──────────────────────┘           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TypeORM Repository Pattern                  │   │
│  │  - Entity Management                                     │   │
│  │  - Query Builder                                         │   │
│  │  - Relationship Handling                                 │   │
│  │  - Transaction Management                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                         │   │
│  │  Tables: users, recipes, ingredients, pantry_items,      │   │
│  │          ratings, saved_recipes, recipe_ingredients      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐               │
│  │ OpenAI   │ │ Web      │ │ TensorFlow.js    │               │
│  │ API      │ │ Scraping │ │ (ML Models)      │               │
│  └──────────┘ └──────────┘ └──────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### DFD Level 0 - Context Diagram

```
                    ┌─────────────────┐
                    │                 │
                    │      User       │
                    │                 │
                    └────────┬────────┘
                             │
                   Authentication Data
                   Recipe Requests
                   Pantry Management
                             │
                             ▼
              ┌──────────────────────────────┐
              │                              │
              │   Smart Recipe              │
              │   Recommendation            │◄──── External Recipe URLs
              │   System                    │
              │                              │
              └──────────────┬───────────────┘
                             │
                    Recommendations
                    Recipe Data
                    Nutritional Info
                             │
                             ▼
                    ┌─────────────────┐
                    │                 │
                    │   PostgreSQL    │
                    │   Database      │
                    │                 │
                    └─────────────────┘
```

### DFD Level 1 - Main Processes

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ Login/Register
     ▼
┌─────────────────────┐         ┌──────────────┐
│  1.0               │         │              │
│  Authentication    │────────►│  User Store  │
│  Process           │         │              │
└─────────┬───────────┘         └──────────────┘
          │
          │ JWT Token
          ▼
┌─────────────────────┐         ┌──────────────┐
│  2.0               │         │              │
│  Recipe Management │◄───────►│ Recipe Store │
│  Process           │         │              │
└─────────┬───────────┘         └──────────────┘
          │
          │ Recipe Data
          ▼
┌─────────────────────┐         ┌──────────────┐
│  3.0               │         │              │
│  Recommendation    │◄───────►│ ML Models    │
│  Engine            │         │ & Vectors    │
└─────────┬───────────┘         └──────────────┘
          │
          │ Recommendations
          ▼
┌─────────────────────┐         ┌──────────────┐
│  4.0               │         │              │
│  Pantry Management │◄───────►│ Pantry Store │
│  Process           │         │              │
└─────────┬───────────┘         └──────────────┘
          │
          │ Available Ingredients
          ▼
┌─────────────────────┐         ┌──────────────┐
│  5.0               │         │              │
│  Nutrition Analysis│◄───────►│ Nutrition    │
│  Process           │         │ Data         │
└────────────────────┘         └──────────────┘
```

### DFD Level 2 - Recommendation Engine Process

```
┌──────────────┐
│   User       │
│   Request    │
└──────┬───────┘
       │
       │ Ingredient IDs, Preferences, Filters
       ▼
┌─────────────────────────────────────────────────────────┐
│          Recommendation Request Handler                  │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Content    │ │Collaborative │ │   Hybrid     │
│   Based      │ │   Filtering  │ │   Engine     │
│   Engine     │ │   Engine     │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────────┐
│        Vector Calculation & Similarity           │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ TF-IDF   │  │ Word2Vec │  │ User-User│      │
│  │ Vectors  │  │Embeddings│  │Similarity│      │
│  └──────────┘  └──────────┘  └──────────┘      │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Score Calculation & Ranking                 │
│  - Cosine Similarity                                    │
│  - Ingredient Match Score                               │
│  - Embedding Similarity                                 │
│  - Quality Score (ratings, reviews)                     │
│  - Rarity Bonus                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Filtering & Post-Processing                 │
│  - Nutrition Filters                                    │
│  - Dietary Preferences                                  │
│  - Allergies                                            │
│  - Exclude Already Saved/Liked                          │
│  - Minimum Score Threshold                              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
                ┌──────────────┐
                │  Ranked      │
                │  Recipe List │
                └──────────────┘
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram (ERD)

```
┌─────────────────────────┐
│        Users            │
├─────────────────────────┤
│ PK  id (UUID)          │
│     email (unique)     │
│     password (hashed)  │
│     name               │
│     role (enum)        │
│     dietaryPreferences │
│     allergies          │
│     createdAt          │
│     updatedAt          │
│     refreshToken       │
└───────────┬─────────────┘
            │
            │ 1:N (author)
            ▼
┌─────────────────────────┐
│       Recipes           │
├─────────────────────────┤
│ PK  id (UUID)          │
│ FK  authorId           │
│     title              │
│     description        │
│     difficulty (enum)  │
│     instructions[]     │
│     prepTime           │
│     cookTime           │
│     servings           │
│     cuisine (enum)     │
│     mealType (enum)    │
│     tags[]             │
│     imageUrl           │
│     averageRating      │
│     reviewCount        │
│     calories           │
│     protein, carbs, etc│
│     createdAt          │
│     updatedAt          │
└───────┬─────────────┬───┘
        │             │
        │ M:N         │ 1:N (ratings)
        │             │
        ▼             ▼
┌─────────────┐  ┌─────────────────┐
│ Ingredients │  │    Ratings      │
├─────────────┤  ├─────────────────┤
│PK id (UUID) │  │PK id (UUID)     │
│  name       │  │FK userId        │
│  description│  │FK recipeId      │
│  category   │  │  value (1-5)    │
│  alternative│  │  comment        │
│  Names[]    │  │  createdAt      │
│  calories   │  │  updatedAt      │
│  protein    │  └─────────────────┘
│  carbs, etc │
│  isCommon   │
│  imageUrl   │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────────────────┐
│     PantryItems         │
├─────────────────────────┤
│ PK  id (UUID)          │
│ FK  userId             │
│ FK  ingredientId       │
│     quantity           │
│     unit (enum)        │
│     expiryDate         │
│     isFavorite         │
│     note               │
│     createdAt          │
│     updatedAt          │
└─────────────────────────┘

┌─────────────────────────┐
│    SavedRecipes         │
├─────────────────────────┤
│ PK  id (UUID)          │
│ FK  userId             │
│ FK  recipeId           │
│     savedAt            │
│ UQ  (userId, recipeId) │
└─────────────────────────┘

┌─────────────────────────┐
│  recipe_ingredients     │
│  (Join Table)           │
├─────────────────────────┤
│ FK  recipeId           │
│ FK  ingredientId       │
└─────────────────────────┘

┌─────────────────────────┐
│  user_liked_recipes     │
│  (Join Table)           │
├─────────────────────────┤
│ FK  userId             │
│ FK  recipeId           │
└─────────────────────────┘
```

### Key Relationships

1. **User ↔ Recipes**: One-to-Many (author relationship)
2. **User ↔ PantryItems**: One-to-Many (user's pantry)
3. **User ↔ SavedRecipes**: One-to-Many (saved recipes)
4. **User ↔ Recipes**: Many-to-Many (liked recipes)
5. **Recipe ↔ Ingredients**: Many-to-Many (recipe ingredients)
6. **Recipe ↔ Ratings**: One-to-Many (recipe ratings)
7. **Ingredient ↔ PantryItems**: One-to-Many (ingredient tracking)

---

## 🔌 API Modules & Endpoints

### 1. Authentication Module (`/api/auth`)

**Data Flow:**
```
User Input → Validation → Password Hashing → DB Query → JWT Generation → Cookie Setting → Response
```

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/logout` | Logout user | Yes |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/me` | Get current user | Yes |

**Data Processing:**
1. **Registration**: Email/Password → bcrypt hash → User entity → JWT tokens → HTTP-only cookies
2. **Login**: Credentials → Validation → JWT generation → Cookies
3. **Refresh**: Refresh token from cookie → Validation → New access token

---

### 2. Users Module (`/api/users`)

**Data Flow:**
```
JWT Token → User Extraction → User Service → Database → Response
```

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | Get all users | Yes (Admin) |
| GET | `/users/me` | Get current user profile | Yes |
| GET | `/users/:id` | Get user by ID | Yes |
| PATCH | `/users/me` | Update current user | Yes |
| DELETE | `/users/me` | Delete account | Yes |
| PATCH | `/users/preferences` | Update preferences | Yes |

**User Data Structure:**
- Personal info: email, name, role
- Preferences: dietaryPreferences[], allergies[]
- Relationships: recipes, pantryItems, savedRecipes, likedRecipes

---

### 3. Recipes Module (`/api/recipes`)

**Data Flow:**
```
Request → Validation → Recipe Service → Database Query → Related Data Loading → Response
```

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/recipes` | Create recipe | Yes |
| POST | `/recipes/bulk` | Bulk create recipes | Yes |
| POST | `/recipes/extract` | Extract from URL | Yes |
| POST | `/recipes/upload-excel` | Upload Excel file | Yes |
| GET | `/recipes` | Get all recipes | No |
| GET | `/recipes/my` | Get user's recipes | Yes |
| GET | `/recipes/filter` | Filter recipes | No |
| GET | `/recipes/search` | Search recipes | No |
| GET | `/recipes/by-ingredients` | Find by ingredients | No |
| GET | `/recipes/liked` | Get liked recipes | Yes |
| GET | `/recipes/saved` | Get saved recipes | Yes |
| GET | `/recipes/:id` | Get recipe by ID | No |
| PATCH | `/recipes/:id` | Update recipe | Yes |
| DELETE | `/recipes/:id` | Delete recipe | Yes |

**Recipe Operations:**

#### Like System
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recipes/:id/like` | Like/unlike recipe |
| GET | `/recipes/:id/likes` | Get like count |
| GET | `/recipes/:id/liked` | Check if liked |
| POST | `/recipes/bulk-like` | Bulk like recipes |

#### Save System
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recipes/:id/save` | Save recipe |
| DELETE | `/recipes/:id/save` | Unsave recipe |
| POST | `/recipes/:id/toggle-save` | Toggle save status |
| GET | `/recipes/:id/save-status` | Check save status |
| POST | `/recipes/bulk-save` | Bulk save recipes |
| POST | `/recipes/bulk-unsave` | Bulk unsave recipes |

#### Rating System
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recipes/:id/ratings` | Rate recipe (1-5) |
| DELETE | `/recipes/:id/ratings` | Remove rating |
| GET | `/recipes/:id/ratings/me` | Get user's rating |
| GET | `/recipes/:id/ratings` | List all ratings |
| GET | `/recipes/:id/ratings/summary` | Get rating summary |

**Web Scraping Flow:**
```
URL Input → Axios Fetch → Cheerio Parse → Data Extraction → Recipe Creation → Response
```

---

### 4. Ingredients Module (`/api/ingredients`)

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/ingredients` | Create ingredient | Yes |
| POST | `/ingredients/upload` | Upload Excel | No |
| GET | `/ingredients` | List all ingredients | No |
| GET | `/ingredients/search` | Search ingredients | No |
| GET | `/ingredients/common` | Get common ingredients | No |
| GET | `/ingredients/categories` | Get all categories | No |
| GET | `/ingredients/categories/:cat` | Get by category | No |
| GET | `/ingredients/:id` | Get ingredient by ID | No |
| PATCH | `/ingredients/:id` | Update ingredient | Yes |
| DELETE | `/ingredients/:id` | Delete ingredient | Yes |

**Categories:**
Vegetable, Fruit, Meat, Seafood, Dairy, Grain, Legume, Nut, Seed, Herb, Spice, Condiment, Oil, Sweetener, Baking, Beverage, Other

---

### 5. Pantry Module (`/api/pantry`)

**Data Flow:**
```
User ID + Item Data → Validation → Pantry Service → Database → Response
```

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/pantry/items` | Add pantry item | Yes |
| GET | `/pantry/items` | List pantry items | Yes |
| GET | `/pantry/items/:id` | Get pantry item | Yes |
| PATCH | `/pantry/items/:id` | Update item | Yes |
| DELETE | `/pantry/items/:id` | Remove item | Yes |
| GET | `/pantry/summary` | Get pantry summary | Yes |

**Query Parameters:**
- `page`, `limit`: Pagination
- `ingredients`: Filter by ingredient IDs
- `categories`: Filter by categories
- `favorite`: Filter favorites
- `expiringSoon`: Filter expiring items

**Pantry Item Data:**
```json
{
  "ingredientId": "uuid",
  "quantity": 500,
  "unit": "g",
  "expiryDate": "2024-12-31",
  "isFavorite": false,
  "note": "Stored in refrigerator"
}
```

---

### 6. Recommendation Module (`/api/recommendations`)

**Main Data Flow:**
```
User ID + Ingredient IDs + Filters
    ↓
┌──────────────────────────────────┐
│  Recommendation Service          │
│  1. Load user preferences        │
│  2. Initialize ML models         │
│  3. Calculate recipe vectors     │
│  4. Generate recommendations     │
└──────────────────────────────────┘
    ↓
Content-Based → TF-IDF + Word2Vec → Similarity Scores
    ↓
Collaborative → User-User Similarity → Recipe Scores
    ↓
Hybrid → Combine Scores → Weighted Average
    ↓
Filter → Nutrition, Allergies, Preferences
    ↓
Rank & Return Top N Recipes
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recommendations` | Get recommendations |
| POST | `/recommendations` | Advanced recommendations |
| GET | `/recommendations/content` | Content-based only |
| GET | `/recommendations/collaborative` | Collaborative only |
| GET | `/recommendations/hybrid` | Hybrid recommendations |

**Request Parameters:**
```json
{
  "ingredientIds": ["uuid1", "uuid2"],
  "limit": 10,
  "minCosineSimilarity": 0.3,
  "includeContentBased": true,
  "includeCollaborative": true,
  "includeHybrid": true,
  "nutritionFilters": {
    "maxCalories": 500,
    "minProtein": 20
  }
}
```

**Response Structure:**
```json
{
  "recommendations": [
    {
      "recipe": { /* recipe object */ },
      "score": 0.85,
      "type": "hybrid",
      "reason": "85% match based on ingredients and user preferences"
    }
  ],
  "metadata": {
    "totalRecommendations": 10,
    "contentBasedCount": 4,
    "collaborativeCount": 3,
    "hybridCount": 3,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 7. Nutrition Module (`/api/nutrition`)

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nutrition/recipes` | Filter by nutrition |
| GET | `/nutrition/insights` | Get insights |
| GET | `/nutrition/goals` | Get recommended goals |
| POST | `/nutrition/analyze` | Analyze recipe |
| GET | `/nutrition/trends` | Get trends |
| GET | `/nutrition/recommendations` | Get nutrition tips |

**Nutrition Filters:**
```json
{
  "minCalories": 100,
  "maxCalories": 500,
  "minProtein": 10,
  "maxProtein": 50,
  "minCarbs": 20,
  "maxCarbs": 100,
  "minFat": 5,
  "maxFat": 30,
  "minFiber": 5,
  "maxSugar": 20
}
```

---

## 🤖 Recommendation Engine

### Algorithm Details

#### 1. Content-Based Filtering

**Process Flow:**
```
Input: Ingredient IDs
    ↓
Step 1: Fetch Recipes from Database
    ↓
Step 2: Calculate TF-IDF Vectors
    - Term Frequency: Count of ingredient in recipe
    - Inverse Document Frequency: log(total recipes / recipes with ingredient)
    - TF-IDF = TF × IDF
    ↓
Step 3: Calculate Word2Vec Embeddings
    - Load pre-trained model
    - Get ingredient vectors (300-dimension)
    - Average vectors for recipe representation
    ↓
Step 4: Calculate Similarity Scores
    - Cosine Similarity on TF-IDF vectors
    - Cosine Similarity on Word2Vec embeddings
    - Ingredient Match Score (exact + partial)
    - Quality Score (ratings × review count)
    - Rarity Bonus (for uncommon ingredients)
    ↓
Step 5: Combine Scores
    finalScore = (
        exactMatchScore × 0.3 +
        embeddingScore × 0.25 +
        qualityScore × 0.25 +
        rarityBonus × 0.2
    )
    ↓
Step 6: Filter & Rank
    - Apply minimum threshold (default: 0.3)
    - Sort by score descending
    - Return top N results
```

**Key Components:**

**TF-IDF Calculation:**
```typescript
// For each recipe
const tf = termCount / totalTermsInRecipe;
const idf = Math.log(totalRecipes / recipesContainingTerm);
const tfidf = tf * idf;
```

**Cosine Similarity:**
```typescript
// Vector similarity
const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
const similarity = dotProduct / (magnitudeA * magnitudeB);
```

**Ingredient Matching:**
- Exact matches: Full ingredient name match
- Partial matches: Normalized substring matching
- Alternative names: Check ingredient.alternativeNames

#### 2. Collaborative Filtering

**Process Flow:**
```
Input: User ID
    ↓
Step 1: Build User-Like Matrix
    - Rows: Users
    - Columns: Recipes
    - Values: 1 (liked), 0 (not liked)
    ↓
Step 2: Find Similar Users
    - Calculate Jaccard similarity
    - Similarity = |CommonLikes| / |TotalUniqueLikes|
    - Minimum 3 common likes required
    ↓
Step 3: Get Candidate Recipes
    - Recipes liked by similar users
    - Exclude already liked by current user
    ↓
Step 4: Calculate Recommendation Score
    score = Σ(userSimilarity × recipeLikeCount) / totalSimilarUsers
    ↓
Step 5: Fetch Full Recipe Data
    - Load recipes from database
    - Include all relations
    ↓
Step 6: Filter & Rank
    - Apply minimum score threshold (0.4)
    - Sort by score descending
```

**User Similarity Calculation:**
```typescript
// Jaccard Similarity
const commonLikes = userA.likes.filter(id => userB.likes.includes(id));
const totalUniqueLikes = new Set([...userA.likes, ...userB.likes]).size;
const similarity = commonLikes.length / totalUniqueLikes;
```

#### 3. Hybrid Recommendations

**Process Flow:**
```
Input: User ID + Ingredient IDs
    ↓
Step 1: Get Content-Based Recommendations
    ↓
Step 2: Get Collaborative Recommendations
    ↓
Step 3: Combine Results
    - Group by recipe ID
    - Average scores from both methods
    - If recipe appears in both: weighted average
    - Weights: Content 60%, Collaborative 40%
    ↓
Step 4: Re-rank
    - Sort combined results by final score
    - Apply nutrition filters
    - Check dietary preferences
    - Filter allergens
    ↓
Step 5: Return Results
```

**Score Combination:**
```typescript
if (existsInBoth) {
    finalScore = (contentScore × 0.6) + (collaborativeScore × 0.4);
} else if (contentOnly) {
    finalScore = contentScore × 0.8; // Penalize slightly
} else {
    finalScore = collaborativeScore × 0.8;
}
```

### Machine Learning Models

**Word2Vec Embeddings:**
- **Purpose**: Capture semantic similarity between ingredients
- **Model**: Pre-trained 300-dimension vectors
- **Usage**: Calculate ingredient and recipe embeddings
- **Fallback**: Generated vector for unknown ingredients

**TensorFlow.js:**
- **Library**: @tensorflow/tfjs-node
- **Purpose**: Future ML model integration
- **Current**: Prepared for deep learning models

### Scoring Components

**1. Exact Match Score:**
- Percentage of query ingredients in recipe
- Weight: 30%

**2. Embedding Similarity Score:**
- Cosine similarity of Word2Vec vectors
- Weight: 25%

**3. Quality Score:**
- Based on average rating and review count
- Formula: `(averageRating / 5) × Math.log(reviewCount + 1) / 5`
- Weight: 25%

**4. Rarity Bonus:**
- Rewards recipes with uncommon ingredients
- Formula: `(rareIngredients / totalIngredients) × 0.1`
- Weight: 20%

---

## 💻 Technology Stack

### Backend Framework
- **NestJS**: Progressive Node.js framework
- **TypeScript**: Type-safe development
- **Node.js**: Runtime environment

### Database
- **PostgreSQL**: Primary database
- **TypeORM**: ORM for database operations

### Authentication
- **JWT**: JSON Web Tokens
- **Passport.js**: Authentication middleware
- **bcrypt**: Password hashing

### Machine Learning
- **Natural**: NLP library for text processing
- **Word2Vec**: Pre-trained word embeddings
- **TensorFlow.js**: ML framework
- **Custom TF-IDF**: Implementation for content filtering

### Data Processing
- **Cheerio**: Web scraping
- **Axios**: HTTP client
- **XLSX**: Excel file processing

### API Documentation
- **Swagger/OpenAPI**: API documentation

### Validation & Transformation
- **class-validator**: DTO validation
- **class-transformer**: Object transformation

### Security
- **Cookie-parser**: Cookie handling
- **Throttler**: Rate limiting
- **CORS**: Cross-origin resource sharing

---

## 🚀 Setup & Installation

### Prerequisites
```bash
Node.js >= 18.x
PostgreSQL >= 14.x
npm or yarn
```

### Installation Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd recipe-recommendation-api
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Setup Database**
```bash
# Create PostgreSQL database
createdb recipe_recommendation

# Run migrations (if any)
npm run migration:run
```

4. **Environment Configuration**
Create `.env.development` file (see Environment Configuration section)

5. **Seed Database (Optional)**
```bash
ts-node seed-database.ts
```

6. **Run the application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

7. **Access Swagger Documentation**
```
http://localhost:3001/api/docs
```

---

## ⚙️ Environment Configuration

### `.env.development` / `.env.production`

```env
# Application
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=recipe_recommendation

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your_refresh_token_secret_key
JWT_REFRESH_EXPIRATION=7d

# OpenAI (Optional - for recipe extraction)
OPENAI_API_KEY=your_openai_api_key

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# CORS
CORS_ORIGIN=*
```

---

## 📝 API Request/Response Examples

### 1. User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}

Response:
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### 2. Get Recommendations
```http
GET /api/recommendations?ingredientIds=uuid1,uuid2&limit=10
Authorization: Bearer <jwt_token>

Response:
{
  "recommendations": [
    {
      "recipe": {
        "id": "uuid",
        "title": "Pasta Carbonara",
        "description": "Classic Italian pasta",
        "difficulty": "Medium",
        "prepTime": 15,
        "cookTime": 20,
        "servings": 4,
        "averageRating": 4.5,
        "calories": 450,
        "protein": 25,
        "ingredients": [...]
      },
      "score": 0.87,
      "type": "hybrid",
      "reason": "87% match - High ingredient overlap and popular among similar users"
    }
  ],
  "metadata": {
    "totalRecommendations": 10,
    "contentBasedCount": 4,
    "collaborativeCount": 3,
    "hybridCount": 3
  }
}
```

### 3. Add to Pantry
```http
POST /api/pantry/items
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "ingredientId": "uuid",
  "quantity": 500,
  "unit": "g",
  "expiryDate": "2024-12-31",
  "note": "Fresh from market"
}
```

### 4. Filter Recipes by Nutrition
```http
GET /api/nutrition/recipes?maxCalories=500&minProtein=20&page=1&limit=10

Response:
{
  "data": [...recipes],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## 📊 Data Processing Workflows

### Recipe Creation Workflow
```
User Input → Validation (class-validator)
    ↓
DTO Transformation (class-transformer)
    ↓
Recipe Service
    ↓
Check Author Exists
    ↓
Validate Ingredients Exist
    ↓
Create Recipe Entity
    ↓
Link Ingredients (Many-to-Many)
    ↓
Save to Database (Transaction)
    ↓
Calculate Initial Nutrition (if provided)
    ↓
Return Recipe with Relations
```

### Recommendation Workflow
```
Request Received
    ↓
Authenticate User (JWT)
    ↓
Validate Request (DTO)
    ↓
Load User Preferences
    ↓
Initialize ML Models (if not loaded)
    ↓
Calculate Recipe Vectors (TF-IDF + Word2Vec)
    ↓
Generate Content Recommendations
    ↓
Generate Collaborative Recommendations
    ↓
Merge & Score (Hybrid)
    ↓
Apply Filters (Nutrition, Allergies, Preferences)
    ↓
Rank by Score
    ↓
Fetch Full Recipe Data
    ↓
Return Recommendations with Metadata
```

### Like/Save Workflow
```
User Action (Like/Save)
    ↓
Authenticate User
    ↓
Check Recipe Exists
    ↓
Check Current Status (Liked/Saved?)
    ↓
Toggle Action
    ↓
Update Database (ManyToMany / OneToMany)
    ↓
Update Recipe Statistics (if like)
    ↓
Invalidate User Matrix Cache (for recommendations)
    ↓
Return Updated Status
```

---

## 🔐 Security Features

1. **JWT Authentication**: HTTP-only cookies
2. **Password Hashing**: bcrypt with salt rounds
3. **Rate Limiting**: 100 requests per 60 seconds
4. **Input Validation**: DTO validation on all endpoints
5. **SQL Injection Prevention**: TypeORM parameterized queries
6. **CORS Configuration**: Controlled origin access
7. **Role-Based Access**: User/Admin roles

---

## 📈 Performance Optimizations

1. **Caching**:
   - User-like matrix cached for 5 minutes
   - Recipe vectors cached in memory
   - Word2Vec embeddings cached after first load

2. **Database**:
   - Indexed foreign keys
   - Unique constraints on relationships
   - Pagination on all list endpoints
   - Selective field loading

3. **Batch Processing**:
   - Bulk operations for likes, saves, recipe creation
   - Parallel vector calculations

4. **Lazy Loading**:
   - ML models loaded on first recommendation request
   - Word2Vec embeddings loaded on-demand

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📦 Build & Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start:prod

# Docker deployment (if Dockerfile exists)
docker build -t recipe-api .
docker run -p 3001:3001 recipe-api
```

---

## 🤝 Contributing

This project follows NestJS best practices and clean architecture principles. When contributing:
1. Follow TypeScript strict mode
2. Use DTOs for data validation
3. Implement proper error handling
4. Add Swagger documentation for endpoints
5. Write unit tests for new features

---

## 📄 License

UNLICENSED - Private Project

---

## 📞 Support

For issues and questions, please refer to the API documentation at `/api/docs` when the server is running.

---

**Last Updated**: January 2024
**Version**: 0.0.1
