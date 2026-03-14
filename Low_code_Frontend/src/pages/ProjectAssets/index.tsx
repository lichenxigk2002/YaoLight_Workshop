import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Breadcrumb,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  GlobalOutlined,
  MailOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/project';
import { projectAssetsApi } from '@/api/projectAssets';
import { taskApi } from '@/api/task';
import { MarkdownRenderer } from '@/components/WorkflowEditor/utils/MarkdownRenderer';
import { MermaidRenderer, looksLikeMermaid } from '@/components/WorkflowEditor/utils/MermaidRenderer';
import http from '@/http';
import type { Project } from '@/types/project';
import type {
  ProjectArtifactItem,
  ProjectKnowledgeDetail,
  ProjectKnowledgeItem,
  ProjectKnowledgePayload,
  ProjectKnowledgeSearchTestResult,
  WebsiteSourceDetail,
  WebsiteSourceItem,
  WebsiteSourcePayload,
} from '@/types/projectAssets';
import styles from './index.module.scss';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type AssetTabKey = 'knowledge' | 'sources' | 'artifacts';
type SidePanelType = 'knowledge' | 'source' | null;
type KnowledgeSourceMeta = {
  sourceName?: string;
  sourceMimeType?: string;
  sourceSize?: number;
};

type ProjectAssetsContentProps = {
  embedded?: boolean;
  projectId?: number;
  project?: Project | null;
};

type SidePanelProps = {
  open: boolean;
  title: string;
  subtitle: string;
  confirmText: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

const knowledgeCategoryOptions = [
  { label: '最佳实践', value: 'best_practice' },
  { label: '排错修复', value: 'error_repair' },
  { label: '节点使用', value: 'node_usage' },
  { label: '场景模板', value: 'scene_template' },
  { label: '业务规则', value: 'business_rule' },
];

const sourceStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
  { label: '无效', value: 'invalid' },
];

const knowledgeCategoryLabelMap = {
  best_practice: '最佳实践',
  error_repair: '排错修复',
  node_usage: '节点使用',
  scene_template: '场景模板',
  business_rule: '业务规则',
} as const;

const sourceStatusLabelMap = {
  active: '启用',
  disabled: '停用',
  invalid: '无效',
} as const;

const importableKnowledgeExtensions = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'html', 'htm', 'xml']);

const parseLineList = (value?: string) =>
  (value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinLineList = (value?: string[]) => (value || []).join('\n');

const parseTagList = (value?: string) =>
  (value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinTagList = (value?: string[]) => (value || []).join(', ');

const normalizeDownloadPathForHttp = (path: string) => {
  if (typeof path !== 'string') return '';
  return path.startsWith('/api/') ? path.replace(/^\/api/, '') : path;
};

const getTokenForFetch = () => {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const authData = JSON.parse(authStorage);
      return authData.state?.token || null;
    }
  } catch {
    return null;
  }
  return null;
};

const canPreviewArtifact = (mimeType: string) => {
  const lower = (mimeType || '').toLowerCase();
  return lower.includes('text/') || lower.includes('json') || lower.includes('markdown') || lower.includes('svg');
};

const formatTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const inferFileType = (file: File) => {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json' || file.type === 'application/xml') return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return importableKnowledgeExtensions.has(ext);
};

const getStatusClassName = (status: 'active' | 'disabled' | 'invalid' | 'muted') => {
  if (status === 'active') return styles.statusActive;
  if (status === 'disabled') return styles.statusDisabled;
  if (status === 'invalid') return styles.statusInvalid;
  return styles.statusMuted;
};

function SidePanel({ open, title, subtitle, confirmText, onClose, onSubmit, children }: SidePanelProps) {
  return (
    <>
      <div className={`${styles.sidePanelMask} ${open ? styles.sidePanelMaskOpen : ''}`} onClick={onClose} />
      <aside className={`${styles.sidePanel} ${open ? styles.sidePanelOpen : ''}`} aria-hidden={!open}>
        <div className={styles.sidePanelHeader}>
          <div className={styles.sidePanelTitleWrap}>
            <div className={styles.sidePanelTitle}>{title}</div>
            <div className={styles.sidePanelSubtitle}>{subtitle}</div>
          </div>
          <Button type="text" icon={<CloseOutlined />} className={styles.sidePanelClose} onClick={onClose} />
        </div>
        <div className={styles.sidePanelBody}>{children}</div>
        <div className={styles.sidePanelFooter}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={onSubmit}>
            {confirmText}
          </Button>
        </div>
      </aside>
    </>
  );
}

export function ProjectAssetsContent({ embedded = false, projectId: providedProjectId, project: providedProject }: ProjectAssetsContentProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { message } = App.useApp();
  const knowledgeFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectIdNumber = providedProjectId ?? (projectId ? Number(projectId) : 0);

  const [project, setProject] = useState<Project | null>(providedProject || null);
  const [activeTab, setActiveTab] = useState<AssetTabKey>('knowledge');
  const [panelType, setPanelType] = useState<SidePanelType>(null);

  const [knowledgeList, setKnowledgeList] = useState<ProjectKnowledgeItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeTotal, setKnowledgeTotal] = useState(0);
  const [knowledgePage, setKnowledgePage] = useState(1);
  const [knowledgePageSize, setKnowledgePageSize] = useState(10);
  const [knowledgeKeyword, setKnowledgeKeyword] = useState('');
  const [knowledgeCategory, setKnowledgeCategory] = useState<string>();
  const [knowledgeSearchOpen, setKnowledgeSearchOpen] = useState(false);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<number | null>(null);
  const [knowledgeSearchResult, setKnowledgeSearchResult] = useState<ProjectKnowledgeSearchTestResult | null>(null);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [knowledgeSourceMeta, setKnowledgeSourceMeta] = useState<KnowledgeSourceMeta | null>(null);
  const [knowledgeForm] = Form.useForm();
  const [knowledgeSearchForm] = Form.useForm();

  const [sourceList, setSourceList] = useState<WebsiteSourceItem[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceTotal, setSourceTotal] = useState(0);
  const [sourcePage, setSourcePage] = useState(1);
  const [sourcePageSize, setSourcePageSize] = useState(10);
  const [sourceKeyword, setSourceKeyword] = useState('');
  const [sourceStatus, setSourceStatus] = useState<string>();
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [sourceCheckData, setSourceCheckData] = useState<Record<string, unknown> | null>(null);
  const [sourceCheckOpen, setSourceCheckOpen] = useState(false);
  const [sourceForm] = Form.useForm();

  const [artifactList, setArtifactList] = useState<ProjectArtifactItem[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactTotal, setArtifactTotal] = useState(0);
  const [artifactPage, setArtifactPage] = useState(1);
  const [artifactPageSize, setArtifactPageSize] = useState(10);
  const [artifactKeyword, setArtifactKeyword] = useState('');
  const [artifactKind, setArtifactKind] = useState<string>();
  const [artifactPreviewOpen, setArtifactPreviewOpen] = useState(false);
  const [artifactPreviewTitle, setArtifactPreviewTitle] = useState('');
  const [artifactPreviewMime, setArtifactPreviewMime] = useState('');
  const [artifactPreviewContent, setArtifactPreviewContent] = useState('');
  const [artifactEmailOpen, setArtifactEmailOpen] = useState(false);
  const [artifactEmailTarget, setArtifactEmailTarget] = useState<ProjectArtifactItem | null>(null);
  const [artifactEmailForm] = Form.useForm();

  const artifactKindOptions = useMemo(
    () => Array.from(new Set(artifactList.map((item) => item.kind).filter(Boolean))).map((value) => ({ label: value, value })),
    [artifactList],
  );

  const closePanel = () => {
    setPanelType(null);
    setEditingKnowledgeId(null);
    setEditingSourceId(null);
    setKnowledgeUploading(false);
    setKnowledgeSourceMeta(null);
    knowledgeForm.resetFields();
    sourceForm.resetFields();
  };

  const loadKnowledge = async (page = knowledgePage, pageSize = knowledgePageSize) => {
    if (!projectIdNumber) return;
    setKnowledgeLoading(true);
    try {
      const response = await projectAssetsApi.listKnowledge(projectIdNumber, {
        page,
        page_size: pageSize,
        keyword: knowledgeKeyword || undefined,
        category: knowledgeCategory || undefined,
      });
      setKnowledgeList(response.list || []);
      setKnowledgeTotal(response.total || 0);
      setKnowledgePage(response.page || page);
      setKnowledgePageSize(response.pageSize || pageSize);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const loadSources = async (page = sourcePage, pageSize = sourcePageSize) => {
    if (!projectIdNumber) return;
    setSourceLoading(true);
    try {
      const response = await projectAssetsApi.listSources(projectIdNumber, {
        page,
        page_size: pageSize,
        keyword: sourceKeyword || undefined,
        status: sourceStatus || undefined,
      });
      setSourceList(response.list || []);
      setSourceTotal(response.total || 0);
      setSourcePage(response.page || page);
      setSourcePageSize(response.pageSize || pageSize);
    } finally {
      setSourceLoading(false);
    }
  };

  const loadArtifacts = async (page = artifactPage, pageSize = artifactPageSize) => {
    if (!projectIdNumber) return;
    setArtifactLoading(true);
    try {
      const response = await projectAssetsApi.listArtifacts(projectIdNumber, {
        page,
        pageSize,
        keyword: artifactKeyword || undefined,
        kind: artifactKind || undefined,
      });
      setArtifactList(response.list || []);
      setArtifactTotal(response.total || 0);
      setArtifactPage(response.page || page);
      setArtifactPageSize(response.pageSize || pageSize);
    } finally {
      setArtifactLoading(false);
    }
  };

  useEffect(() => {
    if (providedProject) {
      setProject(providedProject);
      return;
    }
    if (!projectIdNumber) return;
    const run = async () => {
      try {
        const data = await projectApi.getProjectById(projectIdNumber);
        setProject(data);
      } catch (error: any) {
        message.error(error.message || '加载项目失败');
      }
    };
    run();
  }, [message, projectIdNumber, providedProject]);

  useEffect(() => {
    if (!projectIdNumber) return;
    const run = async () => {
      try {
        const [knowledgeResponse, sourceResponse, artifactResponse] = await Promise.all([
          projectAssetsApi.listKnowledge(projectIdNumber, {
            page: 1,
            page_size: 10,
          }),
          projectAssetsApi.listSources(projectIdNumber, {
            page: 1,
            page_size: 10,
          }),
          projectAssetsApi.listArtifacts(projectIdNumber, {
            page: 1,
            pageSize: 10,
          }),
        ]);
        setKnowledgeList(knowledgeResponse.list || []);
        setKnowledgeTotal(knowledgeResponse.total || 0);
        setKnowledgePage(knowledgeResponse.page || 1);
        setKnowledgePageSize(knowledgeResponse.pageSize || 10);
        setSourceList(sourceResponse.list || []);
        setSourceTotal(sourceResponse.total || 0);
        setSourcePage(sourceResponse.page || 1);
        setSourcePageSize(sourceResponse.pageSize || 10);
        setArtifactList(artifactResponse.list || []);
        setArtifactTotal(artifactResponse.total || 0);
        setArtifactPage(artifactResponse.page || 1);
        setArtifactPageSize(artifactResponse.pageSize || 10);
      } catch (error: any) {
        message.error(error.message || '加载项目资产失败');
      }
    };
    run();
  }, [message, projectIdNumber]);
  const openCreateKnowledge = () => {
    setEditingKnowledgeId(null);
    setKnowledgeSourceMeta(null);
    knowledgeForm.setFieldsValue({
      category: 'best_practice',
      target: '',
      title: '',
      content: '',
      tags: '',
      isActive: true,
    });
    setPanelType('knowledge');
  };

  const openEditKnowledge = async (item: ProjectKnowledgeItem) => {
    const detail: ProjectKnowledgeDetail = await projectAssetsApi.getKnowledge(projectIdNumber, item.id);
    setEditingKnowledgeId(item.id);
    setKnowledgeSourceMeta({
      sourceName: detail.sourceName,
      sourceMimeType: detail.sourceMimeType,
      sourceSize: detail.sourceSize,
    });
    knowledgeForm.setFieldsValue({
      category: detail.category,
      target: detail.target,
      title: detail.title,
      content: detail.content,
      tags: joinTagList(detail.tags),
      isActive: detail.isActive,
    });
    setPanelType('knowledge');
  };

  const handleKnowledgeFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!inferFileType(file)) {
      message.error('当前仅支持导入 txt、md、json、csv、html、xml 等文本类文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('导入文件请控制在 2 MB 以内');
      return;
    }

    setKnowledgeUploading(true);
    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error('文件内容为空');
      }
      const currentTitle = knowledgeForm.getFieldValue('title');
      knowledgeForm.setFieldsValue({
        title: currentTitle || file.name.replace(/\.[^.]+$/, ''),
        content,
      });
      setKnowledgeSourceMeta({
        sourceName: file.name,
        sourceMimeType: file.type || 'text/plain',
        sourceSize: file.size,
      });
      message.success('文件内容已导入知识内容');
    } catch (error: any) {
      message.error(error.message || '文件导入失败');
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const submitKnowledge = async () => {
    const values = await knowledgeForm.validateFields();
    const payload: ProjectKnowledgePayload = {
      category: values.category,
      target: values.target || '',
      title: values.title,
      content: values.content,
      sourceName: knowledgeSourceMeta?.sourceName,
      sourceMimeType: knowledgeSourceMeta?.sourceMimeType,
      sourceSize: knowledgeSourceMeta?.sourceSize,
      tags: parseTagList(values.tags),
      isActive: !!values.isActive,
    };

    if (editingKnowledgeId) {
      await projectAssetsApi.updateKnowledge(projectIdNumber, editingKnowledgeId, payload);
    } else {
      await projectAssetsApi.createKnowledge(projectIdNumber, payload);
    }

    message.success(editingKnowledgeId ? '知识库条目已更新' : '知识库条目已创建');
    closePanel();
    loadKnowledge(knowledgePage, knowledgePageSize).catch((error: any) => message.error(error.message || '刷新知识库失败'));
  };

  const openCreateSource = () => {
    setEditingSourceId(null);
    sourceForm.setFieldsValue({
      name: '',
      baseUrl: '',
      entryUrl: '',
      listUrlExamples: '',
      detailUrlExamples: '',
      allowedPatterns: '',
      blockedPatterns: '',
      crawlTips: '',
      authHint: '',
      contentHint: '',
      tags: '',
      status: 'active',
    });
    setPanelType('source');
  };

  const openEditSource = async (item: WebsiteSourceItem) => {
    const detail: WebsiteSourceDetail = await projectAssetsApi.getSource(projectIdNumber, item.id);
    setEditingSourceId(item.id);
    sourceForm.setFieldsValue({
      name: detail.name,
      baseUrl: detail.baseUrl,
      entryUrl: detail.entryUrl,
      listUrlExamples: joinLineList(detail.listUrlExamples),
      detailUrlExamples: joinLineList(detail.detailUrlExamples),
      allowedPatterns: joinLineList(detail.allowedPatterns),
      blockedPatterns: joinLineList(detail.blockedPatterns),
      crawlTips: detail.crawlTips,
      authHint: detail.authHint,
      contentHint: detail.contentHint,
      tags: joinTagList(detail.tags),
      status: detail.status,
    });
    setPanelType('source');
  };

  const submitSource = async () => {
    const values = await sourceForm.validateFields();
    const payload: WebsiteSourcePayload = {
      name: values.name,
      baseUrl: values.baseUrl,
      entryUrl: values.entryUrl,
      listUrlExamples: parseLineList(values.listUrlExamples),
      detailUrlExamples: parseLineList(values.detailUrlExamples),
      allowedPatterns: parseLineList(values.allowedPatterns),
      blockedPatterns: parseLineList(values.blockedPatterns),
      crawlTips: values.crawlTips,
      authHint: values.authHint,
      contentHint: values.contentHint,
      tags: parseTagList(values.tags),
      status: values.status,
    };

    if (editingSourceId) {
      await projectAssetsApi.updateSource(projectIdNumber, editingSourceId, payload);
    } else {
      await projectAssetsApi.createSource(projectIdNumber, payload);
    }

    message.success(editingSourceId ? '网站源已更新' : '网站源已创建');
    closePanel();
    loadSources(sourcePage, sourcePageSize).catch((error: any) => message.error(error.message || '刷新网站源失败'));
  };

  const previewArtifact = async (item: ProjectArtifactItem) => {
    const downloadPath = normalizeDownloadPathForHttp(item.downloadUrl);
    const baseURL = import.meta.env.VITE_BASE_URL || '/api';
    const token = getTokenForFetch();
    const response = await fetch(`${baseURL.replace(/\/$/, '')}${downloadPath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    setArtifactPreviewTitle(item.name);
    setArtifactPreviewMime(item.mimeType);
    setArtifactPreviewContent(text);
    setArtifactPreviewOpen(true);
  };

  const renderArtifactPreview = () => {
    const lowerMime = artifactPreviewMime.toLowerCase();
    if (lowerMime.includes('image/svg+xml')) {
      return (
        <img
          alt={artifactPreviewTitle}
          className={styles.previewImage}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artifactPreviewContent)}`}
        />
      );
    }
    if (looksLikeMermaid(artifactPreviewContent) || artifactPreviewTitle.toLowerCase().endsWith('.mmd')) {
      return <MermaidRenderer content={artifactPreviewContent} showSavePng={true} downloadName={artifactPreviewTitle} />;
    }
    if (lowerMime.includes('markdown')) {
      return <MarkdownRenderer content={artifactPreviewContent} />;
    }
    if (lowerMime.includes('json')) {
      return <pre className={styles.codeBlock}>{artifactPreviewContent}</pre>;
    }
    return <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{artifactPreviewContent}</Paragraph>;
  };

  const renderListShell = (
    loading: boolean,
    list: ReactNode[],
    emptyDescription: string,
    pagination: { current: number; pageSize: number; total: number; onChange: (page: number, pageSize: number) => void },
  ) => {
    if (loading) {
      return (
        <div className={styles.listSurface}>
          <div className={styles.loadingWrap}>
            <Spin />
          </div>
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className={styles.listSurface}>
          <div className={styles.emptyWrap}>
            <Empty description={emptyDescription} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.listSurface}>
        <div className={styles.assetList}>{list}</div>
        <div className={styles.paginationRow}>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={pagination.onChange}
            showSizeChanger={true}
          />
        </div>
      </div>
    );
  };
  const renderKnowledgeRows = () =>
    knowledgeList.map((record) => (
      <div key={record.id} className={styles.assetRow}>
        <div className={styles.rowMain}>
          <div className={styles.resourceCell}>
            <div className={`${styles.resourceIcon} ${styles.knowledgeIcon}`}>
              <BookOutlined />
            </div>
            <div className={styles.resourceMain}>
              <div className={styles.resourceTitleRow}>
                <div className={styles.primaryText}>{record.title}</div>
                <span className={styles.softPill}>{knowledgeCategoryLabelMap[record.category]}</span>
                {record.target ? <span className={styles.mutedPill}>{record.target}</span> : null}
                <span className={`${styles.statusPill} ${record.isActive ? styles.statusActive : styles.statusMuted}`}>
                  {record.isActive ? '启用中' : '已停用'}
                </span>
              </div>
              <div className={styles.secondaryText}>{record.contentExcerpt || '暂无内容摘要'}</div>
              <div className={styles.metaRow}>
                <span className={styles.metaText}>
                  <ClockCircleOutlined />
                  更新于 {formatTime(record.updatedAt)}
                </span>
                {record.sourceName ? (
                  <span className={styles.metaText}>
                    <FileTextOutlined />
                    {record.sourceName}
                    {record.sourceSize ? ` · ${formatFileSize(record.sourceSize)}` : ''}
                  </span>
                ) : null}
                {(record.tags || []).slice(0, 4).map((tag) => (
                  <span key={tag} className={styles.tagChip}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.rowAside}>
          <div className={styles.asideMetric}>ID #{record.id}</div>
          <div className={styles.actionGroup}>
            <Switch
              checked={record.isActive}
              onChange={(checked) =>
                projectAssetsApi
                  .setKnowledgeStatus(projectIdNumber, record.id, checked)
                  .then(() => loadKnowledge(knowledgePage, knowledgePageSize))
              }
            />
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditKnowledge(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除这条知识？"
              onConfirm={() => projectAssetsApi.deleteKnowledge(projectIdNumber, record.id).then(() => loadKnowledge(knowledgePage, knowledgePageSize))}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    ));

  const renderSourceRows = () =>
    sourceList.map((record) => (
      <div key={record.id} className={styles.assetRow}>
        <div className={styles.rowMain}>
          <div className={styles.resourceCell}>
            <div className={`${styles.resourceIcon} ${styles.sourceIcon}`}>
              <GlobalOutlined />
            </div>
            <div className={styles.resourceMain}>
              <div className={styles.resourceTitleRow}>
                <div className={styles.primaryText}>{record.name}</div>
                <span className={`${styles.statusPill} ${getStatusClassName(record.status)}`}>{sourceStatusLabelMap[record.status]}</span>
              </div>
              <a className={styles.primaryLink} href={record.baseUrl} rel="noreferrer" target="_blank">
                {record.baseUrl}
              </a>
              <div className={styles.secondaryText}>{record.entryUrl || '未设置入口页，Alkaid 将以基础域名作为默认入口'}</div>
              <div className={styles.metaRow}>
                {record.lastCheckStatus ? <span className={styles.metaText}>校验 {record.lastCheckStatus}</span> : <span className={styles.metaText}>未校验</span>}
                {record.lastCheckedAt ? (
                  <span className={styles.metaText}>
                    <ClockCircleOutlined />
                    {formatTime(record.lastCheckedAt)}
                  </span>
                ) : null}
                {(record.tags || []).slice(0, 4).map((tag) => (
                  <span key={tag} className={styles.tagChip}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.rowAside}>
          <div className={styles.asideMetric}>{record.entryUrl ? '已配置入口页' : '待补入口页'}</div>
          <div className={styles.actionGroup}>
            <Switch
              checked={record.status === 'active'}
              onChange={(checked) =>
                projectAssetsApi
                  .setSourceStatus(projectIdNumber, record.id, checked ? 'active' : 'disabled')
                  .then(() => loadSources(sourcePage, sourcePageSize))
              }
            />
            <Button
              size="small"
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() =>
                projectAssetsApi.checkSource(projectIdNumber, record.id).then((result) => {
                  setSourceCheckData(result.result);
                  setSourceCheckOpen(true);
                  loadSources(sourcePage, sourcePageSize);
                })
              }
            >
              校验
            </Button>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditSource(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除这个网站源？"
              onConfirm={() => projectAssetsApi.deleteSource(projectIdNumber, record.id).then(() => loadSources(sourcePage, sourcePageSize))}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      </div>
    ));

  const renderArtifactRows = () =>
    artifactList.map((record) => (
      <div key={record.id} className={styles.assetRow}>
        <div className={styles.rowMain}>
          <div className={styles.resourceCell}>
            <div className={`${styles.resourceIcon} ${styles.artifactIcon}`}>
              <FileTextOutlined />
            </div>
            <div className={styles.resourceMain}>
              <div className={styles.resourceTitleRow}>
                <div className={styles.primaryText}>{record.name}</div>
                <span className={styles.softPill}>{record.kind}</span>
                <span className={styles.mutedPill}>{record.mimeType}</span>
              </div>
              <div className={styles.secondaryText}>{record.workflowName || `工作流 #${record.workflowId || '-'}`}</div>
              <div className={styles.metaRow}>
                <span className={styles.metaText}>节点 {record.nodeId || '-'}</span>
                {record.taskName ? <span className={styles.metaText}>{record.taskName}</span> : null}
                <span className={styles.metaText}>
                  <ClockCircleOutlined />
                  {formatTime(record.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.rowAside}>
          <div className={styles.asideMetric}>{formatFileSize(record.size)}</div>
          <div className={styles.actionGroup}>
            {canPreviewArtifact(record.mimeType) ? (
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => previewArtifact(record).catch((error: any) => message.error(error.message || '预览失败'))}
              >
                预览
              </Button>
            ) : null}
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => http.download(normalizeDownloadPathForHttp(record.downloadUrl), undefined, record.name)}
            >
              下载
            </Button>
            <Button
              size="small"
              type="text"
              icon={<MailOutlined />}
              disabled={!record.taskId}
              onClick={() => {
                setArtifactEmailTarget(record);
                artifactEmailForm.setFieldsValue({ to: '', subject: record.name, body: '' });
                setArtifactEmailOpen(true);
              }}
            >
              邮件
            </Button>
          </div>
        </div>
      </div>
    ));

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {!embedded ? (
        <div className={styles.header}>
          <div>
            <Breadcrumb
              items={[
                { title: <a onClick={() => navigate('/')}>项目列表</a> },
                { title: <a onClick={() => navigate(`/projects/${projectIdNumber}/workflows`)}>{project?.name || '项目'}</a> },
                { title: '资产中心' },
              ]}
            />
            <div className={styles.titleRow}>
              <span className={styles.titleIcon}>
                <BookOutlined />
              </span>
              <Title level={2} className={styles.title}>
                项目资产中心
              </Title>
            </div>
            <Text className={styles.subtitle}>统一管理知识库、网站源和生成物，列表改成更接近资源库的卡片行结构</Text>
          </div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectIdNumber}/workflows`)}>
            返回项目
          </Button>
        </div>
      ) : null}

      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>知识库</div>
          <div className={styles.summaryValue}>{knowledgeTotal}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>网站源</div>
          <div className={styles.summaryValue}>{sourceTotal}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>生成物</div>
          <div className={styles.summaryValue}>{artifactTotal}</div>
        </div>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as AssetTabKey)}
        items={[
          {
            key: 'knowledge',
            label: (
              <span className={styles.tabLabel}>
                <BookOutlined />
                知识库
              </span>
            ),
            children: (
              <div className={styles.panel}>
                <div className={styles.toolbar}>
                  <div className={styles.toolbarPrimary}>
                    <Input
                      value={knowledgeKeyword}
                      onChange={(event) => setKnowledgeKeyword(event.target.value)}
                      prefix={<SearchOutlined />}
                      placeholder="搜索知识标题、目标或内容"
                      style={{ width: 280 }}
                    />
                    <Select allowClear value={knowledgeCategory} onChange={setKnowledgeCategory} options={knowledgeCategoryOptions} placeholder="分类" style={{ width: 180 }} />
                    <Button onClick={() => loadKnowledge(1, knowledgePageSize)}>查询</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>共 {knowledgeTotal} 条</span>
                    <Button onClick={() => setKnowledgeSearchOpen(true)}>检索测试</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateKnowledge}>
                      新建知识
                    </Button>
                  </div>
                </div>
                {renderListShell(knowledgeLoading, renderKnowledgeRows(), '暂无知识库内容', {
                  current: knowledgePage,
                  pageSize: knowledgePageSize,
                  total: knowledgeTotal,
                  onChange: (page, pageSize) => loadKnowledge(page, pageSize),
                })}
              </div>
            ),
          },
          {
            key: 'sources',
            label: (
              <span className={styles.tabLabel}>
                <GlobalOutlined />
                网站源
              </span>
            ),
            children: (
              <div className={styles.panel}>
                <div className={styles.toolbar}>
                  <div className={styles.toolbarPrimary}>
                    <Input
                      value={sourceKeyword}
                      onChange={(event) => setSourceKeyword(event.target.value)}
                      prefix={<SearchOutlined />}
                      placeholder="搜索网站源名称或 URL"
                      style={{ width: 280 }}
                    />
                    <Select allowClear value={sourceStatus} onChange={setSourceStatus} options={sourceStatusOptions} placeholder="状态" style={{ width: 180 }} />
                    <Button onClick={() => loadSources(1, sourcePageSize)}>查询</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>共 {sourceTotal} 条</span>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSource}>
                      新建网站源
                    </Button>
                  </div>
                </div>
                {renderListShell(sourceLoading, renderSourceRows(), '暂无网站源', {
                  current: sourcePage,
                  pageSize: sourcePageSize,
                  total: sourceTotal,
                  onChange: (page, pageSize) => loadSources(page, pageSize),
                })}
              </div>
            ),
          },
          {
            key: 'artifacts',
            label: (
              <span className={styles.tabLabel}>
                <FileTextOutlined />
                生成物
              </span>
            ),
            children: (
              <div className={styles.panel}>
                <div className={styles.toolbar}>
                  <div className={styles.toolbarPrimary}>
                    <Input
                      value={artifactKeyword}
                      onChange={(event) => setArtifactKeyword(event.target.value)}
                      prefix={<SearchOutlined />}
                      placeholder="搜索生成物名称"
                      style={{ width: 280 }}
                    />
                    <Select allowClear value={artifactKind} onChange={setArtifactKind} options={artifactKindOptions} placeholder="类型" style={{ width: 180 }} />
                    <Button onClick={() => loadArtifacts(1, artifactPageSize)}>查询</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>共 {artifactTotal} 条</span>
                  </div>
                </div>
                {renderListShell(artifactLoading, renderArtifactRows(), '暂无生成物', {
                  current: artifactPage,
                  pageSize: artifactPageSize,
                  total: artifactTotal,
                  onChange: (page, pageSize) => loadArtifacts(page, pageSize),
                })}
              </div>
            ),
          },
        ]}
      />

      <SidePanel
        open={panelType === 'knowledge'}
        title={editingKnowledgeId ? '编辑知识库条目' : '新建知识库条目'}
        subtitle="右侧侧板承载表单，便于一边看列表一边维护内容"
        confirmText={editingKnowledgeId ? '保存修改' : '创建知识'}
        onClose={closePanel}
        onSubmit={() => submitKnowledge().catch((error: any) => message.error(error.message || '保存失败'))}
      >
        <Form form={knowledgeForm} layout="vertical">
          <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={knowledgeCategoryOptions} />
          </Form.Item>
          <Form.Item label="Target" name="target">
            <Input placeholder="例如 crawler / output / extract" />
          </Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：新闻站详情页抓取规则" />
          </Form.Item>

          <div className={styles.importStrip}>
            <div className={styles.importMeta}>
              <div className={styles.primaryText}>可导入文本文件</div>
              <div className={styles.secondaryText}>支持 txt、md、json、csv、html、xml。当前导入会转成知识正文，不做二进制文件托管。</div>
            </div>
            <div className={styles.importActions}>
              <input
                ref={knowledgeFileInputRef}
                className={styles.uploadInput}
                type="file"
                accept=".txt,.md,.markdown,.json,.csv,.html,.htm,.xml,text/*,application/json,application/xml"
                onChange={(event) => handleKnowledgeFilePick(event).catch((error: any) => message.error(error.message || '导入失败'))}
              />
              <Button icon={<UploadOutlined />} loading={knowledgeUploading} onClick={() => knowledgeFileInputRef.current?.click()}>
                导入文件
              </Button>
              {knowledgeSourceMeta?.sourceName ? (
                <Button type="text" onClick={() => setKnowledgeSourceMeta(null)}>
                  清除来源
                </Button>
              ) : null}
            </div>
          </div>

          {knowledgeSourceMeta?.sourceName ? (
            <div className={styles.importStrip}>
              <div className={styles.importMeta}>
                <div className={styles.primaryText}>{knowledgeSourceMeta.sourceName}</div>
                <div className={styles.secondaryText}>
                  {(knowledgeSourceMeta.sourceMimeType || 'text/plain') + (knowledgeSourceMeta.sourceSize ? ` · ${formatFileSize(knowledgeSourceMeta.sourceSize)}` : '')}
                </div>
              </div>
            </div>
          ) : null}

          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={12} placeholder="支持直接编写，也可以先导入文本文件再补充整理" />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="逗号分隔，例如 爬虫, 详情页, 选择器" />
          </Form.Item>
          <Form.Item label="启用" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </SidePanel>

      <SidePanel
        open={panelType === 'source'}
        title={editingSourceId ? '编辑网站源' : '新建网站源'}
        subtitle="更像资源库右侧配置板，不打断列表浏览"
        confirmText={editingSourceId ? '保存修改' : '创建网站源'}
        onClose={closePanel}
        onSubmit={() => submitSource().catch((error: any) => message.error(error.message || '保存失败'))}
      >
        <Form form={sourceForm} layout="vertical">
          <div className={styles.formGrid}>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="例如：36kr 新闻站" />
            </Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={sourceStatusOptions} />
            </Form.Item>
          </div>
          <Form.Item label="基础 URL" name="baseUrl" rules={[{ required: true, message: '请输入基础 URL' }]}>
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item label="推荐入口页" name="entryUrl">
            <Input placeholder="https://example.com/news" />
          </Form.Item>
          <div className={styles.formGrid}>
            <Form.Item label="列表页样例" name="listUrlExamples">
              <TextArea rows={4} placeholder="每行一个 URL" />
            </Form.Item>
            <Form.Item label="详情页样例" name="detailUrlExamples">
              <TextArea rows={4} placeholder="每行一个 URL" />
            </Form.Item>
          </div>
          <div className={styles.formGrid}>
            <Form.Item label="允许路径模式" name="allowedPatterns">
              <TextArea rows={4} placeholder="每行一条规则" />
            </Form.Item>
            <Form.Item label="禁止路径模式" name="blockedPatterns">
              <TextArea rows={4} placeholder="每行一条规则" />
            </Form.Item>
          </div>
          <Form.Item label="抓取提示" name="crawlTips">
            <TextArea rows={3} placeholder="例如：列表页需等待 2 秒，正文容器常见为 .article-content" />
          </Form.Item>
          <Form.Item label="登录 / Header 提示" name="authHint">
            <TextArea rows={3} placeholder="例如：需要特定 Cookie 或 Referer" />
          </Form.Item>
          <Form.Item label="正文定位提示" name="contentHint">
            <TextArea rows={3} placeholder="例如：正文常位于 article 或 .main-content" />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="逗号分隔，例如 新闻, 财经, 免登录" />
          </Form.Item>
        </Form>
      </SidePanel>
      <Modal
        title="知识库检索测试"
        open={knowledgeSearchOpen}
        onCancel={() => setKnowledgeSearchOpen(false)}
        onOk={() =>
          knowledgeSearchForm
            .validateFields()
            .then((values) => projectAssetsApi.searchKnowledgeTest(projectIdNumber, values.query, 8).then(setKnowledgeSearchResult))
            .catch((error: any) => {
              if (!error?.errorFields) message.error(error.message || '测试失败');
            })
        }
        width={720}
      >
        <Form form={knowledgeSearchForm} layout="vertical">
          <Form.Item label="测试问题" name="query" rules={[{ required: true, message: '请输入测试问题' }]}>
            <Input placeholder="例如：帮我生成一个抓取详情页的 crawler 工作流" />
          </Form.Item>
        </Form>
        {knowledgeSearchResult ? (
          <div className={styles.resultList}>
            {knowledgeSearchResult.list.map((item) => (
              <div key={`${item.scope}-${item.id}`} className={styles.resultCard}>
                <Space wrap>
                  <Tag color="blue">{item.scope}</Tag>
                  <Tag>{item.category}</Tag>
                  {item.target ? <Tag color="geekblue">{item.target}</Tag> : null}
                </Space>
                <div className={styles.primaryText}>{item.title}</div>
                <div className={styles.secondaryText}>{item.contentExcerpt}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal title="网站源校验结果" open={sourceCheckOpen} footer={null} onCancel={() => setSourceCheckOpen(false)} width={720}>
        {sourceCheckData ? <pre className={styles.codeBlock}>{JSON.stringify(sourceCheckData, null, 2)}</pre> : null}
      </Modal>

      <Modal title={artifactPreviewTitle} open={artifactPreviewOpen} footer={null} onCancel={() => setArtifactPreviewOpen(false)} width={860}>
        {renderArtifactPreview()}
      </Modal>

      <Modal
        title="发送生成物邮件"
        open={artifactEmailOpen}
        onCancel={() => setArtifactEmailOpen(false)}
        onOk={() =>
          artifactEmailForm
            .validateFields()
            .then((values) => {
              if (!artifactEmailTarget?.taskId) return Promise.reject(new Error('缺少任务信息'));
              return taskApi.sendArtifactsEmail(artifactEmailTarget.taskId, {
                to: values.to,
                subject: values.subject,
                body: values.body || undefined,
                artifactIds: [artifactEmailTarget.id],
              });
            })
            .then(() => {
              message.success('邮件已发送');
              setArtifactEmailOpen(false);
            })
            .catch((error: any) => {
              if (!error?.errorFields) message.error(error.message || '发送失败');
            })
        }
      >
        <Form form={artifactEmailForm} layout="vertical">
          <Form.Item label="收件邮箱" name="to" rules={[{ required: true, message: '请输入收件邮箱' }, { type: 'email', message: '请输入有效邮箱地址' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="主题" name="subject" rules={[{ required: true, message: '请输入主题' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="正文" name="body">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function ProjectAssetsPage() {
  return <ProjectAssetsContent />;
}
