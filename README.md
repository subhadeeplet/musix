# Spotify Clone Project

Full-stack Spotify-style app with a Node/Express backend and a Vite frontend.

## Project Structure

- `BACKEND/` - Express API, MongoDB models, auth, music upload endpoints, ImageKit storage
- `FRONTEND/` - Vite frontend

## Backend

```bash
cd BACKEND
npm install
npm run dev
```

Production start command:

```bash
npm start
```

Required environment variables:

```bash
MONGO_URI=
JWT_SECRET=
IMAGEKIT_PRIVATE_KEY=
FRONTEND_URL=
PORT=
```

`PORT` is optional locally. Hosting providers usually set it automatically.

## Frontend

```bash
cd FRONTEND
npm install
npm run dev
```

Build command:

```bash
npm run build
```

Required environment variable:

```bash
VITE_API_URL=
```

Set `VITE_API_URL` to the deployed backend URL.

## Deployment Notes

Deploy the backend as a Node web service with:

- Root directory: `BACKEND`
- Build command: `npm install`
- Start command: `npm start`

Deploy the frontend as a static/Vite site with:

- Root directory: `FRONTEND`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
