-- Colors become free hex values picked with a color picker. Existing values
-- of the old StatusColor enum are converted in place, without data loss.

ALTER TABLE "customer_status" ALTER COLUMN "color" DROP DEFAULT;
ALTER TABLE "customer_status" ALTER COLUMN "color" TYPE TEXT USING (
    CASE "color"::text
        WHEN 'ACCENT' THEN '#3b82f6'
        WHEN 'SUCCESS' THEN '#22c55e'
        WHEN 'WARNING' THEN '#f59e0b'
        WHEN 'DANGER' THEN '#ef4444'
        ELSE '#71717a'
    END
);
ALTER TABLE "customer_status" ALTER COLUMN "color" SET DEFAULT '#71717a';

ALTER TABLE "pipeline_stage" ALTER COLUMN "color" DROP DEFAULT;
ALTER TABLE "pipeline_stage" ALTER COLUMN "color" TYPE TEXT USING (
    CASE "color"::text
        WHEN 'ACCENT' THEN '#3b82f6'
        WHEN 'SUCCESS' THEN '#22c55e'
        WHEN 'WARNING' THEN '#f59e0b'
        WHEN 'DANGER' THEN '#ef4444'
        ELSE '#71717a'
    END
);
ALTER TABLE "pipeline_stage" ALTER COLUMN "color" SET DEFAULT '#71717a';

-- DropEnum
DROP TYPE "StatusColor";
