import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigrations1760408290988 implements MigrationInterface {
    name = 'InitialMigrations1760408290988'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ingredients_category_enum" AS ENUM('Vegetable', 'Fruit', 'Meat', 'Seafood', 'Dairy', 'Grain', 'Legume', 'Nut', 'Seed', 'Herb', 'Spice', 'Condiment', 'Oil', 'Sweetener', 'Baking', 'Beverage', 'Other')`);
        await queryRunner.query(`CREATE TABLE "ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "category" "public"."ingredients_category_enum" NOT NULL DEFAULT 'Other', "alternativeNames" text, "calories" double precision NOT NULL DEFAULT '0', "protein" double precision NOT NULL DEFAULT '0', "carbs" double precision NOT NULL DEFAULT '0', "fat" double precision NOT NULL DEFAULT '0', "fiber" double precision NOT NULL DEFAULT '0', "sugar" double precision NOT NULL DEFAULT '0', "sodium" double precision NOT NULL DEFAULT '0', "isCommon" boolean NOT NULL DEFAULT true, "imageUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a955029b22ff66ae9fef2e161f8" UNIQUE ("name"), CONSTRAINT "PK_9240185c8a5507251c9f15e0649" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."recipes_cuisine_enum" AS ENUM('Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'American', 'Mediterranean', 'Thai', 'French', 'Other')`);
        await queryRunner.query(`CREATE TYPE "public"."recipes_mealtype_enum" AS ENUM('Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer', 'Beverage')`);
        await queryRunner.query(`CREATE TABLE "recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text NOT NULL, "difficulty" character varying NOT NULL DEFAULT 'Easy', "instructions" text array NOT NULL, "prepTime" integer NOT NULL, "cookTime" integer NOT NULL, "servings" integer NOT NULL, "cuisine" "public"."recipes_cuisine_enum" NOT NULL DEFAULT 'Other', "mealType" "public"."recipes_mealtype_enum" NOT NULL DEFAULT 'Dinner', "tags" text, "imageUrl" character varying, "averageRating" double precision NOT NULL DEFAULT '0', "reviewCount" integer NOT NULL DEFAULT '0', "calories" double precision NOT NULL DEFAULT '0', "protein" double precision NOT NULL DEFAULT '0', "carbs" double precision NOT NULL DEFAULT '0', "fat" double precision NOT NULL DEFAULT '0', "fiber" double precision NOT NULL DEFAULT '0', "sugar" double precision NOT NULL DEFAULT '0', "sodium" double precision NOT NULL DEFAULT '0', "authorId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8f09680a51bf3669c1598a21682" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."pantry_items_unit_enum" AS ENUM('g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cups', 'pcs', 'pinch', 'dash', 'to taste')`);
        await queryRunner.query(`CREATE TABLE "pantry_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "ingredientId" uuid NOT NULL, "quantity" double precision NOT NULL, "unit" "public"."pantry_items_unit_enum" NOT NULL DEFAULT 'g', "expiryDate" TIMESTAMP, "isFavorite" boolean NOT NULL DEFAULT false, "note" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb63c18ae1bc99152edd69c4a61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "saved_recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "recipeId" uuid NOT NULL, "savedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_saved_recipe_user_recipe" UNIQUE ("userId", "recipeId"), CONSTRAINT "PK_11e7caa47f845935f979231d190" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "dietaryPreferences" text, "allergies" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "currentHashedRefreshToken" character varying, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "recipeId" uuid NOT NULL, "value" integer NOT NULL, "comment" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ratings_user_recipe" UNIQUE ("userId", "recipeId"), CONSTRAINT "CHK_ratings_value_range" CHECK ("value" >= 1 AND "value" <= 5), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ratings_userId" ON "ratings" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ratings_recipeId" ON "ratings" ("recipeId") `);
        await queryRunner.query(`CREATE TABLE "recipe_ingredients" ("recipeId" uuid NOT NULL, "ingredientId" uuid NOT NULL, CONSTRAINT "PK_77d03a398e85d333b09b22cda91" PRIMARY KEY ("recipeId", "ingredientId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d7f407ae694e91bb3da1798c6" ON "recipe_ingredients" ("recipeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_05a2b62604dfd9840f4cda76a9" ON "recipe_ingredients" ("ingredientId") `);
        await queryRunner.query(`CREATE TABLE "users_liked_recipes_recipes" ("usersId" uuid NOT NULL, "recipesId" uuid NOT NULL, CONSTRAINT "PK_a7d4a56950ea36702234bdc5a0b" PRIMARY KEY ("usersId", "recipesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dbbc16afe6ef24ef9d3f53c08c" ON "users_liked_recipes_recipes" ("usersId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd527dddb414f3a3353249a895" ON "users_liked_recipes_recipes" ("recipesId") `);
        await queryRunner.query(`ALTER TABLE "recipes" ADD CONSTRAINT "FK_afd4f74f8df44df574253a7f37b" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pantry_items" ADD CONSTRAINT "FK_fe765334f323598ae708b097127" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pantry_items" ADD CONSTRAINT "FK_6ec9dd6e38d58b273da6c967630" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_recipes" ADD CONSTRAINT "FK_ef79f3baa55df3e93ef87f7e44a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_recipes" ADD CONSTRAINT "FK_99e2945dac11da77ec4da894705" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_bbfab9d204f8a93f7da1ab97b32" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "users_liked_recipes_recipes" ADD CONSTRAINT "FK_dbbc16afe6ef24ef9d3f53c08c1" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "users_liked_recipes_recipes" ADD CONSTRAINT "FK_fd527dddb414f3a3353249a895a" FOREIGN KEY ("recipesId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users_liked_recipes_recipes" DROP CONSTRAINT "FK_fd527dddb414f3a3353249a895a"`);
        await queryRunner.query(`ALTER TABLE "users_liked_recipes_recipes" DROP CONSTRAINT "FK_dbbc16afe6ef24ef9d3f53c08c1"`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93"`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_bbfab9d204f8a93f7da1ab97b32"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_4d0b0e3a4c4af854d225154ba40"`);
        await queryRunner.query(`ALTER TABLE "saved_recipes" DROP CONSTRAINT "FK_99e2945dac11da77ec4da894705"`);
        await queryRunner.query(`ALTER TABLE "saved_recipes" DROP CONSTRAINT "FK_ef79f3baa55df3e93ef87f7e44a"`);
        await queryRunner.query(`ALTER TABLE "pantry_items" DROP CONSTRAINT "FK_6ec9dd6e38d58b273da6c967630"`);
        await queryRunner.query(`ALTER TABLE "pantry_items" DROP CONSTRAINT "FK_fe765334f323598ae708b097127"`);
        await queryRunner.query(`ALTER TABLE "recipes" DROP CONSTRAINT "FK_afd4f74f8df44df574253a7f37b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd527dddb414f3a3353249a895"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbbc16afe6ef24ef9d3f53c08c"`);
        await queryRunner.query(`DROP TABLE "users_liked_recipes_recipes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05a2b62604dfd9840f4cda76a9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d7f407ae694e91bb3da1798c6"`);
        await queryRunner.query(`DROP TABLE "recipe_ingredients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ratings_recipeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ratings_userId"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "saved_recipes"`);
        await queryRunner.query(`DROP TABLE "pantry_items"`);
        await queryRunner.query(`DROP TYPE "public"."pantry_items_unit_enum"`);
        await queryRunner.query(`DROP TABLE "recipes"`);
        await queryRunner.query(`DROP TYPE "public"."recipes_mealtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."recipes_cuisine_enum"`);
        await queryRunner.query(`DROP TABLE "ingredients"`);
        await queryRunner.query(`DROP TYPE "public"."ingredients_category_enum"`);
    }

}
