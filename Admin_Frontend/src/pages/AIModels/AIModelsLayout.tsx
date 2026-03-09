import { Button } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import styles from './AIModels.module.scss';

export default function AIModelsLayout() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="AI 管理域"
        title="AI 模型管理"
        description="在独立的管理域中统一查看服务商、模型、计费规则和使用统计。"
        tags={['服务商', '模型', '计费规则', '使用统计']}
        action={
          <Button type="primary" onClick={() => navigate('/ai-models/models/new')}>
            新建模型
          </Button>
        }
      />

      <Outlet />
    </div>
  );
}
