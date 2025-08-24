import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1754148500992 implements MigrationInterface {
    name = 'InitialSchema1754148500992'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ingredients_category_enum" AS ENUM('Vegetable', 'Fruit', 'Meat', 'Seafood', 'Dairy', 'Grain', 'Legume', 'Nut', 'Seed', 'Herb', 'Spice', 'Condiment', 'Oil', 'Sweetener', 'Baking', 'Beverage', 'Other')`);
        await queryRunner.query(`CREATE TABLE "ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "category" "public"."ingredients_category_enum" NOT NULL DEFAULT 'Other', "alternativeNames" text, "calories" double precision NOT NULL DEFAULT '0', "protein" double precision NOT NULL DEFAULT '0', "carbs" double precision NOT NULL DEFAULT '0', "fat" double precision NOT NULL DEFAULT '0', "fiber" double precision NOT NULL DEFAULT '0', "sugar" double precision NOT NULL DEFAULT '0', "sodium" double precision NOT NULL DEFAULT '0', "isCommon" boolean NOT NULL DEFAULT true, "imageUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a955029b22ff66ae9fef2e161f8" UNIQUE ("name"), CONSTRAINT "PK_9240185c8a5507251c9f15e0649" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."recipes_cuisine_enum" AS ENUM('Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'American', 'Mediterranean', 'Thai', 'French', 'Other')`);
        await queryRunner.query(`CREATE TYPE "public"."recipes_mealtype_enum" AS ENUM('Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Beverage')`);
        await queryRunner.query(`CREATE TABLE "recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text NOT NULL, "instructions" text array NOT NULL, "prepTime" integer NOT NULL, "cookTime" integer NOT NULL, "servings" integer NOT NULL, "cuisine" "public"."recipes_cuisine_enum" NOT NULL DEFAULT 'Other', "mealType" "public"."recipes_mealtype_enum" NOT NULL DEFAULT 'Dinner', "tags" text, "imageUrl" character varying, "averageRating" double precision NOT NULL DEFAULT '0', "reviewCount" integer NOT NULL DEFAULT '0', "calories" double precision NOT NULL DEFAULT '0', "protein" double precision NOT NULL DEFAULT '0', "carbs" double precision NOT NULL DEFAULT '0', "fat" double precision NOT NULL DEFAULT '0', "fiber" double precision NOT NULL DEFAULT '0', "sugar" double precision NOT NULL DEFAULT '0', "authorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8f09680a51bf3669c1598a21682" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."pantry_items_unit_enum" AS ENUM('g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cups', 'pcs', 'pinch', 'dash', 'to taste')`);
        await queryRunner.query(`CREATE TABLE "pantry_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "ingredientId" uuid NOT NULL, "quantity" double precision NOT NULL, "unit" "public"."pantry_items_unit_enum" NOT NULL DEFAULT 'g', "expiryDate" TIMESTAMP, "isFavorite" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb63c18ae1bc99152edd69c4a61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "dietaryPreferences" text, "allergies" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recipe_ingredients" ("recipeId" uuid NOT NULL, "ingredientId" uuid NOT NULL, CONSTRAINT "PK_77d03a398e85d333b09b22cda91" PRIMARY KEY ("recipeId", "ingredientId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d7f407ae694e91bb3da1798c6" ON "recipe_ingredients" ("recipeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_05a2b62604dfd9840f4cda76a9" ON "recipe_ingredients" ("ingredientId") `);
        await queryRunner.query(`ALTER TABLE "recipes" ADD CONSTRAINT "FK_afd4f74f8df44df574253a7f37b" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pantry_items" ADD CONSTRAINT "FK_fe765334f323598ae708b097127" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pantry_items" ADD CONSTRAINT "FK_6ec9dd6e38d58b273da6c967630" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93"`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61"`);
        await queryRunner.query(`ALTER TABLE "pantry_items" DROP CONSTRAINT "FK_6ec9dd6e38d58b273da6c967630"`);
        await queryRunner.query(`ALTER TABLE "pantry_items" DROP CONSTRAINT "FK_fe765334f323598ae708b097127"`);
        await queryRunner.query(`ALTER TABLE "recipes" DROP CONSTRAINT "FK_afd4f74f8df44df574253a7f37b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05a2b62604dfd9840f4cda76a9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d7f407ae694e91bb3da1798c6"`);
        await queryRunner.query(`DROP TABLE "recipe_ingredients"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "pantry_items"`);
        await queryRunner.query(`DROP TYPE "public"."pantry_items_unit_enum"`);
        await queryRunner.query(`DROP TABLE "recipes"`);
        await queryRunner.query(`DROP TYPE "public"."recipes_mealtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."recipes_cuisine_enum"`);
        await queryRunner.query(`DROP TABLE "ingredients"`);
        await queryRunner.query(`DROP TYPE "public"."ingredients_category_enum"`);
    }

}
