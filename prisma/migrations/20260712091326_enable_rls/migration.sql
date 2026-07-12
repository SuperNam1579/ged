-- Enable Row Level Security on every public table.
--
-- Supabase exposes all public-schema tables to PostgREST (the anon/authenticated
-- REST API), and RLS was not enabled on any of them -- meaning the User table
-- (password hashes, verification/reset tokens) and every other table were
-- readable/writable by anyone holding the public anon key.
--
-- No policies are added: RLS with zero policies denies all access by default
-- for the anon/authenticated PostgREST roles. The app never goes through
-- PostgREST -- Prisma connects directly via DATABASE_URL as the table owner,
-- and plain ENABLE ROW LEVEL SECURITY (not FORCE) always lets the owner
-- bypass RLS, so application queries are unaffected.

ALTER TABLE "User"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreferences"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSubtopicProficiency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subtopic"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubtopicPrerequisite"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAssessmentAttempt"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserQuestionResponse"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyAvailability"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilitySlot"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyPlan"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GaExecutionLog"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevokedToken"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyAvailabilityTemplate"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyAvailabilityTemplateSlot" ENABLE ROW LEVEL SECURITY;
