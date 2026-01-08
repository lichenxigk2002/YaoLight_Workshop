import { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, message, Popconfirm, Tag, Breadcrumb } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import { workflowApi } from '@/api/workflow';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { PageRequest } from '@/types/api';
import styles from './index.module.scss';

const { TextArea } = Input;

export default function ProjectDetail() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [form] = Form.useForm();

  // 加载项目信息
  const loadProject = async () => {
    if (!projectId) return;
    try {
      const data = await projectApi.getProjectById(Number(projectId));
      setProject(data);
    } catch (error: any) {
      message.error(error.message || t('dashboard.loadFailed'));
    }
  };

  // 加载工作流列表
  const loadWorkflows = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const params: PageRequest = {
        page,
        pageSize,
      };
      // 按项目ID查询工作流
      const response = await workflowApi.getWorkflowList({
        ...params,
        projectId: Number(projectId),
      });
      setWorkflows(response?.list || []);
      setTotal(response?.total || 0);
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
    loadWorkflows();
  }, [projectId, page, pageSize]);

  // 创建/更新工作流
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

  // 删除工作流
  const handleDelete = async (id: number) => {
    try {
      await workflowApi.deleteWorkflow(id);
      message.success(t('workflow.execSuccess'));
      loadWorkflows();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  // 打开编辑模态框
  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    form.setFieldsValue({
      name: workflow.name,
      description: workflow.description,
    });
    setModalVisible(true);
  };

  // 打开创建模态框
  const handleCreate = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 进入工作流编辑器
  const handleEditWorkflow = (workflow: Workflow) => {
    navigate(`/projects/${projectId}/workflows/${workflow.id}/edit`);
  };

  // 执行工作流
  const handleExecute = async (workflow: Workflow) => {
    try {
      const hide = message.loading(t('workflow.executeWorkflow'), 0);
      await workflowApi.executeWorkflow({
        nodes: (workflow.nodes || []).map(node => ({
          id: node.id,
          type: node.type,
          config: node.config,
        })),
        edges: workflow.edges || [],
      });
      hide();
      message.success(t('workflow.execSuccess'));
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    }
  };

  const columns = [
    {
      title: t('workflow.workflowName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Workflow) => (
        <a onClick={() => handleEditWorkflow(record)}>{text}</a>
      ),
    },
    {
      title: t('workflow.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('workflow.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: t('workflow.statusDraft') },
          published: { color: 'green', text: t('workflow.statusPublished') },
          archived: { color: 'orange', text: t('workflow.statusArchived') },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: t('workflow.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: any, record: Workflow) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
          >
            {t('common.execute')}
          </Button>
          <Popconfirm
            title={t('workflow.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.ok')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => navigate('/')}>{t('dashboard.projectsList')}</a> },
          { title: project?.name || t('dashboard.projectDetail') },
        ]}
      />

      <Card
        title={
          <Space>
            <ArrowLeftOutlined
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            />
            <span>{project?.name || t('dashboard.projectDetail')}</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('workflow.createWorkflow')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={workflows}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => t('workflow.paginationTotal', { total }),
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

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
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label={t('workflow.workflowName')}
            rules={[{ required: true, message: t('workflow.workflowName') }]}
          >
            <Input placeholder={t('workflow.workflowName')} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('workflow.workflowDescription')}
          >
            <TextArea
              rows={4}
              placeholder={t('workflow.workflowDescription')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

