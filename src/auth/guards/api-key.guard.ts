import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JWT_AUTH_KEY } from '../decorators/jwt-auth.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    const isJwtAuth = this.reflector.getAllAndOverride<boolean>(JWT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Allow public endpoints and JWT-protected endpoints (handled by JWT guard)
    if (isPublic || isJwtAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const project = await this.authService.validateApiKey(apiKey);
    if (!project) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach project to request for use in controllers
    request.project = project;
    return true;
  }

  private extractApiKey(request: any): string | undefined {
    // Check for API key in header (x-api-key)
    const headerApiKey = request.headers['x-api-key'];
    if (headerApiKey) {
      return headerApiKey;
    }

    // Check for API key in Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}