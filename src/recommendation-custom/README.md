# Custom TF-IDF Recommendation System

This module provides a **from-scratch implementation of TF-IDF (Term Frequency-Inverse Document Frequency)** for recipe recommendations, built entirely in TypeScript without relying on external NLP libraries.

## 📚 Overview

This is a complete, custom implementation designed to demonstrate a deep understanding of information retrieval algorithms. It serves as an educational alternative to the `natural` package-based system, allowing for direct comparison and analysis.

## 🎯 Purpose

This custom implementation was created for:

1. **Educational purposes** - Understanding the mathematics behind TF-IDF
2. **Academic demonstrations** - Showing implementation knowledge for college projects
3. **Algorithm comparison** - Comparing custom vs. library-based approaches
4. **Transparency** - Full control over the algorithm's behavior

## 🧮 How It Works

### 1. **Term Frequency (TF)**

Measures how frequently a term appears in a document:

```
TF(term, document) = (Number of times term appears in document) / (Total terms in document)
```

**Example:**
- Document: "chicken rice chicken curry" (4 terms)
- Term: "chicken"
- TF("chicken") = 2/4 = 0.5

### 2. **Inverse Document Frequency (IDF)**

Measures how rare or important a term is across all documents:

```
IDF(term, corpus) = log((Total documents + 1) / (Documents containing term + 1)) + 1
```

**Example:**
- Corpus: 100 documents
- "chicken" appears in 50 documents
- IDF("chicken") = log(101/51) + 1 = 1.69

### 3. **TF-IDF Score**

Combines both metrics:

```
TF-IDF(term, document, corpus) = TF(term, document) × IDF(term, corpus)
```

**Example:**
- TF-IDF("chicken") = 0.5 × 1.69 = 0.845

### 4. **Cosine Similarity**

Compares recipe vectors to find similar recipes:

```
Cosine Similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Where:
- `A · B` = dot product of vectors
- `||A||` = magnitude of vector A
- `||B||` = magnitude of vector B

## 🏗️ Architecture

### Core Components

```
recommendation-custom/
├── custom-tfidf.ts              # Core TF-IDF implementation
├── recommendation-custom.service.ts   # Recommendation service
├── recommendation-custom.controller.ts # API endpoints
├── recommendation-custom.module.ts     # NestJS module
└── dto/
    └── custom-recommendation.dto.ts   # Request/Response DTOs
```

### Key Classes

#### `CustomTfIdf`

The core TF-IDF implementation with methods:

- `addDocument(text: string)` - Add a document to the corpus
- `tfidf(term: string, docIndex: number)` - Get TF-IDF score
- `listTerms(docIndex: number)` - List all terms with scores
- `getVector(docIndex: number)` - Get sparse vector representation
- `getDenseVector(docIndex: number)` - Get dense vector for similarity
- `getVocabulary()` - Get all unique terms

#### `RecommendationCustomService`

Handles recipe recommendations using the custom TF-IDF:

- Initializes TF-IDF model with all recipes
- Creates query vectors from ingredients
- Calculates cosine similarity
- Filters and ranks recommendations

## 🚀 API Endpoints

### 1. Get Recommendations (GET)

```http
GET /recommendations-custom?ingredientIds=id1,id2&limit=10&minCosineSimilarity=0.6
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `ingredientIds` (required) - Comma-separated ingredient IDs
- `limit` (optional, default: 10) - Number of recommendations
- `minCosineSimilarity` (optional, default: 0.6) - Minimum similarity threshold
- `maxCalories` (optional) - Maximum calories filter
- `minProtein` (optional) - Minimum protein filter
- `maxCarbs` (optional) - Maximum carbs filter
- `maxFat` (optional) - Maximum fat filter

**Response:**
```json
{
  "recommendations": [
    {
      "recipe": { /* recipe object */ },
      "score": 0.85,
      "reason": "Custom TF-IDF cosine similarity: 0.850",
      "type": "custom-tfidf"
    }
  ],
  "metadata": {
    "totalRecommendations": 10,
    "corpusSize": 150,
    "vocabularySize": 450,
    "processingTimeMs": 125,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Get Recommendations (POST)

```http
POST /recommendations-custom
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "ingredientIds": ["id1", "id2"],
  "limit": 10,
  "minCosineSimilarity": 0.6,
  "maxCalories": 500,
  "minProtein": 20
}
```

### 3. Get Recipe TF-IDF Details

```http
GET /recommendations-custom/recipe/:id/details
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "recipe": {
    "id": "recipe-id",
    "title": "Chicken Curry"
  },
  "topTerms": [
    { "term": "chicken", "tfidf": 2.45, "tf": 0.15, "idf": 1.63 },
    { "term": "curry", "tfidf": 2.12, "tf": 0.12, "idf": 1.77 },
    { "term": "spices", "tfidf": 1.89, "tf": 0.10, "idf": 1.89 }
  ],
  "vocabularySize": 450
}
```

### 4. Compare Two Recipes

```http
GET /recommendations-custom/compare?recipeId1=id1&recipeId2=id2
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "recipe1": {
    "id": "id1",
    "title": "Chicken Curry"
  },
  "recipe2": {
    "id": "id2",
    "title": "Chicken Tikka"
  },
  "cosineSimilarity": 0.78,
  "method": "Custom TF-IDF"
}
```

### 5. Get Model Statistics

```http
GET /recommendations-custom/stats
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "initialized": true,
  "documentCount": 150,
  "vocabularySize": 450,
  "recipeCount": 150,
  "sampleVocabulary": ["chicken", "rice", "curry", "..."]
}
```

## 🔬 Features

### Text Processing

1. **Tokenization** - Splits text into individual words
2. **Lowercasing** - Normalizes all text to lowercase
3. **Stop Word Removal** - Filters out common words like "the", "a", "is"
4. **Basic Stemming** - Reduces words to root form (e.g., "cooking" → "cook")

### Performance Optimizations

- **IDF Caching** - IDF scores calculated once and cached
- **TF Caching** - Per-document TF scores cached
- **Sparse Vectors** - Only stores non-zero values
- **Dense Vectors** - Pre-computed for similarity calculations

## 📊 Comparison with Natural Package

| Feature | Custom TF-IDF | Natural Package |
|---------|---------------|-----------------|
| **Implementation** | ✅ From scratch | ❌ External library |
| **Transparency** | ✅ Full control | ⚠️ Black box |
| **Learning Value** | ✅ High | ❌ Low |
| **Stemming** | ⚠️ Basic | ✅ Advanced (Porter Stemmer) |
| **Stop Words** | ✅ Custom list | ✅ Built-in |
| **Performance** | ⚠️ Good | ✅ Optimized |
| **Maintenance** | ❌ Manual | ✅ Community |
| **Feature Richness** | ⚠️ Basic | ✅ Full NLP toolkit |

## 🎓 Educational Value

### For Your Defense/Presentation

When presenting this to your supervisor, highlight:

1. **Mathematical Understanding**
   - "I implemented TF-IDF from scratch to demonstrate understanding of the algorithm"
   - Walk through the formulas and explain each component

2. **Engineering Decisions**
   - "I built custom stemming and stop-word removal"
   - "I implemented caching for performance optimization"

3. **Comparison Analysis**
   - "I can compare results between my custom implementation and the Natural library"
   - "This shows the trade-offs between building vs. using existing tools"

4. **Code Quality**
   - "The code is well-documented with clear variable names"
   - "I followed TypeScript best practices and design patterns"

## 🧪 Testing

### Example Usage in Code

```typescript
import { CustomTfIdf } from './custom-tfidf';

// Create instance
const tfidf = new CustomTfIdf();

// Add documents
tfidf.addDocument("chicken curry with rice and spices");
tfidf.addDocument("pasta with tomato sauce and cheese");
tfidf.addDocument("chicken tikka masala with rice");

// Get TF-IDF score
const score = tfidf.tfidf("chicken", 0);
console.log(`TF-IDF score for "chicken": ${score}`);

// List top terms
const terms = tfidf.listTerms(0);
console.log("Top terms:", terms.slice(0, 5));

// Get vocabulary
const vocab = tfidf.getVocabulary();
console.log(`Vocabulary size: ${vocab.length}`);
```

## 🔍 Algorithm Flow

```
1. Initialization
   ├── Load all recipes from database
   ├── Build document for each recipe (title + description + ingredients)
   ├── Add documents to TF-IDF model
   └── Calculate vocabulary and IDF scores

2. User Request
   ├── Receive ingredient IDs
   ├── Fetch ingredient names
   ├── Create query vector
   └── Calculate TF-IDF scores for query

3. Similarity Calculation
   ├── For each recipe vector
   ├── Calculate cosine similarity with query
   ├── Filter by minimum threshold
   └── Sort by similarity score

4. Response
   ├── Apply nutrition filters
   ├── Limit results
   └── Return recommendations with metadata
```

## 📝 Notes

### When to Use This Implementation

- ✅ For learning and understanding TF-IDF
- ✅ For academic demonstrations and defenses
- ✅ For comparing custom vs. library implementations
- ✅ When you need full control over the algorithm

### When to Use Natural Package

- ✅ For production applications
- ✅ When advanced NLP features are needed
- ✅ When stemming quality is critical
- ✅ For better performance at scale

## 🚀 Future Enhancements

Potential improvements you could discuss in your defense:

1. **Advanced Stemming** - Implement Porter or Lancaster stemmer
2. **N-grams** - Support bigrams and trigrams (e.g., "olive oil")
3. **Weighted Fields** - Give more importance to title than description
4. **BM25** - Implement more sophisticated ranking algorithm
5. **Caching** - Add Redis for distributed caching
6. **Evaluation Metrics** - Implement precision, recall, and nDCG

## 📖 References

- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*
- Salton, G., & Buckley, C. (1988). "Term-weighting approaches in automatic text retrieval"

---

**Built with ❤️ for educational purposes and academic excellence!**