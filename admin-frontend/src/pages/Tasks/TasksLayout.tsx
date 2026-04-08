import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import styles from './Tasks.module.scss';

export default function TasksLayout() {
  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="Task Center"
        title="任务监控中心"
        description="从平台视角查看全局任务、运行中队列和失败任务，并持续下钻到执行现场。"
        tags={['全局任务', '运行中', '失败任务', '节点执行', '任务日志']}
      />

      <Outlet />
    </div>
  );
}
