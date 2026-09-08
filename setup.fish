```fish
#!/usr/bin/env fish

# ==========================================================
# Quest Generator - Setup Script
#
# Shell: Fish
# Terminal: Kitty compatible
#
# Backend:       Python + FastAPI + uv
# Frontend:      React + Vite + npm
# Database:      PostgreSQL (SYSTEM)
# Vector DB:     Qdrant (DOCKER)
# AI Model:      Ollama + Mistral (SYSTEM)
#
# No MySQL/MariaDB
# No backend Docker
# Qdrant only runs in Docker
# ==========================================================

echo "=========================================="
echo " Quest Generator - Project Setup"
echo "=========================================="
echo ""

# ==========================================================
# COLORS
# ==========================================================

set RED '\033[0;31m'
set GREEN '\033[0;32m'
set YELLOW '\033[1;33m'
set BLUE '\033[0;34m'
set NC '\033[0m'

function print_success
    echo -e "$GREEN✓ $argv$NC"
end

function print_error
    echo -e "$RED✗ $argv$NC"
end

function print_info
    echo -e "$YELLOW➜ $argv$NC"
end

function print_step
    echo -e "$BLUE>>> $argv$NC"
end

# ==========================================================
# CHECK LINUX
# ==========================================================

if test (uname) != "Linux"
    print_error "This script is designed for Linux."
    exit 1
end

# ==========================================================
# STEP 1: SYSTEM DEPENDENCIES
# ==========================================================

echo ""
print_step "STEP 1: Checking System Dependencies"
echo ""

# ----------------------------------------------------------
# Python
# ----------------------------------------------------------

if not command -q python3

    print_error "Python 3 is not installed."

    if command -q pacman
        print_info "Installing Python..."
        sudo pacman -S --needed python
    else if command -q apt
        print_info "Installing Python..."
        sudo apt update
        sudo apt install -y python3
    else
        print_error "Unsupported package manager."
        exit 1
    end

else

    set PYTHON_VERSION (python3 --version | awk '{print $2}')
    print_success "Python $PYTHON_VERSION found"

end

# ----------------------------------------------------------
# uv
# ----------------------------------------------------------

if not command -q uv

    print_info "uv is not installed."
    print_info "Installing uv..."

    curl -LsSf https://astral.sh/uv/install.sh | sh

    fish_add_path ~/.local/bin

    if not command -q uv
        print_error "uv was installed but is not available."
        print_info "Run: fish_add_path ~/.local/bin"
        print_info "Then run this script again."
        exit 1
    end

    print_success "uv installed"

else

    set UV_VERSION (uv --version)
    print_success "$UV_VERSION found"

end

# ----------------------------------------------------------
# Node.js
# ----------------------------------------------------------

if not command -q node

    print_error "Node.js is not installed."
    print_error "Please install Node.js 18 or higher."
    exit 1

else

    set NODE_VERSION (node --version)
    print_success "Node.js $NODE_VERSION found"

end

# ----------------------------------------------------------
# npm
# ----------------------------------------------------------

if not command -q npm

    print_error "npm is not installed."
    exit 1

else

    set NPM_VERSION (npm --version)
    print_success "npm $NPM_VERSION found"

end

# ----------------------------------------------------------
# curl
# ----------------------------------------------------------

if not command -q curl

    print_error "curl is not installed."

    if command -q pacman
        sudo pacman -S --needed curl
    else if command -q apt
        sudo apt update
        sudo apt install -y curl
    else
        print_error "Please install curl manually."
        exit 1
    end

else

    print_success "curl found"

end



# ==========================================================
# STEP 4: QDRANT - DOCKER ONLY
# ==========================================================

echo ""
print_step "STEP 4: Setting up Qdrant using Docker"
echo ""

# ----------------------------------------------------------
# Docker
# ----------------------------------------------------------

if not command -q docker

    print_error "Docker is not installed."

    if command -q pacman

        print_info "Installing Docker..."
        sudo pacman -S --needed docker docker-compose

    else

        print_error "Please install Docker first."
        exit 1

    end

else

    print_success "Docker found"

end

# ----------------------------------------------------------
# Docker service
# ----------------------------------------------------------

if systemctl is-active --quiet docker

    print_success "Docker service is running"

else

    print_info "Starting Docker service..."

    sudo systemctl enable --now docker

    print_success "Docker service started"

end

# ----------------------------------------------------------
# Docker permissions
# ----------------------------------------------------------

if groups | string match -q '*docker*'

    print_success "User is already in docker group"

else

    print_info "Adding $USER to docker group..."

    sudo usermod -aG docker $USER

    print_info "Docker group added."
    print_info "Log out and log back in if Docker permission is denied."

end

# ----------------------------------------------------------
# Qdrant container
# ----------------------------------------------------------

set QDRANT_CONTAINER "quest-generator-qdrant"

if docker ps -a --format '{{.Names}}' | string match -q "^$QDRANT_CONTAINER\$"

    if docker ps --format '{{.Names}}' | string match -q "^$QDRANT_CONTAINER\$"

        print_success "Qdrant container is already running"

    else

        print_info "Starting existing Qdrant container..."

        docker start $QDRANT_CONTAINER

        print_success "Qdrant container started"

    end

else

    print_info "Creating Qdrant Docker container..."

    docker run -d \
        --name $QDRANT_CONTAINER \
        --restart unless-stopped \
        -p 6333:6333 \
        -p 6334:6334 \
        -v quest_generator_qdrant_storage:/qdrant/storage \
        qdrant/qdrant:latest

    print_success "Qdrant container created"

end

# ----------------------------------------------------------
# Qdrant health check
# ----------------------------------------------------------

print_info "Checking Qdrant..."

sleep 3

if curl -fsS http://localhost:6333/healthz >/dev/null 2>&1

    print_success "Qdrant is running on port 6333"

else

    print_error "Qdrant is not responding."

    print_info "Check Qdrant logs:"
    echo "    docker logs $QDRANT_CONTAINER"

    exit 1

end

# ==========================================================
# STEP 5: OLLAMA
# ==========================================================

echo ""
print_step "STEP 5: Setting up Ollama"
echo ""

if not command -q ollama

    print_info "Ollama not found."
    print_info "Installing Ollama..."

    curl -fsSL https://ollama.com/install.sh | sh

    print_success "Ollama installed"

else

    print_success "Ollama already installed"

end

# ----------------------------------------------------------
# Start Ollama
# ----------------------------------------------------------

if pgrep -x ollama >/dev/null 2>&1

    print_success "Ollama is already running"

else

    print_info "Starting Ollama..."

    ollama serve >/dev/null 2>&1 &

    sleep 3

    if pgrep -x ollama >/dev/null 2>&1
        print_success "Ollama started"
    else
        print_error "Failed to start Ollama."
        exit 1
    end

end

# ----------------------------------------------------------
# Pull Mistral
# ----------------------------------------------------------

print_info "Pulling Mistral model..."
print_info "This may take several minutes."

ollama pull mistral:latest

print_success "Mistral model ready"

# ==========================================================
# STEP 6: PYTHON BACKEND USING UV
# ==========================================================

echo ""
print_step "STEP 6: Setting up Python Backend using uv"
echo ""

if not test -d backend

    print_error "backend directory not found."
    exit 1

end

cd backend

# ----------------------------------------------------------
# Requirements
# ----------------------------------------------------------

if not test -f requirements.txt

    print_error "backend/requirements.txt not found."
    cd ..
    exit 1

end

# ----------------------------------------------------------
# Create uv environment
# ----------------------------------------------------------

if not test -d .venv

    print_info "Creating Python environment using uv..."

    uv venv

    if test $status -ne 0
        print_error "Failed to create uv environment."
        cd ..
        exit 1
    end

    print_success "uv environment created"

else

    print_success ".venv already exists"

end

# ----------------------------------------------------------
# Install dependencies
# ----------------------------------------------------------

print_info "Installing backend dependencies using uv..."

uv pip install -r requirements.txt

if test $status -ne 0

    print_error "Failed to install backend dependencies."
    cd ..
    exit 1

end

print_success "Backend dependencies installed"

# ==========================================================
# .ENV
# ==========================================================

if not test -f .env

    print_info "Creating .env file..."

    printf '%s\n' \
        '# PostgreSQL' \
        'DB_HOST=localhost' \
        'DB_PORT=5432' \
        'DB_NAME=quest_generator_db' \
        'DB_USER=quest_generator' \
        'DB_PASSWORD=1234' \
        '' \
        '# Qdrant' \
        'QDRANT_HOST=localhost' \
        'QDRANT_PORT=6333' \
        'QDRANT_URL=http://localhost:6333' \
        '' \
        '# Ollama' \
        'OLLAMA_HOST=http://localhost:11434' \
        'OLLAMA_MODEL=mistral:latest' \
        > .env

    print_success ".env file created"

else

    print_success ".env file already exists"

end

# ==========================================================
# DATABASE INITIALIZATION
# ==========================================================

print_info "Initializing database schema..."

uv run python -c "from database import init_database; init_database()"

if test $status -ne 0

    print_error "Database initialization failed."
    print_info "Make sure your backend database.py uses PostgreSQL."
    cd ..
    exit 1

end

print_success "Database tables initialized successfully"

echo ""
print_info "Tables:"
echo "  - subjects"
echo "  - units"
echo "  - topics"
echo "  - subtopics"
echo "  - question_banks"
echo "  - questions"
echo "  - blueprints"
echo "  - question_papers"

cd ..

# ==========================================================
# STEP 7: REACT FRONTEND
# ==========================================================

echo ""
print_step "STEP 7: Setting up React Frontend"
echo ""

if not test -d frontend

    print_error "frontend directory not found."
    exit 1

end

cd frontend

print_info "Installing Node.js dependencies..."

npm install

if test $status -ne 0

    print_error "Frontend dependency installation failed."
    cd ..
    exit 1

end

print_success "Frontend dependencies installed"

cd ..

# ==========================================================
# STEP 8: DIRECTORIES
# ==========================================================

echo ""
print_step "STEP 8: Creating Upload and Log Directories"
echo ""

mkdir -p backend/uploads/syllabus
mkdir -p backend/uploads/books
mkdir -p backend/uploads/blueprints
mkdir -p logs

print_success "Upload directories created"

echo "  - backend/uploads/syllabus/"
echo "  - backend/uploads/books/"
echo "  - backend/uploads/blueprints/"

print_success "Logs directory created"

# ==========================================================
# FINAL
# ==========================================================

echo ""
echo "=========================================="
print_success "✨ Setup completed successfully! ✨"
echo "=========================================="
echo ""

echo "📋 Project Architecture:"
echo ""
echo "  Backend:"
echo "    FastAPI + Python + uv"
echo ""
echo "  Frontend:"
echo "    React + Vite"
echo ""
echo "  Database:"
echo "    PostgreSQL (SYSTEM)"
echo ""
echo "  Vector Database:"
echo "    Qdrant (DOCKER)"
echo ""
echo "  AI:"
echo "    Ollama + Mistral (SYSTEM)"
echo ""

echo "🐍 Backend:"
echo "  Environment: backend/.venv"
echo "  Package Manager: uv"
echo ""

echo "🐘 PostgreSQL:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

echo "🐳 Qdrant:"
echo "  Container: $QDRANT_CONTAINER"
echo "  HTTP: http://localhost:6333"
echo "  gRPC: localhost:6334"
echo ""

echo "🤖 Ollama:"
echo "  Host: http://localhost:11434"
echo "  Model: mistral:latest"
echo ""

echo "🚀 Start Backend:"
echo "  cd backend"
echo "  uv run uvicorn main:app --reload --port 8010"
echo ""

echo "🚀 Start Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""

echo "🐳 Start Qdrant:"
echo "  docker start $QDRANT_CONTAINER"
echo ""

echo "🌐 Service URLs:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8010"
echo "  API Docs: http://localhost:8010/docs"
echo "  Qdrant:   http://localhost:6333/dashboard"
echo "  Ollama:   http://localhost:11434"
echo ""
```
