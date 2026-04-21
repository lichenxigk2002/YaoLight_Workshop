ALTER TABLE crawler_rules
ADD COLUMN IF NOT EXISTS tutorial TEXT;

UPDATE crawler_rules
SET tutorial = $$适用场景：新闻、博客、帮助中心、公告详情等标准正文页。

操作步骤：
1. 在规则测试页输入一篇真实文章 URL。
2. 先直接执行测试，观察是否返回 title、content 或 html。
3. 如果正文过短，优先检查目标页面是否需要登录或是否是前端渲染。

常见失败：
- 页面正文在 iframe 里，这条规则通常抓不全。
- 页面首屏只有摘要，完整正文需要点击展开，这条规则不适合。

调参建议：
- 纯静态页面一般不需要开启 Headless。
- 如果页面结构很怪，建议复制本规则后改成自定义选择器。

示例页面类型：新闻详情、博客文章、帮助中心文档。$$
WHERE name = '通用正文抽取（文章页）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：导航页、栏目页、聚合页、目录页，需要先拿到一批链接再做后续遍历。

操作步骤：
1. 输入一个列表页 URL。
2. 执行测试后查看 links 结果数量和链接文本。
3. 如果结果过多，后续通常要在工作流里再做过滤。

常见失败：
- 页面链接主要由前端渲染，这条静态规则可能抓不到。
- 页面里无关导航链接很多，结果会比较杂。

调参建议：
- 如果只想抓正文区链接，复制本规则后改成自定义选择器。
- 如果页面有分页，优先改用“下一页按钮”或“?page=”规则。

示例页面类型：博客归档页、分类目录页、栏目列表页。$$
WHERE name = '通用链接列表抽取（导航/目录页）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：正文内容由 React、Vue、Next.js 等前端渲染后才出现的详情页。

操作步骤：
1. 输入一个真实详情页 URL。
2. 先看测试结果里是否成功等待到正文容器。
3. 如果内容仍为空，说明页面可能还需要更长等待或特殊交互。

常见失败：
- 页面需要登录、验证、点击“展开全文”。
- 正文不在常规 article/main/content 容器里。

调参建议：
- 可以复制后适当增加等待时间。
- 如果页面正文区选择器很明确，建议改成自定义选择器版本。

示例页面类型：前端渲染文章页、社区帖子详情页、文档详情页。$$
WHERE name = '通用动态正文抽取（JS 页面）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：瀑布流、卡片流、搜索结果、前端渲染列表页。

操作步骤：
1. 输入一个 SPA 列表页 URL。
2. 执行测试后查看 items 或 data 数量。
3. 如果抓到的是空列表，先确认页面是否在首屏就渲染数据。

常见失败：
- 页面需要滚动到底部才继续加载更多卡片。
- 页面需要点击“加载更多”按钮。

调参建议：
- 这条规则适合首屏可见列表，不适合无限滚动的完整抓取。
- 如果只想抽某一类卡片，复制后改成自定义选择器。

示例页面类型：资讯流、商品卡片流、搜索结果页。$$
WHERE name = '通用动态卡片列表抽取（SPA 列表页）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：存在标准“下一页”链接或分页按钮的多页列表。

操作步骤：
1. 输入第一页 URL。
2. 测试后检查 pages 数量和每页结果。
3. 如果只抓到第一页，说明站点的下一页选择器不匹配。

常见失败：
- 分页不是超链接，而是点击按钮或滚动加载。
- 下一页按钮使用特殊 DOM 结构，默认选择器命不中。

调参建议：
- 遇到站点分页 DOM 特殊时，复制本规则并修改 pagination.selector。
- 多数站点建议把最大页数控制在较小范围，先验证链路。

示例页面类型：博客分页、新闻列表分页、分类归档分页。$$
WHERE name = '通用分页链接抓取（下一页按钮）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：URL 通过 ?page=2、?p=2 这类参数翻页的列表页。

操作步骤：
1. 输入第一页 URL。
2. 确认第一页本身不带错误页码参数。
3. 测试后检查 pages 和聚合结果是否符合预期。

常见失败：
- 站点分页参数不叫 page。
- 第一页 URL 本身已经带特殊查询参数，和规则里的 page_param 发生冲突。

调参建议：
- 如站点使用 p、pageNo、current 等参数，请复制本规则后修改 page_param。
- 如页码从 0 开始，也要同步调整 start_page。

示例页面类型：搜索结果页、商品列表页、目录分页页。$$
WHERE name = '通用参数翻页列表抓取（?page=）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：相册页、图库页、商品图页、素材详情页，需要先收集图片资源地址。

操作步骤：
1. 输入一个图片较多的页面 URL。
2. 执行测试后查看 images 列表和返回数量。
3. 再确认返回的是目标图片而不是页面装饰图。

常见失败：
- 图片是背景图而不是 img 标签。
- 真正大图需要点击缩略图后才加载。

调参建议：
- 如果站点大量用背景图，通用图片规则命中率会下降。
- 如果只抓某个画廊区域，复制后改成自定义选择器更稳。

示例页面类型：图库详情、商品相册、素材预览页。$$
WHERE name = '通用图片画廊抽取（相册/素材页）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');

UPDATE crawler_rules
SET tutorial = $$适用场景：政策公告、论文附件、下载中心、资料库，需要快速抽出 PDF、DOC、ZIP 等附件链接。

操作步骤：
1. 输入一个下载页或公告详情页 URL。
2. 执行测试后查看 link 字段和文本。
3. 如果命中太少，检查附件链接是否通过脚本生成。

常见失败：
- 下载链接不是直接挂在 a 标签 href 上。
- 附件需要登录鉴权或二次跳转接口。

调参建议：
- 如果站点附件后缀不标准，复制本规则并补充选择器。
- 如果附件链接藏在正文区，可结合正文规则和自定义选择器一起做。

示例页面类型：公告附件、资料下载页、论文附件页。$$
WHERE name = '通用附件链接抽取（PDF/文档/下载）'
  AND created_by IS NULL
  AND (tutorial IS NULL OR btrim(tutorial) = '');
