# Order Management System - Makefile
# Provides automation for building, running, and managing the application

.PHONY: help build run stop clean logs ps shell-backend shell-frontend dev-backend dev-frontend install test lint format

# Default target
help:
	@echo "Order Management System - Available Commands:"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make build          - Build all Docker images"
	@echo "  make run            - Start all services"
	@echo "  make stop           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - Show logs from all services"
	@echo "  make ps             - Show running containers"
	@echo "  make clean          - Stop and remove containers, images, volumes"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev-backend    - Start backend in development mode"
	@echo "  make dev-frontend   - Start frontend in development mode"
	@echo "  make dev            - Start both backend and frontend in development mode"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make install        - Install dependencies for both backend and frontend"
	@echo "  make test           - Run tests for both backend and frontend"
	@echo "  make lint           - Run linting for both backend and frontend"
	@echo "  make format         - Format code for both backend and frontend"
	@echo "  make shell-backend  - Open shell in backend container"
	@echo "  make shell-frontend - Open shell in frontend container"
	@echo ""

# Docker commands
build:
	@echo "🔨 Building Docker images..."
	docker-compose build

run:
	@echo "🚀 Starting all services..."
	docker-compose up -d

stop:
	@echo "🛑 Stopping all services..."
	docker-compose down

restart:
	@echo "🔄 Restarting all services..."
	docker-compose restart

logs:
	@echo "📋 Showing logs..."
	docker-compose logs -f

ps:
	@echo "📊 Showing running containers..."
	docker-compose ps

clean:
	@echo "🧹 Cleaning up Docker resources..."
	docker-compose down -v --rmi all
	docker system prune -f

# Development commands
dev-backend:
	@echo "🔧 Starting backend in development mode..."
	cd backend && npm install && npm run dev

dev-frontend:
	@echo "🔧 Starting frontend in development mode..."
	npm install && npm run dev

dev:
	@echo "🔧 Starting both services in development mode..."
	@echo "Starting backend..."
	@cd backend && npm install && npm run dev &
	@echo "Starting frontend..."
	@npm install && npm run dev

# Utility commands
install:
	@echo "📦 Installing dependencies..."
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	npm install

test:
	@echo "🧪 Running tests..."
	@echo "Running backend tests..."
	cd backend && npm test
	@echo "Running frontend tests..."
	npm test

lint:
	@echo "🔍 Running linting..."
	@echo "Linting backend..."
	cd backend && npm run lint
	@echo "Linting frontend..."
	npm run lint

format:
	@echo "🎨 Formatting code..."
	@echo "Formatting backend..."
	cd backend && npm run format
	@echo "Formatting frontend..."
	npm run format

# Shell access
shell-backend:
	@echo "🐚 Opening shell in backend container..."
	docker-compose exec backend sh

shell-frontend:
	@echo "🐚 Opening shell in frontend container..."
	docker-compose exec frontend sh

# Database commands (if you add database later)
db-shell:
	@echo "🗄️ Opening database shell..."
	docker-compose exec database psql -U oms_user -d oms_db

db-backup:
	@echo "💾 Creating database backup..."
	docker-compose exec database pg_dump -U oms_user oms_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

db-restore:
	@echo "📥 Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	docker-compose exec -T database psql -U oms_user -d oms_db < $$backup_file

# Monitoring commands
status:
	@echo "📊 System Status:"
	@echo "=================="
	@docker-compose ps
	@echo ""
	@echo "Resource Usage:"
	@docker stats --no-stream

health:
	@echo "🏥 Health Check:"
	@echo "Backend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "DOWN")"
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "DOWN")"

# Quick setup
setup:
	@echo "⚙️ Setting up Order Management System..."
	make install
	make build
	make run
	@echo "✅ Setup complete! Access the application at http://localhost:3000"

# Production commands
prod-build:
	@echo "🏭 Building for production..."
	docker-compose -f docker-compose.prod.yml build

prod-run:
	@echo "🚀 Starting production services..."
	docker-compose -f docker-compose.prod.yml up -d

# Helpers
logs-backend:
	@echo "📋 Backend logs:"
	docker-compose logs -f backend

logs-frontend:
	@echo "📋 Frontend logs:"
	docker-compose logs -f frontend

# Emergency commands
force-stop:
	@echo "🛑 Force stopping all containers..."
	docker-compose down --remove-orphans
	docker stop $$(docker ps -q) 2>/dev/null || true

reset:
	@echo "🔄 Resetting everything..."
	make force-stop
	make clean
	make setup 