import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { Public } from './decorators/public.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Public()
  // @Post('register')
  // async register(
  //   @Body() registerDto: RegisterDto,
  //   @Res({ passthrough: true }) response: Response,
  // ) {
  //   try {
  //     // 1. Create the user
  //     const user = await this.authService.register(registerDto);

  //     // 2. Auto-login: generate tokens
  //     const { accessToken, refreshToken } = await this.authService.login({
  //       email: registerDto.email,
  //       password: registerDto.password,
  //     });

  //     // 3. Set cookies
  //     response.cookie('Authentication', accessToken, {
  //       httpOnly: true,
  //       path: '/',
  //       maxAge: 15 * 60 * 1000, // 15 minutes
  //       sameSite: 'strict',
  //       secure: process.env.NODE_ENV === 'production',
  //     });

  //     response.cookie('Refresh', refreshToken, {
  //       httpOnly: true,
  //       path: '/auth/refresh',
  //       maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  //       sameSite: 'strict',
  //       secure: process.env.NODE_ENV === 'production',
  //     });

  //     return { message: 'Registration successful', user };
  //   } catch (error) {
  //     console.error('Register error:', error);
  //     throw new HttpException('Registration failed', HttpStatus.BAD_REQUEST);
  //   }
  // }
  @Public()
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const { user, accessToken, refreshToken } =
        await this.authService.register(registerDto);

      response.cookie('Authentication', accessToken, {
        httpOnly: true,
        path: '/',
        maxAge: 15 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });

      response.cookie('Refresh', refreshToken, {
        httpOnly: true,
        path: '/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });

      return { message: 'Registration successful', user };
    } catch (error) {
      console.error('Register error:', error);
      throw new HttpException('Registration failed', HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const { accessToken, refreshToken, user } =
        await this.authService.login(loginDto);

      response.cookie('Authentication', accessToken, {
        httpOnly: true,
        path: '/',
        maxAge: 15 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });

      response.cookie('Refresh', refreshToken, {
        httpOnly: true,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });

      return { message: 'Login successful', user };
    } catch (error) {
      console.error('Login error:', error);
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
  }

  @Auth()
  @ApiBearerAuth('JWT')
  @Post('logout')
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      // await this.authService.logout(user.id);

      response.clearCookie('Authentication', { path: '/' });
      response.clearCookie('Refresh', { path: '/auth/refresh' });

      return { message: 'Successfully logged out' };
    } catch (error) {
      console.error('Logout error:', error);
      throw new HttpException(
        'Logout failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const refreshToken = req.cookies?.Refresh as any;
      console.log(refreshToken);
      if (!refreshToken) {
        throw new HttpException(
          'Refresh token not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const {
        accessToken,
        refreshToken: newRefreshToken,
        user,
      } = await this.authService.refreshTokens(refreshToken);

      response.cookie('Authentication', accessToken, {
        httpOnly: true,
        path: '/',
        maxAge: 15 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });

      if (newRefreshToken) {
        response.cookie('Refresh', newRefreshToken, {
          httpOnly: true,
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      return { user: user, accessToken };
    } catch (error) {
      console.error('Refresh error:', error);
      throw new HttpException(
        'Could not refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Auth()
  @ApiBearerAuth('JWT')
  @Get('me')
  @UsePipes(
    new ValidationPipe({ skipMissingProperties: true, whitelist: true }),
  )
  getCurrentUser(@Req() req: any) {
    return req.user;
  }
}
