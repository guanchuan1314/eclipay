# EcliPay - Multi-chain USDT Payment Gateway

A robust payment infrastructure supporting multiple blockchain networks for USDT transactions.

## Features

- **Multi-chain Support**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Tron, Solana, TON
- **Auto Wallet Generation**: HD wallet derivation for unique payment addresses
- **Real-time Monitoring**: Transaction detection and confirmation tracking
- **Webhook Notifications**: Merchant callbacks for payment events
- **API Authentication**: Secure API key-based merchant authentication
- **Docker Deployment**: Complete containerized setup with PostgreSQL and Redis
- **Dual Environment Support**: Separate configurations for development and production

## Supported Chains

| Chain | Standard | Gas Token | USDT Contract |
|-------|----------|-----------|---------------|
| Ethereum | EVM | ETH | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| BSC | EVM | BNB | 0x55d398326f99059fF775485246999027B3197955 |
| Polygon | EVM | MATIC | 0xc2132D05D31c914a87C6611C10748AEb04B58e8F |
| Arbitrum | EVM | ETH | 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 |
| Optimism | EVM | ETH | 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58 |
| Avalanche | EVM | AVAX | 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7 |
| Tron | TRON | TRX | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| Solana | SOLANA | SOL | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB |
| TON | TON | TON | (Jettons) |

## Quick Start

### Prerequisites
- Docker and Docker Compose v2+
- Domain pointed to your server (for production)
- SSL certificate management (Traefik recommended for production)

### 🚀 Development Setup

Development setup exposes only the frontend web interface (port 3000) to the host. All backend services (API, database, Redis) run internally with hot reload support.

```bash
# 1. Clone the repository
git clone <repository>
cd eclipay

# 2. Create environment file
cp .env.example .env

# 3. Start development environment
docker compose up -d

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: Internal only (accessible via frontend proxy)
```

**Development Features:**
- ✅ Hot reload for frontend and backend
- ✅ Source code volume mounts
- ✅ Only web port exposed (security-focused)
- ✅ Automatic file watching and rebuilds

### 🏭 Production Setup

Production setup exposes all service ports and includes production optimizations, health checks, and Traefik labels for SSL termination.

```bash
# 1. Clone the repository
git clone <repository>
cd eclipay

# 2. Create and configure environment
cp .env.example .env
# Edit .env with your production values:
# - Set strong passwords for DB_PASSWORD, ENCRYPTION_KEY, JWT_SECRET
# - Configure your domain names
# - Set blockchain RPC URLs
# - Configure email/monitoring settings

# 3. Start production environment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Verify deployment
curl http://localhost:3001/health  # Backend API
curl http://localhost:3000/        # Frontend
```

**Production Features:**
- ✅ All ports exposed for monitoring
- ✅ Health checks and automatic restarts
- ✅ Resource limits and performance tuning
- ✅ Traefik labels for SSL/TLS termination
- ✅ Production-optimized container builds
- ✅ Comprehensive environment configuration

### 📊 Port Configuration

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | `:3000` → Host | `:3000` → Host |
| Backend API | Internal only | `:3001` → Host |
| PostgreSQL | Internal only | `:5432` → Host |
| Redis | Internal only | `:6379` → Host |

## Configuration

### Environment Variables

The `.env.example` file contains all available configuration options with documentation. Key variables include:

```bash
# Security (REQUIRED)
ENCRYPTION_KEY=your-32-char-encryption-key
JWT_SECRET=your-32-char-jwt-secret
DB_PASSWORD=secure-database-password

# Domains (Production)
FRONTEND_DOMAIN=payment.yourdomain.com
API_DOMAIN=api.yourdomain.com

# Blockchain RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
BSC_RPC_URL=https://bsc-dataseed.binance.org/
# ... (see .env.example for full list)
```

### SSL/TLS with Traefik

For production deployments with SSL, set up Traefik as a reverse proxy:

```yaml
# /opt/traefik/docker-compose.yml
version: '3.8'
services:
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    command:
      - --providers.docker=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - web

networks:
  web:
    external: true
```

## API Documentation

### Health Check
```bash
GET /health
```

### Authentication
All merchant API endpoints require the `x-api-key` header with a valid API key.

### Create Merchant
```bash
POST /auth/merchants
{
  "name": "My Store",
  "webhookUrl": "https://mystore.com/webhooks/eclipay"
}
```

### Create Invoice
```bash
POST /invoices
Headers: x-api-key: your-api-key
{
  "merchantId": 1,
  "chainId": 1,
  "amount": "100.00",
  "externalId": "order-123",
  "callbackUrl": "https://mystore.com/payment/callback"
}
```

### Get Payment Address
```bash
GET /invoices/{id}/payment-address
Headers: x-api-key: your-api-key
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Merchant    │    │     EcliPay     │    │   Blockchain    │
│   Application   │    │    Gateway      │    │    Networks     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │  1. Create Invoice      │                        │
         ├────────────────────────►│                        │
         │                        │                        │
         │  2. Payment Address     │                        │
         ◄────────────────────────┤                        │
         │                        │                        │
         │                        │  3. Monitor Address    │
         │                        ├───────────────────────►│
         │                        │                        │
         │                        │  4. Detect Payment     │
         │                        ◄───────────────────────┤
         │                        │                        │
         │  5. Webhook Callback    │                        │
         ◄────────────────────────┤                        │
```

## Management Commands

### Development
```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

### Production
```bash
# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f

# Update and restart
docker compose pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Database backup
docker compose exec postgres pg_dump -U eclipay eclipay > backup.sql
```

### Monitoring
```bash
# Service status
docker compose ps

# Resource usage
docker stats

# Health checks
curl http://localhost:3001/health
curl http://localhost:3000/

# Database connection
docker compose exec postgres psql -U eclipay -d eclipay

# Redis connection
docker compose exec redis redis-cli ping
```

## Database Schema

- **chains**: Blockchain network configurations
- **merchants**: API key authentication and webhooks  
- **master_wallets**: Root wallets for each chain
- **sub_wallets**: Derived addresses for payments
- **invoices**: Payment requests and status
- **transactions**: Blockchain transaction records

## Development Workflow

### Local Development
```bash
# Install dependencies locally (optional, for IDE support)
npm install

# Start development environment
docker compose up -d

# Run tests
docker compose exec backend npm test
docker compose exec backend npm run test:e2e

# Database migrations (if needed)
docker compose exec backend npm run typeorm migration:run
```

### Hot Reload

The development environment supports hot reload:
- **Frontend**: Next.js fast refresh for React components
- **Backend**: TypeScript compilation and restart on file changes
- **Database**: Schema changes via mounted migration files

## Security Features

- ✅ API keys hashed with bcrypt
- ✅ Private keys encrypted at rest
- ✅ HTTPS enforced via reverse proxy
- ✅ CORS and security headers configured
- ✅ Webhook signature verification
- ✅ Rate limiting on API endpoints
- ✅ Database connection encryption
- ✅ Environment-based configuration

## Monitoring & Observability

- **Health Endpoints**: `/health` for service status
- **Metrics**: Transaction and invoice statistics endpoints
- **Logging**: Structured JSON logs via Docker
- **Alerts**: Webhook delivery failures and retry logic
- **Performance**: Database query optimization and caching

## Scaling Considerations

### Horizontal Scaling
- Run multiple backend instances behind a load balancer
- Use shared Redis for session storage
- Implement database read replicas for analytics

### Resource Optimization
- Backend: 2 CPU cores, 1GB RAM per instance
- PostgreSQL: 1 CPU core, 1GB RAM
- Redis: 0.5 CPU cores, 1GB RAM
- Frontend: 1 CPU core, 512MB RAM

### High Availability
- Multi-zone database deployment
- Redis clustering for cache redundancy
- External monitoring services for address watching
- Automated backup and recovery procedures

## Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check logs
docker compose logs

# Rebuild containers
docker compose build --no-cache
docker compose up -d
```

**Database connection issues:**
```bash
# Check database status
docker compose exec postgres pg_isready

# Reset database (development only)
docker compose down -v
docker compose up -d
```

**Frontend not accessible:**
```bash
# Check if port is bound
netstat -tlnp | grep :3000

# Check container status
docker compose ps
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - See LICENSE file for details

---

**Need Help?** Check the logs with `docker compose logs -f` or open an issue for support.