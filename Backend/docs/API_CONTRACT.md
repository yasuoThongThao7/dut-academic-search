# DUT Document Sharing API Contract

The backend is the source of truth for this contract. The API prefix is `/api/v1`; the Angular client stores only the origin (`http://localhost:8000`) and appends the prefix once.

## Conventions

- Successful JSON responses use `{"data": ...}`.
- Paged responses use `{"data": [...], "page": 0, "size": 12, "totalElements": 0, "totalPages": 0}`. `page` is zero-based. The Angular API adapter converts this to `{content, number, size, totalElements, totalPages}`.
- Application and validation errors use `{"code": "...", "message": "...", "fieldErrors": {...}}`.
- DTO JSON fields use camelCase. SQLAlchemy fields use snake_case.
- Endpoints marked **Student/Admin** require a bearer access token. **Admin** requires role `ADMIN`. Refresh token is an HttpOnly cookie named `refreshToken`, scoped to `/api/v1/auth`.

## Frontend/backend API audit

| Feature | Frontend call | Backend route | Result |
|---|---|---|---|
| Authentication | `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`, `/auth/password` | Same | MATCHED |
| Faculties | `/faculties` | `GET /faculties` | MATCHED |
| Majors | `/faculties/{id}/majors` | Same | MATCHED |
| Courses | `/majors/{id}/courses` | Same | MATCHED |
| Major-course mapping | `/admin/majors/{id}/courses` | `GET/PUT` | MATCHED |
| Lecturers | `/lecturers` | `GET /lecturers` | MATCHED |
| Academic terms | `/academic-terms` | `GET /academic-terms` | MATCHED |
| Course offerings | `/courses/{id}/offerings` | Same | MATCHED |
| Documents and search | `/documents`, `/documents/{id}` | Same; combined filters/sort/page | MATCHED |
| Upload and edit | Multipart `/documents` | Multipart `POST/PATCH /documents` | MATCHED |
| Preview | `/documents/{id}/preview` and admin preview | Public approved / admin all non-deleted | MATCHED |
| Download | `/documents/{id}/download` | Same | MATCHED |
| Reviews | Document reviews and `/reviews/{id}` | Same | MATCHED |
| Favorites | `/me/favorites` | Same; document responses include viewer `isFavorite` | MATCHED |
| My documents | `/me/documents` | Same; status and pagination | MATCHED |
| Student dashboard | `/documents` sorts and `/dashboard/popular-courses` | Same | MATCHED |
| Admin dashboard | `/admin/dashboard/stats` | Same, includes counts and recent activities | MATCHED |
| Admin users | `/admin/users` and status/reset routes | Same | MATCHED |
| Moderation | `/admin/documents` and moderation route | Same | MATCHED |
| Admin catalog | `/admin/{catalog}` | CRUD and status deactivation | MATCHED |
| Reports | Student submit and Admin list/detail/update | Same | MATCHED |

These are source-level API contract matches. Automated browser-driven Angular-to-API workflows are not configured in this repository; unit/API tests are reported separately and do not imply browser E2E coverage.

## Authentication

| Method and path | Access | Request | Successful response |
|---|---|---|---|
| `POST /auth/login` | Public | `{"studentId":"...","password":"..."}` | `data: {accessToken, tokenType, expiresIn, user:{id,studentId,fullName,role,forcePasswordChange}}`; sets refresh cookie |
| `GET /auth/me` | Student/Admin | Bearer token | `data: {id,studentId,fullName,role,forcePasswordChange}` |
| `POST /auth/refresh` | Refresh cookie | Empty JSON | New `data` access-token response and rotated refresh cookie |
| `POST /auth/logout` | Refresh cookie | Empty JSON | `data: {loggedOut:true}`; revokes refresh token and clears cookie |
| `PATCH /auth/password` | Student/Admin | `{"currentPassword":"...","newPassword":"..."}` (10–128 chars) | `data: {updated:true}` |

There is no public registration endpoint. Administrators provision student accounts.

## Catalog

All public catalog reads return `data` arrays:

| Method and path | Query/request | Result fields |
|---|---|---|
| `GET /faculties` | — | `id, code, name, description` (active only) |
| `GET /faculties/{facultyId}/majors` | — | `id, facultyId, code, name` (active only) |
| `GET /majors/{majorId}/courses` | Optional `q` | `id, code, name, credits` (active related courses only) |
| `GET /courses/{courseId}/offerings` | Optional `termId` | `id, courseId, lecturer:{id,fullName}, academicTerm:{id,name}, classCode` |
| `GET /lecturers` | Optional `q, courseId, termId` | `id, lecturerCode, fullName, email, facultyId` |
| `GET /academic-terms` | — | `id, code, name, startDate, endDate` |
| `GET /document-categories` | — | `id, code, name` |

Admin catalog routes provide list/create/update/soft-delete operations at `/admin/faculties`, `/admin/majors`, `/admin/courses`, `/admin/lecturers`, `/admin/academic-terms`, and `/admin/course-offerings`. Create uses `POST`, update uses `PATCH /{id}`, and delete uses `DELETE /{id}`; resources with a status are made `INACTIVE`. Major-course mapping uses `GET /admin/majors/{id}/courses` and `PUT /admin/majors/{id}/courses` with `{"courseIds":[1,2]}`; the response is the resulting course array.

## Documents

| Method and path | Access | Request/query | Result |
|---|---|---|---|
| `GET /documents` | Public | `q, facultyId, majorId, courseId, lecturerId, termId, categoryCode, sort, page, size` | Paged approved documents |
| `GET /documents/{id}` | Public | — | Approved document detail |
| `POST /documents` | Student/Admin | Multipart `metadata` JSON plus `file`; metadata fields: `title, description, majorId, courseId, courseOfferingId, categoryCode` | `data:{id,status}`; new documents start `PENDING` |
| `PATCH /documents/{id}` | Student/Admin | Multipart `metadata` JSON and optional `file` | `data:{id,status}`; owner edits are resubmitted as `PENDING` |
| `DELETE /documents/{id}` | Student/Admin | — | Soft delete; `data:{deleted:true}` |
| `POST /documents/{id}/views` | Student/Admin | Empty JSON | `data:{viewCount}` |
| `GET /documents/{id}/preview` | Public | — | Inline PDF/image stream for approved documents only |
| `GET /admin/documents/{id}/preview` | Admin | — | Inline PDF/image stream, including pending moderation documents |
| `GET /documents/{id}/download` | Student/Admin | — | Approved file stream; records a download and increments count |

Document list/detail fields include `id, title, description, category, major:{id,name,faculty}, course, courseOffering, lecturer, academicTerm, uploader, viewCount, downloadCount, averageRating, reviewCount, createdAt`, and viewer-specific `isFavorite` when a valid access token is supplied. Detail also includes `fileName, fileType, fileSize, status, rejectionReason`. `courseOffering` is `null` when no offering was selected.

Sort values are `recent`, `popular`, `rating`, and `downloads`. Pagination is zero-based, with `size` from 1 to 100. Search and filters are combined in the database; public search only returns approved, non-deleted documents.

## Reviews, favorites, and personal documents

| Method and path | Access | Request/query | Result |
|---|---|---|---|
| `GET /documents/{id}/reviews` | Public | `page, size` | Paged `{id,user:{id,fullName},rating,content,createdAt,updatedAt}` |
| `POST /documents/{id}/reviews` | Student/Admin | `{"rating":1..5,"content":"..."}` | `data:{id,averageRating,reviewCount}` |
| `PATCH /reviews/{id}` | Owner/Admin | Optional `rating, content` | Updated `data:{id,averageRating,reviewCount}` |
| `DELETE /reviews/{id}` | Owner/Admin | — | `data:{deleted:true}` |
| `GET /me/favorites` | Student/Admin | `page, size` | Paged approved document details |
| `PUT /me/favorites/{documentId}` | Student/Admin | — | `data:{favorited:true}`; idempotent |
| `DELETE /me/favorites/{documentId}` | Student/Admin | — | `data:{favorited:false}` |
| `GET /me/documents` | Student/Admin | Optional `status, page, size` | Paged documents uploaded by the current account |
| `POST /documents/{id}/reports` | Student | `{"reason":"WRONG_COURSE|WRONG_MAJOR|INAPPROPRIATE|BROKEN_FILE|COPYRIGHT|OTHER","description":"..."}` | `data:{id,status,createdAt}` |

## Administration

All administration routes require role `ADMIN`.

| Method and path | Request/query | Result |
|---|---|---|
| `GET /admin/dashboard/stats` | — | `totalStudents, totalDocuments, pendingDocuments, approvedDocuments, rejectedDocuments, totalDownloads, recentActivities` |
| `GET /admin/users` | `page, size` | Paged students with status, major and faculty |
| `POST /admin/users` | `studentId, fullName, email?, majorId?` | Student profile and one-time `temporaryPassword` |
| `PATCH /admin/users/{id}/status` | `{"status":"ACTIVE|LOCKED"}` | Updated id and status |
| `POST /admin/users/{id}/reset-password` | Empty JSON | One-time `temporaryPassword` and `forcePasswordChange` |
| `GET /admin/documents` | `status, page, size` | Paged documents in the requested moderation status |
| `GET /admin/documents/{id}` | — | Document detail including non-public moderation metadata |
| `PATCH /admin/documents/{id}/moderation` | `{"status":"APPROVED|REJECTED|HIDDEN","reason":"..."}` | Updated moderation status and rejection reason |
| `GET /admin/reports` | Optional `status, page, size` | Paged reports with document and reporter summary |
| `GET /admin/reports/{id}` | — | Report plus document detail |
| `PATCH /admin/reports/{id}` | `{"status":"RESOLVED|REJECTED","hideDocument":false}` | Updated report; optional hiding is audited |

`GET /dashboard/popular-courses?limit=6` is public and returns `data:[{id,code,name,documentCount}]`, ranked using approved non-deleted documents.

## Database relationship rules

Majors belong to faculties. Courses are shared across majors via the unique `major_courses(major_id, course_id)` relation. Offerings connect one course, lecturer, and term. Documents carry a composite FK to a valid major-course link and, when provided, an offering/course pair. Reviews and favorites are unique per user/document. Reports retain document, reporter, and optional administrator foreign keys. Catalog delete operations are soft/inactive where a status exists; referenced records use restrictive foreign keys.

## MySQL verification

Migrations were applied through `0007_document_reports` to an isolated MySQL 8 integration-test schema. CRUD checks covered catalog relations, an offering-backed document, review, favorite, download log, refresh token, report, and rollback on a violated foreign key. The pre-existing configured database already contained tables and was not migrated or modified. Keep `.env` pointed at the intended database; do not use the test schema as a deployment database.
