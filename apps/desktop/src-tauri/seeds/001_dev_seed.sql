INSERT INTO projects (id, name, icon)
VALUES ('project-apollo', 'Apollo Project', 'rocket')
ON CONFLICT(id) DO NOTHING;

INSERT INTO environments (id, project_id, name)
VALUES
  ('env-apollo-dev', 'project-apollo', 'Dev'),
  ('env-apollo-staging', 'project-apollo', 'Staging'),
  ('env-apollo-prod', 'project-apollo', 'Prod'),
  ('env-apollo-local', 'project-apollo', 'Local')
ON CONFLICT(id) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES
  ('mask_default', 'true'),
  ('clipboard_clear_seconds', '30')
ON CONFLICT(key) DO NOTHING;
