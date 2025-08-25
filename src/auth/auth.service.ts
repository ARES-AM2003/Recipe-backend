import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Validate JWT secrets on startup
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets must be defined in environment variables');
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'>> {
    try {
      const user = await this.usersService.findByEmail(email);
      this.logger.debug(`User lookup for email: ${email.substring(0, 3)}***`);

      if (!user) {
        this.logger.debug(`No user found with email: ${email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.password) {
        this.logger.error(`User ${user.id} has no password set`);
        throw new UnauthorizedException('Invalid credentials');
      }
      console.log(user.password);
      console.log({
        plain: password,
        hashInDB: user.password,
        valid: await bcrypt.compare(password.trim(), user.password),
      });

      const isPasswordValid = await bcrypt.compare(
        password.trim(),
        user.password,
      );

      if (!isPasswordValid) {
        this.logger.debug(`Invalid password for user: ${user.id}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Error in validateUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  // async register(registerDto: RegisterDto) {
  //   const existingUser = await this.usersService.findByEmail(registerDto.email);
  //   if (existingUser) {
  //     throw new BadRequestException('Email already in use');
  //   }

  //   const hashedPassword = await bcrypt.hash(registerDto.password, 10);
  //   const user = await this.usersService.create({
  //     ...registerDto,
  //     password: hashedPassword,
  //   });

  //   return this.generateTokens(user);
  // }
  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      // password: hashedPassword,
    });

    // Return both the user and tokens
    const tokens = await this.generateTokens(user);
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      const user = await this.usersService.findById(payload.userId);
      if (!user || !user.currentHashedRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(
        refreshToken,
        user.currentHashedRefreshToken,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const userData: Omit<User, 'password'> = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        dietaryPreferences: user.dietaryPreferences || [],
        allergies: user.allergies || [],
        recipes: user.recipes || [],
        pantryItems: user.pantryItems || [],
        likedRecipes: user.likedRecipes || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        currentHashedRefreshToken: user.currentHashedRefreshToken,
      };

      return this.generateTokens(userData);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async generateTokens(user: Omit<User, 'password'>) {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ),
      }),
    ]);
    await this.usersService.updateToken(
      payload.userId,
      await bcrypt.hash(refreshToken, 10),
    );

    return {
      accessToken,
      refreshToken,
      user: user,
    };
  }
}
