import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function SystemConfigsPage() {
  return (
    <PlaceholderPage
      eyebrow="平台设置"
      title="平台设置"
      description="统一管理平台参数、功能开关和分组配置，方便后台按业务场景维护。"
      tags={['配置中心', '功能开关', '分组管理', '后台维护']}
      cards={[
        {
          title: '配置治理',
          description: '将需要后台维护的平台参数集中管理，减少分散配置带来的维护成本。',
          bullets: ['键值管理', '分类管理', '公开配置', '配置备注'],
        },
        {
          title: '使用边界',
          description: '这里只承接平台业务配置，不替代底层基础设施和部署环境配置。',
          bullets: ['功能开关', '展示配置', '业务阈值', '限流参数'],
        },
      ]}
    />
  );
}
