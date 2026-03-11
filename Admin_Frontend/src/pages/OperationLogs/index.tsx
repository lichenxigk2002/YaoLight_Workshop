import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function OperationLogsPage() {
  return (
    <PlaceholderPage
      eyebrow="操作日志"
      title="操作日志"
      description="承接管理员写操作的审计日志，记录谁在什么时候对哪个资源做了什么改动。"
      tags={['审计日志', '管理员操作', '资源追踪', '排障']}
      cards={[
        {
          title: '日志维度',
          description: '日志维度围绕用户、动作、资源、状态码、错误信息和请求快照组织。',
          bullets: ['操作人', '动作', '资源类型', '请求响应'],
        },
        {
          title: '实现约束',
          description: '所有管理端写接口都应统一经过操作日志中间件，不能散落在页面逻辑中。',
          bullets: ['统一中间件', '查询接口', '分页检索', '导出能力'],
        },
      ]}
    />
  );
}
