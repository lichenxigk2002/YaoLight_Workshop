import { useEffect, useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Tabs } from 'antd';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { deleteAIModel, getAIModel } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AIAdminModel } from '@/types/aiModels';
import { getAIModelStatusLabel, getAIProviderLabel } from './i18n';
import styles from './AIModels.module.scss';

export interface ModelDetailOutletContext {
  model: AIAdminModel;
  isDraft: boolean;
  canEdit: boolean;
  setModel: (model: AIAdminModel) => void;
}

function getActiveModelTab(pathname: string, id: string) {
  if (pathname.endsWith('/capability')) {
    return `/ai-models/models/${id}/capability`;
  }
  if (pathname.endsWith('/pricing')) {
    return `/ai-models/models/${id}/pricing`;
  }
  return `/ai-models/models/${id}`;
}

export default function ModelDetailLayout() {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('ai_models.models');
  const [model, setModel] = useState<AIAdminModel | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) {
      setModel(null);
      return;
    }

    const draftModel = (location.state as { draftModel?: AIAdminModel } | null)?.draftModel;

    void getAIModel(id).then((found) => {
      if (found) {
        setModel(found);
        return;
      }

      if (draftModel?.id === id) {
        setModel(draftModel);
        return;
      }

      setModel(null);
    });
  }, [id, location.state]);

  if (model === undefined || !id) {
    return <Card loading bordered={false} className={styles.card} />;
  }

  if (!model) {
    return <Empty description={t('aiModels.detailNotFound')} className={styles.emptyBlock} />;
  }

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteAIModel(model.id);
      message.success(t('aiModels.deleteSuccess'));
      navigate('/ai-models/models');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('aiModels.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiModels.detailEyebrow')}
        title={model.display_name}
        description={model.description || t('aiModels.detailNoDescription')}
        tags={[
          getAIProviderLabel(model.provider, t),
          model.model_name,
          getAIModelStatusLabel(model.status, t),
          model.is_active ? t('aiModels.modelEnabled.active') : t('aiModels.modelEnabled.inactive'),
        ]}
        action={
          <Space>
            <Button onClick={() => navigate(`/ai-models/usage?modelId=${model.id}`)}>
              {t('aiModels.detailActionUsage')}
            </Button>
            {canEdit ? (
              <Popconfirm
                title={t('aiModels.deleteConfirmTitle')}
                description={t('aiModels.deleteConfirmDescription')}
                okText={t('aiModels.actionDelete')}
                cancelText={t('aiModels.actionCancel')}
                okButtonProps={{ danger: true, loading: deleting }}
                onConfirm={() => void handleDelete()}
              >
                <Button danger loading={deleting}>
                  {t('aiModels.actionDelete')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
      />

      <Card bordered={false} className={styles.detailTabs}>
        <Tabs
          activeKey={getActiveModelTab(location.pathname, model.id)}
          onChange={(key) => navigate(key)}
          items={[
            { key: `/ai-models/models/${model.id}`, label: t('aiModels.tabOverview') },
            { key: `/ai-models/models/${model.id}/capability`, label: t('aiModels.tabCapability') },
            { key: `/ai-models/models/${model.id}/pricing`, label: t('aiModels.tabPricing') },
          ]}
        />
      </Card>

      <Outlet context={{ model, isDraft: model.id.startsWith('draft-'), canEdit, setModel }} />
    </div>
  );
}
