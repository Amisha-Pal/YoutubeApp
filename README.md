# YouTube Clone

Full-stack video platform: Django REST + Channels backend, React (Vite) frontend.

## Features
Upload (background processing: duration, thumbnail, 360p/720p), public/unlisted/private videos, playback with quality switching, theater/PiP, autoplay; likes/dislikes, comments with replies and reactions; channels with customization and subscriptions; subscription feed, trending, liked videos, Shorts (≤60s) and category pages; playlists; search with filters; real-time notifications (WebSocket) with preferences; watch history and Watch Later; JWT auth with refresh rotation, logout and password reset.

## Requirements
Python 3.12+, Node 20+, PostgreSQL, Redis, FFmpeg.

## Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit values
python manage.py migrate
python manage.py runserver            # API + WebSocket (Daphne)
celery -A config worker -l info       # video processing (separate shell)
python manage.py test                 # backend tests
```

## Frontend
```bash
cd frontend
npm ci
cp .env.example .env.local   # optional; defaults to http://127.0.0.1:8000/api/
npm run dev
npm run lint && npm run build
```

## Production checklist
- `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY` (startup fails on the default), real `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`.
- Serve behind HTTPS (HSTS, secure cookies and SSL redirect are on when `DEBUG` is off).
- Configure SMTP (`EMAIL_*`) for password-reset emails.
- Run `python manage.py collectstatic`; serve `/media/` via your web server or set `SERVE_MEDIA=True`.
- Build the frontend with `VITE_API_BASE_URL` (and optional `VITE_WS_BASE_URL`) pointing at the API.
