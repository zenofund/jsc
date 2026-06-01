#!/bin/bash

# JSC-PMS Development Startup Script
# This script starts both backend and frontend servers

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   JSC Payroll Management System - Development Mode       ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ Error: backend/.env file not found${NC}"
    echo ""
    echo "Please create backend/.env file with your configuration:"
    echo "1. cd backend"
    echo "2. cp .env.example .env"
    echo "3. Edit .env with your Supabase credentials"
    echo ""
    echo "See BACKEND_STARTUP_GUIDE.md for detailed instructions"
    exit 1
fi

# Check if node_modules exists in backend
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Backend dependencies not installed${NC}"
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
    echo ""
fi

# Check if node_modules exists in frontend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend dependencies not installed${NC}"
    echo "Installing frontend dependencies..."
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
    echo ""
fi

echo -e "${GREEN}Starting JSC-PMS Development Servers...${NC}"
echo ""
echo "Backend will run on:  http://localhost:3000"
echo "Frontend will run on: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo -e "${YELLOW}Stopping servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Servers stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
cd backend
npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Backend started successfully (PID: $BACKEND_PID)${NC}"
    
    # Test backend health
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend health check failed (may still be starting...)${NC}"
    fi
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "Check backend.log for errors"
    exit 1
fi

echo ""

# Start frontend
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 2

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend started successfully (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "Check frontend.log for errors"
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo -e "${GREEN}🚀 JSC-PMS is now running!${NC}"
echo ""
echo "📚 Backend API Docs:  http://localhost:3000/api/docs"
echo "🌍 Frontend App:      http://localhost:5173"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "────────────────────────────────────────────────────────────"

# Wait for user to press Ctrl+C
wait
