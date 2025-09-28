# Recipe Filter API

This document describes the comprehensive recipe filtering API endpoint that allows clients to search and filter recipes based on multiple criteria.

## Endpoint

```
GET /recipes/filter
```

## Features

- ✅ **Conditional filtering**: Only applies filters that are actually provided by the client
- ✅ **Comprehensive search**: Text search across title, description, and tags
- ✅ **Multiple filter types**: Cuisine, meal type, difficulty, time, ingredients, nutrition, and rating
- ✅ **Flexible time filtering**: Both category-based (quick/moderate/long) and precise range filtering
- ✅ **Smart ingredient handling**: Supports both ingredient names and UUIDs
- ✅ **Advanced sorting**: Multiple sort options including rating, time, and reviews
- ✅ **Pagination support**: Configurable page size with consistent results

## Quick Start

### Basic Search
```
GET /recipes/filter?search=pasta&cuisine=Italian&difficulty=Easy
```

### Time-based Filtering
```
GET /recipes/filter?timeCategory=quick&sort=rating_desc
```

### Nutrition Filtering
```
GET /recipes/filter?caloriesMax=500&proteinMin=20&carbsMax=30
```

## Filter Parameters

### 🔍 Search & Basic Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | string | Text search in title, description, tags | `pasta` |
| `cuisine` | array | Cuisine types (comma-separated) | `Italian,Mexican` |
| `mealType` | array | Meal types (comma-separated) | `Dinner,Lunch` |
| `difficulty` | array | Difficulty levels (comma-separated) | `Easy,Medium` |

**Enum Values:**
- **Cuisine**: Italian, Mexican, Indian, Chinese, Japanese, American, Mediterranean, Thai, French, Other
- **Meal Type**: Breakfast, Lunch, Dinner, Dessert, Snack, Appetizer, Beverage
- **Difficulty**: Easy, Medium, Hard

### ⏱ Time Categories & Ranges

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `timeCategory` | enum | `quick` (≤30min), `moderate` (31-60min), `long` (>60min) | `quick` |
| `prepTimeMin` | number | Minimum prep time in minutes | `10` |
| `prepTimeMax` | number | Maximum prep time in minutes | `30` |
| `cookTimeMin` | number | Minimum cook time in minutes | `15` |
| `cookTimeMax` | number | Maximum cook time in minutes | `45` |
| `servingsMin` | number | Minimum number of servings | `4` |

### 🥗 Ingredient Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `ingredientsInclude` | array | Must include ALL these ingredients | `tomato,basil,cheese` |
| `ingredientsExclude` | array | Must exclude ALL these ingredients | `nuts,shellfish,dairy` |

**Note**: Supports both ingredient names and UUIDs. Multiple ingredients are comma-separated.

### 🥑 Nutrition Ranges (per serving)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `caloriesMin` | number | Minimum calories | `200` |
| `caloriesMax` | number | Maximum calories | `500` |
| `proteinMin` | number | Minimum protein (grams) | `20` |
| `carbsMax` | number | Maximum carbs (grams) | `30` |
| `fatMax` | number | Maximum fat (grams) | `15` |
| `fiberMin` | number | Minimum fiber (grams) | `10` |
| `sugarMax` | number | Maximum sugar (grams) | `10` |
| `sodiumMax` | number | Maximum sodium (grams) | `1` |

### ⭐ Rating Filter

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `minRating` | number | Minimum average rating (0-5) | `4.0` |

### 📄 Pagination & Sorting

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (default: 1) | `2` |
| `limit` | number | Results per page (default: 10, max: 100) | `20` |
| `sort` | enum | Sort option (default: newest) | `rating_desc` |

**Sort Options:**
- `newest`: Most recently created first
- `oldest`: Oldest recipes first
- `rating_desc`: Highest rated first
- `rating_asc`: Lowest rated first
- `time_asc`: Shortest total time first
- `time_desc`: Longest total time first
- `most_reviewed`: Most reviewed first

## Response Format

```json
{
  "data": [
    {
      "id": "recipe-uuid",
      "title": "Recipe Title",
      "description": "Recipe description...",
      "difficulty": "Easy",
      "prepTime": 15,
      "cookTime": 25,
      "servings": 4,
      "cuisine": "Italian",
      "mealType": "Dinner",
      "tags": ["quick", "family-friendly"],
      "averageRating": 4.5,
      "reviewCount": 23,
      "calories": 350,
      "protein": 18.5,
      "carbs": 45.2,
      "fat": 12.3,
      "fiber": 6.8,
      "sugar": 8.5,
      "sodium": 0.45,
      "author": {
        "id": "author-uuid",
        "name": "Chef Name"
      },
      "ingredients": [
        {
          "id": "ingredient-uuid",
          "name": "Ingredient Name"
        }
      ],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10
}
```

## Usage Examples

### 1. Quick Healthy Dinner
```
GET /recipes/filter?mealType=Dinner&timeCategory=quick&caloriesMax=400&proteinMin=15&sort=rating_desc
```

### 2. Vegetarian Low-Carb Options
```
GET /recipes/filter?ingredientsExclude=meat,chicken,beef,pork&carbsMax=20&minRating=3.5
```

### 3. High-Protein Breakfast Under 30 Minutes
```
GET /recipes/filter?mealType=Breakfast&prepTimeMax=30&proteinMin=20&sort=time_asc
```

### 4. Mediterranean Diet Recipes
```
GET /recipes/filter?cuisine=Mediterranean&ingredientsInclude=olive oil&fatMax=25&fiberMin=5
```

### 5. Family-Friendly Italian Recipes
```
GET /recipes/filter?cuisine=Italian&difficulty=Easy&servingsMin=4&ingredientsExclude=nuts&sort=most_reviewed
```

### 6. Diet-Conscious Options
```
GET /recipes/filter?caloriesMax=300&fatMax=10&sodiumMax=0.5&sugarMax=5&sort=rating_desc
```

## Implementation Details

### Query Optimization
- Uses TypeORM QueryBuilder with conditional WHERE clauses
- Only adds filters for provided parameters (not null/undefined values)
- Efficient joins for author and ingredients relations
- Proper indexing support for common filter combinations

### Ingredient Resolution
- Automatically detects UUIDs vs ingredient names
- Case-insensitive name matching
- Supports both inclusion and exclusion logic
- Handles missing ingredients gracefully

### Time Category Logic
- **Quick**: `(prepTime + cookTime) <= 30 minutes`
- **Moderate**: `(prepTime + cookTime) BETWEEN 31 AND 60 minutes`
- **Long**: `(prepTime + cookTime) > 60 minutes`

### Array Parameter Handling
- Accepts both arrays and comma-separated strings
- Automatic trimming of whitespace
- Type-safe transformations with validation

## Error Handling

The API returns standard HTTP status codes:
- `200 OK`: Successful filtering with results
- `400 Bad Request`: Invalid parameter values or validation errors
- `500 Internal Server Error`: Server-side processing errors

## Performance Considerations

- Results are paginated to prevent large data transfers
- Complex filters may require additional processing time
- Consider using specific filters to reduce result sets
- Ingredient name resolution requires database lookups

## Security Notes

- All parameters are validated and sanitized
- SQL injection protection through parameterized queries
- No authentication required (public endpoint)
- Rate limiting may apply based on server configuration