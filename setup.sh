#!/bin/bash

# Quest Generator - Setup Script
# This script sets up the entire project including frontend, backend, MySQL/MariaDB database, and Ollama

set -e  # Exit on any error

echo "=========================================="
echo "Quest Generator - Project Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_step() {
    echo -e "${BLUE}>>> $1${NC}"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux. Please adapt it for your OS."
    exit 1
fi

echo ""
print_step "STEP 1: Checking System Dependencies"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
else
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    print_success "Python $PYTHON_VERSION found"
fi

# Check pip
if ! command -v pip3 &> /dev/null; then
    print_error "pip3 is not installed. Installing pip..."
    sudo apt update
    sudo apt install -y python3-pip
else
    print_success "pip3 found"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
else
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION found"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
else
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION found"
fi

# Check MySQL/MariaDB
if ! command -v mysql &> /dev/null; then
    print_error "MySQL/MariaDB is not installed. Installing MariaDB..."
    sudo apt update
    sudo apt install -y mariadb-server mariadb-client
    print_success "MariaDB installed"
else
    MYSQL_VERSION=$(mysql --version)
    print_success "MySQL/MariaDB found: $MYSQL_VERSION"
fi

# Check if MySQL/MariaDB service is running
if systemctl is-active --quiet mysql; then
    print_success "MySQL service is running"
elif systemctl is-active --quiet mariadb; then
    print_success "MariaDB service is running"
else
    print_info "Starting database service..."
    if systemctl list-unit-files | grep -q "^mysql.service"; then
        sudo systemctl start mysql
        sudo systemctl enable mysql
    elif systemctl list-unit-files | grep -q "^mariadb.service"; then
        sudo systemctl start mariadb
        sudo systemctl enable mariadb
    fi
    print_success "Database service started"
fi

echo ""
print_step "STEP 2: Setting up MySQL/MariaDB Database"
echo ""

# Create database and grant privileges (try with password first, fallback to prompt)
if mysql -u root -p1234 -e "CREATE DATABASE IF NOT EXISTS quest_generator_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON quest_generator_db.* TO 'root'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null; then
    print_success "MySQL database 'quest_generator_db' created with UTF-8 support"
else
    print_info "Password '1234' didn't work. Please enter your MySQL root password when prompted..."
    mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS quest_generator_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON quest_generator_db.* TO 'root'@'localhost'; FLUSH PRIVILEGES;"
    print_success "MySQL database 'quest_generator_db' created with UTF-8 support"
fi

echo ""
print_step "STEP 3: Setting up Ollama (AI Model)"
echo ""
echo ""
print_step "STEP 3: Setting up Ollama (AI Model)"
echo ""

if ! command -v ollama &> /dev/null; then
    print_info "Ollama not found. Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    print_success "Ollama installed"
else
    print_success "Ollama already installed"
fi

# Start Ollama service if not running
if ! pgrep -x "ollama" > /dev/null; then
    print_info "Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    print_success "Ollama service started"
else
    print_success "Ollama service already running"
fi

# Pull Mistral model
print_info "Pulling Mistral model (this may take several minutes on first run)..."
ollama pull mistral:latest
print_success "Mistral model ready"

echo ""
print_step "STEP 4: Setting up Python Backend"
echo ""

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_success "Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
print_info "Installing Python dependencies..."
source venv/bin/activate

# Upgrade pip first
pip install --upgrade pip > /dev/null 2>&1

# Install dependencies
pip install -r requirements.txt
print_success "Backend dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_info "Creating .env file..."
    cat > .env <<EOL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=1234
DB_NAME=quest_generator_db
DB_PORT=3306
EOL
    print_success ".env file created"
else
    print_success ".env file already exists"
fi

# Initialize database tables
print_info "Initializing database schema (creating tables)..."
python3 -c "from database import init_database; init_database()"
print_success "Database tables initialized successfully"
print_info "Tables created: subjects, units, topics, subtopics, question_banks, questions, blueprints, question_papers"

deactivate
cd ..

echo ""
print_step "STEP 5: Setting up React Frontend"
echo ""

cd frontend

# Install npm dependencies
print_info "Installing Node.js dependencies (this may take a few minutes)..."
npm install
print_success "Frontend dependencies installed"

cd ..

echo ""
print_step "STEP 6: Creating Upload Directories"
echo ""

# Create uploads directories
mkdir -p backend/uploads/syllabus
mkdir -p backend/uploads/books
mkdir -p backend/uploads/blueprints
print_success "Upload directories created"
print_info "  - backend/uploads/syllabus/"
print_info "  - backend/uploads/books/"
print_info "  - backend/uploads/blueprints/"

# Create logs directory for run script
mkdir -p logs
print_success "Logs directory created"

echo ""
echo "=========================================="
print_success "✨ Setup completed successfully! ✨"
echo "=========================================="
echo ""
echo "📋 Project Structure:"
echo "  • Backend:  FastAPI + Python + MySQL"
echo "  • Frontend: React + Vite"
echo "  • AI Model: Ollama Mistral"
echo ""
echo "🚀 To start the project:"
echo "  ./run.sh"
echo ""
echo "📖 Or start services individually:"
echo "  Backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8010"
echo "  Frontend: cd frontend && npm run dev"
echo "  Ollama:   ollama serve"
echo ""
echo "🌐 Service URLs (after running ./run.sh):"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend:  http://localhost:8010"
echo "  • API Docs: http://localhost:8010/docs"
echo ""
