import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';

interface RegisterDto {
  username: string;
  password: string;
  email?: string;
}

interface LoginDto {
  username: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: any; token: string }> {
    // Check if username already exists
    const existingUser = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists
    if (dto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = this.userRepository.create({
      username: dto.username,
      password_hash: hashedPassword,
      email: dto.email,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate JWT token
    const payload = { userId: savedUser.id, username: savedUser.username };
    const token = jwt.sign(payload, process.env.ENCRYPTION_KEY, { expiresIn: '24h' });

    return {
      user: {
        id: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        createdAt: savedUser.created_at,
      },
      token,
    };
  }

  async login(dto: LoginDto): Promise<{ user: any; token: string }> {
    // Find user by username
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { userId: user.id, username: user.username };
    const token = jwt.sign(payload, process.env.ENCRYPTION_KEY, { expiresIn: '24h' });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    };
  }

  async getProfile(userId: number): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
    };
  }

  async validateJwtToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, process.env.ENCRYPTION_KEY) as any;
      return this.userRepository.findOne({ where: { id: payload.userId } });
    } catch (error) {
      return null;
    }
  }

  async validateApiKey(apiKey: string): Promise<Project | null> {
    if (!apiKey) {
      return null;
    }

    const projects = await this.projectRepository.find({
      where: { active: true },
      relations: ['user'],
    });

    for (const project of projects) {
      const isValid = await bcrypt.compare(apiKey, project.api_key_hash);
      if (isValid) {
        return project;
      }
    }

    return null;
  }

  generateApiKey(): string {
    // Generate a secure API key (e.g., eclipay_live_1234567890abcdef...)
    const prefix = process.env.NODE_ENV === 'production' ? 'eclipay_live_' : 'eclipay_test_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return prefix + randomBytes;
  }
}