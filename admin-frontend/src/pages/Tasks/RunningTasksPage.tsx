import TaskListCard from './TaskListCard';
import { useI18n } from '@/i18n';

export default function RunningTasksPage() {
  const { t } = useI18n();

  return (
    <TaskListCard
      title={t('tasks.runningListTitle')}
      description={t('tasks.runningListDescription')}
      mode="running"
    />
  );
}
