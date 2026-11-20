# DUT Document Sharing Platform - Backend

FastAPI REST API for the DUT student document-sharing platform. The API is prefixed with `/api/v1`; interactive OpenAPI documentation is available at `/docs`.

## Requirements and setup

Python 3.14 and MySQL 8 are supported. From the project root:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `MYSQL_*` and a cryptographically random `JWT_SECRET` in `.env`. Never commit `.env`. `DATABASE_URL` can be set instead for local testing, for example `sqlite:///./dut_documents.db`.

Create the configured MySQL database, then apply migrations:

```powershell
alembic upgrade head
```

Initialize the first administrator only after migration. Set `BOOTSTRAP_ADMIN_STUDENT_ID` and `BOOTSTRAP_ADMIN_PASSWORD` temporarily in the process environment or `.env`; use a unique password with at least 12 characters:

```powershell
python -m scripts.create_admin
```

Remove the bootstrap values after creating the account. No public registration endpoint exists. The initial administrator is forced to change the password.

Run the API:

```powershell
uvicorn app.main:app --reload
```

Uploaded files are stored under `STORAGE_LOCATION` outside the public web root. The default maximum upload size is 50 MiB. `COOKIE_SECURE=true` should be used behind HTTPS.

## Implemented endpoints

| Area | Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`; `GET /api/v1/auth/me`; `PATCH /api/v1/auth/password` |
| Catalog | `GET /api/v1/faculties`, `/faculties/{facultyId}/majors`, `/majors/{majorId}/courses`, `/courses/{courseId}/offerings`, `/lecturers`, `/academic-terms`, `/document-categories` |
| Documents | `GET /api/v1/documents`, `GET /api/v1/documents/{id}`; `POST /api/v1/documents`, `PATCH/DELETE /api/v1/documents/{id}`; `POST /api/v1/documents/{id}/views`; `GET /api/v1/documents/{id}/preview` and `/download` |
| Reviews | `GET/POST /api/v1/documents/{id}/reviews`; `PATCH/DELETE /api/v1/reviews/{id}` |
| Personal | `GET /api/v1/me/favorites`, `PUT/DELETE /api/v1/me/favorites/{documentId}`, `GET /api/v1/me/documents` |
| Admin | `GET /api/v1/admin/dashboard/stats`; `GET/POST /admin/users`, `PATCH /admin/users/{id}/status`, `POST /admin/users/{id}/reset-password`; `GET /admin/documents`, `GET /admin/documents/{id}`, `PATCH /admin/documents/{id}/moderation`; `GET/PATCH /admin/reports`; faculty, major, course, lecturer, term and course-offering CRUD; `GET/PUT /admin/majors/{id}/courses` |

All normal responses use the documented `data` envelope; list endpoints use database pagination. Validation and application errors use the documented error shape.

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for request/response fields, role requirements, pagination and relational constraints. MySQL 8 migrations and relational CRUD were verified on an isolated integration-test schema; the configured pre-existing database was not changed. The Angular frontend is in `../Frontend`; from that directory run `npm install`, `npm start`, `npm run build`, and `npm test -- --watch=false`.

Run tests with `python -m pytest -q`. The test suite uses an isolated SQLite database; production migrations target the configured MySQL database.
