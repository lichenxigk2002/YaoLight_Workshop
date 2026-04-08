import { Button } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import styles from './AIModels.module.scss';

export default function AIModelsLayout() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('ai_models.models');

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiProviders.layoutEyebrow')}
        title={t('aiProviders.layoutTitle')}
        description={t('aiProviders.layoutDescription')}
        tags={[
          t('aiProviders.layoutTagProviders'),
          t('aiProviders.layoutTagModels'),
          t('aiProviders.layoutTagPricingRules'),
          t('aiProviders.layoutTagUsage'),
        ]}
        action={
          canEdit ? (
            <Button type="primary" onClick={() => navigate('/ai-models/models/new')}>
              {t('aiProviders.createModel')}
            </Button>
          ) : null
        }
      />

      <Outlet />
    </div>
  );
}
