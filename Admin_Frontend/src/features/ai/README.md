# AI Admin Module

This module is designed around the current backend AI architecture:

- `ai_provider_templates`
- `model_capability_configs`
- `model_pricing_configs`
- system preset models exposed by `/api/ai/models/system`

Current frontend behavior:

- Provider templates are loaded from `/api/ai/providers/templates`
- Capability data is seeded from provider templates and can be edited in the admin workspace
- Pricing data is managed in a local admin workspace until backend admin APIs are added
- Model catalog entries are merged from provider templates and local custom models

Recommended backend admin contract:

- `GET /api/admin/ai-models/providers`
- `GET /api/admin/ai-models/providers/:provider`
- `GET /api/admin/ai-models/models`
- `POST /api/admin/ai-models/models`
- `GET /api/admin/ai-models/models/:provider/:model`
- `PUT /api/admin/ai-models/models/:provider/:model`
- `GET /api/admin/ai-models/models/:provider/:model/capability`
- `PUT /api/admin/ai-models/models/:provider/:model/capability`
- `GET /api/admin/ai-models/models/:provider/:model/pricing`
- `PUT /api/admin/ai-models/models/:provider/:model/pricing`
- `GET /api/admin/ai-models/usage`

Recommended persistence strategy:

- Keep provider template edits at provider level
- Keep capability and pricing rules at `provider + model_name`
- Add a separate admin model catalog table only if you need extra metadata such as recommendation, release stage, or review status
