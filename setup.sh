#!/bin/bash

# EcliPay Production Setup Script
# Installs and configures EcliPay on a bare Ubuntu server (no Docker)
# Compatible with Ubuntu 22.04/24.04

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Progress tracking
STEP=0
TOTAL_STEPS=12

print_step() {
    STEP=$((STEP + 1))
    echo -e "\n${BLUE}${BOLD}[Step $STEP/$TOTAL_STEPS] $1${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

generate_random() {
    openssl rand -hex 16
}

check_os() {
    if [[ ! -f /etc/lsb-release ]]; then
        print_error "This script only supports Ubuntu. Please use Ubuntu 22.04 or 24.04."
        exit 1
    fi
    
    source /etc/lsb-release
    if [[ "$DISTRIB_ID" != "Ubuntu" ]]; then
        print_error "This script only supports Ubuntu. Please use Ubuntu 22.04 or 24.04."
        exit 1
    fi
    
    if [[ "$DISTRIB_RELEASE" != "22.04" && "$DISTRIB_RELEASE" != "24.04" ]]; then
        print_error "This script supports Ubuntu 22.04 or 24.04. Found: $DISTRIB_RELEASE"
        exit 1
    fi
    
    print_success "Operating system check passed: Ubuntu $DISTRIB_RELEASE"
}

install_prerequisites() {
    print_step "Installing system prerequisites"
    
    # Update package list
    apt-get update
    
    # Install basic tools
    apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release build-essential git
    
    # Add Node.js 18 LTS repository
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    
    # Add PostgreSQL 16 repository
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
    
    # Update package list with new repositories
    apt-get update
    
    # Install all packages
    apt-get install -y \
        nodejs \
        postgresql-16 \
        postgresql-client-16 \
        postgresql-contrib-16 \
        redis-server \
        nginx \
        certbot \
        python3-certbot-nginx \
        openssl
    
    # Install PM2 globally
    npm install -g pm2
    
    # Start and enable services
    systemctl enable postgresql
    systemctl start postgresql
    systemctl enable redis-server
    systemctl start redis-server
    systemctl enable nginx
    systemctl start nginx
    
    print_success "System prerequisites installed successfully"
}

prompt_for_inputs() {
    print_step "Collecting configuration variables"
    
    echo -e "${BOLD}Please provide the following configuration values:${NC}"
    echo -e "${YELLOW}For secrets, press Enter to auto-generate or type your own value${NC}\n"
    
    # Domain configuration
    read -p "$(echo -e "${BOLD}Domain name${NC} (e.g., eclipay.com): ")" DOMAIN_NAME
    if [[ -z "$DOMAIN_NAME" ]]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    read -p "$(echo -e "${BOLD}Admin email${NC} (for Let's Encrypt): ")" ADMIN_EMAIL
    if [[ -z "$ADMIN_EMAIL" ]]; then
        print_error "Admin email is required"
        exit 1
    fi
    
    # Database configuration
    echo -e "\n${BOLD}Database Configuration:${NC}"
    read -p "Database name (default: eclipay): " DB_NAME
    DB_NAME=${DB_NAME:-eclipay}
    
    read -p "Database user (default: eclipay): " DB_USER
    DB_USER=${DB_USER:-eclipay}
    
    read -p "Database password (press Enter to auto-generate): " DB_PASSWORD
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(generate_random)
        echo -e "${GREEN}Generated database password: $DB_PASSWORD${NC}"
    fi
    
    # Application secrets
    echo -e "\n${BOLD}Application Secrets:${NC}"
    read -p "JWT secret (press Enter to auto-generate): " JWT_SECRET
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(generate_random)
        echo -e "${GREEN}Generated JWT secret: $JWT_SECRET${NC}"
    fi
    
    read -p "Encryption key (press Enter to auto-generate): " ENCRYPTION_KEY
    if [[ -z "$ENCRYPTION_KEY" ]]; then
        ENCRYPTION_KEY=$(generate_random)
        echo -e "${GREEN}Generated encryption key: $ENCRYPTION_KEY${NC}"
    fi
    
    # Admin user
    echo -e "\n${BOLD}Initial Admin User:${NC}"
    read -p "Admin username: " ADMIN_USERNAME
    if [[ -z "$ADMIN_USERNAME" ]]; then
        print_error "Admin username is required"
        exit 1
    fi
    
    read -p "Admin email: " ADMIN_USER_EMAIL
    if [[ -z "$ADMIN_USER_EMAIL" ]]; then
        print_error "Admin email is required"
        exit 1
    fi
    
    read -s -p "Admin password: " ADMIN_PASSWORD
    echo
    if [[ -z "$ADMIN_PASSWORD" ]]; then
        print_error "Admin password is required"
        exit 1
    fi
    
    # SMTP configuration (optional)
    echo -e "\n${BOLD}SMTP Configuration (optional - press Enter to skip):${NC}"
    read -p "SMTP host: " SMTP_HOST
    if [[ -n "$SMTP_HOST" ]]; then
        read -p "SMTP port (default: 587): " SMTP_PORT
        SMTP_PORT=${SMTP_PORT:-587}
        read -p "SMTP user: " SMTP_USER
        read -s -p "SMTP password: " SMTP_PASS
        echo
        read -p "SMTP from address: " SMTP_FROM
    fi
    
    # RPC URLs with sensible defaults
    echo -e "\n${BOLD}Blockchain RPC URLs (press Enter for defaults):${NC}"
    
    read -p "Ethereum RPC (default: https://eth.llamarpc.com): " ETHEREUM_RPC
    ETHEREUM_RPC=${ETHEREUM_RPC:-https://eth.llamarpc.com}
    
    read -p "BSC RPC (default: https://bsc-dataseed.binance.org/): " BSC_RPC
    BSC_RPC=${BSC_RPC:-https://bsc-dataseed.binance.org/}
    
    read -p "Polygon RPC (default: https://polygon-rpc.com/): " POLYGON_RPC
    POLYGON_RPC=${POLYGON_RPC:-https://polygon-rpc.com/}
    
    read -p "Arbitrum RPC (default: https://arb1.arbitrum.io/rpc): " ARBITRUM_RPC
    ARBITRUM_RPC=${ARBITRUM_RPC:-https://arb1.arbitrum.io/rpc}
    
    read -p "Optimism RPC (default: https://mainnet.optimism.io): " OPTIMISM_RPC
    OPTIMISM_RPC=${OPTIMISM_RPC:-https://mainnet.optimism.io}
    
    read -p "Avalanche RPC (default: https://api.avax.network/ext/bc/C/rpc): " AVALANCHE_RPC
    AVALANCHE_RPC=${AVALANCHE_RPC:-https://api.avax.network/ext/bc/C/rpc}
    
    read -p "Tron RPC (default: https://api.trongrid.io): " TRON_RPC
    TRON_RPC=${TRON_RPC:-https://api.trongrid.io}
    
    read -p "Solana RPC (default: https://api.mainnet-beta.solana.com): " SOLANA_RPC
    SOLANA_RPC=${SOLANA_RPC:-https://api.mainnet-beta.solana.com}
    
    read -p "TON RPC (default: https://toncenter.com/api/v2/jsonRPC): " TON_RPC
    TON_RPC=${TON_RPC:-https://toncenter.com/api/v2/jsonRPC}
    
    print_success "Configuration collected successfully"
}

setup_postgresql() {
    print_step "Setting up PostgreSQL database"
    
    # Create database user and database
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    # Configure PostgreSQL for production
    PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"
    
    # Update PostgreSQL configuration for production
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" $PG_CONFIG_DIR/postgresql.conf
    sed -i "s/#max_connections = 100/max_connections = 200/" $PG_CONFIG_DIR/postgresql.conf
    sed -i "s/#shared_buffers = 128MB/shared_buffers = 256MB/" $PG_CONFIG_DIR/postgresql.conf
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    print_success "PostgreSQL configured and ready"
}

create_env_file() {
    print_step "Creating environment configuration"
    
    cat > .env << EOF
# EcliPay Production Configuration
# Generated on $(date)

# =======================
# APPLICATION SETTINGS
# =======================
NODE_ENV=production
PORT=3001

# =======================
# DOMAIN CONFIGURATION
# =======================
FRONTEND_DOMAIN=$DOMAIN_NAME
API_DOMAIN=$DOMAIN_NAME
FRONTEND_API_URL=https://$DOMAIN_NAME/api

# =======================
# DATABASE CONFIGURATION
# =======================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# =======================
# REDIS CONFIGURATION
# =======================
REDIS_HOST=localhost
REDIS_PORT=6379

# =======================
# SECURITY CONFIGURATION
# =======================
ENCRYPTION_KEY=$ENCRYPTION_KEY
JWT_SECRET=$JWT_SECRET

# API rate limiting (requests per minute per IP)
RATE_LIMIT_TTL=60000
RATE_LIMIT_LIMIT=100

# =======================
# BLOCKCHAIN RPC URLS
# =======================
ETHEREUM_RPC_URL=$ETHEREUM_RPC
BSC_RPC_URL=$BSC_RPC
POLYGON_RPC_URL=$POLYGON_RPC
ARBITRUM_RPC_URL=$ARBITRUM_RPC
OPTIMISM_RPC_URL=$OPTIMISM_RPC
AVALANCHE_RPC_URL=$AVALANCHE_RPC
TRON_RPC_URL=$TRON_RPC
SOLANA_RPC_URL=$SOLANA_RPC
TON_RPC_URL=$TON_RPC

# =======================
# WEBHOOK CONFIGURATION
# =======================
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY=5000

# =======================
# MONITORING & LOGGING
# =======================
LOG_LEVEL=info
ENABLE_MONITORING=true

# Transaction confirmation requirements
MIN_CONFIRMATIONS_ETH=12
MIN_CONFIRMATIONS_BSC=15
MIN_CONFIRMATIONS_POLYGON=20
MIN_CONFIRMATIONS_ARBITRUM=1
MIN_CONFIRMATIONS_OPTIMISM=1
MIN_CONFIRMATIONS_AVALANCHE=1
MIN_CONFIRMATIONS_TRON=20
MIN_CONFIRMATIONS_SOLANA=32
MIN_CONFIRMATIONS_TON=1
EOF

    # Add SMTP configuration if provided
    if [[ -n "$SMTP_HOST" ]]; then
        cat >> .env << EOF

# =======================
# EMAIL CONFIGURATION
# =======================
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=true
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
EOF
    fi

    cat >> .env << EOF

# =======================
# DEVELOPMENT SETTINGS
# =======================
DEBUG=false
CORS_ORIGIN=https://$DOMAIN_NAME

# Database connection pool size
DB_POOL_SIZE=10
REDIS_POOL_SIZE=10

# =======================
# PERFORMANCE TUNING
# =======================
NODE_OPTIONS=--max-old-space-size=2048
WORKER_THREADS=4
MAX_WEBHOOK_CONCURRENCY=50
CHAIN_CACHE_TTL=300
EOF

    print_success "Environment file created"
}

setup_backend() {
    print_step "Setting up backend application"
    
    # Install production dependencies
    npm install --production
    
    # Build the application (if not already built)
    if [[ ! -d "dist" ]] || [[ "src" -nt "dist" ]]; then
        npm run build
    fi
    
    # Run database migrations
    npm run typeorm migration:run
    
    print_success "Backend application ready"
}

setup_frontend() {
    print_step "Setting up frontend application"
    
    cd frontend
    
    # Install dependencies and build
    npm install
    npm run build
    
    cd ..
    
    print_success "Frontend application built"
}

setup_nginx() {
    print_step "Configuring Nginx reverse proxy"
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/$DOMAIN_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;
    
    # SSL configuration (will be updated by Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # File uploads
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 10M;
    }
    
    # Frontend proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Next.js specific
        proxy_buffering off;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    print_success "Nginx configuration created"
}

setup_ssl() {
    print_step "Setting up SSL with Let's Encrypt"
    
    # Stop Nginx temporarily for initial certificate generation
    systemctl stop nginx
    
    # Generate SSL certificate
    certbot certonly --standalone -d $DOMAIN_NAME --email $ADMIN_EMAIL --agree-tos --non-interactive
    
    # Start Nginx
    systemctl start nginx
    
    # Configure automatic renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx") | crontab -
    
    print_success "SSL certificate installed and auto-renewal configured"
}

setup_pm2() {
    print_step "Setting up PM2 process manager"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'eclipay-api',
      script: './dist/main.js',
      cwd: '$(pwd)',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      restart_delay: 5000,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'eclipay-web',
      script: 'npm',
      args: 'start',
      cwd: '$(pwd)/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      restart_delay: 5000,
      max_memory_restart: '512M'
    }
  ]
};
EOF

    # Create logs directory
    mkdir -p logs frontend/logs
    
    # Start applications with PM2
    pm2 start ecosystem.config.js
    
    # Configure PM2 to start on boot
    pm2 startup
    pm2 save
    
    print_success "PM2 configured and applications started"
}

create_update_script() {
    print_step "Creating update script"
    
    cat > update.sh << 'EOF'
#!/bin/bash

# EcliPay Update Script
# Updates the application to the latest version

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

print_step() {
    echo -e "\n${BLUE}${BOLD}$1${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_step "Starting EcliPay update..."

# Git pull latest changes
print_step "Pulling latest code..."
git pull origin main

# Update backend
print_step "Updating backend dependencies..."
npm install --production

# Update frontend
print_step "Updating frontend dependencies..."
cd frontend
npm install
cd ..

# Build applications
print_step "Building applications..."
npm run build
cd frontend
npm run build
cd ..

# Run new migrations
print_step "Running database migrations..."
npm run typeorm migration:run

# Restart applications
print_step "Restarting applications..."
pm2 restart all

# Wait for applications to start
sleep 5

# Health check
print_step "Performing health check..."
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    print_success "Backend is healthy"
else
    echo "⚠️ Backend health check failed"
fi

if curl -f http://localhost:3000/ >/dev/null 2>&1; then
    print_success "Frontend is healthy"
else
    echo "⚠️ Frontend health check failed"
fi

print_success "Update completed successfully!"
echo -e "\n${BOLD}Application URLs:${NC}"
echo "🌐 Website: https://$(hostname -f)"
echo "📊 PM2 Status: pm2 status"
echo "📋 Logs: pm2 logs"
EOF

    chmod +x update.sh
    
    print_success "Update script created (./update.sh)"
}

perform_health_check() {
    print_step "Performing final health check"
    
    echo "Checking services..."
    
    # Check PostgreSQL
    if systemctl is-active --quiet postgresql; then
        print_success "PostgreSQL is running"
    else
        print_error "PostgreSQL is not running"
        exit 1
    fi
    
    # Check Redis
    if systemctl is-active --quiet redis-server; then
        print_success "Redis is running"
    else
        print_error "Redis is not running"
        exit 1
    fi
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx is running"
    else
        print_error "Nginx is not running"
        exit 1
    fi
    
    # Wait for applications to start
    echo "Waiting for applications to start..."
    sleep 10
    
    # Check backend API
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Backend API is responding"
    else
        print_warning "Backend API is not responding (may still be starting)"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000/ >/dev/null 2>&1; then
        print_success "Frontend is responding"
    else
        print_warning "Frontend is not responding (may still be starting)"
    fi
    
    # Check HTTPS
    if curl -f https://$DOMAIN_NAME/ >/dev/null 2>&1; then
        print_success "HTTPS is working"
    else
        print_warning "HTTPS check failed (DNS may not be propagated yet)"
    fi
    
    print_success "Health check completed"
}

print_summary() {
    echo -e "\n${GREEN}${BOLD}🎉 EcliPay installation completed successfully!${NC}\n"
    
    echo -e "${BOLD}Application URLs:${NC}"
    echo "🌐 Website: https://$DOMAIN_NAME"
    echo "🔗 API: https://$DOMAIN_NAME/api"
    echo ""
    
    echo -e "${BOLD}Management Commands:${NC}"
    echo "📊 View status: pm2 status"
    echo "📋 View logs: pm2 logs"
    echo "🔄 Restart all: pm2 restart all"
    echo "🆙 Update app: ./update.sh"
    echo ""
    
    echo -e "${BOLD}System Services:${NC}"
    echo "🗄️  Database: sudo systemctl status postgresql"
    echo "🏪 Cache: sudo systemctl status redis-server"
    echo "🌐 Web server: sudo systemctl status nginx"
    echo ""
    
    echo -e "${BOLD}Configuration Files:${NC}"
    echo "⚙️  Environment: .env"
    echo "🔧 Nginx: /etc/nginx/sites-available/$DOMAIN_NAME"
    echo "🚀 PM2: ecosystem.config.js"
    echo ""
    
    echo -e "${BOLD}Important Security Notes:${NC}"
    echo "🔐 Database password: $DB_PASSWORD"
    echo "🔑 JWT secret: $JWT_SECRET"
    echo "🔒 Encryption key: $ENCRYPTION_KEY"
    echo -e "${YELLOW}Store these credentials securely!${NC}"
    echo ""
    
    echo -e "${BOLD}Next Steps:${NC}"
    echo "1. Point your domain DNS to this server's IP"
    echo "2. Access https://$DOMAIN_NAME to verify installation"
    echo "3. Create your first merchant via the API"
    echo "4. Set up monitoring and backups"
    echo ""
    
    echo -e "${BLUE}Need help? Check the logs with 'pm2 logs' or visit the documentation${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                     EcliPay Production Setup                        ║"
    echo "║                                                                      ║"
    echo "║  This script will install EcliPay natively on Ubuntu 22.04/24.04    ║"
    echo "║  Make sure you have root access and a domain pointed to this server  ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root. Use: sudo ./setup.sh"
        exit 1
    fi
    
    # Check if in correct directory
    if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
        print_error "This script must be run from the EcliPay root directory"
        exit 1
    fi
    
    # Pre-flight checks
    check_os
    
    # Confirm before proceeding
    read -p "$(echo -e "${YELLOW}Continue with installation? (y/N): ${NC}")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    # Execute setup steps
    install_prerequisites
    prompt_for_inputs
    setup_postgresql
    create_env_file
    setup_backend
    setup_frontend
    setup_nginx
    setup_ssl
    setup_pm2
    create_update_script
    perform_health_check
    print_summary
}

# Run main function
main "$@"