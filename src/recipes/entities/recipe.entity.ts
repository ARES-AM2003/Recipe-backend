import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

export enum CuisineType {
  ITALIAN = 'Italian',
  MEXICAN = 'Mexican',
  INDIAN = 'Indian',
  CHINESE = 'Chinese',
  JAPANESE = 'Japanese',
  AMERICAN = 'American',
  MEDITERRANEAN = 'Mediterranean',
  THAI = 'Thai',
  FRENCH = 'French',
  OTHER = 'Other',
}

export enum DifficultyLevel {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
}

export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner',
  DESSERT = 'Dessert',
  SNACK = 'Snack',
  APPETIZER = 'Appetizer',
  BEVERAGE = 'Beverage',
}

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ enum: DifficultyLevel, default: DifficultyLevel.EASY })
  difficulty: DifficultyLevel;

  @Column('text', { array: true })
  instructions: string[];

  @Column('int')
  prepTime: number; // in minutes

  @Column('int')
  cookTime: number; // in minutes

  @Column('int')
  servings: number;

  @Column({
    type: 'enum',
    enum: CuisineType,
    default: CuisineType.OTHER,
  })
  cuisine: CuisineType;

  @Column({
    type: 'enum',
    enum: MealType,
    default: MealType.DINNER,
  })
  mealType: MealType;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  imageUrl: string;

  @Column('float', { default: 0 })
  averageRating: number;

  @Column('int', { default: 0 })
  reviewCount: number;

  // Nutrition information (per serving)
  @Column('float', { default: 0 })
  calories: number;

  @Column('float', { default: 0 })
  protein: number; // in grams

  @Column('float', { default: 0 })
  carbs: number; // in grams

  @Column('float', { default: 0 })
  fat: number; // in grams

  @Column('float', { default: 0 })
  fiber: number; // in grams

  @Column('float', { default: 0 })
  sugar: number; // in grams

  @Column('float', { default: 0 })
  sodium: number; // in grams

  @ManyToOne(() => User, (user) => user.recipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: string;

  @ManyToMany(() => Ingredient)
  @JoinTable({
    name: 'recipe_ingredients',
    joinColumn: { name: 'recipeId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'ingredientId', referencedColumnName: 'id' },
  })
  ingredients: Ingredient[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => User, (user) => user.likedRecipes, { onDelete: 'CASCADE' })
  @JoinTable()
  likedBy: User[];

  constructor(partial: Partial<Recipe>) {
    Object.assign(this, partial);
  }
}
