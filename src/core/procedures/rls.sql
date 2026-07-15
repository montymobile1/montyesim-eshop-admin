/*EXPLANATION: MAY NOT INCLUDE ALL FEAT , TO BE RETESTED ON PORTAL*/

-- READ
CREATE POLICY "select policy"
ON public.app_config
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.app_config
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.app_config
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.app_config
FOR DELETE
USING (true);

CREATE POLICY "select policy"
ON public.contact_us
FOR SELECT
USING (true);

CREATE POLICY "select policy"
ON public.user_wallet_transaction
FOR SELECT
USING (true);

CREATE POLICY "select policy"
ON public.user_wallet
FOR SELECT
USING (true);

CREATE POLICY "select policy"
ON public.promotion
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.promotion
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.promotion
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.promotion
FOR DELETE
USING (true);

CREATE POLICY "select policy"
ON public.promotion_rule
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.promotion_rule
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.promotion_rule
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.promotion_rule
FOR DELETE
USING (true);

CREATE POLICY "select policy"
ON public.promotion_rule_event
FOR SELECT
USING (true);

CREATE POLICY "select policy"
ON public.promotion_rule_action
FOR SELECT
USING (true);

CREATE POLICY "insert policy"
ON public.promotion_usage
FOR INSERT
WITH CHECK (true);

CREATE POLICY "insert policy"
ON public.users_copy
FOR INSERT
WITH CHECK (true);

CREATE POLICY "insert policy"
ON public.user_order
FOR INSERT
WITH CHECK (true);

-- READ
CREATE POLICY "select policy"
ON public.bundle
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.bundle
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.bundle
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.bundle
FOR DELETE
USING (true);

-- READ
CREATE POLICY "select policy"
ON public.voucher
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.voucher
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.voucher
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.voucher
FOR DELETE
USING (true);

-- READ
CREATE POLICY "select policy"
ON public.device
FOR SELECT
USING (true);


-- READ
CREATE POLICY "select policy"
ON public.audit_log
FOR SELECT
USING (true);

CREATE POLICY "insert policy"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.audit_log
FOR UPDATE
USING (true)
WITH CHECK (true);


CREATE POLICY "select policy"
ON public.currency
FOR SELECT
USING (true);

-- =========================================================
-- tag_group (groups page: list, create, edit, toggle, delete)
-- =========================================================

-- READ
CREATE POLICY "select policy"
ON public.tag_group
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.tag_group
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.tag_group
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.tag_group
FOR DELETE
USING (true);

-- =========================================================
-- tag (tags belong to groups; create/edit/delete from group flow)
-- =========================================================

-- READ
CREATE POLICY "select policy"
ON public.tag
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.tag
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.tag
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.tag
FOR DELETE
USING (true);

-- =========================================================
-- bundle_tag (read needed by delete_group_if_no_bundle to
-- check bundle associations before deleting a group)
-- =========================================================

-- READ
CREATE POLICY "select policy"
ON public.bundle_tag
FOR SELECT
USING (true);

-- INSERT
CREATE POLICY "insert policy"
ON public.bundle_tag
FOR INSERT
WITH CHECK (true);

-- UPDATE
CREATE POLICY "update policy"
ON public.bundle_tag
FOR UPDATE
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "delete policy"
ON public.bundle_tag
FOR DELETE
USING (true);


-------------------
CREATE POLICY "select policy"
ON public.promotion_usage
FOR SELECT
USING (true);

CREATE POLICY "select media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'media');
 
CREATE POLICY "insert media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');
 
CREATE POLICY "update media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');
 
CREATE POLICY "delete media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media');
