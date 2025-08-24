import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Recipe } from '../../recipes/entities/recipe.entity';

export enum IngredientCategory {
  VEGETABLE = 'Vegetable',
  FRUIT = 'Fruit',
  MEAT = 'Meat',
  SEAFOOD = 'Seafood',
  DAIRY = 'Dairy',
  GRAIN = 'Grain',
  LEGUME = 'Legume',
  NUT = 'Nut',
  SEED = 'Seed',
  HERB = 'Herb',
  SPICE = 'Spice',
  CONDIMENT = 'Condiment',
  OIL = 'Oil',
  SWEETENER = 'Sweetener',
  BAKING = 'Baking',
  BEVERAGE = 'Beverage',
  OTHER = 'Other',
}

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: IngredientCategory,
    default: IngredientCategory.OTHER,
  })
  category: IngredientCategory;

  @Column('simple-array', { nullable: true })
  alternativeNames: string[];

  // Nutrition per 100g
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
  sodium: number; // in mg

  @Column({ default: true })
  isCommon: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Recipe, (recipe) => recipe.ingredients)
  recipes: Recipe[];

  constructor(partial: Partial<Ingredient>) {
    Object.assign(this, partial);
  }
}
