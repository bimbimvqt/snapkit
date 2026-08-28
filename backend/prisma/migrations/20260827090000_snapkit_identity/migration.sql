UPDATE "AppConfig"
SET "value" = jsonb_set(
  "value",
  '{proProductId}',
  to_jsonb('snapkit_pro_monthly'::text),
  true
)
WHERE "key" = 'mobile';

UPDATE "User"
SET "name" = 'Snapkit Admin'
WHERE "role" = 'ADMIN';
