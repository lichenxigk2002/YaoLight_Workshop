import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function TasksPage() {
  return (
    <PlaceholderPage
      eyebrow="任务监控"
      title="全局任务监控"
      description="按平台视角查看所有任务、失败节点、执行耗时和异常日志，用于排障与运营处理。"
      tags={['全局任务', '失败重试', '节点明细', '执行日志']}
      cards={[
        {
          title: '监控视角',
          description: '支持按用户、工作流、状态、时间范围、失败类型进行筛选。',
          bullets: ['平台任务列表', '失败任务筛选', '耗时分析', '节点明细'],
        },
        {
          title: '处置动作',
          description: '这里的动作必须是管理员动作，不与用户自助操作混用。',
          bullets: ['取消任务', '重试任务', '查看日志', '导出异常信息'],
        },
      ]}
    />
  );
}
