/**
 * Custom TF-IDF (Term Frequency-Inverse Document Frequency) Implementation
 *
 * This class provides a from-scratch implementation of the TF-IDF algorithm
 * for text similarity and information retrieval.
 */

// Simple tokenizer that splits text into words and converts to lowercase
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

// Common stop words to filter out (words that don't add much meaning)
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'them',
  'their',
  'my',
  'your',
  'his',
  'her',
  'our',
]);

// Simple stemmer - reduces words to their root form
function stem(word: string): string {
  // Remove common suffixes (very basic stemming)
  const suffixes = ['ing', 'ed', 'es', 's', 'ly', 'er', 'est'];

  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }

  return word;
}

export interface TermScore {
  term: string;
  tfidf: number;
  tf: number;
  idf: number;
}

export class CustomTfIdf {
  private documents: string[][] = []; // Stores tokenized documents
  private documentTexts: string[] = []; // Stores original text for reference
  private idfCache: Map<string, number> = new Map(); // Caches IDF scores
  private tfCache: Map<number, Map<string, number>> = new Map(); // Caches TF scores per document
  private isIdfCalculated = false;
  private vocabularySize = 0;

  /**
   * Add a document to the corpus
   * @param document - The text document to add
   */
  public addDocument(document: string): void {
    // Store original text
    this.documentTexts.push(document);

    // Tokenize, remove stop words, and stem
    const tokens = tokenize(document)
      .filter((word) => !STOP_WORDS.has(word))
      .map((word) => stem(word));

    this.documents.push(tokens);
    this.isIdfCalculated = false; // Invalidate cache when new doc is added
    this.tfCache.clear(); // Clear TF cache as well
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for all terms in the corpus
   * IDF measures how rare/important a term is across all documents
   */
  private calculateIdf(): void {
    if (this.isIdfCalculated) return;

    const totalDocs = this.documents.length;
    if (totalDocs === 0) {
      throw new Error('No documents have been added to the corpus');
    }

    const docFreq: Map<string, number> = new Map();

    // Count how many documents each term appears in
    for (const doc of this.documents) {
      const uniqueTerms = new Set(doc);
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    this.vocabularySize = docFreq.size;

    // Calculate and cache the IDF score for each term
    // Formula: IDF(term) = log(totalDocs / (1 + docsContainingTerm))
    // The +1 is smoothing to avoid division by zero
    for (const [term, count] of docFreq.entries()) {
      const idf = Math.log((totalDocs + 1) / (count + 1)) + 1; // Add 1 to ensure positive values
      this.idfCache.set(term, idf);
    }

    this.isIdfCalculated = true;
  }

  /**
   * Calculate TF (Term Frequency) for a specific term in a document
   * TF measures how often a term appears in a single document
   * @param term - The term to calculate frequency for
   * @param documentTokens - The tokenized document
   * @returns The term frequency (0 to 1)
   */
  private calculateTf(term: string, documentTokens: string[]): number {
    if (documentTokens.length === 0) return 0;

    const termCount = documentTokens.filter((t) => t === term).length;
    return termCount / documentTokens.length;
  }

  /**
   * Get all TF scores for a document (cached for performance)
   * @param documentIndex - The index of the document
   * @returns A map of term -> TF score
   */
  private getTfScoresForDocument(documentIndex: number): Map<string, number> {
    // Check cache first
    if (this.tfCache.has(documentIndex)) {
      return this.tfCache.get(documentIndex)!;
    }

    const documentTokens = this.documents[documentIndex];
    const tfScores = new Map<string, number>();

    // Get unique terms in this document
    const uniqueTerms = new Set(documentTokens);

    for (const term of uniqueTerms) {
      const tf = this.calculateTf(term, documentTokens);
      tfScores.set(term, tf);
    }

    // Cache the results
    this.tfCache.set(documentIndex, tfScores);

    return tfScores;
  }

  /**
   * Get the TF-IDF score for a specific term in a specific document
   * @param term - The term to score
   * @param documentIndex - The index of the document
   * @returns The TF-IDF score
   */
  public tfidf(term: string, documentIndex: number): number {
    if (!this.isIdfCalculated) {
      this.calculateIdf();
    }

    if (documentIndex < 0 || documentIndex >= this.documents.length) {
      throw new Error(
        `Document index ${documentIndex} out of bounds (0-${this.documents.length - 1})`,
      );
    }

    // Normalize the term (apply same preprocessing as documents)
    const normalizedTerm = stem(term.toLowerCase());

    // If term is a stop word, return 0
    if (STOP_WORDS.has(normalizedTerm)) {
      return 0;
    }

    // Get TF from cache
    const tfScores = this.getTfScoresForDocument(documentIndex);
    const tf = tfScores.get(normalizedTerm) || 0;

    // Get IDF from cache (0 if term not in corpus)
    const idf = this.idfCache.get(normalizedTerm) || 0;

    return tf * idf;
  }

  /**
   * List all terms in a document with their TF-IDF scores, sorted by score
   * @param documentIndex - The index of the document
   * @returns Array of terms with their scores
   */
  public listTerms(documentIndex: number): TermScore[] {
    if (!this.isIdfCalculated) {
      this.calculateIdf();
    }

    if (documentIndex < 0 || documentIndex >= this.documents.length) {
      throw new Error(
        `Document index ${documentIndex} out of bounds (0-${this.documents.length - 1})`,
      );
    }

    const documentTokens = this.documents[documentIndex];
    const uniqueTerms = new Set(documentTokens);
    const results: TermScore[] = [];

    const tfScores = this.getTfScoresForDocument(documentIndex);

    for (const term of uniqueTerms) {
      const tf = tfScores.get(term) || 0;
      const idf = this.idfCache.get(term) || 0;
      const tfidfScore = tf * idf;

      results.push({
        term: term,
        tfidf: tfidfScore,
        tf: tf,
        idf: idf,
      });
    }

    return results.sort((a, b) => b.tfidf - a.tfidf);
  }

  /**
   * Get the TF-IDF vector for a document
   * Returns a sparse representation (only non-zero values)
   * @param documentIndex - The index of the document
   * @returns Map of term -> TF-IDF score
   */
  public getVector(documentIndex: number): Map<string, number> {
    const vector = new Map<string, number>();
    const terms = this.listTerms(documentIndex);

    for (const termScore of terms) {
      if (termScore.tfidf > 0) {
        vector.set(termScore.term, termScore.tfidf);
      }
    }

    return vector;
  }

  /**
   * Get a dense vector for a document based on the entire vocabulary
   * Useful for cosine similarity calculations
   * @param documentIndex - The index of the document
   * @returns Array of TF-IDF scores aligned with vocabulary
   */
  public getDenseVector(documentIndex: number): number[] {
    if (!this.isIdfCalculated) {
      this.calculateIdf();
    }

    const vocabulary = Array.from(this.idfCache.keys()).sort();
    const vector: number[] = [];

    for (let i = 0; i < vocabulary.length; i++) {
      vector.push(0);
    }

    const sparseVector = this.getVector(documentIndex);

    vocabulary.forEach((term, index) => {
      vector[index] = sparseVector.get(term) || 0;
    });

    return vector;
  }

  /**
   * Get the complete vocabulary (all unique terms across all documents)
   * @returns Array of all terms
   */
  public getVocabulary(): string[] {
    if (!this.isIdfCalculated) {
      this.calculateIdf();
    }

    return Array.from(this.idfCache.keys()).sort();
  }

  /**
   * Get the number of documents in the corpus
   */
  public get documentCount(): number {
    return this.documents.length;
  }

  /**
   * Get the size of the vocabulary
   */
  public get vocabularyLength(): number {
    if (!this.isIdfCalculated) {
      this.calculateIdf();
    }
    return this.vocabularySize;
  }

  /**
   * Get the original text of a document
   * @param documentIndex - The index of the document
   */
  public getDocumentText(documentIndex: number): string {
    if (documentIndex < 0 || documentIndex >= this.documentTexts.length) {
      throw new Error(`Document index ${documentIndex} out of bounds`);
    }
    return this.documentTexts[documentIndex];
  }

  /**
   * Clear all documents and reset the TF-IDF model
   */
  public clear(): void {
    this.documents = [];
    this.documentTexts = [];
    this.idfCache.clear();
    this.tfCache.clear();
    this.isIdfCalculated = false;
    this.vocabularySize = 0;
  }
}
