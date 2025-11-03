# Swarm Check-in Visualizer

A web application to visualize and analyze 15 years of Swarm/Foursquare check-in data.

## Features
- **Interactive Map**: 27k+ check-ins visualized with Mapbox GL JS
- **Advanced Filtering**: Filter by date, category, location
- **Analytics Dashboard**: Trends and statistics
- **AI Copilot**: Ask natural language questions about your check-in history
- **Time Period Comparison**: Compare different date ranges

## Tech Stack
- Frontend: React + Material-UI + Mapbox GL JS
- Backend: Node.js + Express + PostgreSQL + PostGIS
- AI: Google Gemini 2.5 Flash with function calling
- Deployment: Vercel (frontend) + Render (backend)

## Project Structure
- `/client` - React frontend
- `/server` - Node.js backend API
- `/docs` - Design and planning documents

## Documentation
- [AI Copilot Documentation](docs/AI_COPILOT.md) - Natural language query interface
- [AI Copilot Deployment Guide](docs/AI_COPILOT_DEPLOYMENT.md) - Production deployment
- [Multi-User Implementation](MULTI_USER_IMPLEMENTATION.md) - Authentication & data isolation

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Google Gemini API key (for AI Copilot)

### Setup
See individual README files in `/client` and `/server` directories.

### Quick Start
```bash
# Install dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env and add your API keys

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```
