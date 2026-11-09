# Pychaswiatowa

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Testing

### Unit tests (Vitest)

To execute unit tests with [Vitest](https://vitest.dev/), use the following command:

```bash
npm run test
```

Vitest provides fast and modern unit testing capabilities for the application, allowing you to test components, services, and other Angular modules in isolation.

### End-to-end tests (Playwright)

For end-to-end (e2e) testing with [Playwright](https://playwright.dev/), run:

```bash
npm run test:e2e
```

Playwright enables automated browser testing, simulating real user interactions to verify critical user flows across the application.

### More testing commands

```bash
npm run test:watch        # Watch mode for unit tests
npm run test:ui           # Visual UI for unit tests
npm run test:coverage     # Generate coverage report
npm run test:e2e:ui       # Interactive mode for E2E tests
npm run test:e2e:debug    # Debug mode for E2E tests
```

📖 **For detailed testing documentation, see [TESTING.md](TESTING.md)**

## Deployment

The application uses GitHub Actions with a **separate CI and a manual production deployment**. A push or merge to `main` runs only CI (build + tests) and **never deploys to production**.

Production deployment is started manually (`workflow_dispatch`) from `main` and, after the preflight checks (exact SHA, current `main` HEAD, green CI), runs in this order:
1. Database migrations (Supabase)
2. Edge Functions (Supabase)
3. Frontend (Firebase Hosting)

### Quick Start Deployment

```bash
# 1. Merge changes to main via Pull Request and wait for green CI

# 2. Start the deployment manually (SHA must equal the current HEAD of main)
gh workflow run main-deploy.yml --ref main -f expected_sha=<SHA>

# 3. Monitor progress
# GitHub → Actions → "Deploy to Production"
```

Full procedure and partial-failure handling: [Production deployment runbook](docs/deployment/production-deployment-runbook.md).

**Deployment time:** ~10-15 minutes

### Configuration & Documentation

- 🚀 **[Deployment Documentation](docs/deployment/README.md)** - Deployment guides, CI/CD, secrets, and RLS procedures
- 🔧 **[Environment Setup](docs/configuration/environment-setup.md)** - Configuration for local development and production
- 📋 **[Project Documentation](docs/results/main-project-docs/)** - PRD, API Plan, Tech Stack, and more

### Required GitHub Secrets

For production deployment, configure these secrets in GitHub:
- `SUPABASE_PROJECT_ID` - Supabase project reference
- `SUPABASE_ACCESS_TOKEN` - Supabase API token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `GEMINI_API_KEY` - Google Gemini API key for image generation
- `FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD` - Firebase service account
- `APP_PUBLIC_URL` - Public URL of the application

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
