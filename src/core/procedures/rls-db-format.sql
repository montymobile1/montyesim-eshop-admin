DO $$
BEGIN

  -- app_config
  IF to_regclass('public.app_config') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.app_config;
    DROP POLICY IF EXISTS "insert policy" ON public.app_config;
    DROP POLICY IF EXISTS "update policy" ON public.app_config;
    DROP POLICY IF EXISTS "delete policy" ON public.app_config;

    CREATE POLICY "select policy" ON public.app_config FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.app_config FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.app_config FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.app_config FOR DELETE USING (true);
  END IF;

  -- contact_us
  IF to_regclass('public.contact_us') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.contact_us;
    CREATE POLICY "select policy" ON public.contact_us FOR SELECT USING (true);
  END IF;

  -- user_wallet_transaction
  IF to_regclass('public.user_wallet_transaction') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.user_wallet_transaction;
    CREATE POLICY "select policy" ON public.user_wallet_transaction FOR SELECT USING (true);
  END IF;

  -- user_wallet
  IF to_regclass('public.user_wallet') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.user_wallet;
    CREATE POLICY "select policy" ON public.user_wallet FOR SELECT USING (true);
  END IF;

  -- promotion
  IF to_regclass('public.promotion') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.promotion;
    DROP POLICY IF EXISTS "insert policy" ON public.promotion;
    DROP POLICY IF EXISTS "update policy" ON public.promotion;
    DROP POLICY IF EXISTS "delete policy" ON public.promotion;

    CREATE POLICY "select policy" ON public.promotion FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.promotion FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.promotion FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.promotion FOR DELETE USING (true);
  END IF;

  -- promotion_rule
  IF to_regclass('public.promotion_rule') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.promotion_rule;
    DROP POLICY IF EXISTS "insert policy" ON public.promotion_rule;
    DROP POLICY IF EXISTS "update policy" ON public.promotion_rule;
    DROP POLICY IF EXISTS "delete policy" ON public.promotion_rule;

    CREATE POLICY "select policy" ON public.promotion_rule FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.promotion_rule FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.promotion_rule FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.promotion_rule FOR DELETE USING (true);
  END IF;

  -- promotion_rule_event
  IF to_regclass('public.promotion_rule_event') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.promotion_rule_event;
    CREATE POLICY "select policy" ON public.promotion_rule_event FOR SELECT USING (true);
  END IF;

  -- promotion_rule_action
  IF to_regclass('public.promotion_rule_action') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.promotion_rule_action;
    CREATE POLICY "select policy" ON public.promotion_rule_action FOR SELECT USING (true);
  END IF;

  -- promotion_usage
  IF to_regclass('public.promotion_usage') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.promotion_usage;
    DROP POLICY IF EXISTS "insert policy" ON public.promotion_usage;

    CREATE POLICY "select policy" ON public.promotion_usage FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.promotion_usage FOR INSERT WITH CHECK (true);
  END IF;

  -- users_copy
  IF to_regclass('public.users_copy') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.users_copy;
    DROP POLICY IF EXISTS "insert policy" ON public.users_copy;

    CREATE POLICY "select policy" ON public.users_copy FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.users_copy FOR INSERT WITH CHECK (true);
  END IF;

  -- user_order
  IF to_regclass('public.user_order') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.user_order;
    DROP POLICY IF EXISTS "insert policy" ON public.user_order;

    CREATE POLICY "select policy" ON public.user_order FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.user_order FOR INSERT WITH CHECK (true);
  END IF;

  -- bundle
  IF to_regclass('public.bundle') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.bundle;
    DROP POLICY IF EXISTS "insert policy" ON public.bundle;
    DROP POLICY IF EXISTS "update policy" ON public.bundle;
    DROP POLICY IF EXISTS "delete policy" ON public.bundle;

    CREATE POLICY "select policy" ON public.bundle FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.bundle FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.bundle FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.bundle FOR DELETE USING (true);
  END IF;

  -- voucher
  IF to_regclass('public.voucher') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.voucher;
    DROP POLICY IF EXISTS "insert policy" ON public.voucher;
    DROP POLICY IF EXISTS "update policy" ON public.voucher;
    DROP POLICY IF EXISTS "delete policy" ON public.voucher;

    CREATE POLICY "select policy" ON public.voucher FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.voucher FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.voucher FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.voucher FOR DELETE USING (true);
  END IF;

  -- device
  IF to_regclass('public.device') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.device;
    CREATE POLICY "select policy" ON public.device FOR SELECT USING (true);
  END IF;

  -- audit_log skipped if not exists
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.audit_log;
    CREATE POLICY "select policy" ON public.audit_log FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.audit_log FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.audit_log FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  -- currency
  IF to_regclass('public.currency') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.currency;
    CREATE POLICY "select policy" ON public.currency FOR SELECT USING (true);
  END IF;

  -- tag_group
  IF to_regclass('public.tag_group') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.tag_group;
    DROP POLICY IF EXISTS "insert policy" ON public.tag_group;
    DROP POLICY IF EXISTS "update policy" ON public.tag_group;
    DROP POLICY IF EXISTS "delete policy" ON public.tag_group;

    CREATE POLICY "select policy" ON public.tag_group FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.tag_group FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.tag_group FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.tag_group FOR DELETE USING (true);
  END IF;

  -- tag
  IF to_regclass('public.tag') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.tag;
    DROP POLICY IF EXISTS "insert policy" ON public.tag;
    DROP POLICY IF EXISTS "update policy" ON public.tag;
    DROP POLICY IF EXISTS "delete policy" ON public.tag;

    CREATE POLICY "select policy" ON public.tag FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.tag FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.tag FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.tag FOR DELETE USING (true);
  END IF;

  -- bundle_tag
  IF to_regclass('public.bundle_tag') IS NOT NULL THEN
    DROP POLICY IF EXISTS "select policy" ON public.bundle_tag;
    DROP POLICY IF EXISTS "insert policy" ON public.bundle_tag;
    DROP POLICY IF EXISTS "update policy" ON public.bundle_tag;
    DROP POLICY IF EXISTS "delete policy" ON public.bundle_tag;

    CREATE POLICY "select policy" ON public.bundle_tag FOR SELECT USING (true);
    CREATE POLICY "insert policy" ON public.bundle_tag FOR INSERT WITH CHECK (true);
    CREATE POLICY "update policy" ON public.bundle_tag FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "delete policy" ON public.bundle_tag FOR DELETE USING (true);
  END IF;

END $$;