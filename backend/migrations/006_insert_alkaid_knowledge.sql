-- 瑶光星知识库数据初始化脚本
-- 本脚本包含详细的节点使用说明、最佳实践、错误修复手册和场景模板
-- 数据来源：基于代码实现自动生成，后续更新代码时会同步更新此脚本

-- 清空现有知识库数据（可选，用于重新初始化）
-- DELETE FROM alkaid_knowledge WHERE user_id IS NULL;

-- ============================================
-- 一、节点使用说明 (node_usage)
-- ============================================

-- 1.1 Start 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,  -- 系统公共知识
  'node_usage',
  'start',
  '开始节点使用说明',
  '开始节点是工作流的入口，定义初始输入数据。

必填配置：
- trigger: 触发方式，可选值：manual（手动触发）、schedule（定时触发）、webhook（Webhook触发）
- inputDataType: 输入数据类型，可选值：json、text、form

输入数据格式（inputDataType="json"时）：
建议使用JSON对象字符串，例如：
{
  "url": "https://example.com",
  "url1": "https://site1.com",
  "url2": "https://site2.com",
  "topic": "要搜索的主题"
}

输出变量：
- data: 初始数据对象，包含用户在inputData中定义的所有字段

变量引用示例：
下游节点可以通过 {{node-1.data.url}} 引用开始节点中的url字段

最佳实践：
1. 使用有意义的字段名（如url、topic等）
2. 字段名使用小写字母和下划线
3. 对于需要传入多个URL的场景，使用url1、url2等命名',
  '["开始节点", "输入数据", "变量引用"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.2 Crawler 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'crawler',
  '爬虫节点使用说明',
  '爬虫节点用于抓取网页内容，支持多种提取模式和配置选项。

URL配置（二选一）：
1. url: 直接指定URL地址（字符串）
2. urlVariable: 使用变量引用，推荐使用 {{node-id.data.url}} 或 {{node-id.data.url1}} 格式

HTTP方法：
- method: GET（默认）或 POST

提取模式（extractMode）：
- smart: 智能提取（推荐），自动识别网页主要内容，适用于大多数场景
- regex: 正则表达式提取，需要提供selector字段，适用于精确提取
- custom: 自定义CSS选择器提取，需要提供selector和extractType

提取类型（extractType）：
- text: 提取文本内容（推荐）
- html: 提取HTML内容
- link: 提取链接地址
- image: 提取图片地址
- attr: 提取自定义属性

输出变量：
- data: 爬取到的完整数据对象
- html: 原始HTML内容（字符串）
- text: 提取的文本内容（字符串）

高级配置：
- timeout: 请求超时时间（秒），默认30秒
- retryCount: 重试次数，默认3次
- retryDelay: 重试延迟（秒），默认1秒
- headers: HTTP请求头（支持变量引用）
- cookies: Cookie（支持变量引用）
- body: POST请求体
- bodyType: 请求体类型，json或form
- useHeadless: 是否使用无头浏览器，用于JavaScript渲染的页面
- javascriptWait: JavaScript等待时间（秒），默认5秒
- encoding: 编码方式，auto（自动检测）或其他编码

变量引用：
- urlVariable: 可以使用 {{node-id.data.url}} 格式
- headers: 可以使用变量引用
- body: 可以使用变量引用

最佳实践：
1. 优先使用 urlVariable 引用start节点的数据
2. extractMode="smart" 适用于90%的场景
3. 对于需要JavaScript渲染的页面，设置 useHeadless=true
4. 对于需要登录的网站，使用headers和cookies配置
5. 遇到超时错误时，增加timeout参数或使用重试机制

常见错误：
- 超时错误：增加timeout或检查网络
- 提取失败：检查extractMode和extractType配置
- 变量引用错误：确保上游节点输出正确的变量',
  '["爬虫节点", "网页抓取", "变量引用", "提取模式"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.3 DataClean 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'dataclean',
  '数据清洗节点使用说明',
  '数据清洗节点用于清洗和格式化文本数据，去除HTML标签、空格等无用内容。

必填配置：
- dataVariable: 数据变量引用，使用 {{node-id.variable}} 格式
  例如：{{node-2.text}} 或 {{node-2.html}} 或 {{node-3.cleaned}}

清洗类型（cleanType）：
- html: 去除HTML标签
- text: 文本清洗（去除HTML、空格、换行等）
- email: 提取邮箱地址
- url: 提取URL地址
- phone: 提取电话号码
- number: 提取数字
- date: 提取日期
- custom: 自定义清洗规则

清洗选项：
- removeHTML: 是否去除HTML标签（默认true）
- trim: 是否去除首尾空格（默认true）
- removeSpaces: 是否去除所有空格（默认false）
- toLowerCase: 是否转换为小写（默认false）
- toUpperCase: 是否转换为大写（默认false）
- deduplicate: 是否去重（默认false）

输出变量：
- cleaned: 清洗后的数据（类型与输入数据一致）

变量引用：
- dataVariable: 必须使用变量引用格式 {{node-id.variable}}
  常见引用：
  - {{node-2.text}}: 引用crawler节点的文本输出
  - {{node-2.html}}: 引用crawler节点的HTML输出
  - {{node-3.cleaned}}: 引用另一个dataclean节点的清洗结果

最佳实践：
1. 通常配合crawler节点使用，清洗 {{crawler-node.text}}
2. cleanType="text" 适用于大多数场景
3. trim=true 可以去除多余的空白字符
4. 对于需要结构化提取的数据，可以先用dataclean清洗，再用AI节点提取

常见错误：
- 变量引用不存在：确保上游节点正确执行并输出对应变量
- 清洗后数据为空：检查清洗规则是否过于严格',
  '["数据清洗节点", "文本处理", "变量引用"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.4 AI 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'ai',
  'AI处理节点使用说明',
  'AI处理节点使用AI模型处理文本内容，支持摘要、翻译、结构化提取等任务。

必填配置：
- prompt: AI提示词，描述希望AI执行的任务
- contentVariable: 内容变量引用，使用 {{node-id.variable}} 格式

模型模式（modelMode）：
- system: 使用系统预设模型（推荐），无需配置API Key
- custom: 使用用户自定义模型，需要在"设置-模型管理"中配置

系统预设模型（modelMode="system"时）：
- provider: 模型提供商，可选值：deepseek、qwen、doubao、spark、grok等
- modelName: 模型名称，例如 deepseek-chat、qwen-turbo等

AI参数：
- temperature: 温度参数（0-1），控制输出的随机性
  - 0.1-0.3: 确定性输出，适用于摘要、翻译等任务（推荐）
  - 0.7-0.9: 创造性输出，适用于创作、对话等任务
- maxTokens: 最大输出token数，默认2000
- stream: 是否使用流式输出（默认false）
- thinking: 是否启用深度思考模式（DeepSeek特有，默认false）

提示词（prompt）：
- 可以是普通文本，也可以包含变量引用
- 变量引用格式：{{node-id.variable}}
- 例如："请总结以下内容，并提取关键信息：{{node-1.data.topic}}"

内容变量（contentVariable）：
- 必须使用变量引用格式
- 常见引用：
  - {{node-3.cleaned}}: 引用dataclean节点的清洗结果（推荐）
  - {{node-2.text}}: 直接引用crawler节点的文本输出
  - {{node-4.result}}: 引用另一个AI节点的结果

输出变量：
- result: AI处理后的结果（字符串）

最佳实践：
1. 优先使用 contentVariable 引用 dataclean 节点的 cleaned 输出
2. temperature=0.2 适用于摘要、提取等确定性任务
3. 提示词要清晰明确，包含具体的输出要求
4. 对于长文本，确保 maxTokens 足够大
5. 提示词中可以使用变量，例如："请根据主题 {{node-1.data.topic}} 总结以下内容"

常见错误：
- 提示词为空：必须填写prompt
- 内容变量引用不存在：确保上游节点正确执行
- 模型调用失败：检查系统是否配置了API Key或用户模型是否有效
- 输出被截断：增加maxTokens参数',
  '["AI节点", "AI处理", "提示词", "变量引用"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.5 Output 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'output',
  '输出节点使用说明',
  '输出节点用于输出工作流的处理结果。

必填配置：
- format: 输出格式，可选值：json、markdown、text

可选配置：
- destination: 输出目标，可选值：file（文件，默认）、console（控制台）

输出格式说明：
- json: JSON格式输出，适用于结构化数据
- markdown: Markdown格式输出，适用于文档、报告等
- text: 纯文本格式输出，适用于简单文本内容

数据来源：
输出节点会自动接收上游节点的数据，不需要配置变量引用。
如果上游是AI节点，通常会输出 {{node-id.result}}

最佳实践：
1. 通常作为工作流的最后一个节点（在end节点之前）
2. format="markdown" 适用于生成报告、文档等
3. format="json" 适用于结构化数据输出',
  '["输出节点", "结果输出"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.6 Condition 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'condition',
  '条件分支节点使用说明',
  '条件分支节点根据条件判断结果，选择不同的执行路径。

必填配置：
- conditionType: 条件类型，可选值：equals、contains、greater、less、regex
- field: 要判断的字段路径（支持嵌套，如 data.status）
- operator: 操作符，可选值：==、!=、>、<、>=、<=、contains
- value: 比较值

可选配置：
- fieldVariable: 字段变量引用（如果使用变量，field会被覆盖）
- valueVariable: 值变量引用（如果使用变量，value会被覆盖）

输出分支：
- sourceHandle="true": 条件为真时执行的路径
- sourceHandle="false": 条件为假时执行的路径

输出变量：
- result: 判断结果（boolean）
- data: 原始输入数据

最佳实践：
1. 条件节点后的边必须配置 sourceHandle 属性
2. true分支用于正常流程，false分支用于异常处理
3. field字段可以使用变量引用，例如 {{node-1.data.status}}
4. 可以使用fieldVariable和valueVariable实现动态条件判断',
  '["条件节点", "分支控制"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.7 Transform 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'transform',
  '数据转换节点使用说明',
  '数据转换节点用于对数据进行转换、过滤、排序、分组等操作。

⚠️ 重要提示：
当前版本（第一阶段）中，transform节点的script执行逻辑为占位实现，不会真正执行转换脚本。
节点会透传输入数据，不会进行实际转换。

配置选项：
- transformType: 转换类型，可选值：map、filter、sort、group
- script: 转换脚本（当前未实现，待后续版本支持）

输入变量：
- data: 待转换数据（any类型）

输出变量：
- transformed: 转换后数据（当前版本会透传输入数据）

转换类型说明：
- map: 映射转换，将数据映射为新的结构
- filter: 过滤转换，根据条件过滤数据
- sort: 排序转换，对数据进行排序
- group: 分组转换，将数据按条件分组

使用建议：
1. 第一阶段不建议使用transform节点
2. 如果需要数据转换，可以使用AI节点进行结构化提取
3. 等待后续版本完善script执行功能后再使用

替代方案：
- 使用AI节点：通过提示词让AI进行数据转换和结构化
- 使用dataclean节点：进行简单的数据清洗和格式化',
  '["数据转换节点", "实验性功能", "待完善"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.8 Loop 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'loop',
  '循环处理节点使用说明',
  '循环处理节点用于对数组数据进行循环处理。

⚠️ 重要提示：
当前版本（第一阶段）中，loop节点不会真正逐项驱动下游执行。
节点会将输入数组透传为results，不会真正循环执行下游节点。

配置选项：
- loopType: 循环类型，可选值：foreach、while、for
- items: 要循环的数据路径（例如：data.items）
- condition: 循环条件（while和for类型使用）

输入变量：
- items: 循环项（array类型，必填）

输出变量：
- results: 循环结果（array类型，当前版本会透传输入数组）
- count: 循环次数

循环类型说明：
- foreach: 遍历数组中的每个元素
- while: 根据条件循环执行
- for: 按次数循环执行

使用建议：
1. 第一阶段不建议使用loop节点
2. 如果需要处理多个URL，可以创建多个crawler节点，分别引用不同的URL
3. 等待后续版本完善循环执行功能后再使用

替代方案：
- 多节点方案：为每个需要处理的项目创建独立的节点链
- 例如：处理3个URL，创建3个crawler节点，分别引用url1、url2、url3',
  '["循环节点", "实验性功能", "待完善"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.9 Merge 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'merge',
  '合并分支节点使用说明',
  '合并分支节点用于将多个分支的数据合并为一个输出。

使用场景：
- 条件分支后的数据合并
- 多个并行处理路径的结果合并
- 将多个数据源合并为一个数据集

配置选项：
- mergeType: 合并类型，可选值：concat（连接）、union（并集）、intersect（交集）

输入变量：
- data: 要合并的数据（any类型，可以有多个输入）

输出变量：
- merged: 合并后的数据（object类型）

连接配置：
- merge节点的入边必须配置 targetHandle 属性
- 格式：targetHandle="input-0", "input-1", "input-2" 等
- 第一个输入使用 input-0，第二个使用 input-1，以此类推

合并逻辑：
- concat: 将所有输入数据连接成一个数组或对象
- union: 合并为并集（去重）
- intersect: 合并为交集（只保留共同部分）

使用示例：
1. 条件分支合并：
   condition → [true分支] → merge (input-0)
   condition → [false分支] → merge (input-1)

2. 多数据源合并：
   crawler-1 → merge (input-0)
   crawler-2 → merge (input-1)
   crawler-3 → merge (input-2)

最佳实践：
1. 确保所有入边都配置了正确的targetHandle
2. 合并节点的输入数量应该与入边数量一致
3. 合并后的数据可以通过下游节点继续处理',
  '["合并节点", "分支合并", "数据合并"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.10 Delay 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'delay',
  '延迟等待节点使用说明',
  '延迟等待节点用于在工作流执行过程中添加延迟，避免请求过快被封禁。

配置选项：
- delayType: 延迟类型，可选值：fixed（固定延迟）、random（随机延迟）
- seconds: 延迟时间（秒），默认1秒

输入变量：
- data: 输入数据（any类型，可选）

输出变量：
- data: 透传的输入数据（与输入数据相同）

使用场景：
1. 爬虫节点之间添加延迟，避免请求过快
2. API调用之间添加延迟，遵守速率限制
3. 需要等待外部系统处理完成

延迟类型：
- fixed: 固定延迟，延迟固定的秒数
- random: 随机延迟，在指定范围内随机延迟（待实现）

最佳实践：
1. 在多个crawler节点之间添加delay节点
2. 延迟时间建议1-3秒，避免过长影响执行效率
3. 对于需要遵守robots.txt的场景，使用delay节点

示例配置：
- delayType: "fixed"
- seconds: 2

注意事项：
- delay节点会阻塞工作流执行，增加总执行时间
- 合理设置延迟时间，平衡效率和稳定性',
  '["延迟节点", "等待", "速率控制"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 1.11 End 节点使用说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'node_usage',
  'end',
  '结束节点使用说明',
  '结束节点是工作流的终点，标记工作流执行完成。

配置选项：
- action: 结束动作，可选值：none（无动作，默认）、notify（通知）、callback（回调）

输入变量：
- data: 最终数据（any类型，可选）

输出变量：
- 无（结束节点不输出变量）

使用说明：
1. 每个工作流应该至少有一个end节点
2. end节点只能作为出口，不能有出边
3. 可以有多个end节点（多个结束点）
4. 通常放在output节点之后

最佳实践：
1. 作为工作流的最后一个节点
2. 通常放在output节点之后
3. action="none" 适用于大多数场景
4. 如果需要通知或回调，可以配置action="notify"或"callback"（待实现）

节点序列示例：
start → crawler → dataclean → ai → output → end',
  '["结束节点", "工作流终点"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================
-- 二、最佳实践 (best_practice)
-- ============================================

-- 2.1 Merge节点最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'merge',
  'Merge节点最佳实践',
  '1. 连接配置
   - 所有入边必须配置targetHandle
   - 格式：input-0, input-1, input-2...
   - 按顺序递增，不能跳过

2. 使用场景
   - 条件分支后的数据合并
   - 多个并行处理路径的结果合并
   - 将多个数据源合并为一个数据集

3. 合并类型选择
   - concat: 适用于需要保留所有数据的场景
   - union: 适用于需要去重的场景
   - intersect: 适用于需要求交集的场景

4. 数据格式
   - 确保要合并的数据格式一致
   - 如果格式不一致，merge节点会尝试自动合并',
  '["最佳实践", "合并节点", "分支合并"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.2 Delay节点最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'delay',
  'Delay节点最佳实践',
  '1. 延迟时间设置
   - 推荐：1-3秒
   - 避免过长：超过5秒会影响执行效率
   - 避免过短：小于0.5秒可能无法有效避免封禁

2. 使用场景
   - 多个crawler节点之间：避免请求过快
   - API调用之间：遵守速率限制
   - 需要等待外部系统：给外部系统处理时间

3. 位置选择
   - 放在需要延迟的节点之后
   - 通常放在crawler节点之后

4. 性能考虑
   - delay节点会增加总执行时间
   - 合理使用，不要过度使用',
  '["最佳实践", "延迟节点", "速率控制"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.3 工作流设计最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  NULL,
  '工作流设计最佳实践',
  '1. 节点数量控制
   - 推荐：6-10个节点
   - 最大：12个节点（第一阶段限制）
   - 过多节点会增加复杂度和出错概率

2. 节点ID命名规范
   - 使用 node-1, node-2, node-3... 格式
   - 按顺序递增，便于理解和调试
   - 不要使用 node-a, node-start 等非数字格式

3. 节点位置布局
   - 推荐垂直排列（connectionDirection="vertical"）
   - y坐标递增140，例如：{x:0, y:0}, {x:0, y:140}, {x:0, y:280}
   - 保持节点对齐，便于阅读

4. 变量引用规范
   - 使用 {{nodeId.variableName}} 格式
   - 变量名必须与节点输出定义一致
   - 只能引用上游节点的输出变量
   - 支持嵌套访问，如 {{node-1.data.url}}

5. 节点连接规范
   - start节点只能作为入口，不能有入边
   - end节点只能作为出口，不能有出边
   - condition节点的出边必须配置 sourceHandle
   - merge节点的入边必须配置 targetHandle

6. 推荐节点序列（最小可运行模板）
   start → crawler → dataclean → ai → output → end
   这个序列适用于大多数网页抓取和AI处理场景

7. 应避免的节点类型（第一阶段）
   - loop节点：当前实现为占位，不会真正循环执行
   - transform节点：当前实现为占位，不会执行script

8. 配置完整性
   - 确保所有必填字段都已填写
   - 使用推荐的默认配置
   - 变量引用必须在支持的字段中使用

9. 测试建议
   - 先测试单个节点，确保配置正确
   - 再测试完整工作流
   - 检查每个节点的输出数据',
  '["最佳实践", "设计原则", "规范"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.4 变量引用最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  NULL,
  '变量引用最佳实践',
  '变量引用是工作流中数据传递的核心机制，正确的变量引用是工作流正常运行的关键。

变量引用语法：
- 基本格式：{{nodeId.variableName}}
- 嵌套访问：{{nodeId.variableName.field}}

常用变量引用：
1. 引用start节点的数据：
   - {{node-1.data.url}}
   - {{node-1.data.url1}}
   - {{node-1.data.topic}}

2. 引用crawler节点的输出：
   - {{node-2.text}}：文本内容（最常用）
   - {{node-2.html}}：HTML内容
   - {{node-2.data}}：完整数据对象

3. 引用dataclean节点的输出：
   - {{node-3.cleaned}}：清洗后的数据

4. 引用AI节点的输出：
   - {{node-4.result}}：AI处理结果

5. 引用condition节点的输出：
   - {{node-5.result}}：判断结果（boolean）
   - {{node-5.data}}：原始数据

变量引用规则：
1. 只能引用上游节点（已执行的节点）的输出变量
2. 变量名必须与节点输出定义完全一致（区分大小写）
3. 在支持的字段中使用变量引用：
   - crawler.urlVariable：可以使用变量引用
   - dataclean.dataVariable：可以使用变量引用
   - ai.contentVariable：可以使用变量引用
   - ai.prompt：可以使用变量引用

常见错误：
1. 变量引用不存在：确保上游节点已执行并输出对应变量
2. 变量名拼写错误：检查变量名是否与输出定义一致
3. 在错误的字段中使用：确保字段支持变量引用

调试技巧：
1. 检查上游节点的执行结果，确认输出变量名称
2. 使用节点预览功能验证变量是否正确传递
3. 从简单到复杂，逐步添加变量引用',
  '["最佳实践", "变量引用", "数据传递"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.5 爬虫节点最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'crawler',
  '爬虫节点最佳实践',
  '1. URL配置
   - 优先使用 urlVariable 引用start节点的数据
   - 格式：{{node-1.data.url}} 或 {{node-1.data.url1}}
   - 直接填写url仅适用于测试场景

2. 提取模式选择
   - 大多数场景：extractMode="smart", extractType="text"
   - 需要精确提取：extractMode="custom", 配置selector
   - 需要正则匹配：extractMode="regex", 配置selector

3. JavaScript渲染
   - 普通HTML页面：不需要配置
   - SPA单页应用：设置 useHeadless=true, javascriptWait=5

4. 错误处理
   - 设置合理的timeout（默认30秒）
   - 启用重试：retryCount=3, retryDelay=1
   - 检查网络连接和目标网站可访问性

5. 请求头配置
   - 需要User-Agent：在headers中配置
   - 需要登录：配置cookies
   - 需要自定义头部：在headers中配置（支持变量引用）

6. 性能优化
   - 避免同时抓取过多页面
   - 使用适当的waitTime避免被封禁
   - 对于需要爬取多个页面的场景，考虑使用loop节点（待完善）',
  '["最佳实践", "爬虫节点", "网页抓取"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.6 AI节点最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'ai',
  'AI节点最佳实践',
  '1. 提示词设计
   - 清晰明确：具体描述希望AI执行的任务
   - 包含格式要求：如果需要JSON输出，明确指定
   - 可以包含上下文：使用变量引用 {{node-1.data.topic}}

2. 内容变量引用
   - 推荐引用dataclean的cleaned输出：{{node-3.cleaned}}
   - 也可以直接引用crawler的text输出：{{node-2.text}}
   - 避免引用原始HTML（太冗长）

3. 温度参数选择
   - 摘要、翻译、提取：temperature=0.2（确定性）
   - 创作、对话、生成：temperature=0.7（创造性）

4. Token数量
   - maxTokens=2000：适用于大多数场景
   - maxTokens=4000：适用于长文本处理
   - 注意：过大的maxTokens会增加成本和响应时间

5. 模型选择
   - 推荐使用系统预设模型（modelMode="system"）
   - provider="deepseek"：性价比高，推荐用于工作流生成
   - 其他模型按需选择

6. 流式输出
   - stream=false：普通模式，适用于工作流自动化
   - stream=true：实时显示，适用于交互式场景',
  '["最佳实践", "AI节点", "提示词"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2.7 条件分支最佳实践
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'condition',
  '条件分支最佳实践',
  '1. 条件配置
   - 使用fieldVariable和valueVariable实现动态条件
   - 支持嵌套字段访问，如 data.status.code
   - 操作符选择要符合数据类型

2. 分支连接
   - true分支：用于正常流程
   - false分支：用于异常处理或备用流程
   - 两个分支最终都应该连接到merge节点（如果需要合并）

3. 条件类型选择
   - equals: 精确匹配
   - contains: 包含判断
   - greater/less: 数值比较
   - regex: 正则匹配

4. 常见场景
   - 判断爬取是否成功：conditionType="equals", field="status", value="success"
   - 判断数据是否为空：conditionType="contains", field="data", value=""',
  '["最佳实践", "条件节点", "分支控制"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================
-- 三、错误修复手册 (error_repair)
-- ============================================

-- 3.1 爬虫超时错误修复
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'error_repair',
  'timeout_error',
  '爬虫超时错误修复',
  '错误现象：
- 爬虫节点执行失败
- 错误信息包含 "timeout" 或 "超时"

可能原因：
1. 网络连接慢或不稳定
2. 目标网站响应慢
3. timeout参数设置过小
4. 目标网站需要JavaScript渲染但未启用

修复方法：
1. 增加timeout参数：
   - 默认30秒，可以增加到60或120秒
   - 在crawler节点配置中设置 timeout=60

2. 启用重试机制：
   - retryCount=3（默认已启用）
   - retryDelay=1（默认1秒）
   - 可以增加重试次数和延迟时间

3. 检查网络连接：
   - 确认能正常访问目标网站
   - 检查防火墙和代理设置

4. 启用JavaScript渲染：
   - 如果目标网站是SPA应用，设置 useHeadless=true
   - 增加 javascriptWait=5（等待JavaScript执行）

5. 检查URL是否正确：
   - 确认URL格式正确（以http://或https://开头）
   - 确认URL可访问

6. 使用代理：
   - 如果目标网站限制了IP，配置proxy参数

预防措施：
- 设置合理的timeout值（30-60秒）
- 始终启用重试机制
- 对于SPA应用，始终启用headless模式',
  '["错误修复", "超时", "爬虫"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3.2 变量引用错误修复
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'error_repair',
  'variable_reference_error',
  '变量引用错误修复',
  '错误现象：
- 节点执行失败
- 错误信息包含 "变量"、"variable"、"不存在" 等关键词

可能原因：
1. 变量引用格式错误
2. 引用的节点ID不存在
3. 引用的变量名不存在
4. 上游节点未执行或执行失败

修复方法：
1. 检查变量引用格式：
   - 正确格式：{{node-1.data.url}}
   - 错误格式：{node-1.data.url}（缺少一个花括号）
   - 错误格式：{{node-1.data.url}}}（多余花括号）

2. 检查节点ID：
   - 确认节点ID存在，例如 node-1, node-2
   - 节点ID必须是数字格式（node-1，不是node-a）

3. 检查变量名：
   - crawler节点输出：text, html, data
   - dataclean节点输出：cleaned
   - ai节点输出：result
   - start节点输出：data
   - 变量名区分大小写，必须完全匹配

4. 检查上游节点：
   - 确保上游节点已正确执行
   - 检查上游节点的执行结果，确认输出变量存在
   - 如果上游节点失败，先修复上游节点

5. 检查变量路径：
   - {{node-1.data.url}}：正确，访问data对象的url字段
   - {{node-1.url}}：错误，如果url在data对象内

调试步骤：
1. 查看上游节点的执行结果
2. 确认输出变量名称
3. 检查变量引用语法
4. 测试简单的变量引用',
  '["错误修复", "变量引用", "数据传递"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3.3 AI节点调用失败修复
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'error_repair',
  'ai_call_error',
  'AI节点调用失败修复',
  '错误现象：
- AI节点执行失败
- 错误信息包含 "API"、"模型"、"key" 等关键词

可能原因：
1. 系统未配置API Key（modelMode="system"时）
2. 用户自定义模型无效或API Key错误（modelMode="custom"时）
3. 提示词为空
4. 内容变量引用错误
5. Token数量超限

修复方法：
1. 检查模型模式：
   - modelMode="system"：检查系统是否在.env中配置了对应Provider的API Key
   - modelMode="custom"：检查"设置-模型管理"中的模型是否有效

2. 检查提示词：
   - 确保prompt字段不为空
   - 检查提示词中是否有语法错误

3. 检查内容变量：
   - 确保contentVariable格式正确：{{node-id.variable}}
   - 确认引用的变量存在且不为空

4. 检查Token限制：
   - 减少maxTokens参数
   - 缩短提示词长度
   - 缩短输入内容长度

5. 切换模型：
   - 尝试使用系统预设的deepseek模型
   - 如果使用自定义模型，检查API Key是否有效

6. 检查网络：
   - 确认能访问AI服务提供商的API
   - 检查防火墙设置',
  '["错误修复", "AI节点", "模型调用"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3.4 Merge节点连接错误修复
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'error_repair',
  'merge_connection_error',
  'Merge节点连接错误修复',
  '错误现象：
- merge节点执行失败
- 错误信息包含 "输入数据"、"targetHandle" 等关键词

可能原因：
1. 入边未配置targetHandle
2. targetHandle格式错误
3. targetHandle顺序不连续

修复方法：
1. 检查所有入边：
   - 确保每条入边都配置了targetHandle
   - 格式：targetHandle="input-0", "input-1", "input-2" 等

2. 检查targetHandle格式：
   - 正确格式：input-0, input-1, input-2...
   - 错误格式：input0, input_0, input-1-0 等

3. 检查顺序：
   - 第一个输入使用 input-0
   - 第二个输入使用 input-1
   - 不能跳过，必须连续

4. 检查输入数量：
   - 确保merge节点的入边数量与预期一致
   - 如果只有2个输入，不要配置 input-2

示例：
- 2个输入：input-0, input-1
- 3个输入：input-0, input-1, input-2',
  '["错误修复", "合并节点", "连接配置"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3.5 节点执行顺序错误修复
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'error_repair',
  'execution_order_error',
  '节点执行顺序错误修复',
  '错误现象：
- 工作流执行时节点顺序混乱
- 下游节点先于上游节点执行
- 节点找不到输入数据

可能原因：
1. 节点连接（edges）配置错误
2. 节点位置配置不合理
3. 存在循环依赖

修复方法：
1. 检查节点连接：
   - 确保每条边都正确连接了source和target
   - start节点必须作为入口（没有入边）
   - end节点必须作为出口（没有出边）

2. 检查执行顺序：
   - 工作流按拓扑排序执行
   - 上游节点必须在下游节点之前执行
   - 检查边的连接关系是否正确

3. 检查节点位置：
   - 推荐垂直排列，便于理解执行顺序
   - 从上到下：start → crawler → dataclean → ai → output → end

4. 检查循环依赖：
   - 工作流不能存在循环
   - 如果发现循环，断开循环连接

5. 检查条件分支：
   - condition节点的出边必须配置sourceHandle
   - true和false分支必须正确连接

预防措施：
- 使用推荐的节点序列
- 保持节点垂直排列
- 仔细检查节点连接',
  '["错误修复", "执行顺序", "节点连接"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================
-- 四、场景模板 (scene_template)
-- ============================================

-- 4.1 网页抓取+AI总结模板
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'web_scraping_summary',
  '网页抓取+AI总结模板',
  '适用场景：
抓取网页内容并使用AI进行总结、翻译、结构化提取等处理。

节点序列：
start → crawler → dataclean → ai → output → end

详细配置：

1. Start节点：
   - trigger: "manual"
   - inputDataType: "json"
   - inputData: {"url": "https://example.com"}

2. Crawler节点：
   - urlVariable: "{{node-1.data.url}}"
   - method: "GET"
   - extractMode: "smart"
   - extractType: "text"

3. DataClean节点：
   - dataVariable: "{{node-2.text}}"
   - cleanType: "text"
   - trim: true
   - removeHTML: true

4. AI节点：
   - modelMode: "system"
   - provider: "deepseek"
   - modelName: "deepseek-chat"
   - contentVariable: "{{node-3.cleaned}}"
   - prompt: "请总结以下内容，提取5个要点"
   - temperature: 0.2
   - maxTokens: 2000

5. Output节点：
   - format: "markdown"
   - destination: "file"

6. End节点：
   - action: "none"

变量引用链：
node-1.data.url → node-2.text → node-3.cleaned → node-4.result

使用技巧：
- 修改start节点的inputData.url即可处理不同网页
- 修改AI节点的prompt即可执行不同任务（总结、翻译、提取等）
- 可以添加多个crawler节点处理多个网页',
  '["场景模板", "网页抓取", "AI总结"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 4.2 多URL批量处理模板
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'batch_url_processing',
  '多URL批量处理模板',
  '适用场景：
需要处理多个URL，每个URL执行相同的处理流程。

节点序列：
start → crawler → dataclean → ai → output → end

详细配置：

1. Start节点：
   - trigger: "manual"
   - inputDataType: "json"
   - inputData: {
       "url1": "https://site1.com",
       "url2": "https://site2.com",
       "url3": "https://site3.com"
     }

2. Crawler节点：
   - urlVariable: "{{node-1.data.url1}}"
   - 注意：需要手动修改urlVariable来切换不同的URL
   - 或者创建多个crawler节点，分别引用url1、url2、url3

3. DataClean节点：
   - dataVariable: "{{node-2.text}}"
   - cleanType: "text"

4. AI节点：
   - contentVariable: "{{node-3.cleaned}}"
   - prompt: "处理以下内容"

5. Output节点：
   - format: "json"

扩展建议：
- 当前版本需要手动处理多个URL
- 未来可以使用loop节点实现自动批量处理（待完善）',
  '["场景模板", "批量处理", "多URL"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 4.3 条件分支处理模板
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'conditional_processing',
  '条件分支处理模板',
  '适用场景：
根据数据内容或处理结果，选择不同的处理路径。

节点序列：
start → crawler → condition → [分支A] → merge → output → end
                          ↓
                      [分支B] →

详细配置：

1. Start节点：
   - 输入包含判断依据的数据

2. Crawler节点：
   - 抓取数据

3. Condition节点：
   - conditionType: "contains"
   - field: "data.status"
   - operator: "=="
   - value: "success"

4. 分支A（true分支）：
   - 连接condition节点，sourceHandle="true"
   - 可以连接AI节点进行进一步处理

5. 分支B（false分支）：
   - 连接condition节点，sourceHandle="false"
   - 可以连接错误处理节点

6. Merge节点：
   - 合并两个分支的结果

注意事项：
- condition节点的出边必须配置sourceHandle
- merge节点的入边必须配置targetHandle="input-0", "input-1"
- 确保两个分支最终都连接到merge节点',
  '["场景模板", "条件分支", "流程控制"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 4.4 数据清洗+结构化提取模板

-- 4.5 条件分支+合并模板
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'conditional_merge',
  '条件分支+合并模板',
  '适用场景：
根据条件判断结果，执行不同处理，最后合并结果。

节点序列：
start → crawler → condition → [true分支: ai] → merge → output → end
                          ↓
                      [false分支: dataclean] →

详细配置：

1. Start节点：
   - inputData: {"url": "https://example.com"}

2. Crawler节点：
   - urlVariable: "{{node-1.data.url}}"
   - extractMode: "smart"
   - extractType: "text"

3. Condition节点：
   - conditionType: "contains"
   - field: "data.status"
   - operator: "=="
   - value: "success"

4. True分支（AI处理）：
   - 连接condition，sourceHandle="true"
   - AI节点：contentVariable="{{node-2.text}}", prompt="总结内容"
   - 连接merge，targetHandle="input-0"

5. False分支（数据清洗）：
   - 连接condition，sourceHandle="false"
   - DataClean节点：dataVariable="{{node-2.text}}"
   - 连接merge，targetHandle="input-1"

6. Merge节点：
   - mergeType: "concat"
   - 接收两个分支的结果

7. Output节点：
   - format: "json"

关键配置：
- condition节点的出边必须配置sourceHandle
- merge节点的入边必须配置targetHandle',
  '["场景模板", "条件分支", "数据合并"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 4.6 多爬虫+延迟+合并模板
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'multi_crawler_delay',
  '多爬虫+延迟+合并模板',
  '适用场景：
需要爬取多个网页，避免请求过快被封禁，最后合并结果。

节点序列：
start → crawler-1 → delay → crawler-2 → delay → crawler-3 → merge → ai → output → end

详细配置：

1. Start节点：
   - inputData: {
       "url1": "https://site1.com",
       "url2": "https://site2.com",
       "url3": "https://site3.com"
     }

2. Crawler-1节点：
   - urlVariable: "{{node-1.data.url1}}"
   - extractMode: "smart"
   - extractType: "text"

3. Delay-1节点：
   - delayType: "fixed"
   - seconds: 2

4. Crawler-2节点：
   - urlVariable: "{{node-1.data.url2}}"
   - extractMode: "smart"
   - extractType: "text"

5. Delay-2节点：
   - delayType: "fixed"
   - seconds: 2

6. Crawler-3节点：
   - urlVariable: "{{node-1.data.url3}}"
   - extractMode: "smart"
   - extractType: "text"

7. Merge节点：
   - mergeType: "concat"
   - 接收三个crawler节点的结果
   - 入边配置：input-0, input-1, input-2

8. AI节点：
   - contentVariable: "{{node-7.merged}}"
   - prompt: "总结以下多个网页的内容"

使用技巧：
- 在crawler节点之间添加delay节点，避免请求过快
- 使用merge节点合并多个爬虫结果
- 可以扩展到更多爬虫节点',
  '["场景模板", "多爬虫", "延迟", "合并"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'scene_template',
  'data_extraction',
  '数据清洗+结构化提取模板',
  '适用场景：
从网页中提取结构化数据（如商品信息、文章信息等）。

节点序列：
start → crawler → dataclean → ai → output → end

详细配置：

1. Start节点：
   - inputData: {"url": "https://example.com/product/123"}

2. Crawler节点：
   - urlVariable: "{{node-1.data.url}}"
   - extractMode: "smart"
   - extractType: "text"

3. DataClean节点：
   - dataVariable: "{{node-2.text}}"
   - cleanType: "text"
   - trim: true

4. AI节点：
   - contentVariable: "{{node-3.cleaned}}"
   - prompt: "请从以下内容中提取商品信息，以JSON格式输出，包含：商品名称、价格、描述、图片URL"
   - temperature: 0.2
   - maxTokens: 2000

5. Output节点：
   - format: "json"

提示词设计：
- 明确指定输出格式（JSON）
- 列出需要提取的字段
- 给出示例格式（可选）

使用技巧：
- 调整AI提示词来提取不同的字段
- 使用temperature=0.2确保输出格式稳定
- 输出JSON格式便于后续处理',
  '["场景模板", "数据提取", "结构化"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================
-- 五、工作流格式规范 (format_specification)
-- ============================================

-- 5.1 WorkflowExportData格式说明
INSERT INTO alkaid_knowledge (user_id, category, target, title, content, tags, is_active, created_at, updated_at)
VALUES (
  NULL,
  'best_practice',
  'workflow_format',
  '工作流JSON格式规范',
  'WorkflowExportData 格式要求：

顶层字段（必填）：
- version: "1.0.0"（固定值）
- exportedAt: ISO8601时间戳，例如 "2026-01-19T00:00:00.000Z"
- nodes: 节点数组（必填）
- edges: 边数组（必填）

顶层字段（可选）：
- name: 工作流名称
- description: 工作流描述
- commentCards: 注释卡片数组

NodeData格式（节点）：
必填字段：
- id: 节点ID，格式 "node-1", "node-2" 等
- type: 节点类型，如 "start", "crawler", "ai" 等

可选字段：
- position: 节点位置 {"x": 0, "y": 0}
- data: 节点数据对象
  - label: 显示名称
  - type: 节点类型（需与顶层type一致）
  - config: 节点配置对象
  - connectionDirection: "vertical"（推荐）

EdgeData格式（边）：
必填字段：
- source: 源节点ID
- target: 目标节点ID

可选字段：
- id: 边ID，格式 "e-1-2" 等
- sourceHandle: 源节点输出端口（condition节点需要 "true" 或 "false"）
- targetHandle: 目标节点输入端口（merge节点需要 "input-0", "input-1" 等）

格式验证：
1. version必须是 "1.0.0"
2. nodes和edges必须是数组
3. 每个节点必须有id和type
4. 每条边必须有source和target
5. 所有引用的节点ID必须存在于nodes数组中',
  '["格式规范", "JSON格式", "工作流导出"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 添加更新时间戳
UPDATE alkaid_knowledge SET updated_at = CURRENT_TIMESTAMP WHERE updated_at < CURRENT_TIMESTAMP;

