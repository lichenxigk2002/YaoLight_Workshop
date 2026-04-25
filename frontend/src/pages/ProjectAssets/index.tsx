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
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/project';
import { projectAssetsApi } from '@/api/projectAssets';
import { taskApi } from '@/api/task';
import { CodeBlock } from '@/components/CodeBlock';
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

const { Paragraph } = Typography;
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
  cancelText: string;
  confirmText: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

const knowledgeCategoryValues = ['best_practice', 'error_repair', 'node_usage', 'scene_template', 'business_rule'] as const;
const sourceStatusValues = ['active', 'disabled', 'invalid'] as const;
type KnowledgeCategoryValue = (typeof knowledgeCategoryValues)[number];
type SourceStatusValue = (typeof sourceStatusValues)[number];

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

const formatTime = (value?: string, locale = 'zh-CN') => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
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

function SidePanel({ open, title, subtitle, cancelText, confirmText, onClose, onSubmit, children }: SidePanelProps) {
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
          <Button onClick={onClose}>{cancelText}</Button>
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
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const knowledgeFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectIdNumber = providedProjectId ?? (projectId ? Number(projectId) : 0);
  const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';
  const isZh = locale === 'zh-CN';

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

  const knowledgeCategoryLabelMap: Record<KnowledgeCategoryValue, string> = {
    best_practice: t('projectAssets.categories.bestPractice'),
    error_repair: t('projectAssets.categories.errorRepair'),
    node_usage: t('projectAssets.categories.nodeUsage'),
    scene_template: t('projectAssets.categories.sceneTemplate'),
    business_rule: t('projectAssets.categories.businessRule'),
  };

  const sourceStatusLabelMap: Record<SourceStatusValue, string> = {
    active: t('projectAssets.source.status.active'),
    disabled: t('projectAssets.source.status.disabled'),
    invalid: t('projectAssets.source.status.invalid'),
  };

  const knowledgeCategoryOptions = knowledgeCategoryValues.map((value) => ({
    label: knowledgeCategoryLabelMap[value],
    value,
  }));

  const sourceStatusOptions = sourceStatusValues.map((value) => ({
    label: sourceStatusLabelMap[value],
    value,
  }));

  const getKnowledgeCategoryLabel = (category: string) => knowledgeCategoryLabelMap[category as KnowledgeCategoryValue] || category;
  const getSourceStatusLabel = (status: string) => sourceStatusLabelMap[status as SourceStatusValue] || status;

  const artifactKindOptions = useMemo(
    () => Array.from(new Set(artifactList.map((item) => item.kind).filter(Boolean))).map((value) => ({ label: value, value })),
    [artifactList],
  );

  const collectionOverview = useMemo(
    () => [
      { key: 'knowledge', label: t('projectAssets.knowledge.title'), value: knowledgeTotal },
      { key: 'sources', label: t('projectAssets.source.title'), value: sourceTotal },
      { key: 'artifacts', label: t('projectAssets.artifact.title'), value: artifactTotal },
    ],
    [artifactTotal, knowledgeTotal, sourceTotal, t],
  );

  const activeCollectionIntro = useMemo(() => {
    if (activeTab === 'sources') {
      return {
        title: isZh ? '维护可复用的网站来源' : 'Maintain reusable web sources',
        description: isZh
          ? '把入口地址、抓取提示和校验结果留在一起，后续项目更容易复用。'
          : 'Keep entry URLs, crawl hints, and validation results together so later projects can reuse them.',
      };
    }

    if (activeTab === 'artifacts') {
      return {
        title: isZh ? '把输出结果安静地收好' : 'Keep generated outputs within easy reach',
        description: isZh
          ? '这里保留流程产生的文件和内容，方便预览、下载和继续发送。'
          : 'This is where workflow outputs stay available for preview, download, and delivery.',
      };
    }

    return {
      title: isZh ? '把知识和规则整理成库' : 'Collect reusable knowledge in one calmer library',
      description: isZh
        ? '把经验、规则和场景说明整理成长期可维护的内容，而不是临时备注。'
        : 'Turn repeated know-how, rules, and scenarios into maintainable content instead of one-off notes.',
    };
  }, [activeTab, isZh]);

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
        message.error(error.message || t('projectAssets.messages.loadProjectFailed'));
      }
    };
    run();
  }, [message, projectIdNumber, providedProject, t]);

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
        message.error(error.message || t('projectAssets.messages.loadAssetsFailed'));
      }
    };
    run();
  }, [message, projectIdNumber, t]);
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
      message.error(t('projectAssets.messages.fileTypeUnsupported'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error(t('projectAssets.messages.fileTooLarge'));
      return;
    }

    setKnowledgeUploading(true);
    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error(t('projectAssets.messages.fileEmpty'));
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
      message.success(t('projectAssets.messages.fileImported'));
    } catch (error: any) {
      message.error(error.message || t('projectAssets.messages.fileImportFailed'));
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

    message.success(
      editingKnowledgeId ? t('projectAssets.messages.knowledgeUpdated') : t('projectAssets.messages.knowledgeCreated'),
    );
    closePanel();
    loadKnowledge(knowledgePage, knowledgePageSize).catch((error: any) =>
      message.error(error.message || t('projectAssets.messages.refreshKnowledgeFailed')),
    );
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

    message.success(editingSourceId ? t('projectAssets.messages.sourceUpdated') : t('projectAssets.messages.sourceCreated'));
    closePanel();
    loadSources(sourcePage, sourcePageSize).catch((error: any) =>
      message.error(error.message || t('projectAssets.messages.refreshSourceFailed')),
    );
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
      return <CodeBlock value={artifactPreviewContent} language="json" defaultExpanded collapsedLines={999} />;
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
                <span className={styles.softPill}>{getKnowledgeCategoryLabel(record.category)}</span>
                {record.target ? <span className={styles.mutedPill}>{record.target}</span> : null}
                <span className={`${styles.statusPill} ${record.isActive ? styles.statusActive : styles.statusMuted}`}>
                  {record.isActive ? t('projectAssets.knowledge.enabled') : t('projectAssets.knowledge.disabled')}
                </span>
              </div>
              <div className={styles.secondaryText}>{record.contentExcerpt || t('projectAssets.knowledge.noExcerpt')}</div>
              <div className={styles.metaRow}>
                <span className={styles.metaText}>
                  <ClockCircleOutlined />
                  {t('projectAssets.updatedAt', { time: formatTime(record.updatedAt, locale) })}
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
          <div className={styles.asideMetric}>{t('projectAssets.knowledge.idLabel', { id: record.id })}</div>
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
              {t('common.edit')}
            </Button>
            <Popconfirm
              title={t('projectAssets.knowledge.deleteConfirm')}
              onConfirm={() => projectAssetsApi.deleteKnowledge(projectIdNumber, record.id).then(() => loadKnowledge(knowledgePage, knowledgePageSize))}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                {t('common.delete')}
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
                <span className={`${styles.statusPill} ${getStatusClassName(record.status)}`}>{getSourceStatusLabel(record.status)}</span>
              </div>
              <a className={styles.primaryLink} href={record.baseUrl} rel="noreferrer" target="_blank">
                {record.baseUrl}
              </a>
              <div className={styles.secondaryText}>{record.entryUrl || t('projectAssets.source.noEntryUrl')}</div>
              <div className={styles.metaRow}>
                {record.lastCheckStatus ? (
                  <span className={styles.metaText}>{t('projectAssets.source.checkedStatus', { status: record.lastCheckStatus })}</span>
                ) : (
                  <span className={styles.metaText}>{t('projectAssets.source.unchecked')}</span>
                )}
                {record.lastCheckedAt ? (
                  <span className={styles.metaText}>
                    <ClockCircleOutlined />
                    {formatTime(record.lastCheckedAt, locale)}
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
          <div className={styles.asideMetric}>
            {record.entryUrl ? t('projectAssets.source.entryConfigured') : t('projectAssets.source.entryMissing')}
          </div>
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
              {t('projectAssets.source.check')}
            </Button>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditSource(record)}>
              {t('common.edit')}
            </Button>
            <Popconfirm
              title={t('projectAssets.source.deleteConfirm')}
              onConfirm={() => projectAssetsApi.deleteSource(projectIdNumber, record.id).then(() => loadSources(sourcePage, sourcePageSize))}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                {t('common.delete')}
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
              <div className={styles.secondaryText}>
                {record.workflowName || t('projectAssets.artifact.workflowFallback', { id: record.workflowId || '-' })}
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaText}>{t('projectAssets.artifact.nodeLabel', { id: record.nodeId || '-' })}</span>
                {record.taskName ? <span className={styles.metaText}>{record.taskName}</span> : null}
                <span className={styles.metaText}>
                  <ClockCircleOutlined />
                  {formatTime(record.createdAt, locale)}
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
                onClick={() => previewArtifact(record).catch((error: any) => message.error(error.message || t('projectAssets.messages.previewFailed')))}
              >
                {t('projectAssets.artifact.preview')}
              </Button>
            ) : null}
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => http.download(normalizeDownloadPathForHttp(record.downloadUrl), undefined, record.name)}
            >
              {t('projectAssets.artifact.download')}
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
              {t('projectAssets.artifact.email')}
            </Button>
          </div>
        </div>
      </div>
    ));

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {!embedded ? (
        <div className={styles.pageTopbar}>
          <div className={styles.pageTopbarLeft}>
            <Breadcrumb
              items={[
                { title: <a onClick={() => navigate('/')}>{t('dashboard.projectsList')}</a> },
                { title: <a onClick={() => navigate(`/projects/${projectIdNumber}/workflows`)}>{project?.name || t('projectAssets.projectFallback')}</a> },
                { title: t('projectAssets.pageTitle') },
              ]}
            />
          </div>
          <Button className={styles.backButton} icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectIdNumber}/workflows`)}>
            {t('projectAssets.backToProject')}
          </Button>
        </div>
      ) : null}

      <div className={styles.libraryHero}>
        <div className={styles.libraryHeroCopy}>
          <span className={styles.libraryEyebrow}>
            {embedded ? (isZh ? '项目资产' : 'Project assets') : t('projectAssets.pageTitle')}
          </span>
          <div className={styles.libraryTitle}>
            {embedded ? activeCollectionIntro.title : t('projectAssets.pageTitle')}
          </div>
          <div className={styles.librarySubtitle}>
            {embedded ? activeCollectionIntro.description : t('projectAssets.pageSubtitle')}
          </div>
        </div>

        <div className={styles.libraryStats}>
          {collectionOverview.map((item) => (
            <div key={item.key} className={styles.libraryStatCard}>
              <div className={styles.libraryStatLabel}>{item.label}</div>
              <div className={styles.libraryStatValue}>{item.value}</div>
            </div>
          ))}
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
                {t('projectAssets.knowledge.title')}
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
                      placeholder={t('projectAssets.knowledge.searchPlaceholder')}
                      style={{ width: 280 }}
                    />
                    <Select
                      allowClear
                      value={knowledgeCategory}
                      onChange={setKnowledgeCategory}
                      options={knowledgeCategoryOptions}
                      placeholder={t('projectAssets.knowledge.categoryFilter')}
                      style={{ width: 180 }}
                    />
                    <Button onClick={() => loadKnowledge(1, knowledgePageSize)}>{t('common.search')}</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>{t('projectAssets.totalCount', { count: knowledgeTotal })}</span>
                    <Button onClick={() => setKnowledgeSearchOpen(true)}>{t('projectAssets.searchTest.title')}</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateKnowledge}>
                      {t('projectAssets.knowledge.create')}
                    </Button>
                  </div>
                </div>
                {renderListShell(knowledgeLoading, renderKnowledgeRows(), t('projectAssets.knowledge.empty'), {
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
                {t('projectAssets.source.title')}
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
                      placeholder={t('projectAssets.source.searchPlaceholder')}
                      style={{ width: 280 }}
                    />
                    <Select
                      allowClear
                      value={sourceStatus}
                      onChange={setSourceStatus}
                      options={sourceStatusOptions}
                      placeholder={t('projectAssets.source.statusFilter')}
                      style={{ width: 180 }}
                    />
                    <Button onClick={() => loadSources(1, sourcePageSize)}>{t('common.search')}</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>{t('projectAssets.totalCount', { count: sourceTotal })}</span>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSource}>
                      {t('projectAssets.source.create')}
                    </Button>
                  </div>
                </div>
                {renderListShell(sourceLoading, renderSourceRows(), t('projectAssets.source.empty'), {
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
                {t('projectAssets.artifact.title')}
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
                      placeholder={t('projectAssets.artifact.searchPlaceholder')}
                      style={{ width: 280 }}
                    />
                    <Select
                      allowClear
                      value={artifactKind}
                      onChange={setArtifactKind}
                      options={artifactKindOptions}
                      placeholder={t('projectAssets.artifact.kindFilter')}
                      style={{ width: 180 }}
                    />
                    <Button onClick={() => loadArtifacts(1, artifactPageSize)}>{t('common.search')}</Button>
                  </div>
                  <div className={styles.toolbarActions}>
                    <span className={styles.toolbarStat}>{t('projectAssets.totalCount', { count: artifactTotal })}</span>
                  </div>
                </div>
                {renderListShell(artifactLoading, renderArtifactRows(), t('projectAssets.artifact.empty'), {
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
        title={editingKnowledgeId ? t('projectAssets.knowledge.editPanelTitle') : t('projectAssets.knowledge.createPanelTitle')}
        subtitle={t('projectAssets.knowledge.panelSubtitle')}
        cancelText={t('common.cancel')}
        confirmText={editingKnowledgeId ? t('projectAssets.actions.saveChanges') : t('projectAssets.knowledge.create')}
        onClose={closePanel}
        onSubmit={() => submitKnowledge().catch((error: any) => message.error(error.message || t('projectAssets.messages.saveFailed')))}
      >
        <Form form={knowledgeForm} layout="vertical">
          <Form.Item
            label={t('projectAssets.knowledge.form.category')}
            name="category"
            rules={[{ required: true, message: t('projectAssets.validation.selectCategory') }]}
          >
            <Select options={knowledgeCategoryOptions} />
          </Form.Item>
          <Form.Item label={t('projectAssets.knowledge.form.target')} name="target">
            <Input placeholder={t('projectAssets.knowledge.form.targetPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('projectAssets.knowledge.form.title')}
            name="title"
            rules={[{ required: true, message: t('projectAssets.validation.enterTitle') }]}
          >
            <Input placeholder={t('projectAssets.knowledge.form.titlePlaceholder')} />
          </Form.Item>

          <div className={styles.importStrip}>
            <div className={styles.importMeta}>
              <div className={styles.primaryText}>{t('projectAssets.knowledge.importTitle')}</div>
              <div className={styles.secondaryText}>{t('projectAssets.knowledge.importDescription')}</div>
            </div>
            <div className={styles.importActions}>
              <input
                ref={knowledgeFileInputRef}
                className={styles.uploadInput}
                type="file"
                accept=".txt,.md,.markdown,.json,.csv,.html,.htm,.xml,text/*,application/json,application/xml"
                onChange={(event) => handleKnowledgeFilePick(event).catch((error: any) => message.error(error.message || t('projectAssets.messages.importFailed')))}
              />
              <Button icon={<UploadOutlined />} loading={knowledgeUploading} onClick={() => knowledgeFileInputRef.current?.click()}>
                {t('projectAssets.knowledge.importAction')}
              </Button>
              {knowledgeSourceMeta?.sourceName ? (
                <Button type="text" onClick={() => setKnowledgeSourceMeta(null)}>
                  {t('projectAssets.knowledge.clearSource')}
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

          <Form.Item
            label={t('projectAssets.knowledge.form.content')}
            name="content"
            rules={[{ required: true, message: t('projectAssets.validation.enterContent') }]}
          >
            <TextArea rows={12} placeholder={t('projectAssets.knowledge.form.contentPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('projectAssets.knowledge.form.tags')} name="tags">
            <Input placeholder={t('projectAssets.knowledge.form.tagsPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('projectAssets.knowledge.form.enabled')} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </SidePanel>

      <SidePanel
        open={panelType === 'source'}
        title={editingSourceId ? t('projectAssets.source.editPanelTitle') : t('projectAssets.source.createPanelTitle')}
        subtitle={t('projectAssets.source.panelSubtitle')}
        cancelText={t('common.cancel')}
        confirmText={editingSourceId ? t('projectAssets.actions.saveChanges') : t('projectAssets.source.create')}
        onClose={closePanel}
        onSubmit={() => submitSource().catch((error: any) => message.error(error.message || t('projectAssets.messages.saveFailed')))}
      >
        <Form form={sourceForm} layout="vertical">
          <div className={styles.formGrid}>
            <Form.Item
              label={t('projectAssets.source.form.name')}
              name="name"
              rules={[{ required: true, message: t('projectAssets.validation.enterName') }]}
            >
              <Input placeholder={t('projectAssets.source.form.namePlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('projectAssets.source.form.status')}
              name="status"
              rules={[{ required: true, message: t('projectAssets.validation.selectStatus') }]}
            >
              <Select options={sourceStatusOptions} />
            </Form.Item>
          </div>
          <Form.Item
            label={t('projectAssets.source.form.baseUrl')}
            name="baseUrl"
            rules={[{ required: true, message: t('projectAssets.validation.enterBaseUrl') }]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item label={t('projectAssets.source.form.entryUrl')} name="entryUrl">
            <Input placeholder="https://example.com/news" />
          </Form.Item>
          <div className={styles.formGrid}>
            <Form.Item label={t('projectAssets.source.form.listExamples')} name="listUrlExamples">
              <TextArea rows={4} placeholder={t('projectAssets.source.form.lineUrlPlaceholder')} />
            </Form.Item>
            <Form.Item label={t('projectAssets.source.form.detailExamples')} name="detailUrlExamples">
              <TextArea rows={4} placeholder={t('projectAssets.source.form.lineUrlPlaceholder')} />
            </Form.Item>
          </div>
          <div className={styles.formGrid}>
            <Form.Item label={t('projectAssets.source.form.allowedPatterns')} name="allowedPatterns">
              <TextArea rows={4} placeholder={t('projectAssets.source.form.lineRulePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('projectAssets.source.form.blockedPatterns')} name="blockedPatterns">
              <TextArea rows={4} placeholder={t('projectAssets.source.form.lineRulePlaceholder')} />
            </Form.Item>
          </div>
          <Form.Item label={t('projectAssets.source.form.crawlTips')} name="crawlTips">
            <TextArea rows={3} placeholder={t('projectAssets.source.form.crawlTipsPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('projectAssets.source.form.authHint')} name="authHint">
            <TextArea rows={3} placeholder={t('projectAssets.source.form.authHintPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('projectAssets.source.form.contentHint')} name="contentHint">
            <TextArea rows={3} placeholder={t('projectAssets.source.form.contentHintPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('projectAssets.source.form.tags')} name="tags">
            <Input placeholder={t('projectAssets.source.form.tagsPlaceholder')} />
          </Form.Item>
        </Form>
      </SidePanel>
      <Modal
        title={t('projectAssets.searchTest.title')}
        open={knowledgeSearchOpen}
        onCancel={() => setKnowledgeSearchOpen(false)}
        okText={t('projectAssets.searchTest.action')}
        cancelText={t('common.cancel')}
        onOk={() =>
          knowledgeSearchForm
            .validateFields()
            .then((values) => projectAssetsApi.searchKnowledgeTest(projectIdNumber, values.query, 8).then(setKnowledgeSearchResult))
            .catch((error: any) => {
              if (!error?.errorFields) message.error(error.message || t('projectAssets.messages.searchTestFailed'));
            })
        }
        width={720}
      >
        <Form form={knowledgeSearchForm} layout="vertical">
          <Form.Item
            label={t('projectAssets.searchTest.queryLabel')}
            name="query"
            rules={[{ required: true, message: t('projectAssets.validation.enterSearchQuery') }]}
          >
            <Input placeholder={t('projectAssets.searchTest.queryPlaceholder')} />
          </Form.Item>
        </Form>
        {knowledgeSearchResult ? (
          <div className={styles.resultList}>
            {knowledgeSearchResult.list.map((item) => (
              <div key={`${item.scope}-${item.id}`} className={styles.resultCard}>
                <Space wrap>
                  <Tag>{item.scope}</Tag>
                  <Tag>{getKnowledgeCategoryLabel(item.category)}</Tag>
                  {item.target ? <Tag>{item.target}</Tag> : null}
                </Space>
                <div className={styles.primaryText}>{item.title}</div>
                <div className={styles.secondaryText}>{item.contentExcerpt}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('projectAssets.source.checkResultTitle')}
        open={sourceCheckOpen}
        footer={null}
        onCancel={() => setSourceCheckOpen(false)}
        width={720}
      >
        {sourceCheckData ? <CodeBlock value={sourceCheckData} language="json" defaultExpanded collapsedLines={999} /> : null}
      </Modal>

      <Modal title={artifactPreviewTitle} open={artifactPreviewOpen} footer={null} onCancel={() => setArtifactPreviewOpen(false)} width={860}>
        {renderArtifactPreview()}
      </Modal>

      <Modal
        title={t('projectAssets.artifact.emailTitle')}
        open={artifactEmailOpen}
        onCancel={() => setArtifactEmailOpen(false)}
        okText={t('projectAssets.artifact.sendEmail')}
        cancelText={t('common.cancel')}
        onOk={() =>
          artifactEmailForm
            .validateFields()
            .then((values) => {
              if (!artifactEmailTarget?.taskId) return Promise.reject(new Error(t('projectAssets.messages.taskInfoMissing')));
              return taskApi.sendArtifactsEmail(artifactEmailTarget.taskId, {
                to: values.to,
                subject: values.subject,
                body: values.body || undefined,
                artifactIds: [artifactEmailTarget.id],
              });
            })
            .then(() => {
              message.success(t('projectAssets.messages.emailSent'));
              setArtifactEmailOpen(false);
            })
            .catch((error: any) => {
              if (!error?.errorFields) message.error(error.message || t('projectAssets.messages.sendFailed'));
            })
        }
      >
        <Form form={artifactEmailForm} layout="vertical">
          <Form.Item
            label={t('projectAssets.artifact.emailTo')}
            name="to"
            rules={[
              { required: true, message: t('projectAssets.validation.enterRecipientEmail') },
              { type: 'email', message: t('projectAssets.validation.enterValidEmail') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t('projectAssets.artifact.emailSubject')}
            name="subject"
            rules={[{ required: true, message: t('projectAssets.validation.enterSubject') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t('projectAssets.artifact.emailBody')} name="body">
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
