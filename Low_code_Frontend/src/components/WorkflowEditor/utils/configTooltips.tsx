import React from 'react';

/**
 * 配置面板的 Tooltip 提示内容
 * 统一管理所有节点的 tooltip 提示，便于维护和复用
 */

// Tooltip 样式工具函数
const tooltipStyle = { maxWidth: 400 };

/**
 * 条件节点 Tooltips
 */
export const ConditionTooltips = {
  fieldVariable: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是字段变量？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像查字典时，你需要知道查哪个"词条"（字段名）。如果字段名是动态的，可以从上游节点获取。
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: '#666' }}>
        <div style={{ marginBottom: 4 }}>• <strong>固定字段：</strong>直接在"字段名"框里输入，如：<code>data.count</code></div>
        <div>• <strong>动态字段：</strong>如果字段名会变化，在这里选择上游节点传来的字段名</div>
      </div>
    </div>
  ),
  valueVariable: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是比较值变量？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像判断"成绩是否及格"，"60分"这个标准可以是固定的，也可以从其他地方获取。
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: '#666' }}>
        <div style={{ marginBottom: 4 }}>• <strong>固定值：</strong>直接在"比较值"框里输入，如：<code>100</code></div>
        <div>• <strong>动态值：</strong>如果比较值会变化，在这里选择上游节点传来的值</div>
      </div>
    </div>
  ),
};

/**
 * 开始节点 Tooltips
 */
export const StartTooltips = {
  inputData: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是输入数据？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像给工作流一个"起点数据"。你可以输入任何内容（比如"百度"），这个数据会传给下一个节点。
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
        <div style={{ marginBottom: 4 }}>• <strong>文本：</strong>直接输入文字，如：<code>百度</code></div>
        <div style={{ marginBottom: 4 }}>• <strong>JSON：</strong>输入JSON格式，带语法高亮和格式化</div>
        <div style={{ marginBottom: 4 }}>• <strong>URL：</strong>输入网址，会自动验证格式</div>
        <div style={{ marginBottom: 4 }}>• <strong>数字：</strong>输入数字，如：<code>123</code></div>
        <div>• <strong>留空：</strong>如果不输入，会使用默认数据（包含时间戳）</div>
      </div>
      <div style={{
        padding: 8,
        background: '#f0f7ff',
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.6,
        border: '1px solid #b3d8ff'
      }}>
        <strong>🎯 使用场景：</strong><br />
        比如你想爬取"百度"这个网站，可以在这里输入"百度"或网址，然后下一个爬虫节点就可以使用这个数据。
      </div>
    </div>
  ),
};

/**
 * 数据清洗节点 Tooltips
 */
export const DataCleanTooltips = {
  dataVariable: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是数据变量？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像做菜时，从上一个步骤拿过来"半成品"继续加工。选择上游节点传过来的数据，进行清洗处理。
      </div>
      <div style={{
        padding: 8,
        background: '#fff7e6',
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.6,
        border: '1px solid #ffd591'
      }}>
        <strong>💬 提示：</strong><br />
        如果不选择，系统会自动使用连接的上游节点的输出数据。
        只有当你需要指定特定的数据字段时，才需要选择。
      </div>
    </div>
  ),
};

/**
 * 爬虫节点 Tooltips
 */
export const CrawlerTooltips = {
  urlVariable: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是URL变量？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像接力赛一样，让上一个节点把"网址"传过来，这个爬虫节点就会自动使用这个网址去爬取。
      </div>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>📝 使用场景：</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
        <div style={{ marginBottom: 4 }}>• <strong>场景1：</strong>上一个节点输出了网址，直接选择使用</div>
        <div style={{ marginBottom: 4 }}>• <strong>场景2：</strong>上一个节点输出了数据包（包含网址），选择"数据.URL地址"</div>
        <div>• <strong>场景3：</strong>不选择变量，直接在"URL"框里输入固定网址</div>
      </div>
      <div style={{
        padding: 8,
        background: '#f0f7ff',
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.6,
        border: '1px solid #b3d8ff'
      }}>
        <strong>🎯 简单理解：</strong><br />
        如果下拉框里有很多选项（比如"延迟节点.数据.URL地址"），说明上游节点传过来的是一个"数据包"。
        选择带".URL地址"的选项，系统会自动从数据包里取出网址。
      </div>
    </div>
  ),
  pageType: (t: (key: string) => string) => (
    <div style={{ ...tooltipStyle, fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('node.config.crawler.selectPageType')}</div>
      <div style={{ marginBottom: 8 }}>
        <strong>{t('node.config.crawler.spaApp')}：</strong>{t('node.config.crawler.spaAppDesc')}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>{t('node.config.crawler.normalPage')}：</strong>{t('node.config.crawler.normalPageDesc')}
      </div>
      <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(24, 144, 255, 0.1)', borderRadius: 4, color: '#1890ff' }}>
        <strong>{t('node.config.crawler.antiCrawlerTip')}</strong>
      </div>
    </div>
  ),
  waitForSelector: (t: (key: string) => string) => (
    <div style={{ ...tooltipStyle, fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('node.config.crawler.waitForSelectorTooltip')}</div>
      <div style={{ marginBottom: 8 }}>
        <strong>{t('node.config.crawler.commonScenarios')}：</strong>
      </div>
      <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
        <li>{t('node.config.crawler.blogArticle')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>article</code></li>
        <li>{t('node.config.crawler.articleContent')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.content</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.post-content</code></li>
        <li>{t('node.config.crawler.listPage')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.list</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>ul</code></li>
        <li>{t('node.config.crawler.mainContainer')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>#app</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>main</code></li>
        <li>{t('node.config.crawler.cardContent')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.card</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.item</code></li>
      </ul>
      <div style={{ marginTop: 8, color: '#999' }}>
        {t('node.config.crawler.selectorTip')}
      </div>
    </div>
  ),
  headers: (t: (key: string) => string) => (
    <div>
      <div>{t('node.config.crawler.headersTooltip')}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        支持变量引用，如：{`{"Authorization": "Bearer {{auth_1.token}}"}`}
      </div>
    </div>
  ),
};

/**
 * AI节点 Tooltips
 */
export const AITooltips = {
  contentVariable: (
    <div style={tooltipStyle}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是输入内容变量？</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        就像让AI分析一篇文章，文章内容可以从上游节点传过来，不需要手动输入。
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
        <div style={{ marginBottom: 4 }}>• <strong>方式1：</strong>在这里选择变量，AI会直接使用这个变量的内容</div>
        <div>• <strong>方式2：</strong>在"提示词"框里用 <code>{`{{变量名}}`}</code> 的方式引用</div>
      </div>
      <div style={{
        padding: 8,
        background: '#f6ffed',
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.6,
        border: '1px solid #b7eb8f'
      }}>
        <strong>💬 推荐：</strong><br />
        如果只是简单传递内容，在这里选择变量更方便。
        如果需要在提示词中灵活组合多个变量，在提示词中使用 <code>{`{{变量名}}`}</code> 更灵活。
      </div>
    </div>
  ),
};

