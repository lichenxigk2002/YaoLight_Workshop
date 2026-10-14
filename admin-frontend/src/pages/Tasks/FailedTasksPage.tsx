import FailureInsightsPanel from './FailureInsightsPanel';
import { useI18n } from '@/i18n';
import TaskListCard from './TaskListCard';
import styles from './Tasks.module.scss';

export default function FailedTasksPage() {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <FailureInsightsPanel />
      <TaskListCard
        title={t('tasks.failedListTitle')}
        description={t('tasks.failedListDescription')}
        mode="failures"
      />
    </div>
  );
}
