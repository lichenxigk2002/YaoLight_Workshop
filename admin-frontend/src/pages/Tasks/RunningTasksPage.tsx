import TaskListCard from './TaskListCard';

export default function RunningTasksPage() {
  return (
    <TaskListCard
      title="运行中任务"
      description="聚焦当前仍在执行的任务，便于排查长耗时、卡住或堆积的工作流。"
      mode="running"
    />
  );
}
