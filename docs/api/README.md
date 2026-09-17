# docs/api/

**Purpose:** API contract documentation - endpoint groups from SAD
Section 16.2, request/response envelope shape, and the shared AI
explainability object contract (SAD Section 15.3).

**Responsibility:** Single place the frontend and backend teams agree on
the API contract before either side builds against it. FastAPI's
auto-generated OpenAPI spec (`/docs`, `/openapi.json`) should be exported
here at key milestones for versioned reference.

**Used by:** Frontend service-layer developers, AI Engine integration.
