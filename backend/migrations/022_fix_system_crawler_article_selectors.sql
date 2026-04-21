UPDATE crawler_rules
SET selectors = '{
  "primary":"article, main, .article-content, .post-content, .entry-content, .content",
  "fallback":[".article",".post","#content","#main","body"],
  "wait_for_selector":"article, main, .article-content, .post-content, .entry-content, .content"
}'::jsonb
WHERE name = '通用正文抽取（文章页）'
  AND created_by IS NULL
  AND selectors = '{"wait_for_selector":"body"}'::jsonb;

UPDATE crawler_rules
SET selectors = '{
  "primary":"article, main, .article-content, .post-content, .entry-content, .content",
  "fallback":[".article",".post","#content","#main","body"],
  "wait_for_selector":"article, main, .article-content, .post-content, .entry-content, .content"
}'::jsonb
WHERE name = '通用动态正文抽取（JS 页面）'
  AND created_by IS NULL
  AND selectors = '{"wait_for_selector":"article, main, .article-content, .post-content, .entry-content, .content, body"}'::jsonb;
