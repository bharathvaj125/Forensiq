# infra/docker/

**Purpose:** Shared/auxiliary Docker assets that don't belong to a single
service (e.g., an nginx reverse-proxy config if you front all three
services behind one host in deployment).

**Responsibility:** Keep cross-service infra config out of the
application folders (backend/frontend/ai-engine) so those stay
service-focused.

**Used by:** Deployment step (Roadmap Milestone 9).
