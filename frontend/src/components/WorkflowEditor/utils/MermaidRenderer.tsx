import React, { useEffect, useRef, useState } from 'react';
import { Button, Spin } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const MERMAID_ID_PREFIX = 'mermaid-render-';

let mermaidRenderCounter = 0;
function nextMermaidId() {
  mermaidRenderCounter += 1;
  return `${MERMAID_ID_PREFIX}${Date.now().toString(36)}-${mermaidRenderCounter}`;
}

/**
 * 从 Markdown 中提取 ```mermaid ... ``` 的源码（若整段已是 mermaid 则直接返回）
 */
export function extractMermaidSource(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (s.startsWith('```')) {
    const firstLineEnd = s.indexOf('\n');
    if (firstLineEnd <= 0) return s;
    const firstLine = s.slice(0, firstLineEnd).toLowerCase();
    if (!firstLine.includes('mermaid')) return s;
    const body = s.slice(firstLineEnd + 1);
    const end = body.lastIndexOf('```');
    return (end >= 0 ? body.slice(0, end) : body).trim();
  }
  return s;
}

/**
 * 兼容 Mermaid 11：1) ["节点"] 改为 (节点) 避免 SQS；2) 多条边同屏时需换行，避免 PS 解析错误。
 */
function normalizeFlowchartBracketNodes(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '').trim();
  if (!/^flowchart\s/i.test(normalized) && !/^graph\s/i.test(normalized)) return source;
  // 1) ["xxx"] -> (xxx)
  const bracketNodeRegex = /\[\s*[\u0022\u201C\u201D]([\s\S]*?)[\u0022\u201C\u201D]\s*\]/g;
  let out = normalized.replace(bracketNodeRegex, (_, text) => {
    const safe = String(text)
      .replace(/&/g, '&amp;')
      .replace(/\(/g, '&#40;')
      .replace(/\)/g, '&#41;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
      .replace(/"/g, '&#34;');
    return `(${safe.trim()})`;
  });
  // 2) 每条边单独一行：") (" 为两条边之间的分隔，换成换行
  out = out.replace(/\)\s+\(/g, ')\n(');
  // 3) flowchart LR 后若紧跟节点，补换行
  out = out.replace(/^(flowchart\s+LR)\s+/i, '$1\n');
  return out;
}

/**
 * 判断内容是否像 Mermaid 图（timeline / flowchart / sequenceDiagram 等）
 */
export function looksLikeMermaid(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  const firstLine = t.split('\n')[0].trim().toLowerCase();
  return (
    firstLine.startsWith('timeline') ||
    firstLine.startsWith('flowchart') ||
    firstLine.startsWith('graph ') ||
    firstLine.startsWith('sequenceDiagram') ||
    firstLine.startsWith('sankey-beta') ||
    firstLine.startsWith('pie') ||
    firstLine.startsWith('gantt') ||
    firstLine.startsWith('stateDiagram') ||
    firstLine.startsWith('classDiagram') ||
    firstLine.startsWith('erDiagram') ||
    firstLine.startsWith('journey')
  );
}

interface MermaidRendererProps {
  /** Mermaid 源码（可含 ```mermaid ... ``` 包裹） */
  content: string;
  /** 是否显示“保存为 PNG”按钮 */
  showSavePng?: boolean;
  /** 保存 PNG 时的默认文件名（不含扩展名） */
  downloadName?: string;
  className?: string;
}

/**
 * 渲染 Mermaid 图，并支持保存为 PNG
 */
export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  content,
  showSavePng = true,
  downloadName = 'mermaid-diagram',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>(nextMermaidId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);

  const rawSource = extractMermaidSource(content);
  const source = normalizeFlowchartBracketNodes(rawSource);

  useEffect(() => {
    if (!source || !containerRef.current) {
      setLoading(false);
      if (!source) setError(null);
      return;
    }
    if (!looksLikeMermaid(source)) {
      if (containerRef.current) containerRef.current.innerHTML = '';
      setError('内容不是有效的 Mermaid 图表语法');
      setSvgElement(null);
      setLoading(false);
      return;
    }

    const id = idRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvgElement(null);

    const run = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          suppressErrorRendering: true,
          logLevel: 'fatal',
        } as any);

        const el = document.createElement('div');
        el.id = id;
        el.className = 'mermaid';
        el.textContent = source;
        containerRef.current!.innerHTML = '';
        containerRef.current!.appendChild(el);

        const { svg } = await mermaid.render(id + '-svg', source);
        if (cancelled) return;
        el.innerHTML = svg;
        const svgNode = el.querySelector('svg');
        setSvgElement(svgNode || null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Mermaid 渲染失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const handleSavePng = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;

    const svgStr = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = svg.clientWidth || 800;
        canvas.height = svg.clientHeight || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${downloadName.replace(/\.(png|svg)$/i, '')}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          },
          'image/png',
          1
        );
      } catch {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  return (
    <div className={className} style={{ position: 'relative' }}>
      {loading && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin tip="渲染图表中…" />
        </div>
      )}
      {error && (
        <pre style={{ padding: 12, background: '#fff2f0', borderRadius: 6, fontSize: 12 }}>{error}</pre>
      )}
      <div ref={containerRef} style={{ overflow: 'auto', minHeight: 80 }} />
      {showSavePng && !loading && !error && svgElement && (
        <div style={{ marginTop: 12 }}>
          <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleSavePng}>
            保存为 PNG
          </Button>
        </div>
      )}
    </div>
  );
};
