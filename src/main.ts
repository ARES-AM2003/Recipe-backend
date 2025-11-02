import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser'; // ✅ Added for cookie-based JWT
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe as CustomValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  // ✅ Increase body size limit for bulk operations
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  // ✅ Enable cookie parsing for JWT extraction
  app.use(cookieParser());

  // ✅ Enable CORS
  // console.log(process.env.ALLOWED_ORIGINS?.split(','));
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // ✅ Required for sending/receiving cookies
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  // ✅ Set global API prefix
  app.setGlobalPrefix('api');

  // ✅ Apply global filters and interceptors (validation pipe configured in app.module.ts)
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ✅ Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Recipe Recommendation API')
    .setDescription('API for the Smart Recipe Recommendation System')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      requestInterceptor: (req) => {
        // Ensure cookies are sent
        req.credentials = 'include';
        return req;
      },
    },
  });

  // ✅ Start the server
  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`✅ Application is running at: http://localhost:${port}`);
  console.log(
    `📘 Swagger docs available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start the application', err);
  process.exit(1);
});
