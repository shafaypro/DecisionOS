-- Fold status values written by earlier releases (and the old demo seed) into
-- the current workflow vocabulary: draft · proposed · in_review · approved ·
-- reversed · superseded · archived. The API now rejects anything else, and
-- still accepts these legacy spellings on input by mapping them the same way.
UPDATE "Decision" SET "status" = 'approved'  WHERE "status" IN ('decided', 'validated');
UPDATE "Decision" SET "status" = 'in_review' WHERE "status" = 'under_review';
