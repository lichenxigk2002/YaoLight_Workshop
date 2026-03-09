import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function UsersPage() {
  return (
    <PlaceholderPage
      eyebrow="用户管理"
      title="用户管理"
      description="管理员查看全量用户、调整状态、查看余额与活跃情况。这个页面后续接 `GET /api/admin/users`、`PUT /api/admin/users/:id/status` 等接口。"
      tags={['用户列表', '状态管理', '余额查看', '登录信息']}
      cards={[
        {
          title: '列表能力',
          description: '按用户名、邮箱、状态、角色、注册时间、最近登录时间筛选。',
          bullets: ['分页列表', '状态筛选', '批量搜索', '详情抽屉'],
        },
        {
          title: '管理动作',
          description: '区别于用户侧“当前用户”接口，这里针对指定用户执行平台级操作。',
          bullets: ['启用/禁用', '重置密码', '查看配额', '查看项目与工作流数量'],
        },
      ]}
    />
  );
}
