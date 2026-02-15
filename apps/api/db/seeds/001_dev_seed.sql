TRUNCATE TABLE
  audit_events,
  secret_tags,
  secret_notes,
  secret_versions,
  secrets,
  environment_access,
  environments,
  project_members,
  project_tags,
  projects,
  users
RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, display_name, role)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@company.local', 'Aylin Admin', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'member@company.local', 'Deniz Dev', 'member'),
  ('33333333-3333-4333-8333-333333333333', 'viewer@company.local', 'Mert Ops', 'viewer');

INSERT INTO projects (id, slug, name, description, created_by)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'apollo', 'Apollo API', 'Payment and billing integrations', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'atlas', 'Atlas Core', 'Core backend services', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'nova', 'Nova Analytics', 'Analytics and ingestion tools', '11111111-1111-4111-8111-111111111111');

INSERT INTO project_tags (project_id, tag)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'payments'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'critical'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'backend'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'data'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'internal');

INSERT INTO project_members (project_id, user_id, role)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '33333333-3333-4333-8333-333333333333', 'viewer');

INSERT INTO environments (id, project_id, name, restricted)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'local', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'dev', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'prod', TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'local', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'dev', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'prod', TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'local', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'dev', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'prod', TRUE);

INSERT INTO environment_access (environment_id, user_id, can_read, can_export)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb009', '11111111-1111-4111-8111-111111111111', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001', '22222222-2222-4222-8222-222222222222', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', '22222222-2222-4222-8222-222222222222', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', '22222222-2222-4222-8222-222222222222', FALSE, FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004', '22222222-2222-4222-8222-222222222222', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005', '22222222-2222-4222-8222-222222222222', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006', '22222222-2222-4222-8222-222222222222', TRUE, TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001', '33333333-3333-4333-8333-333333333333', TRUE, FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', '33333333-3333-4333-8333-333333333333', TRUE, FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', '33333333-3333-4333-8333-333333333333', FALSE, FALSE);

INSERT INTO secrets (id, project_id, environment_id, name, provider, type, key_name, value_encrypted, created_by, updated_by)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', 'Stripe Payments', 'Stripe', 'key', 'STRIPE_API_KEY', convert_to('sk_live_51Mz_Real8Xy9', 'UTF8'), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', 'Vercel Deploy Hook', 'Vercel', 'endpoint', 'VERCEL_DEPLOY_HOOK', convert_to('https://api.vercel.com/v1/integrations/deploy/prj_123', 'UTF8'), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005', 'Algolia Search', 'Algolia', 'token', 'ALGOLIA_SEARCH_KEY', convert_to('search_only_abc001', 'UTF8'), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006', 'Auth Service URL', 'Internal', 'endpoint', 'AUTH_SERVICE_URL', convert_to('https://auth.company.local', 'UTF8'), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007', 'S3 Access Token', 'AWS', 'token', 'AWS_S3_TOKEN', convert_to('AKIAEXAMPLE0099', 'UTF8'), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');

INSERT INTO secret_notes (secret_id, content, updated_by)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc001', 'Primary production key for billing.', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc002', 'Used for dev deploy trigger.', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc003', 'Search key for Atlas index.', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc004', 'Internal auth service endpoint.', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc005', 'Local ingestion bucket token.', '11111111-1111-4111-8111-111111111111');

INSERT INTO secret_tags (secret_id, tag)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc001', 'billing'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc001', 'prod'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc002', 'deploy'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc003', 'search'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc004', 'auth'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc004', 'prod'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc005', 'storage');

INSERT INTO audit_events (project_id, actor_user_id, action, target_type, target_id, metadata)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'secret_created', 'secret', 'cccccccc-cccc-4ccc-8ccc-ccccccccc001', '{"secretName":"Stripe Payments"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'secret_copied', 'secret', 'cccccccc-cccc-4ccc-8ccc-ccccccccc004', '{"secretName":"Auth Service URL"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'secret_exported', 'project', NULL, '{"secretName":"Apollo API"}');
