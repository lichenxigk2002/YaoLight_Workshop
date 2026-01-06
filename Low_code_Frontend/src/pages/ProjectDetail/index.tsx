import { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, message, Popconfirm, Tag, Breadcrumb } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/project';
import { workflowApi } from '@/api/workflow';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { PageRequest } from '@/types/api';
import styles from './index.module.scss';

const { TextArea } = Input;

export default function ProjectDetail() {
  const navigate = useNavigate();
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
      message.error(error.message || '加载项目信息失败');
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
      message.error(error.message || '加载工作流列表失败');
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
        message.success('更新工作流成功');
      } else {
        await workflowApi.createWorkflow({
          ...values,
          projectId: Number(projectId),
        });
        message.success('创建工作流成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingWorkflow(null);
      loadWorkflows();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 删除工作流
  const handleDelete = async (id: number) => {
    try {
      await workflowApi.deleteWorkflow(id);
      message.success('删除工作流成功');
      loadWorkflows();
    } catch (error: any) {
      message.error(error.message || '删除失败');
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
      const hide = message.loading('执行中...', 0);
      await workflowApi.executeWorkflow({
        nodes: (workflow.nodes || []).map(node => ({
          id: node.id,
          type: node.type,
          config: node.config,
        })),
        edges: workflow.edges || [],
      });
      hide();
      message.success('工作流执行成功');
    } catch (error: any) {
      message.error(error.message || '执行失败');
    }
  };

  const columns = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Workflow) => (
        <a onClick={() => handleEditWorkflow(record)}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: '草稿' },
          published: { color: 'green', text: '已发布' },
          archived: { color: 'orange', text: '已归档' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Workflow) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
          >
            执行
          </Button>
          <Popconfirm
            title="确定要删除这个工作流吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
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
          { title: <a onClick={() => navigate('/')}>项目列表</a> },
          { title: project?.name || '项目详情' },
        ]}
      />

      <Card
        title={
          <Space>
            <ArrowLeftOutlined
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            />
            <span>{project?.name || '项目详情'}</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建工作流
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
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      <Modal
        title={editingWorkflow ? '编辑工作流' : '新建工作流'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingWorkflow(null);
        }}
        onOk={() => form.submit()}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="工作流名称"
            rules={[{ required: true, message: '请输入工作流名称' }]}
          >
            <Input placeholder="请输入工作流名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="工作流描述"
          >
            <TextArea
              rows={4}
              placeholder="请输入工作流描述（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

