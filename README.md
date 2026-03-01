# EcliPay - Multi-chain USDT Payment Gateway

A robust payment infrastructure supporting multiple blockchain networks for USDT transactions.

## Features

- **Multi-chain Support**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Tron, Solana, TON
- **Auto Wallet Generation**: HD wallet derivation for unique payment addresses
- **Real-time Monitoring**: Transaction detection and confirmation tracking
- **Webhook Notifications**: Merchant callbacks for payment events
- **API Authentication**: Secure API key-based merchant authentication
- **Docker Deployment**: Complete containerized setup with PostgreSQL and Redis

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
- Docker and Docker Compose
- Domain pointed to your server (payment_gateway.guanchuanlee.com)

### 1. Clone and Setup
```bash
git clone <repository>
cd eclipay
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Services
```bash
docker compose up -d
```

### 3. Verify Health
```bash
curl https://payment_gateway.guanchuanlee.com/health
```

## API Endpoints

### Health Check
```bash
GET /health
```

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

## Database Schema

- **chains**: Blockchain network configurations
- **merchants**: API key authentication and webhooks
- **master_wallets**: Root wallets for each chain
- **sub_wallets**: Derived addresses for payments
- **invoices**: Payment requests and status
- **transactions**: Blockchain transaction records

## Development

### Local Setup
```bash
npm install
npm run start:dev
```

### Database Migrations
```bash
# The initial schema is automatically applied via Docker
# For new migrations, use TypeORM CLI
npm run typeorm migration:generate src/database/migrations/NewMigration
npm run typeorm migration:run
```

### Testing
```bash
npm test
npm run test:e2e
```

## Security

- API keys are hashed using bcrypt
- Private keys are encrypted at rest
- HTTPS enforced via Caddy
- CORS and security headers configured
- Webhook signatures for verification

## Monitoring

- Health check endpoint: `/health`
- Transaction statistics: `/transactions/stats/summary`
- Invoice statistics: `/invoices/stats/summary`
- Logs available via Docker: `docker compose logs -f`

## Scaling

- Horizontal scaling: Run multiple app instances behind load balancer
- Database: Use PostgreSQL read replicas for analytics
- Redis: Cluster mode for high availability
- Monitoring: Use external address monitoring services for redundancy

## License

MIT License - See LICENSE file for details