import { useEffect, useState } from 'react';
import { Button, Card, Empty, Tabs } from 'antd';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { getAIModel } from '@/api/aiModels';
import { PROVIDER_LABELS } from '@/types/aiModels';
import type { AIAdminModel } from '@/types/aiModels';
import styles from './AIModels.module.scss';

export interface ModelDetailOutletContext {
  model: AIAdminModel;
  isDraft: boolean;
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

function getStatusTag(status: string) {
  if (status === 'active') {
    return '启用';
  }
  if (status === 'testing') {
    return '测试中';
  }
  return status;
}

export default function ModelDetailLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [model, setModel] = useState<AIAdminModel | null | undefined>(undefined);

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
    return <Empty description="模型不存在" className={styles.emptyBlock} />;
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="模型详情"
        title={model.display_name}
        description={model.description || '该模型暂未填写说明。'}
        tags={[
          PROVIDER_LABELS[model.provider] ?? model.provider,
          model.model_name,
          getStatusTag(model.status),
          model.is_active ? '已启用' : '已停用',
        ]}
        action={
          <Button onClick={() => navigate(`/ai-models/usage?modelId=${model.id}`)}>
            查看使用统计
          </Button>
        }
      />

      <Card bordered={false} className={styles.detailTabs}>
        <Tabs
          activeKey={getActiveModelTab(location.pathname, model.id)}
          onChange={(key) => navigate(key)}
          items={[
            { key: `/ai-models/models/${model.id}`, label: '基本信息' },
            { key: `/ai-models/models/${model.id}/capability`, label: '能力配置' },
            { key: `/ai-models/models/${model.id}/pricing`, label: '计费规则' },
          ]}
        />
      </Card>

      <Outlet context={{ model, isDraft: model.id.startsWith('draft-'), setModel }} />
    </div>
  );
}
