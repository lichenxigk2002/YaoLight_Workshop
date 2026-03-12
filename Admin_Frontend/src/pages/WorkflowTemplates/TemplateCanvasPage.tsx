import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { App, Button, Card, Divider, Empty, Input, InputNumber, List, Popconfirm, Select, Space, Switch, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, BranchesOutlined, ClockCircleOutlined, DatabaseOutlined, DeploymentUnitOutlined, FileTextOutlined, FilterOutlined, PlayCircleOutlined, RobotOutlined, SaveOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactFlow, { addEdge, Background, BackgroundVariant, Connection, Controls, Edge, Handle, MiniMap, Node, NodeProps, NodeTypes, Position, ReactFlowInstance, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { useI18n } from '@/i18n';
import { getWorkflowTemplate, getWorkflowTemplateCanvas, saveWorkflowTemplateCanvas, syncWorkflowTemplate, updateWorkflowTemplate } from '@/api/workflowTemplates';
import type { WorkflowTemplateCanvas, WorkflowTemplateDetail, WorkflowTemplatePayload, WorkflowTemplateStatus } from '@/types/workflowTemplates';
import styles from './TemplateCanvasPage.module.scss';

const { Text, Title, Paragraph } = Typography;
type Direction = 'vertical' | 'horizontal';
type FlowNode = Node<{ label?: string; type: string; config: Record<string, unknown>; connectionDirection?: Direction; text?: string; color?: string }>;
type FlowEdge = Edge;
type NodeMeta = { type: string; labelKey: string; descKey: string; color: string; icon: React.ReactNode; showInput?: boolean; showOutput?: boolean; inputCount?: number; outputCount?: number };

const STATUS_OPTIONS: WorkflowTemplateStatus[] = ['draft', 'published', 'archived', 'disabled'];
const COMMENT_COLORS = ['#fffacd', '#ffe4e1', '#e6f4ff', '#e8f5e9', '#f3e8ff'];
const META: NodeMeta[] = [
  { type: 'start', labelKey: 'workflowTemplateCanvas.node.start.label', descKey: 'workflowTemplateCanvas.node.start.desc', color: '#52c41a', icon: <PlayCircleOutlined />, showInput: false },
  { type: 'crawler', labelKey: 'workflowTemplateCanvas.node.crawler.label', descKey: 'workflowTemplateCanvas.node.crawler.desc', color: '#1677ff', icon: <DatabaseOutlined /> },
  { type: 'dataclean', labelKey: 'workflowTemplateCanvas.node.dataclean.label', descKey: 'workflowTemplateCanvas.node.dataclean.desc', color: '#13c2c2', icon: <FilterOutlined /> },
  { type: 'ai', labelKey: 'workflowTemplateCanvas.node.ai.label', descKey: 'workflowTemplateCanvas.node.ai.desc', color: '#722ed1', icon: <RobotOutlined /> },
  { type: 'condition', labelKey: 'workflowTemplateCanvas.node.condition.label', descKey: 'workflowTemplateCanvas.node.condition.desc', color: '#fa8c16', icon: <BranchesOutlined />, outputCount: 2 },
  { type: 'transform', labelKey: 'workflowTemplateCanvas.node.transform.label', descKey: 'workflowTemplateCanvas.node.transform.desc', color: '#2f54eb', icon: <DeploymentUnitOutlined /> },
  { type: 'loop', labelKey: 'workflowTemplateCanvas.node.loop.label', descKey: 'workflowTemplateCanvas.node.loop.desc', color: '#eb2f96', icon: <SyncOutlined /> },
  { type: 'merge', labelKey: 'workflowTemplateCanvas.node.merge.label', descKey: 'workflowTemplateCanvas.node.merge.desc', color: '#faad14', icon: <DeploymentUnitOutlined />, inputCount: 2 },
  { type: 'delay', labelKey: 'workflowTemplateCanvas.node.delay.label', descKey: 'workflowTemplateCanvas.node.delay.desc', color: '#8c8c8c', icon: <ClockCircleOutlined /> },
  { type: 'output', labelKey: 'workflowTemplateCanvas.node.output.label', descKey: 'workflowTemplateCanvas.node.output.desc', color: '#0958d9', icon: <SendOutlined /> },
  { type: 'end', labelKey: 'workflowTemplateCanvas.node.end.label', descKey: 'workflowTemplateCanvas.node.end.desc', color: '#f5222d', icon: <DeploymentUnitOutlined />, showOutput: false },
  { type: 'comment', labelKey: 'workflowTemplateCanvas.node.comment.label', descKey: 'workflowTemplateCanvas.node.comment.desc', color: '#d4b106', icon: <FileTextOutlined />, showInput: false, showOutput: false },
];

const metaOf = (type: string) => META.find((item) => item.type === type) ?? META[0];
const nodeTypeOf = (node: Pick<FlowNode, 'type' | 'data'>) => node.type || node.data.type;
const isComment = (node?: FlowNode | null) => Boolean(node && nodeTypeOf(node) === 'comment');
const nextIdOf = (nodes: FlowNode[]) => Math.max(0, ...nodes.map((node) => Number(node.id.match(/(\d+)/)?.[1] || 0))) + 1;

function defaults(type: string): Record<string, unknown> {
  switch (type) {
    case 'start': return { trigger: 'manual' };
    case 'crawler': return { url: '', selector: '', method: 'GET' };
    case 'dataclean': return { cleanType: 'html', removeHTML: true, trim: true };
    case 'ai': return { prompt: '', modelMode: 'system', provider: 'default' };
    case 'condition': return { field: '', operator: '==', value: '' };
    case 'transform': return { transformType: 'map', script: '' };
    case 'loop': return { items: '', loopType: 'foreach' };
    case 'merge': return { mergeType: 'concat' };
    case 'delay': return { seconds: 1 };
    case 'output': return { format: 'json', destination: 'result' };
    case 'end': return { action: 'none' };
    default: return {};
  }
}

function summaryOf(node: FlowNode, t: (key: string, params?: Record<string, string | number>) => string) {
  const config = node.data.config || {};
  const kind = nodeTypeOf(node);
  if (kind === 'crawler') return String(config.url || t('workflowTemplateCanvas.summaryNoUrl'));
  if (kind === 'ai') return String(config.prompt || t('workflowTemplateCanvas.summaryPresetPrompt'));
  if (kind === 'condition') return `${config.field || t('workflowTemplateCanvas.summaryField')} ${config.operator || '=='} ${config.value || ''}`.trim();
  if (kind === 'output') return `${config.format || 'json'} -> ${config.destination || t('workflowTemplateCanvas.summaryResultDestination')}`;
  if (kind === 'comment') return node.data.text || t('workflowTemplateCanvas.canvasNote');
  return t(metaOf(kind).descKey);
}

function fromPayload(canvas: WorkflowTemplateCanvas, t: (key: string, params?: Record<string, string | number>) => string) {
  return {
    nodes: [
      ...(canvas.nodes || []).map((node) => ({ id: node.id, type: node.type, position: node.position || { x: 120, y: 120 }, data: { label: node.data?.label || t(metaOf(node.type).labelKey), type: node.type, config: (node.data?.config as Record<string, unknown>) || defaults(node.type), connectionDirection: (node.data?.connectionDirection as Direction) || 'vertical' } })),
      ...(canvas.commentCards || []).map((card) => ({ id: card.id, type: 'comment', position: card.position || { x: 140, y: 140 }, data: { type: 'comment', config: {}, text: card.data?.text || '', color: card.data?.color || '#fffacd' } })),
    ] as FlowNode[],
    edges: (canvas.edges || []).map((edge) => ({ id: edge.id || `${edge.source}-${edge.target}`, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })) as FlowEdge[],
  };
}

function toPayload(nodes: FlowNode[], edges: FlowEdge[]): WorkflowTemplateCanvas {
  return {
    nodes: nodes.filter((node) => !isComment(node)).map((node) => ({ id: node.id, type: nodeTypeOf(node), position: node.position, data: { label: node.data.label || '', type: nodeTypeOf(node), config: node.data.config || {}, connectionDirection: node.data.connectionDirection || 'vertical' } })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle || undefined, targetHandle: edge.targetHandle || undefined })),
    commentCards: nodes.filter((node) => isComment(node)).map((node) => ({ id: node.id, position: node.position, data: { text: node.data.text || '', color: node.data.color || '#fffacd' } })),
  };
}

function CanvasNode({ data, selected, type }: NodeProps<FlowNode['data']>) {
  const { t } = useI18n();
  const kind = type || data.type;
  const meta = metaOf(kind);
  const direction = data.connectionDirection || 'vertical';
  const renderHandle = (handleKind: 'input' | 'output', id?: string, style?: React.CSSProperties) => <Handle type={handleKind === 'input' ? 'target' : 'source'} position={handleKind === 'input' ? (direction === 'vertical' ? Position.Top : Position.Left) : (direction === 'vertical' ? Position.Bottom : Position.Right)} id={id} className={styles.handle} style={style} />;
  if (kind === 'comment') return <div className={`${styles.commentNode} ${selected ? styles.commentNodeSelected : ''}`} style={{ background: data.color || '#fffacd' }}><div className={styles.commentTitle}>{t('workflowTemplateCanvas.commentTitle')}</div><div>{data.text || t('workflowTemplateCanvas.canvasNote')}</div></div>;
  return <div className={`${styles.flowNode} ${selected ? styles.flowNodeSelected : ''}`}>
    {meta.showInput !== false && (meta.inputCount === 2 ? [0, 1].map((index) => renderHandle('input', `input-${index}`, direction === 'vertical' ? { left: `${33 + index * 34}%` } : { top: `${33 + index * 34}%` })) : renderHandle('input', 'input'))}
    <Card className={styles.flowNodeCard} size="small" style={{ borderColor: meta.color, boxShadow: selected ? `0 0 0 3px ${meta.color}22` : undefined }}>
      <div className={styles.flowNodeHeader}><span style={{ color: meta.color }}>{meta.icon}</span><Tag color={meta.color}>{t(meta.labelKey)}</Tag></div>
      <div className={styles.flowNodeLabel}>{data.label || t(meta.labelKey)}</div>
      <div className={styles.flowNodeDesc}>{summaryOf({ id: '', type: kind, data, position: { x: 0, y: 0 } }, t)}</div>
    </Card>
    {meta.showOutput !== false && (meta.outputCount === 2 ? <>{renderHandle('output', 'true', direction === 'vertical' ? { left: '32%', background: '#52c41a' } : { top: '32%', background: '#52c41a' })}{renderHandle('output', 'false', direction === 'vertical' ? { left: '68%', background: '#f5222d' } : { top: '68%', background: '#f5222d' })}</> : renderHandle('output', 'output'))}
  </div>;
}

const nodeTypes: NodeTypes = { start: CanvasNode, crawler: CanvasNode, dataclean: CanvasNode, ai: CanvasNode, condition: CanvasNode, transform: CanvasNode, loop: CanvasNode, merge: CanvasNode, delay: CanvasNode, output: CanvasNode, end: CanvasNode, comment: CanvasNode };

export default function WorkflowTemplateCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const templateId = Number(id);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { locale, t } = useI18n();
  const [nodes, setNodes, baseOnNodesChange] = useNodesState<FlowNode['data']>([]);
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([]);
  const [detail, setDetail] = useState<WorkflowTemplateDetail | null>(null);
  const [draft, setDraft] = useState<WorkflowTemplatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);
  const dragTypeRef = useRef<string | null>(null);
  const selectedNode = useMemo(() => nodes.find((node: FlowNode) => node.id === selectedId) || null, [nodes, selectedId]);
  const statusOptions = useMemo(() => STATUS_OPTIONS.map((value) => ({ value, label: t(`workflowTemplates.status${value[0].toUpperCase()}${value.slice(1)}`) })), [t]);

  const hydrate = useCallback((nextDetail: WorkflowTemplateDetail, canvas: WorkflowTemplateCanvas) => {
    const graph = fromPayload(canvas, t);
    setDetail(nextDetail);
    setDraft({ source_workflow_id: nextDetail.source_workflow_id || undefined, name: nextDetail.name, description: nextDetail.description || undefined, category: nextDetail.category || undefined, tags: nextDetail.tags, status: nextDetail.status, is_public: nextDetail.is_public });
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedId(null);
    setDirty(false);
  }, [setEdges, setNodes, t]);

  const persistMeta = useCallback(async () => {
    if (!draft) {
      return null;
    }

    const updated = await updateWorkflowTemplate(templateId, draft);
    setDetail(updated);
    setDraft({
      source_workflow_id: updated.source_workflow_id || undefined,
      name: updated.name,
      description: updated.description || undefined,
      category: updated.category || undefined,
      tags: updated.tags,
      status: updated.status,
      is_public: updated.is_public,
    });
    return updated;
  }, [draft, templateId]);

  const loadPage = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const [nextDetail, canvas] = await Promise.all([getWorkflowTemplate(templateId), getWorkflowTemplateCanvas(templateId)]);
      hydrate(nextDetail, canvas);
      requestAnimationFrame(() => instance?.fitView({ padding: 0.18, duration: 240 }));
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [hydrate, instance, message, templateId]);

  useEffect(() => { void loadPage(); }, [loadPage]);
  useEffect(() => { if (selectedId && !selectedNode) setSelectedId(null); }, [selectedId, selectedNode]);

  const onNodesChange = useCallback((changes: Parameters<typeof baseOnNodesChange>[0]) => { setDirty(true); baseOnNodesChange(changes); }, [baseOnNodesChange]);
  const onEdgesChange = useCallback((changes: Parameters<typeof baseOnEdgesChange>[0]) => { setDirty(true); baseOnEdgesChange(changes); }, [baseOnEdgesChange]);
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    const idNumber = nextIdOf(nodes);
    const meta = metaOf(type);
    const node: FlowNode = { id: `${type === 'comment' ? 'comment' : 'node'}-${idNumber}`, type, position: position || { x: 160 + Math.random() * 80, y: 160 + Math.random() * 80 }, data: type === 'comment' ? { type: 'comment', config: {}, text: '', color: '#fffacd' } : { label: t(meta.labelKey), type, config: defaults(type), connectionDirection: 'vertical' } };
    setNodes((current: FlowNode[]) => [...current, node]);
    setSelectedId(node.id);
    setDirty(true);
  }, [nodes, setNodes, t]);
  const updateSelected = (updater: (node: FlowNode) => FlowNode) => { if (!selectedId) return; setNodes((current: FlowNode[]) => current.map((node: FlowNode) => node.id === selectedId ? updater(node) : node)); setDirty(true); };
  const updateConfig = (key: string, value: unknown) => updateSelected((node) => ({ ...node, data: { ...node.data, config: { ...(node.data.config || {}), [key]: value } } }));
  const removeSelected = () => { if (!selectedId) return; setNodes((current: FlowNode[]) => current.filter((node: FlowNode) => node.id !== selectedId)); setEdges((current: FlowEdge[]) => current.filter((edge: FlowEdge) => edge.source !== selectedId && edge.target !== selectedId)); setSelectedId(null); setDirty(true); };

  const saveMeta = async () => {
    if (!draft) return;
    setSavingMeta(true);
    try {
      const updated = await persistMeta();
      if (!updated) {
        return;
      }
      message.success(t('workflowTemplateCanvas.saveInfoSuccess'));
    } catch (error) {
      message.error((error as Error).message);
    } finally { setSavingMeta(false); }
  };
  const saveCanvas = async () => {
    setSavingCanvas(true);
    try {
      const updated = await persistMeta();
      await saveWorkflowTemplateCanvas(templateId, toPayload(nodes, edges));
      setDetail(updated || await getWorkflowTemplate(templateId));
      setDirty(false);
      message.success(t('workflowTemplateCanvas.saveCanvasSuccess'));
    } catch (error) {
      message.error((error as Error).message);
    } finally { setSavingCanvas(false); }
  };
  const syncSource = async () => {
    setSyncing(true);
    try {
      const fresh = await syncWorkflowTemplate(templateId);
      hydrate(fresh, await getWorkflowTemplateCanvas(templateId));
      message.success(t('workflowTemplateCanvas.syncSuccess'));
    } catch (error) {
      message.error((error as Error).message);
    } finally { setSyncing(false); }
  };

  const renderInspector = () => {
    if (!selectedNode) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workflowTemplateCanvas.emptyInspector')} />;
    const kind = nodeTypeOf(selectedNode);
    const config = selectedNode.data.config || {};
    if (isComment(selectedNode)) return <>
      <Text type="secondary">{t('workflowTemplateCanvas.commentTitle')}</Text>
      <Input.TextArea rows={5} value={selectedNode.data.text || ''} placeholder={t('workflowTemplateCanvas.commentPlaceholder')} onChange={(event) => updateSelected((node) => ({ ...node, data: { ...node.data, text: event.target.value } }))} />
      <div className={styles.colorRow}>{COMMENT_COLORS.map((color) => <button key={color} type="button" className={`${styles.colorChip} ${selectedNode.data.color === color ? styles.colorChipActive : ''}`} style={{ background: color }} onClick={() => updateSelected((node) => ({ ...node, data: { ...node.data, color } }))} />)}</div>
    </>;
    return <>
      <Text type="secondary">{t('workflowTemplateCanvas.fieldNodeLabel')}</Text>
      <Input value={selectedNode.data.label || ''} onChange={(event) => updateSelected((node) => ({ ...node, data: { ...node.data, label: event.target.value } }))} />
      <Text type="secondary">{t('workflowTemplateCanvas.fieldDirection')}</Text>
      <Select value={selectedNode.data.connectionDirection || 'vertical'} options={[{ value: 'vertical', label: t('workflowTemplateCanvas.directionVertical') }, { value: 'horizontal', label: t('workflowTemplateCanvas.directionHorizontal') }]} onChange={(value: Direction) => updateSelected((node) => ({ ...node, data: { ...node.data, connectionDirection: value } }))} />
      {kind === 'crawler' ? <><Text type="secondary">{t('workflowTemplateCanvas.fieldUrl')}</Text><Input value={String(config.url || '')} onChange={(event) => updateConfig('url', event.target.value)} /><Text type="secondary">{t('workflowTemplateCanvas.fieldSelector')}</Text><Input value={String(config.selector || '')} onChange={(event) => updateConfig('selector', event.target.value)} /></> : null}
      {kind === 'ai' ? <><Text type="secondary">{t('workflowTemplateCanvas.fieldPrompt')}</Text><Input.TextArea rows={6} value={String(config.prompt || '')} onChange={(event) => updateConfig('prompt', event.target.value)} /><Text type="secondary">{t('workflowTemplateCanvas.fieldProviderTag')}</Text><Input value={String(config.provider || 'default')} onChange={(event) => updateConfig('provider', event.target.value)} /></> : null}
      {kind === 'condition' ? <><Text type="secondary">{t('workflowTemplateCanvas.fieldConditionField')}</Text><Input value={String(config.field || '')} onChange={(event) => updateConfig('field', event.target.value)} /><Text type="secondary">{t('workflowTemplateCanvas.fieldConditionOperator')}</Text><Select value={String(config.operator || '==')} options={['==', '!=', '>', '<', 'contains'].map((value) => ({ value, label: value }))} onChange={(value) => updateConfig('operator', value)} /><Text type="secondary">{t('workflowTemplateCanvas.fieldConditionValue')}</Text><Input value={String(config.value || '')} onChange={(event) => updateConfig('value', event.target.value)} /></> : null}
      {kind === 'output' ? <><Text type="secondary">{t('workflowTemplateCanvas.fieldOutputFormat')}</Text><Select value={String(config.format || 'json')} options={['json', 'text', 'markdown'].map((value) => ({ value, label: value }))} onChange={(value) => updateConfig('format', value)} /><Text type="secondary">{t('workflowTemplateCanvas.fieldDestination')}</Text><Input value={String(config.destination || 'result')} onChange={(event) => updateConfig('destination', event.target.value)} /></> : null}
      {kind === 'delay' ? <><Text type="secondary">{t('workflowTemplateCanvas.fieldDelaySeconds')}</Text><InputNumber min={0} value={Number(config.seconds || 1)} onChange={(value) => updateConfig('seconds', Number(value || 0))} style={{ width: '100%' }} /></> : null}
      {['start', 'dataclean', 'transform', 'loop', 'merge', 'end'].includes(kind) ? <Paragraph className={styles.inspectorHint}>{t('workflowTemplateCanvas.simplifiedHint')}</Paragraph> : null}
      <Button danger onClick={removeSelected}>{t('workflowTemplateCanvas.actionDeleteNode')}</Button>
    </>;
  };

  return <div className={styles.page}>
    <div className={styles.headerBar}>
      <div className={styles.headerLead}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workflow-templates')}>{t('workflowTemplateCanvas.actionBack')}</Button>
        <div>
          <Title level={3} className={styles.headerTitle}>{detail?.name || t('workflowTemplateCanvas.titleFallback', { id: templateId })}</Title>
          <Paragraph className={styles.headerMeta}><Link to="/workflow-templates">{t('workflowTemplateCanvas.breadcrumbList')}</Link><span>/</span><span>{t('workflowTemplateCanvas.breadcrumbCanvas')}</span>{dirty ? <Tag color="orange">{t('workflowTemplateCanvas.unsaved')}</Tag> : null}</Paragraph>
        </div>
      </div>
      <Space>
        {detail?.source_workflow_id ? (
          <Popconfirm
            title={locale === 'en-US' ? 'Sync this canvas from the source workflow?' : '确认从源工作流同步当前编排吗？'}
            description={locale === 'en-US' ? 'This will overwrite the current canvas nodes, edges, and comment cards.' : '这会覆盖当前编排里的节点、连线和注释卡。'}
            onConfirm={() => void syncSource()}
          >
            <Button icon={<SyncOutlined />} loading={syncing}>{t('workflowTemplateCanvas.actionSyncSource')}</Button>
          </Popconfirm>
        ) : null}
        <Button icon={<SaveOutlined />} loading={savingMeta} onClick={() => void saveMeta()}>{t('workflowTemplateCanvas.actionSaveInfo')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={savingCanvas} onClick={() => void saveCanvas()}>{t('workflowTemplateCanvas.actionSaveCanvas')}</Button>
      </Space>
    </div>
    <div className={styles.metaStrip}>
      <div className={styles.metaField}><Text type="secondary">{t('workflowTemplateCanvas.metaName')}</Text><Input value={draft?.name || ''} onChange={(event) => setDraft((current: WorkflowTemplatePayload | null) => current ? { ...current, name: event.target.value } : current)} /></div>
      <div className={styles.metaField}><Text type="secondary">{t('workflowTemplateCanvas.metaStatus')}</Text><Select value={draft?.status} options={statusOptions} onChange={(value: WorkflowTemplateStatus) => setDraft((current: WorkflowTemplatePayload | null) => current ? { ...current, status: value } : current)} /></div>
      <div className={styles.metaField}><Text type="secondary">{t('workflowTemplateCanvas.metaCategory')}</Text><Input value={draft?.category || ''} onChange={(event) => setDraft((current: WorkflowTemplatePayload | null) => current ? { ...current, category: event.target.value } : current)} /></div>
      <div className={styles.metaSwitch}><Text type="secondary">{t('workflowTemplateCanvas.metaPublic')}</Text><Switch checked={draft?.is_public || false} onChange={(checked: boolean) => setDraft((current: WorkflowTemplatePayload | null) => current ? { ...current, is_public: checked } : current)} /></div>
    </div>
    <div className={styles.editorShell}>
      <Card title={t('workflowTemplateCanvas.panelNodeLibrary')} className={styles.palettePanel} loading={loading}>
        <div className={styles.paletteList}>{META.map((item) => <button key={item.type} type="button" className={styles.paletteItem} draggable onDragStart={() => { dragTypeRef.current = item.type; }} onClick={() => addNode(item.type)}><span className={styles.paletteIcon} style={{ color: item.color }}>{item.icon}</span><span className={styles.paletteCopy}><strong>{t(item.labelKey)}</strong><span>{t(item.descKey)}</span></span></button>)}</div>
      </Card>
      <div className={styles.canvasPanel} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!dragTypeRef.current || !instance) return; addNode(dragTypeRef.current, instance.screenToFlowPosition({ x: event.clientX, y: event.clientY })); dragTypeRef.current = null; }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(connection: Connection) => { const source = nodes.find((node: FlowNode) => node.id === connection.source); const target = nodes.find((node: FlowNode) => node.id === connection.target); if (isComment(source) || isComment(target)) { message.warning(t('workflowTemplateCanvas.commentConnectWarning')); return; } setEdges((current: FlowEdge[]) => addEdge(connection, current)); setDirty(true); }} onNodeClick={(_event: ReactMouseEvent, node: FlowNode) => setSelectedId(node.id)} onPaneClick={() => setSelectedId(null)} onInit={(reactFlow: ReactFlowInstance) => { setInstance(reactFlow); requestAnimationFrame(() => reactFlow.fitView({ padding: 0.18, duration: 0 })); }} fitView>
          <Controls />
          <MiniMap className={styles.miniMap} />
          <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
        </ReactFlow>
      </div>
      <Card title={selectedNode ? t('workflowTemplateCanvas.inspectorTitleWithNode', { node: t(metaOf(nodeTypeOf(selectedNode)).labelKey) }) : t('workflowTemplateCanvas.panelInspector')} className={styles.inspectorPanel} loading={loading}>
        {renderInspector()}
        <Divider />
        <div className={styles.summaryBlock}><div className={styles.summaryRow}><span>{t('workflowTemplateCanvas.summaryNodes')}</span><strong>{nodes.filter((node) => !isComment(node)).length}</strong></div><div className={styles.summaryRow}><span>{t('workflowTemplateCanvas.summaryEdges')}</span><strong>{edges.length}</strong></div><div className={styles.summaryRow}><span>{t('workflowTemplateCanvas.summaryUsage')}</span><strong>{detail?.usage_count || 0}</strong></div></div>
        <Divider />
        <Text strong>{t('workflowTemplateCanvas.canvasNodes')}</Text>
        <List className={styles.nodeList} dataSource={nodes} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workflowTemplateCanvas.emptyNodes')} /> }} renderItem={(node: FlowNode) => <List.Item className={node.id === selectedId ? styles.nodeListItemActive : styles.nodeListItem} onClick={() => setSelectedId(node.id)}><div><div className={styles.nodeListTitle}>{node.data.label || t(metaOf(nodeTypeOf(node)).labelKey)}</div><div className={styles.nodeListMeta}>{t(metaOf(nodeTypeOf(node)).labelKey)}</div></div><Tag color={metaOf(nodeTypeOf(node)).color}>{nodeTypeOf(node)}</Tag></List.Item>} />
      </Card>
    </div>
  </div>;
}
