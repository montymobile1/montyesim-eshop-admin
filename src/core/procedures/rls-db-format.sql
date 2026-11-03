ALTER TABLE IF EXISTS public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.app_config; DROP POLICY IF EXISTS all_access_insert ON public.app_config; DROP POLICY IF EXISTS all_access_update ON public.app_config; DROP POLICY IF EXISTS all_access_delete ON public.app_config;

ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.audit_log; DROP POLICY IF EXISTS all_access_insert ON public.audit_log; DROP POLICY IF EXISTS all_access_update ON public.audit_log; DROP POLICY IF EXISTS all_access_delete ON public.audit_log;

ALTER TABLE IF EXISTS public.banner ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.banner; DROP POLICY IF EXISTS all_access_insert ON public.banner; DROP POLICY IF EXISTS all_access_update ON public.banner; DROP POLICY IF EXISTS all_access_delete ON public.banner;

ALTER TABLE IF EXISTS public.banner_translation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.banner_translation; DROP POLICY IF EXISTS all_access_insert ON public.banner_translation; DROP POLICY IF EXISTS all_access_update ON public.banner_translation; DROP POLICY IF EXISTS all_access_delete ON public.banner_translation;

ALTER TABLE IF EXISTS public.bundle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.bundle; DROP POLICY IF EXISTS all_access_insert ON public.bundle; DROP POLICY IF EXISTS all_access_update ON public.bundle; DROP POLICY IF EXISTS all_access_delete ON public.bundle;

ALTER TABLE IF EXISTS public.bundle_tag ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.bundle_tag; DROP POLICY IF EXISTS all_access_insert ON public.bundle_tag; DROP POLICY IF EXISTS all_access_update ON public.bundle_tag; DROP POLICY IF EXISTS all_access_delete ON public.bundle_tag;

ALTER TABLE IF EXISTS public.bundle_translation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.bundle_translation; DROP POLICY IF EXISTS all_access_insert ON public.bundle_translation; DROP POLICY IF EXISTS all_access_update ON public.bundle_translation; DROP POLICY IF EXISTS all_access_delete ON public.bundle_translation;

ALTER TABLE IF EXISTS public.contact_us ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.contact_us; DROP POLICY IF EXISTS all_access_insert ON public.contact_us; DROP POLICY IF EXISTS all_access_update ON public.contact_us; DROP POLICY IF EXISTS all_access_delete ON public.contact_us;

ALTER TABLE IF EXISTS public.currency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.currency; DROP POLICY IF EXISTS all_access_insert ON public.currency; DROP POLICY IF EXISTS all_access_update ON public.currency; DROP POLICY IF EXISTS all_access_delete ON public.currency;

ALTER TABLE IF EXISTS public.device ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.device; DROP POLICY IF EXISTS all_access_insert ON public.device; DROP POLICY IF EXISTS all_access_update ON public.device; DROP POLICY IF EXISTS all_access_delete ON public.device;

ALTER TABLE IF EXISTS public.mcp_card_checkout ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.mcp_card_checkout; DROP POLICY IF EXISTS all_access_insert ON public.mcp_card_checkout; DROP POLICY IF EXISTS all_access_update ON public.mcp_card_checkout; DROP POLICY IF EXISTS all_access_delete ON public.mcp_card_checkout;

ALTER TABLE IF EXISTS public.mcp_purchase_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.mcp_purchase_idempotency; DROP POLICY IF EXISTS all_access_insert ON public.mcp_purchase_idempotency; DROP POLICY IF EXISTS all_access_update ON public.mcp_purchase_idempotency; DROP POLICY IF EXISTS all_access_delete ON public.mcp_purchase_idempotency;

ALTER TABLE IF EXISTS public.mcp_stripe_webhook_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.mcp_stripe_webhook_event; DROP POLICY IF EXISTS all_access_insert ON public.mcp_stripe_webhook_event; DROP POLICY IF EXISTS all_access_update ON public.mcp_stripe_webhook_event; DROP POLICY IF EXISTS all_access_delete ON public.mcp_stripe_webhook_event;

ALTER TABLE IF EXISTS public.notification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.notification; DROP POLICY IF EXISTS all_access_insert ON public.notification; DROP POLICY IF EXISTS all_access_update ON public.notification; DROP POLICY IF EXISTS all_access_delete ON public.notification;

ALTER TABLE IF EXISTS public.promotion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.promotion; DROP POLICY IF EXISTS all_access_insert ON public.promotion; DROP POLICY IF EXISTS all_access_update ON public.promotion; DROP POLICY IF EXISTS all_access_delete ON public.promotion;

ALTER TABLE IF EXISTS public.promotion_rule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.promotion_rule; DROP POLICY IF EXISTS all_access_insert ON public.promotion_rule; DROP POLICY IF EXISTS all_access_update ON public.promotion_rule; DROP POLICY IF EXISTS all_access_delete ON public.promotion_rule;

ALTER TABLE IF EXISTS public.promotion_rule_action ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.promotion_rule_action; DROP POLICY IF EXISTS all_access_insert ON public.promotion_rule_action; DROP POLICY IF EXISTS all_access_update ON public.promotion_rule_action; DROP POLICY IF EXISTS all_access_delete ON public.promotion_rule_action;

ALTER TABLE IF EXISTS public.promotion_rule_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.promotion_rule_event; DROP POLICY IF EXISTS all_access_insert ON public.promotion_rule_event; DROP POLICY IF EXISTS all_access_update ON public.promotion_rule_event; DROP POLICY IF EXISTS all_access_delete ON public.promotion_rule_event;

ALTER TABLE IF EXISTS public.promotion_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.promotion_usage; DROP POLICY IF EXISTS all_access_insert ON public.promotion_usage; DROP POLICY IF EXISTS all_access_update ON public.promotion_usage; DROP POLICY IF EXISTS all_access_delete ON public.promotion_usage;

ALTER TABLE IF EXISTS public.tag ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.tag; DROP POLICY IF EXISTS all_access_insert ON public.tag; DROP POLICY IF EXISTS all_access_update ON public.tag; DROP POLICY IF EXISTS all_access_delete ON public.tag;

ALTER TABLE IF EXISTS public.tag_group ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.tag_group; DROP POLICY IF EXISTS all_access_insert ON public.tag_group; DROP POLICY IF EXISTS all_access_update ON public.tag_group; DROP POLICY IF EXISTS all_access_delete ON public.tag_group;

ALTER TABLE IF EXISTS public.tag_translation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.tag_translation; DROP POLICY IF EXISTS all_access_insert ON public.tag_translation; DROP POLICY IF EXISTS all_access_update ON public.tag_translation; DROP POLICY IF EXISTS all_access_delete ON public.tag_translation;

ALTER TABLE IF EXISTS public.user_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_order; DROP POLICY IF EXISTS all_access_insert ON public.user_order; DROP POLICY IF EXISTS all_access_update ON public.user_order; DROP POLICY IF EXISTS all_access_delete ON public.user_order;

ALTER TABLE IF EXISTS public.user_otp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_otp; DROP POLICY IF EXISTS all_access_insert ON public.user_otp; DROP POLICY IF EXISTS all_access_update ON public.user_otp; DROP POLICY IF EXISTS all_access_delete ON public.user_otp;

ALTER TABLE IF EXISTS public.user_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_profile; DROP POLICY IF EXISTS all_access_insert ON public.user_profile; DROP POLICY IF EXISTS all_access_update ON public.user_profile; DROP POLICY IF EXISTS all_access_delete ON public.user_profile;

ALTER TABLE IF EXISTS public.user_profile_bundle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_profile_bundle; DROP POLICY IF EXISTS all_access_insert ON public.user_profile_bundle; DROP POLICY IF EXISTS all_access_update ON public.user_profile_bundle; DROP POLICY IF EXISTS all_access_delete ON public.user_profile_bundle;

ALTER TABLE IF EXISTS public.user_wallet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_wallet; DROP POLICY IF EXISTS all_access_insert ON public.user_wallet; DROP POLICY IF EXISTS all_access_update ON public.user_wallet; DROP POLICY IF EXISTS all_access_delete ON public.user_wallet;

ALTER TABLE IF EXISTS public.user_wallet_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.user_wallet_transaction; DROP POLICY IF EXISTS all_access_insert ON public.user_wallet_transaction; DROP POLICY IF EXISTS all_access_update ON public.user_wallet_transaction; DROP POLICY IF EXISTS all_access_delete ON public.user_wallet_transaction;

ALTER TABLE IF EXISTS public.users_copy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.users_copy; DROP POLICY IF EXISTS all_access_insert ON public.users_copy; DROP POLICY IF EXISTS all_access_update ON public.users_copy; DROP POLICY IF EXISTS all_access_delete ON public.users_copy;

ALTER TABLE IF EXISTS public.voucher ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_access_select ON public.voucher; DROP POLICY IF EXISTS all_access_insert ON public.voucher; DROP POLICY IF EXISTS all_access_update ON public.voucher; DROP POLICY IF EXISTS all_access_delete ON public.voucher;

-- storage.objects (read policy kept)
DROP POLICY IF EXISTS "Enable insert for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for all users" ON storage.objects;
DROP POLICY IF EXISTS "select media" ON storage.objects;
DROP POLICY IF EXISTS "insert media" ON storage.objects;
DROP POLICY IF EXISTS "update media" ON storage.objects;
DROP POLICY IF EXISTS "delete media" ON storage.objects;

-- storage.buckets (read policy kept)
DROP POLICY IF EXISTS "Enable insert for all users " ON storage.buckets;
DROP POLICY IF EXISTS "Enable update for all users" ON storage.buckets;
DROP POLICY IF EXISTS "Enable delete for all users" ON storage.buckets;
 