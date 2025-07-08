# Order Management System - Docker Setup

This document explains how to run the Order Management System using Docker Compose.

## Prerequisites

- Docker
- Docker Compose

## Project Structure

```
order_management_system/
├── backend/                 # Backend API (Node.js/Express)
│   ├── Dockerfile          # Backend container configuration
│   └── src/                # Backend source code
├── src/                    # Frontend source code (React)
├── docker-compose.yaml     # Main Docker Compose configuration
├── Dockerfile.frontend     # Frontend container configuration
├── nginx.conf              # Nginx configuration for frontend
└── .dockerignore           # Docker ignore file
```

## Services

### 1. Backend Service
- **Port**: 3001
- **Technology**: Node.js/Express with TypeScript
- **Database**: PostgreSQL
- **Features**: REST API, tRPC, Supabase integration

### 2. Frontend Service
- **Port**: 3000
- **Technology**: React with Vite, TypeScript, Tailwind CSS
- **Web Server**: Nginx
- **Features**: Modern UI, React Router, tRPC client

### 3. Database Service
- **Port**: 5432
- **Technology**: PostgreSQL 15
- **Data Persistence**: Docker volume
- **Initialization**: SQL scripts from `supabase/` directory

### 4. Redis Service (Optional)
- **Port**: 6379
- **Purpose**: Caching and session storage
- **Data Persistence**: Docker volume

## Quick Start

### 1. Build and Start All Services

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up --build -d
```

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432
- **Redis**: localhost:6379

### 3. View Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs database
```

## Development Workflow

### 1. Development Mode

For development, you can run services individually:

```bash
# Start only the database
docker-compose up database

# Start backend in development mode
cd backend
npm install
npm run dev

# Start frontend in development mode
npm install
npm run dev
```

### 2. Hot Reload

The Docker setup includes volume mounts for hot reloading:

- Backend: `./backend` → `/app`
- Frontend: `./src` → `/app/src`, `./public` → `/app/public`

### 3. Database Management

```bash
# Access PostgreSQL
docker-compose exec database psql -U oms_user -d oms_db

# Backup database
docker-compose exec database pg_dump -U oms_user oms_db > backup.sql

# Restore database
docker-compose exec -T database psql -U oms_user -d oms_db < backup.sql
```

## Environment Variables

### Backend Environment

Create a `.env` file in the `backend/` directory:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://oms_user:oms_password@database:5432/oms_db
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
```

### Frontend Environment

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Useful Commands

### Docker Compose Commands

```bash
# Start services
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild services
docker-compose up --build

# View running containers
docker-compose ps

# Execute command in container
docker-compose exec backend npm run test
docker-compose exec frontend sh
```

### Docker Commands

```bash
# View container logs
docker logs oms-backend
docker logs oms-frontend

# Access container shell
docker exec -it oms-backend sh
docker exec -it oms-frontend sh

# View container resources
docker stats
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :3001
   lsof -i :5432
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs database
   
   # Test database connection
   docker-compose exec database psql -U oms_user -d oms_db -c "SELECT 1;"
   ```

3. **Build Failures**
   ```bash
   # Clean Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

4. **Permission Issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

### Performance Optimization

1. **Development Mode**: Use volume mounts for hot reloading
2. **Production Mode**: Use multi-stage builds for smaller images
3. **Database**: Use connection pooling and proper indexing
4. **Caching**: Utilize Redis for session storage and caching

## Production Deployment

For production deployment, consider:

1. **Environment Variables**: Use proper secrets management
2. **SSL/TLS**: Add reverse proxy with SSL termination
3. **Monitoring**: Add health checks and monitoring
4. **Backup**: Implement automated database backups
5. **Scaling**: Use Docker Swarm or Kubernetes for scaling

## Security Considerations

1. **Database**: Change default passwords
2. **Network**: Use internal Docker networks
3. **Secrets**: Use Docker secrets or external secret management
4. **Updates**: Regularly update base images and dependencies

## Support

For issues or questions:

1. Check the logs: `docker-compose logs`
2. Verify environment variables
3. Ensure all required files are present
4. Check Docker and Docker Compose versions 