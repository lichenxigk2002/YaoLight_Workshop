import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function CrawlerRulesPage() {
  return (
    <PlaceholderPage
      eyebrow="爬虫规则"
      title="爬虫规则库"
      description="管理规则模板、规则测试和规则版本。这里会承接后续的规则模板治理和内容采集标准化。"
      tags={['规则模板', '规则测试', '版本记录', '启用禁用']}
      cards={[
        {
          title: '规则资产化',
          description: '把零散规则沉淀为平台资产，而不是埋在单个工作流节点配置里。',
          bullets: ['分类管理', '版本对比', '使用次数', '关联工作流'],
        },
        {
          title: '测试能力',
          description: '后续接入规则试跑接口，支持快速验证 selector 与提取结果。',
          bullets: ['测试 URL', '提取预览', '错误提示', '调试记录'],
        },
      ]}
    />
  );
}
