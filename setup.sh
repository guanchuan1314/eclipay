#!/bin/bash

# EcliPay Production Setup Script
# This script sets up EcliPay on a fresh Ubuntu server

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to generate random string
generate_random() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to prompt for input with default
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        if [ -z "$input" ]; then
            eval "$var_name='$default'"
        else
            eval "$var_name='$input'"
        fi
    else
        read -p "$prompt: " input
        eval "$var_name='$input'"
    fi
}

# Function to prompt for password
prompt_password() {
    local prompt="$1"
    local var_name="$2"
    
    echo -n "$prompt: "
    read -s password
    echo
    eval "$var_name='$password'"
}

# Function to check if port is available
check_port() {
    local port=$1
    if netstat -tuln | grep -q ":$port "; then
        return 1
    fi
    return 0
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec eclipay_$service_name sh -c "netstat -tuln | grep -q :$port" 2>/dev/null; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is not recommended for production."
        read -p "Continue anyway? (y/N): " continue_root
        if [[ ! "$continue_root" =~ ^[Yy]$ ]]; then
            print_error "Please run this script as a non-root user with sudo privileges."
            exit 1
        fi
    fi
}

# Check if we're in the correct directory
check_directory() {
    if [ ! -f "docker-compose.yml" ] || [ ! -f "package.json" ]; then
        print_error "This script must be run from the EcliPay project root directory."
        print_error "Expected files: docker-compose.yml, package.json"
        exit 1
    fi
}

# Install prerequisites
install_prerequisites() {
    print_header "Installing Prerequisites"
    
    # Update package list
    print_status "Updating package list..."
    sudo apt-get update -qq
    
    # Install required packages
    print_status "Installing required packages..."
    sudo apt-get install -y -qq curl wget gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release openssl netstat-nat
    
    # Install Docker if not present
    if ! command_exists docker; then
        print_status "Installing Docker..."
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io
        sudo systemctl enable docker
        sudo systemctl start docker
        sudo usermod -aG docker $USER
        print_success "Docker installed successfully"
    else
        print_success "Docker is already installed"
    fi
    
    # Install Docker Compose if not present
    if ! command_exists docker-compose; then
        print_status "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installed successfully"
    else
        print_success "Docker Compose is already installed"
    fi
    
    # Install Node.js if not present (for potential future use)
    if ! command_exists node; then
        print_status "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
        print_success "Node.js installed successfully"
    else
        print_success "Node.js is already installed"
    fi
    
    # Verify installations
    print_status "Verifying installations..."
    docker --version
    docker-compose --version
    node --version
    
    print_success "All prerequisites are installed"
}

# Collect configuration
collect_config() {
    print_header "Configuration Setup"
    
    # Check if .env already exists
    if [ -f ".env" ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " overwrite_env
        if [[ ! "$overwrite_env" =~ ^[Yy]$ ]]; then
            print_status "Keeping existing .env file"
            return 0
        fi
    fi
    
    # Domain name
    prompt_input "Enter your domain name (e.g., payment.yourdomain.com)" "" "DOMAIN_NAME"
    
    # Database configuration
    prompt_input "Enter database password" "$(generate_random)" "DB_PASSWORD"
    
    # Encryption key
    prompt_input "Enter encryption key" "$(generate_random)" "ENCRYPTION_KEY"
    
    # JWT secret
    prompt_input "Enter JWT secret" "$(generate_random)" "JWT_SECRET"
    
    # Environment
    prompt_input "Environment (production/staging)" "production" "NODE_ENV"
    
    # Create .env file
    print_status "Creating .env file..."
    cat > .env << EOF
# Application
NODE_ENV=${NODE_ENV}
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=eclipay
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=eclipay

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Security
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}

# Chain RPC URLs (optional overrides)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
BSC_RPC_URL=https://bsc-dataseed.binance.org/
POLYGON_RPC_URL=https://polygon-rpc.com/
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
TRON_RPC_URL=https://api.trongrid.io
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
EOF

    print_success ".env file created successfully"
}

# Setup SSL/TLS with Traefik
setup_ssl() {
    print_header "Setting up SSL/TLS with Traefik"
    
    # Check if Traefik network exists
    if ! docker network ls | grep -q "web"; then
        print_status "Creating Traefik network..."
        docker network create web
        print_success "Traefik network created"
    else
        print_success "Traefik network already exists"
    fi
    
    # Update docker-compose.yml with the correct domain
    print_status "Updating domain configuration..."
    sed -i "s/payment-gateway\.guanchuanlee\.com/$DOMAIN_NAME/g" docker-compose.yml
    
    # Check if Traefik is running
    if ! docker ps | grep -q traefik; then
        print_status "Traefik is not running. You'll need to set up Traefik separately."
        print_status "Creating basic Traefik configuration..."
        
        # Create Traefik directory if it doesn't exist
        sudo mkdir -p /opt/traefik
        
        # Create Traefik docker-compose file
        cat > /opt/traefik/docker-compose.yml << EOF
version: '3.7'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command:
      - --api.dashboard=true
      - --api.debug=true
      - --log.level=DEBUG
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=admin@$DOMAIN_NAME
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(\`traefik.$DOMAIN_NAME\`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.services.traefik.loadbalancer.server.port=8080"

volumes:
  traefik_letsencrypt:

networks:
  web:
    external: true
EOF

        print_status "Starting Traefik..."
        cd /opt/traefik && docker-compose up -d
        cd - > /dev/null
        
        print_success "Traefik started successfully"
    else
        print_success "Traefik is already running"
    fi
}

# Build and start containers
start_services() {
    print_header "Building and Starting Services"
    
    # Check if ports are available
    print_status "Checking port availability..."
    if ! check_port 3000; then
        print_error "Port 3000 is already in use"
        print_error "Please stop the service using this port and try again"
        exit 1
    fi
    
    if ! check_port 3001; then
        print_error "Port 3001 is already in use"
        print_error "Please stop the service using this port and try again"
        exit 1
    fi
    
    # Stop existing containers if running
    print_status "Stopping any existing containers..."
    docker-compose down 2>/dev/null || true
    
    # Build images
    print_status "Building Docker images..."
    docker-compose build --no-cache
    
    # Start services
    print_status "Starting services..."
    docker-compose up -d
    
    print_success "Services started successfully"
}

# Verify services health
verify_services() {
    print_header "Verifying Service Health"
    
    # Wait for database
    wait_for_service "postgres" 5432
    
    # Wait for Redis
    wait_for_service "redis" 6379
    
    # Wait for backend API
    print_status "Waiting for backend API..."
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            print_success "Backend API is ready!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "Backend API failed to start"
            print_error "Check logs with: docker-compose logs app"
            return 1
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    # Wait for frontend
    print_status "Waiting for frontend..."
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3001 >/dev/null 2>&1; then
            print_success "Frontend is ready!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            print_error "Frontend failed to start"
            print_error "Check logs with: docker-compose logs frontend"
            return 1
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_success "All services are healthy!"
}

# Create admin user
create_admin_user() {
    print_header "Creating Admin User"
    
    # Collect admin credentials
    prompt_input "Enter admin email" "admin@$DOMAIN_NAME" "ADMIN_EMAIL"
    prompt_password "Enter admin password" "ADMIN_PASSWORD"
    prompt_input "Enter admin name" "Admin" "ADMIN_NAME"
    
    # Create admin user via API
    print_status "Creating admin user..."
    
    # First, try to create the user
    local response
    response=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/auth/register \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$ADMIN_PASSWORD\",
            \"name\": \"$ADMIN_NAME\"
        }")
    
    local http_code="${response: -3}"
    local response_body="${response%???}"
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        print_success "Admin user created successfully"
    elif [ "$http_code" = "409" ]; then
        print_warning "Admin user already exists"
    else
        print_warning "Failed to create admin user automatically"
        print_warning "You can create it manually after setup is complete"
        print_warning "HTTP Code: $http_code"
        print_warning "Response: $response_body"
    fi
}

# Print summary
print_summary() {
    print_header "Setup Complete!"
    
    echo ""
    print_success "EcliPay has been successfully deployed!"
    echo ""
    echo -e "${CYAN}Access URLs:${NC}"
    echo -e "  • Frontend: ${BLUE}https://$DOMAIN_NAME${NC}"
    echo -e "  • Backend API: ${BLUE}https://$DOMAIN_NAME/api${NC}"
    echo -e "  • Local Frontend: ${BLUE}http://localhost:3001${NC}"
    echo -e "  • Local Backend: ${BLUE}http://localhost:3000${NC}"
    echo ""
    echo -e "${CYAN}Services Status:${NC}"
    echo -e "  • Frontend: ${GREEN}✓ Running${NC}"
    echo -e "  • Backend: ${GREEN}✓ Running${NC}"
    echo -e "  • Database: ${GREEN}✓ Running${NC}"
    echo -e "  • Redis: ${GREEN}✓ Running${NC}"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo -e "  • View logs: ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  • Restart services: ${YELLOW}docker-compose restart${NC}"
    echo -e "  • Stop services: ${YELLOW}docker-compose down${NC}"
    echo -e "  • Update services: ${YELLOW}docker-compose pull && docker-compose up -d${NC}"
    echo ""
    echo -e "${CYAN}Configuration:${NC}"
    echo -e "  • Environment file: ${YELLOW}.env${NC}"
    echo -e "  • Docker Compose: ${YELLOW}docker-compose.yml${NC}"
    echo ""
    if [ -n "$ADMIN_EMAIL" ]; then
        echo -e "${CYAN}Admin Account:${NC}"
        echo -e "  • Email: ${YELLOW}$ADMIN_EMAIL${NC}"
        echo ""
    fi
    
    print_warning "Make sure your DNS is pointing to this server for $DOMAIN_NAME"
    print_warning "Traefik will automatically obtain SSL certificates from Let's Encrypt"
    
    echo ""
    print_success "EcliPay is ready to accept payments! 🚀"
}

# Cleanup function for graceful exit
cleanup() {
    print_error "Setup interrupted. Cleaning up..."
    docker-compose down 2>/dev/null || true
    exit 1
}

# Main execution
main() {
    # Set trap for cleanup
    trap cleanup INT TERM
    
    print_header "EcliPay Production Setup"
    print_status "Starting automated deployment..."
    
    # Pre-flight checks
    check_root
    check_directory
    
    # Installation steps
    install_prerequisites
    collect_config
    setup_ssl
    start_services
    verify_services
    create_admin_user
    print_summary
    
    print_success "Setup completed successfully!"
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi