-- COR-7: correct the deployed credential_dispatch notification so it no longer
-- claims a generated or default credential. Data-only, forward-only, and
-- scoped to the credential_dispatch template whose body still carries the
-- obsolete marker. Fresh seeds use the corrected template in prisma/seed.ts.

UPDATE `email_templates`
SET
  `subject` = 'COR Verified: Your Student Account',
  `body_html` = '<p>Dear {{student_name}},</p><p>Your Certificate of Registration (COR) has been verified and your account is now a Student account.</p><p>Your Student Number is: <strong>{{student_number}}</strong></p><p>Sign in through the Student portal using your Student Number and your existing account password.</p><p>If you have forgotten your password, use the &quot;Forgot your password?&quot; option on the login page.</p><p>Portal: {{portal_link}}</p>',
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `template_key` = 'credential_dispatch'
  AND (`body_html` LIKE '%{{default_password}}%' OR `body_html` LIKE '%Last Name in ALL CAPS%');
