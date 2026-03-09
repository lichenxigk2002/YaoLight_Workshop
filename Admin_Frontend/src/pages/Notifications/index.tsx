import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function NotificationsPage() {
  return (
    <PlaceholderPage
      eyebrow="通知中心"
      title="平台通知"
      description="基于现有 notifications 模型扩展平台通知和运营消息管理，用于站内通知和后续模板化发送。"
      tags={['站内通知', '发送记录', '消息类型', '后续模板化']}
      cards={[
        {
          title: '发送能力',
          description: '支持管理员面向指定用户或批量用户发站内通知。',
          bullets: ['即时发送', '目标用户', '通知分类', '跳转链接'],
        },
        {
          title: '管理视图',
          description: '后续会补发送记录、阅读情况和失败追踪。',
          bullets: ['发送记录', '已读率', '过期时间', '相关资源关联'],
        },
      ]}
    />
  );
}
