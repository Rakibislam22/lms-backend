# LearnSphere LMS — Backend & CMS (Strapi 5)

> **Junior Software Engineer — Project Round**  
> Headless CMS and API backend built with **Strapi 5**. Powers authentication, role-based access control (RBAC), course curriculum, auto-graded quizzes, and blog publications. Deployed on **Railway**.

---

## 🔗 Live Deployment & Repositories

- **Live Backend (Railway):** [https://lms-backend-production-b6a5.up.railway.app](https://lms-backend-production-b6a5.up.railway.app)
- **Live Frontend (Vercel):** [https://learn-sphere-pi.vercel.app](https://learn-sphere-pi.vercel.app)
- **Backend GitHub Repository:** [https://github.com/Rakibislam22/lms-backend](https://github.com/Rakibislam22/lms-backend)
- **Frontend GitHub Repository:** [https://github.com/Rakibislam22/lms-frontend](https://github.com/Rakibislam22/lms-frontend)

---

## 🧱 Mandatory Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| **Backend / CMS** | **Strapi 5 (Node.js, PostgreSQL / SQLite)** | **Railway** |
| **Frontend** | **Next.js 16 (App Router) + Tailwind CSS** | **Vercel** |

---

## 👥 User Roles & 4-Role Permission Matrix

Strapi enforces access rules on the API level through custom policies, controller wrappers, and Users-Permissions plugins:

1. **Admin** — Unrestricted superuser. Full management of users and role assignments via `PUT /api/users/:id/role`. Full control of all content types.
2. **Content Manager** — Full platform course and lesson authoring. Writes and manages blog publications across the site. Does not manage user accounts.
3. **Instructor** — Manages their own courses, lessons, and quizzes. Can inspect enrolled student progress for their own courses. Can author and publish blog posts.
4. **Student** — Enrolls in courses, updates their own lesson progress, takes quizzes, and views their own evaluation records.

### Permission Matrix

| Action | Admin | Content Manager | Instructor | Student |
|---|:---:|:---:|:---:|:---:|
| **Manage users & assign roles** | ✅ | ❌ | ❌ | ❌ |
| **Create / edit / delete any course** | ✅ | ✅ | Own only | ❌ |
| **Add / edit / delete lessons** | ✅ | ✅ | Own courses | ❌ |
| **Create quizzes** | ✅ | ✅ | Own courses | ❌ |
| **View student progress & results** | ✅ | ✅ | Own courses | Own only |
| **Write / manage blog posts** | ✅ | ✅ | ✅ (Own) | ❌ |
| **Enroll in a course** | ❌ | ❌ | ❌ | ✅ |
| **Take quizzes & view auto-grades** | ❌ | ❌ | ❌ | ✅ |

---

## 🏗️ Architecture & Data Collections

The Strapi backend exposes the following primary content types and endpoints:

| Content Type / Endpoint | Description | Access Rules |
|---|---|---|
| `api::course.course` | Course tracks (title, description, instructor) | Admin/CM all; Instructor own; Student/Public read |
| `api::lesson.lesson` | Curriculum units (title, content, videoUrl, order) | Inherited from course ownership; Student read |
| `api::enrollment.enrollment` | Student course registrations & progress cache | Student own; Instructor/CM/Admin read |
| `api::quiz.quiz` | MCQ assessments with questions & answers | Instructor/CM/Admin manage; Student read |
| `api::quiz-result.quiz-result` | Auto-graded student submissions & scores | Student submit/read own; Instructor/CM/Admin view |
| `api::lesson-progress.lesson-progress` | Per-lesson completion tracking records | Student own; Instructor/CM/Admin view |
| `api::blog-post.blog-post` | Articles (title, body, coverImageUrl, status) | Public read `published`; CM/Admin/Instructor write & drafts |
| `PUT /api/users/:id/role` | Custom endpoint for live user role reassignment | Strictly Admin role only |

---

## 🌟 Key Backend Technical Implementations

### 1. Server-Side Auto-Grading Engine (`quiz-result`)
Located in [`src/api/quiz-result/controllers/quiz-result.js`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/api/quiz-result/controllers/quiz-result.js):
- On `POST /api/quiz-results`, the student submits their answers array along with the `quizId`.
- The controller fetches the authoritative quiz questions and correct answers from the database.
- It iterates through each question, matches the student's answer, calculates the `score` percentage:
  $$\text{score} = \text{round}\left(\frac{\text{correctCount}}{\text{totalQuestions}} \times 100\right)$$
- The result record is saved with `student: ctx.state.user.id`, preventing spoofing.
- The response returns the calculated score and question details for instant feedback.

### 2. Automatic Role Assignment on Registration
Located in [`src/extensions/users-permissions/strapi-server.js`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/extensions/users-permissions/strapi-server.js):
- Strapi 5 uses a factory pattern for core controllers. We wrapped `plugin.controllers.auth` to intercept `register`.
- On registration, the requested role (`student`, `instructor`, `content_manager`) is looked up and assigned immediately.
- The `admin` role is explicitly blocked from public registration.

### 3. Draft vs. Published Blog Content Controller
Located in [`src/api/blog-post/controllers/blog-post.js`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/api/blog-post/controllers/blog-post.js):
- When non-authenticated users or students query `/api/blog-posts`, Strapi applies a filter forcing `filters[status][$eq]=published`.
- Instructors, Content Managers, and Admins can see both drafts and published articles.

### 4. Automated Bootstrap Permissions
Located in [`src/index.js`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/index.js):
- On server startup (`bootstrap`), the script verifies all 4 roles exist in the database.
- It automatically configures and updates permissions for each role so the app runs out-of-the-box on clean installs and deployments.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v9.x` or higher

### 2. Clone the Repository
```bash
git clone https://github.com/Rakibislam22/lms-backend.git
cd lms-backend
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):

```env
# Server
HOST=0.0.0.0
PORT=1337
NODE_ENV=development

# Security Keys (Generate via: openssl rand -base64 16)
APP_KEYS=your_app_key_1,your_app_key_2,your_app_key_3,your_app_key_4
API_TOKEN_SALT=your_api_token_salt_here
ADMIN_JWT_SECRET=your_admin_jwt_secret_here
JWT_SECRET=your_jwt_secret_here
TRANSFER_TOKEN_SALT=your_transfer_token_salt_here
ENCRYPTION_KEY=your_encryption_key_here

# Database (defaults to SQLite locally)
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

# CORS
CORS_ORIGIN=*
```

### 5. Run the Backend Server
```bash
# Develop mode with auto-reload
npm run develop
```

The Strapi Admin panel will be available at [http://localhost:1337/admin](http://localhost:1337/admin).  
Create your primary administrator account on the initial setup screen.

---

## ⚙️ Production Deployment (Railway)

The backend is configured for deployment on **Railway** connected to a **PostgreSQL** database:

1. **Root Directory**: `lms-backend`
2. **Build Command**: `npm run build`
3. **Start Command**: `npm run start`
4. **Environment Variables on Railway**:
   - `DATABASE_CLIENT`: `postgres`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `DATABASE_SSL`: `false`
   - `NODE_ENV`: `production`
   - `PUBLIC_URL`: `https://lms-backend-production-b6a5.up.railway.app`
   - `JWT_SECRET`, `ADMIN_JWT_SECRET`, `APP_KEYS`, etc.

---

## 🎥 10-Minute Video Walkthrough Checklist

During the video demonstration:

1. **Role-Based Access Enforcement on the Backend**:
   - Show route policies in `src/api/course/routes/` and `src/api/blog-post/routes/`.
   - Explain how requests from unauthorized roles are intercepted and rejected with `403 Forbidden`.
2. **Quiz Auto-Grading Logic**:
   - Walk through [`src/api/quiz-result/controllers/quiz-result.js`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/api/quiz-result/controllers/quiz-result.js) line by line.
   - Show how score calculation is strictly performed on the server.
3. **Progress Tracking Logic**:
   - Walk through [`src/api/lesson-progress/`](file:///d:/my-code/WEB/Cps_Task/lms-backend/src/api/lesson-progress/) and how records are saved and queried per student.
4. **Role Assignment**:
   - Show `src/extensions/users-permissions/strapi-server.js` and how the Admin role endpoint functions.
5. **Deployment**:
   - Display the Railway dashboard, PostgreSQL plugin, and environment variables.

---

## 📄 License
Developed for the **Junior Software Engineer — Project Round**. All rights reserved.
