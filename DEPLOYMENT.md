# Backend Deployment on Render

This guide deploys the PHP API in the repository's root `Dockerfile`. The API uses MySQL; Render's web service does not provide a MySQL database, so provision a reachable MySQL database separately.

## 1. Prepare the database

1. Create an empty MySQL database and a database user with permissions on it. Use a MySQL version compatible with the SQL in `database/schema.sql`.
2. The schema file currently creates and selects a database named `formicpq_flakes`. Either create that exact database, or change its `CREATE DATABASE` and `USE` statements to the database name supplied by your provider before importing it.
3. Import `database/schema.sql` into the new database.
4. Apply `database/migrations/004_create_guest_usage.sql` and then `database/migrations/005_create_project_files.sql` to that database.

Do not run `001_create_initial_tables.sql` on production: it drops tables and does not contain the table definitions. Do not run all migration files blindly; the base schema already includes several changes and some migrations can duplicate indexes or make provider-specific partition assumptions.

## 2. Create the Render service

1. In Render, create a **Web Service** and connect this repository and the branch to deploy.
2. Select **Docker** as the runtime. Set the root directory to `.` and Dockerfile path to `Dockerfile`.
3. Leave Build Command and Start Command blank. Render builds the Dockerfile and starts the container with its `CMD`, which binds Apache to Render's `PORT`.
4. Set the health check path to `/health`.
5. Create the service. It serves the API at `/api/...`; `/health` is also available directly for Render's health check.

The image uses PHP 8.3 with Apache, `pdo_mysql`, cURL, URL rewriting, and headers support. The Docker build context excludes `.env` files; configure production settings in Render instead.

## 3. Set environment variables

In the Render service's **Environment** settings, add these values:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | Your public application origin, including `https://` and no trailing slash. See the OAuth note below. |
| `DB_HOST` | MySQL hostname from your provider |
| `DB_PORT` | MySQL port, usually `3306` |
| `DB_NAME` | MySQL database name |
| `DB_USER` | MySQL username |
| `DB_PASS` | MySQL password |
| `JWT_SECRET` | A unique, random secret. Generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | A unique 32-character value. Generate with `openssl rand -hex 16`. Keep it stable; changing it can prevent decrypting existing data. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins, for example `https://my-app.onrender.com` (no trailing slash). |

Set the provider's CA or TLS options as required for its database connection. The application currently builds a standard MySQL TCP DSN and does not configure a custom CA file.

Add the key for the generation provider you use: `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`. Other integrations are optional; Google sign-in uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and Paystack verification uses `PAYSTACK_SECRET_KEY`.

## 4. Connect the frontend and OAuth

Set the frontend's `VITE_API_URL` to the deployed API base URL, ending in `/api`, for example `https://my-api.onrender.com/api`. This is a frontend build-time variable, so redeploy the frontend after changing it.

The backend's `.htaccess` currently includes a fixed `Access-Control-Allow-Origin` value. Update that origin in `api/.htaccess` to match the deployed frontend, as well as setting `CORS_ALLOWED_ORIGINS` in Render. Keep the allowed origin exact; do not use `*` with credentialed requests.

Google OAuth currently derives both its callback URL and post-login frontend redirect from `APP_URL`. It expects a single public origin to serve the frontend and the API at `/api`. If the frontend and backend use different origins, OAuth callback/redirect configuration must be split in the application before Google sign-in will work. Register the callback URL shown by the deployed app in Google Cloud OAuth settings; with the current code it is `{APP_URL}/api/auth/google/callback`.

## 5. Verify the deployment

1. Open `https://<render-service>.onrender.com/health`; expect HTTP 200 and JSON with `"status":"healthy"`. This checks that Apache and the PHP API respond.
2. Open `https://<render-service>.onrender.com/health/database`; expect HTTP 200 and `"database":"connected"`. An unavailable database returns HTTP 503 without exposing connection details.
3. Check Render logs for startup or database connection errors. From the deployed frontend, test sign-in and one generation request. Browser CORS errors usually mean the frontend origin in `api/.htaccess` or `CORS_ALLOWED_ORIGINS` does not match exactly.
4. Confirm database-backed data survives a new deploy. Files written under `/var/storage` use container-local storage by default; attach persistent storage and set `STORAGE_PATH` if the application needs those files to survive container replacement.

Never commit production secrets or put them in the Docker image. Keep `APP_DEBUG=false` in production.
