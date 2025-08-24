import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidatorOptions } from 'class-validator';
import { plainToClass, ClassTransformOptions } from 'class-transformer';

export interface ValidationPipeOptions extends ValidatorOptions {
  transform?: boolean;
  transformOptions?: ClassTransformOptions;
}

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly options: ValidationPipeOptions;

  constructor(options?: ValidationPipeOptions) {
    this.options = {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: {
        target: false,
        value: false,
      },
      ...options,
    };
  }

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value, {
      enableImplicitConversion: true,
      ...this.options.transformOptions,
    });

    const errors = await validate(object, this.options);

    if (errors.length > 0) {
      const message = this.formatErrors(errors);
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: message,
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]) {
    return errors.map((err) => {
      const constraints = err.constraints || {};
      return {
        property: err.property,
        value: err.value,
        constraints: Object.values(constraints),
      };
    });
  }
}
