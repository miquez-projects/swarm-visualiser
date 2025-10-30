# Deployment Guide

This guide will help you deploy the Swarm Visualizer to production.

## Overview

- **Frontend**: Deploy to Vercel (recommended) or Netlify
- **Backend**: Deploy to Render (recommended) or Railway
- **Database**: PostgreSQL with PostGIS extension (included with Render/Railway)

## Option 1: Deploy to Render (Recommended)

Render provides free tier with PostgreSQL included and automatic deploys from GitHub.

### Step 1: Deploy Backend to Render

1. **Create a Render account** at https://render.com

2. **Create a new PostgreSQL database:**
   - Click "New +" → "PostgreSQL"
   - Name: `swarm-visualizer-db`
   - Database: `swarm_visualizer`
   - User: (auto-generated)
   - Region: Choose closest to you
   - Plan: Free
   - Click "Create Database"
   - **Copy the Internal Database URL** (starts with `postgresql://`)

3. **Create a new Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `https://github.com/miquez/swarm-visualiser`
   - Name: `swarm-visualizer-api`
   - Region: Same as database
   - Branch: `main`
   - Root Directory: `server`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

4. **Add Environment Variables:**
   - Click "Environment" tab
   - Add these variables:
     ```
     DATABASE_URL = <paste Internal Database URL from step 2>
     NODE_ENV = production
     PORT = 10000
     ```

5. **Enable PostGIS extension:**
   - Go to your database in Render dashboard
   - Click "Connect" → "External Connection"
   - Use the `psql` command shown, then run:
     ```sql
     CREATE EXTENSION postgis;
     ```

6. **Initialize database schema:**
   - After first deploy completes, go to "Shell" tab in your web service
   - Run: `npm run db:init`

7. **Import your Swarm data:**
   - In the Shell tab, run:
     ```bash
     npm run import -- /path/to/swarm-export.json
     ```
   - Or upload your data file and import it

8. **Note your API URL:**
   - Your backend will be at: `https://swarm-visualizer-api.onrender.com`

### Step 2: Deploy Frontend to Vercel

1. **Create a Vercel account** at https://vercel.com

2. **Import your GitHub repository:**
   - Click "Add New" → "Project"
   - Import `https://github.com/miquez/swarm-visualiser`
   - Select the repository

3. **Configure build settings:**
   - Framework Preset: `Create React App`
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `build`

4. **Add Environment Variables:**
   - Add these variables:
     ```
     REACT_APP_API_URL = https://swarm-visualizer-api.onrender.com
     REACT_APP_MAPBOX_TOKEN = <your Mapbox token>
     ```

5. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at: `https://swarm-visualiser.vercel.app` (or similar)

6. **Test the deployment:**
   - Visit your Vercel URL
   - Check that the map loads
   - Try filtering and viewing statistics
   - Test the comparison view

---

## Option 2: Deploy to Railway (Alternative)

Railway is another excellent platform with PostgreSQL included.

### Backend on Railway

1. **Create account** at https://railway.app

2. **Create new project:**
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

3. **Add PostgreSQL:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will create a database and provide connection URL

4. **Configure backend service:**
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables:
     ```
     DATABASE_URL = ${{Postgres.DATABASE_URL}} (Railway will auto-fill)
     NODE_ENV = production
     ```

5. **Enable PostGIS and initialize:**
   - Connect to database and run:
     ```sql
     CREATE EXTENSION postgis;
     ```
   - Run schema initialization

### Frontend on Vercel (Same as Option 1)

Follow Step 2 from Option 1 above.

---

## Post-Deployment Steps

### 1. Import Your Swarm Data

After backend is deployed, import your check-in data:

**For Render:**
- Use the Shell tab in Render dashboard
- Or connect via the connection string and run import locally

**For Railway:**
- Use Railway CLI or connect to database directly

```bash
# From your local machine (if you have the connection string)
DATABASE_URL="postgresql://..." npm run import -- /path/to/swarm-export.json
```

### 2. Update README

Add your live URLs to README.md:
```markdown
## Live Demo

- Frontend: https://your-app.vercel.app
- API: https://your-api.onrender.com
```

### 3. Configure Custom Domain (Optional)

**Vercel:**
- Go to project settings → "Domains"
- Add your custom domain
- Follow DNS configuration instructions

**Render:**
- Go to web service settings → "Custom Domains"
- Add your domain
- Update DNS records

---

## Environment Variables Reference

### Backend (server/.env)
```bash
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
PORT=10000
```

### Frontend (client/.env)
```bash
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_MAPBOX_TOKEN=pk.your_mapbox_token
```

---

## Troubleshooting

### Backend Issues

**Database connection fails:**
- Check DATABASE_URL is correct
- Ensure PostgreSQL service is running
- Verify network connectivity between services

**PostGIS extension error:**
- Run `CREATE EXTENSION postgis;` in your database
- Check PostgreSQL version supports PostGIS (need 12+)

**Import fails:**
- Check file format matches expected Swarm JSON
- Verify database schema is initialized
- Check database has enough storage

### Frontend Issues

**API calls fail:**
- Check REACT_APP_API_URL is correct (no trailing slash)
- Verify CORS is enabled on backend
- Check browser console for errors

**Map doesn't load:**
- Verify REACT_APP_MAPBOX_TOKEN is set
- Check Mapbox token is valid
- Check browser console for errors

**Blank page:**
- Check build logs for errors
- Verify all dependencies installed
- Check React app built successfully

---

## Monitoring and Maintenance

### Render
- View logs: Dashboard → Web Service → "Logs" tab
- Monitor resources: "Metrics" tab
- Database backups: Automatic on paid plans

### Vercel
- View deployment logs: Project → "Deployments" → Click deployment
- Monitor performance: "Analytics" tab
- Automatic deployments on push to main branch

---

## Costs

### Free Tier Limits

**Render Free Plan:**
- Web Service: 750 hours/month, spins down after 15 min inactivity
- PostgreSQL: 1GB storage, 97 connection limit
- Bandwidth: 100GB/month

**Vercel Free Plan:**
- 100GB bandwidth/month
- Unlimited deployments
- Automatic SSL

**Railway Free Plan:**
- $5 credit/month
- Includes compute and database

### When to Upgrade

Consider paid plans when:
- App has consistent traffic (to avoid cold starts)
- Need more than 1GB database storage
- Need faster response times
- Want custom domains with SSL

---

## Next Steps After Deployment

1. **Test all features** with real data
2. **Share the URL** with friends and family
3. **Monitor usage** and performance
4. **Add Google Analytics** (optional)
5. **Set up error tracking** with Sentry (optional)
6. **Create backup strategy** for database

---

## Quick Deploy Commands

```bash
# Commit and push latest changes
git add -A
git commit -m "Prepare for deployment"
git push origin main

# Both Vercel and Render will auto-deploy on push to main
```

---

## Support

If you encounter issues:
- Check deployment logs on your hosting platform
- Review this guide's troubleshooting section
- Check GitHub Issues for similar problems
- Render docs: https://render.com/docs
- Vercel docs: https://vercel.com/docs
