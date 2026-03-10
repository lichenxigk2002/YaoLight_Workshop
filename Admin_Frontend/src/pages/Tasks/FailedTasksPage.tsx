import FailureInsightsPanel from './FailureInsightsPanel';
import TaskListCard from './TaskListCard';
import styles from './Tasks.module.scss';

export default function FailedTasksPage() {
  return (
    <div className={styles.page}>
      <FailureInsightsPanel />
      <TaskListCard
        title="失败任务列表"
        description="聚焦失败与超时任务，支持继续按节点类型、错误关键字、用户和工作流下钻。"
        mode="failures"
      />
    </div>
  );
}
