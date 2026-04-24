import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import styles from './Tasks.module.scss';

export default function TasksLayout() {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('tasks.layoutEyebrow')}
        title={t('tasks.layoutTitle')}
        description={t('tasks.layoutDescription')}
        tags={[
          t('tasks.layoutTagGlobal'),
          t('tasks.layoutTagRunning'),
          t('tasks.layoutTagFailed'),
          t('tasks.layoutTagNodes'),
          t('tasks.layoutTagLogs'),
        ]}
      />

      <Outlet />
    </div>
  );
}
