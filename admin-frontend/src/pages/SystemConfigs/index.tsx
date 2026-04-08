import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function SystemConfigsPage() {
  return (
    <PlaceholderPage
      eyebrow="系统配置"
      title="系统配置"
      description="围绕 system_configs 表提供平台参数管理、开关项管理和配置分组能力。"
      tags={['配置中心', '功能开关', '分组', '热更新预留']}
      cards={[
        {
          title: '配置治理',
          description: '将平台参数从环境变量之外的可运营配置抽出来，支持后台维护。',
          bullets: ['键值管理', '分类管理', '公开配置', '配置备注'],
        },
        {
          title: '使用边界',
          description: '这里只承接业务配置，不替代底层基础设施配置。',
          bullets: ['功能开关', '展示配置', '业务阈值', '限流参数'],
        },
      ]}
    />
  );
}
