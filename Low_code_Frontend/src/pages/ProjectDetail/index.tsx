import { useEffect, useMemo, useState } from 'react';
import { App, Breadcrumb, Button, Form, Input, Modal, Pagination, Popconfirm, Tabs, Tag, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import { workflowApi } from '@/api/workflow';
import { ProjectAssetsContent } from '@/pages/ProjectAssets';
import type { PageRequest } from '@/types/api';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';
import styles from './index.module.scss';

const { TextArea } = Input;

type ProjectPrimaryTab = 'workflows' | 'assets';

export default function ProjectDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const activeTab = useMemo<ProjectPrimaryTab>(
    () => (location.pathname.includes('/assets') ? 'assets' : 'workflows'),
    [location.pathname],
  );

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const data = await projectApi.getProjectById(Number(projectId));
      setProject(data);
    } catch (error: any) {
      message.error(error.message || t('dashboard.loadFailed'));
    }
  };

  const loadWorkflows = async () => {
    if (!projectId) return;
    try {
      const params: PageRequest = {
        page,
        pageSize,
      };
      const response = await workflowApi.getWorkflowList({
        ...params,
        projectId: Number(projectId),
      });
      setWorkflows(response?.list || []);
      setTotal(response?.total || 0);
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (activeTab !== 'workflows') return;
    loadWorkflows();
  }, [activeTab, page, pageSize, projectId]);

  const handleSubmit = async (values: any) => {
    if (!projectId) return;
    try {
      if (editingWorkflow) {
        await workflowApi.updateWorkflow(editingWorkflow.id, values);
        message.success(t('workflow.execSuccess'));
      } else {
        await workflowApi.createWorkflow({
          ...values,
          projectId: Number(projectId),
        });
        message.success(t('workflow.execSuccess'));
      }
      setModalVisible(false);
      form.resetFields();
      setEditingWorkflow(null);
      loadWorkflows();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await workflowApi.deleteWorkflow(id);
      message.success(t('workflow.execSuccess'));
      loadWorkflows();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    form.setFieldsValue({
      name: workflow.name,
      description: workflow.description,
    });
    setModalVisible(true);
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    navigate(`/projects/${projectId}/workflows/${workflow.id}/edit`);
  };

  const handleExecute = async (workflow: Workflow) => {
    try {
      const hide = message.loading(t('workflow.executeWorkflow'), 0);
      await workflowApi.executeWorkflow({
        workflowId: workflow.id,
      });
      hide();
      message.success(t('workflow.execSuccess'));
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    }
  };

  const filteredWorkflows = workflows.filter(
    (workflow) =>
      workflow.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (workflow.description || '').toLowerCase().includes(searchText.toLowerCase()),
  );

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: t('workflow.statusDraft') },
      published: { color: 'green', text: t('workflow.statusPublished') },
      archived: { color: 'orange', text: t('workflow.statusArchived') },
    };
    return statusMap[status] || { color: 'default', text: status };
  };

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const renderWorkflowPanel = () => (
    <>
      <div className={styles.tabToolbar}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
          placeholder={t('workflow.searchPlaceholder', '鎼滅储宸ヤ綔娴?..')}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          style={{ width: 260, borderRadius: '8px' }}
          allowClear
        />
      </div>

      <div className={styles.workflowGrid}>
        <div className={styles.createCard} onClick={handleCreate}>
          <PlusOutlined className={styles.createIcon} />
          <div className={styles.createText}>{t('workflow.createWorkflow')}</div>
        </div>

        {filteredWorkflows.map((workflow) => {
          const statusInfo = getStatusInfo(workflow.status);
          return (
            <div key={workflow.id} className={styles.workflowCard} onClick={() => handleEditWorkflow(workflow)}>
              <div className={styles.cardHeader}>
                <div className={styles.title} title={workflow.name}>
                  {workflow.name}
                </div>
                <Tag color={statusInfo.color} style={{ margin: 0 }}>
                  {statusInfo.text}
                </Tag>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.description} title={workflow.description}>
                  {workflow.description || t('common.noDescription', '鏆傛棤鎻忚堪')}
                </div>
                <div className={styles.meta}>
                  <div className={styles.metaItem}>
                    <CalendarOutlined />
                    {formatDate(workflow.createdAt)}
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
                <Tooltip title={t('common.edit')}>
                  <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(workflow)} />
                </Tooltip>
                <Tooltip title={t('common.execute')}>
                  <Button type="text" icon={<PlayCircleOutlined />} onClick={() => handleExecute(workflow)} />
                </Tooltip>
                <Popconfirm
                  title={t('workflow.deleteConfirm')}
                  onConfirm={() => handleDelete(workflow.id)}
                  okText={t('common.ok')}
                  cancelText={t('common.cancel')}
                >
                  <Tooltip title={t('common.delete')}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          );
        })}
      </div>

      {total > 0 ? (
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(value) => t('workflow.paginationTotal', { total: value })}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.breadcrumb}>
            <Breadcrumb
              items={[
                { title: <a onClick={() => navigate('/')}>{t('dashboard.projectsList')}</a> },
                { title: project?.name || t('dashboard.projectDetail') },
              ]}
            />
          </div>
          <h1>{project?.name || t('dashboard.projectDetail')}</h1>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => navigate(`/projects/${projectId}/${key}`)}
        items={[
          {
            key: 'workflows',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <AppstoreOutlined />
                工作流
              </span>
            ),
            children: renderWorkflowPanel(),
          },
          {
            key: 'assets',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FolderOpenOutlined />
                资产中心
              </span>
            ),
            children: <ProjectAssetsContent embedded={true} projectId={Number(projectId)} project={project} />,
          },
        ]}
      />

      <Modal
        title={editingWorkflow ? t('workflow.editWorkflow') : t('workflow.createWorkflow')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingWorkflow(null);
        }}
        onOk={() => form.submit()}
        okText={t('common.ok')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label={t('workflow.workflowName')} rules={[{ required: true, message: t('workflow.workflowName') }]}>
            <Input placeholder={t('workflow.workflowName')} />
          </Form.Item>
          <Form.Item name="description" label={t('workflow.workflowDescription')}>
            <TextArea rows={4} placeholder={t('workflow.workflowDescription')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
