#!/bin/bash

# Development startup script for Order Management System
# This script starts both the backend API and frontend development servers

echo "🚀 Starting Order Management System Development Environment"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 0
    else
        return 1
    fi
}

# Function to start backend
start_backend() {
    echo "📦 Starting Backend API Server..."
    cd backend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    
    # Start backend server
    echo "🔧 Starting backend on http://localhost:3001"
    npm run dev &
    BACKEND_PID=$!
    
    cd ..
    sleep 3  # Give backend time to start
}

# Function to start frontend
start_frontend() {
    echo "🎨 Starting Frontend Development Server..."
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    # Start frontend server
    echo "🔧 Starting frontend on http://localhost:5173"
    npm run dev &
    FRONTEND_PID=$!
    
    sleep 2  # Give frontend time to start
}

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "   ✓ Backend server stopped"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "   ✓ Frontend server stopped"
    fi
    
    echo "👋 Development environment stopped"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

# Check if ports are available
if check_port 3001; then
    echo "❌ Backend port 3001 is already in use. Please stop the running process."
    exit 1
fi

if check_port 5173; then
    echo "❌ Frontend port 5173 is already in use. Please stop the running process."
    exit 1
fi

# Start services
start_backend
start_frontend

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "📊 Services running:"
echo "   • Backend API:  http://localhost:3001"
echo "   • Frontend App: http://localhost:5173"
echo ""
echo "🔗 Useful URLs:"
echo "   • App Dashboard: http://localhost:5173"
echo "   • API Health:    http://localhost:3001/health"
echo ""
echo "📝 To stop the servers, press Ctrl+C"
echo ""

# Wait for user to stop the servers
wait