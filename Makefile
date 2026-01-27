.PHONY: dev dev-build backend-dev frontend-dev test lint migrate setup clean

# Development
dev:
	docker-compose up

dev-build:
	docker-compose up --build

backend-dev:
	cd backend && python manage.py runserver

frontend-dev:
	cd frontend && npm run dev

# Database
migrate:
	cd backend && python manage.py migrate

makemigrations:
	cd backend && python manage.py makemigrations

# Testing
test:
	cd backend && pytest

test-backend:
	cd backend && pytest -v

test-engine:
	cd backend && pytest tests/test_engine/ -v

test-ai:
	cd backend && pytest tests/test_ai/ -v

# Linting
lint:
	cd backend && ruff check .

format:
	cd backend && ruff format .

# Setup
setup-backend:
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt

setup-frontend:
	cd frontend && npm install

setup: setup-backend setup-frontend

# Clean
clean:
	docker-compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/db.sqlite3

# Create superuser
superuser:
	cd backend && python manage.py createsuperuser

# Shell
shell:
	cd backend && python manage.py shell

# Help
help:
	@echo "Available commands:"
	@echo "  make dev          - Start all services with Docker"
	@echo "  make dev-build    - Build and start all services"
	@echo "  make backend-dev  - Run backend locally"
	@echo "  make frontend-dev - Run frontend locally"
	@echo "  make migrate      - Run database migrations"
	@echo "  make test         - Run all tests"
	@echo "  make test-ai      - Run AI tests only"
	@echo "  make lint         - Run linter"
	@echo "  make setup        - Setup local development"
	@echo "  make clean        - Clean up containers and cache"
