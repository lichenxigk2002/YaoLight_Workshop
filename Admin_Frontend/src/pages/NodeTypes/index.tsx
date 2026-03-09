import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function NodeTypesPage() {
  return (
    <PlaceholderPage
      eyebrow="节点类型"
      title="节点类型管理"
      description="管理系统节点和自定义节点的展示信息、配置 schema、默认配置和文档说明。"
      tags={['节点定义', 'Schema', '默认配置', '系统节点']}
      cards={[
        {
          title: '系统节点',
          description: '系统节点只允许查看与受控更新，不允许误删。',
          bullets: ['只读保护', '版本信息', '图标与颜色', '文档链接'],
        },
        {
          title: '自定义节点',
          description: '后续支持新增自定义节点类型，并配置展示元数据。',
          bullets: ['新增节点', '编辑配置', '启用禁用', '版本演进'],
        },
      ]}
    />
  );
}
