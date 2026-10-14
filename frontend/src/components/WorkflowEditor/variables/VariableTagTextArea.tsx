import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button, Popover, List, Tag, Input as AntdInput, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Node, Edge } from 'reactflow';
import { nodeIODefinitions } from './nodeVariables';
import { ThunderboltOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './VariableTagTextArea.module.scss';

interface VariableTagTextAreaProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  className?: string;
  executionResult?: any;
}

interface VariableInfo {
  label: string;
  value: string;
  nodeId: string;
  variable: string;
  description?: string;
  nodeLabel: string;
  nodeType: string;
}

interface TextPart {
  type: 'text' | 'variable';
  content: string;
  variable?: string;
}

// 变量标签组件
const VariableTag: React.FC<{
  variable: string;
  displayLabel: string;
  onDelete: (variable: string, e: React.MouseEvent) => void;
}> = ({ variable, displayLabel, onDelete }) => {
  return (
    <span
      className={styles.variableTag}
      contentEditable={false}
      data-variable={variable}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={styles.variableTagText}>{displayLabel}</span>
      <span
        className={styles.variableTagDelete}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(variable, e);
        }}
        title="删除变量"
      >
        <CloseOutlined />
      </span>
    </span>
  );
};

export const VariableTagTextArea: React.FC<VariableTagTextAreaProps> = ({
  value = '',
  onChange,
  placeholder,
  rows = 5,
  node,
  nodes,
  edges,
  className,
  executionResult,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const savedRangeRef = useRef<Range | null>(null);

  // 同步外部 value 到内部状态
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);


  // 从执行结果中提取各节点的输出数据（用于变量预览）
  const nodeOutputs = useMemo(() => {
    if (!executionResult?.results) return {};
    const outputs: Record<string, any> = {};
    executionResult.results.forEach((result: any) => {
      if (result.success && result.data) {
        outputs[result.node_id] = result.data;
      }
    });
    return outputs;
  }, [executionResult]);

  // 获取变量预览值（用于在变量列表中提示实际内容）
  const getVariablePreview = useCallback(
    (nodeId: string, variablePath: string): string | null => {
      const nodeData = nodeOutputs[nodeId];
      if (!nodeData) return null;

      try {
        const parts = variablePath.split('.');
        let current: any = nodeData;

        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return null;
          }
        }

        if (typeof current === 'string') {
          // URL 不截断太短，方便识别
          const text = current.length > 80 ? `${current.substring(0, 80)}...` : current;
          return text;
        }
        if (typeof current === 'number' || typeof current === 'boolean') {
          return String(current);
        }
        if (Array.isArray(current)) {
          return `数组，共 ${current.length} 项`;
        }
        if (current && typeof current === 'object') {
          const keys = Object.keys(current);
          if (keys.length === 0) return '对象（空）';

          const previewFields: string[] = [];
          ['content', 'text', 'title', 'url', 'link', 'href'].forEach((key) => {
            if (key in current && typeof current[key] === 'string') {
              const val = current[key] as string;
              previewFields.push(
                `${key}: ${val.length > 40 ? val.substring(0, 40) + '...' : val}`,
              );
            }
          });
          if (previewFields.length > 0) {
            return previewFields.join('  |  ');
          }
          return `对象（${keys.length} 个字段）`;
        }

        return String(current);
      } catch {
        return null;
      }
    },
    [nodeOutputs],
  );

  // 获取所有可用的上游变量
  const availableVariables = useMemo(() => {
    if (!node) return [];

    const variables: VariableInfo[] = [];

    const upstreamNodes = edges
      .filter(edge => edge.target === node.id)
      .map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode;
      })
      .filter(Boolean) as Node[];

    upstreamNodes.forEach(upstreamNode => {
      const nodeType = upstreamNode.data?.type || upstreamNode.type;
      const nodeDef = nodeIODefinitions[nodeType];
      const nodeLabel = upstreamNode.data?.label || upstreamNode.id;

      if (nodeDef?.outputs) {
        nodeDef.outputs.forEach(outputVar => {
          variables.push({
            label: outputVar.label,
            value: `{{${upstreamNode.id}.${outputVar.variable}}}`,
            nodeId: upstreamNode.id,
            variable: outputVar.variable,
            description: outputVar.description || t('node.variables.fromNode', { node: nodeLabel, label: outputVar.label }) || `来自"${nodeLabel}"节点的${outputVar.label}`,
            nodeLabel,
            nodeType,
          });

          if (outputVar.type === 'object' || outputVar.type === 'any') {
            // 根据节点类型选择不同的常见字段
            let commonFields: Array<{ field: string; label: string }> = [];
            
            if (nodeType === 'dataclean') {
              // 数据清洗节点：添加更多字段，因为清洗后的数据可能包含各种字段
              commonFields = [
                { field: 'data', label: t('node.variables.fields.data') || '数据' },
                { field: 'content', label: t('node.variables.fields.content') || '内容' },
                { field: 'text', label: t('node.variables.fields.text') || '文本' },
                { field: 'title', label: t('node.variables.fields.title') || '标题' },
                { field: 'url', label: t('node.variables.fields.url') || 'URL地址' },
                { field: 'link', label: t('node.variables.fields.link') || '链接' },
                { field: 'href', label: t('node.variables.fields.href') || '超链接' },
                { field: 'src', label: t('node.variables.fields.src') || '资源地址' },
              ];
            } else {
              // 其他节点：使用默认字段
              commonFields = [
                { field: 'url', label: t('node.variables.fields.url') || 'URL地址' },
                { field: 'link', label: t('node.variables.fields.link') || '链接' },
                { field: 'href', label: t('node.variables.fields.href') || '超链接' },
                { field: 'src', label: t('node.variables.fields.src') || '资源地址' },
                { field: 'data', label: t('node.variables.fields.data') || '数据' },
                { field: 'text', label: t('node.variables.fields.text') || '文本' },
                { field: 'title', label: t('node.variables.fields.title') || '标题' },
                { field: 'content', label: t('node.variables.fields.content') || '内容' },
              ];
            }

            commonFields.forEach(field => {
              variables.push({
                label: `${outputVar.label}.${field.label}`,
                value: `{{${upstreamNode.id}.${outputVar.variable}.${field.field}}}`,
                nodeId: upstreamNode.id,
                variable: `${outputVar.variable}.${field.field}`,
                description: t('node.variables.fromNode', { node: nodeLabel, label: field.label }) || `来自"${nodeLabel}"节点的${field.label}`,
                nodeLabel,
                nodeType,
              });
            });
          }
        });
      }
    });

    return variables;
  }, [node, nodes, edges, t]);

  // 获取变量信息
  const getVariableInfo = useCallback((variable: string): VariableInfo | null => {
    return availableVariables.find(v => v.value === variable) || null;
  }, [availableVariables]);

  // 解析文本为部分（文本和变量）
  const parseTextToParts = useCallback((text: string): TextPart[] => {
    const result: TextPart[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
        });
      }

      result.push({
        type: 'variable',
        content: match[0],
        variable: match[0],
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return result.length > 0 ? result : [{ type: 'text', content: text }];
  }, []);

  // 从 contentEditable 提取纯文本（包含变量标记）
  const extractTextFromContentEditable = useCallback((): string => {
    if (!contentEditableRef.current) return '';
    
    let text = '';
    const children = contentEditableRef.current.childNodes;
    
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains(styles.variableTag)) {
          const variable = el.getAttribute('data-variable');
          if (variable) {
            text += variable;
          }
        } else {
          // 递归处理其他元素
          text += el.textContent || '';
        }
      }
    }

    return text;
  }, []);

  // 更新 contentEditable 内容的函数（先定义，供其他函数使用）
  const updateContentEditableContent = useCallback((text: string, onDeleteVariable?: (variable: string, e: Event) => void) => {
    if (!contentEditableRef.current) return;
    
    const parts = parseTextToParts(text);
    const fragment = document.createDocumentFragment();
    
    parts.forEach((part) => {
      if (part.type === 'variable') {
        const varInfo = getVariableInfo(part.variable!);
        const displayLabel = varInfo 
          ? `${varInfo.nodeLabel}.${varInfo.label.split('.').pop() || varInfo.label}`
          : part.variable!.replace(/\{\{|\}\}/g, '').split('.').slice(1).join('.') || part.variable!;
        
        const tagSpan = document.createElement('span');
        tagSpan.className = styles.variableTag;
        tagSpan.setAttribute('contentEditable', 'false');
        tagSpan.setAttribute('data-variable', part.variable!);
        
        const textSpan = document.createElement('span');
        textSpan.className = styles.variableTagText;
        textSpan.textContent = displayLabel;
        
        const deleteSpan = document.createElement('span');
        deleteSpan.className = styles.variableTagDelete;
        deleteSpan.innerHTML = '<svg viewBox="64 64 896 896" focusable="false" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3.1-3.6-7.6-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3.1 3.6 7.6 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"></path></svg>';
        if (onDeleteVariable) {
          deleteSpan.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteVariable(part.variable!, e);
          };
        }
        
        tagSpan.appendChild(textSpan);
        tagSpan.appendChild(deleteSpan);
        fragment.appendChild(tagSpan);
      } else {
        const textNode = document.createTextNode(part.content);
        fragment.appendChild(textNode);
      }
    });
    
    contentEditableRef.current.innerHTML = '';
    contentEditableRef.current.appendChild(fragment);
  }, [parseTextToParts, getVariableInfo]);

  // 删除变量
  const handleDeleteVariable = useCallback((variable: string, event: React.MouseEvent | React.KeyboardEvent | Event) => {
    if (event && 'preventDefault' in event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    const text = internalValue || '';
    const newValue = text.replace(variable, '');
    setInternalValue(newValue);
    
    if (textareaRef.current) {
      textareaRef.current.value = newValue;
    }
    
    if (onChange) {
      onChange(newValue);
    }
    
    // 重新渲染 contentEditable
    setTimeout(() => {
      updateContentEditableContent(newValue, handleDeleteVariable);
      if (contentEditableRef.current) {
        contentEditableRef.current.focus();
      }
    }, 0);
  }, [internalValue, onChange, updateContentEditableContent]);

  // 处理输入
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    isUserTypingRef.current = true;
    const text = extractTextFromContentEditable();
    setInternalValue(text);
    
    // 同步到隐藏的 textarea
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
    
    if (onChange) {
      onChange(text);
    }
    
    // 延迟重置标志，避免立即触发 useEffect
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 100);
  }, [extractTextFromContentEditable, onChange]);

  // 处理删除键
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        
        // 检查是否选中了变量标签
        let node = startContainer;
        while (node && node !== contentEditableRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains(styles.variableTag)) {
              const variable = el.getAttribute('data-variable');
              if (variable) {
                e.preventDefault();
                handleDeleteVariable(variable, e as any);
                return;
              }
            }
          }
          node = node.parentNode;
        }
      }
    }
  }, [handleDeleteVariable]);

  // 插入变量到光标位置
  const insertVariable = useCallback((variable: string) => {
    if (!contentEditableRef.current) return;
    
    const contentEditable = contentEditableRef.current;
    
    // 使用保存的 range，或者获取当前的 selection
    let range: Range;
    const selection = window.getSelection();
    
    // 优先使用保存的 range
    if (savedRangeRef.current) {
      range = savedRangeRef.current.cloneRange();
      savedRangeRef.current = null; // 清除保存的 range
    } else if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // 检查 container 是否在 contentEditable 内部
      let isInside = false;
      let node: Node | null = container;
      while (node) {
        if (node === contentEditable) {
          isInside = true;
          break;
        }
        node = node.parentNode;
      }
      
      if (!isInside) {
        // 如果不在，将光标移到 contentEditable 的末尾
        range = document.createRange();
        range.selectNodeContents(contentEditable);
        range.collapse(false); // 折叠到末尾
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    } else {
      // 如果没有选择，将光标移到 contentEditable 的末尾
      range = document.createRange();
      range.selectNodeContents(contentEditable);
      range.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    // 删除选中的内容（如果有）
    range.deleteContents();

      const varInfo = getVariableInfo(variable);
      const displayLabel = varInfo 
        ? `${varInfo.nodeLabel}.${varInfo.label.split('.').pop() || varInfo.label}`
        : variable.replace(/\{\{|\}\}/g, '').split('.').slice(1).join('.') || variable;

      // 创建变量标签元素
      const tagSpan = document.createElement('span');
      tagSpan.className = styles.variableTag;
      tagSpan.setAttribute('contentEditable', 'false');
      tagSpan.setAttribute('data-variable', variable);
      
      const textSpan = document.createElement('span');
      textSpan.className = styles.variableTagText;
      textSpan.textContent = displayLabel;
      
      const deleteSpan = document.createElement('span');
      deleteSpan.className = styles.variableTagDelete;
      deleteSpan.innerHTML = '<svg viewBox="64 64 896 896" focusable="false" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3.1-3.6-7.6-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3.1 3.6 7.6 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"></path></svg>';
      deleteSpan.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteVariable(variable, e as any);
      };
      
    tagSpan.appendChild(textSpan);
    tagSpan.appendChild(deleteSpan);
    
    // 在光标位置插入标签
    range.insertNode(tagSpan);
    
    // 移动光标到标签后
    const newRange = document.createRange();
    newRange.setStartAfter(tagSpan);
    newRange.collapse(true);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    // 更新值 - 从 DOM 提取文本（包含新插入的变量）
    const currentText = extractTextFromContentEditable();
    setInternalValue(currentText);
    if (textareaRef.current) {
      textareaRef.current.value = currentText;
    }
    if (onChange) {
      onChange(currentText);
    }

    setOpen(false);
    setSearchText('');
    
    // 确保 contentEditable 保持焦点
    contentEditable.focus();
  }, [getVariableInfo, extractTextFromContentEditable, onChange, handleDeleteVariable]);

  // 过滤变量
  const filteredVariables = useMemo(() => {
    if (!searchText) return availableVariables;
    const search = searchText.toLowerCase();
    return availableVariables.filter(v =>
      v.label.toLowerCase().includes(search) ||
      v.variable.toLowerCase().includes(search) ||
      v.value.toLowerCase().includes(search) ||
      (v.description && v.description.toLowerCase().includes(search))
    );
  }, [availableVariables, searchText]);

  const handleSelect = (variable: string) => {
    insertVariable(variable);
  };

  // 渲染内容（仅在初始化时使用，之后由 contentEditable 管理）
  const initialContent = useMemo(() => {
    if (!internalValue) return null;
    
    const parts = parseTextToParts(internalValue);
    return parts.map((part, index) => {
      if (part.type === 'variable') {
        const varInfo = getVariableInfo(part.variable!);
        const displayLabel = varInfo 
          ? `${varInfo.nodeLabel}.${varInfo.label.split('.').pop() || varInfo.label}`
          : part.variable!.replace(/\{\{|\}\}/g, '').split('.').slice(1).join('.') || part.variable!;
        
        return (
          <VariableTag
            key={`var-${index}`}
            variable={part.variable!}
            displayLabel={displayLabel}
            onDelete={handleDeleteVariable}
          />
        );
      }
      return <span key={`text-${index}`}>{part.content}</span>;
    });
  }, [internalValue, parseTextToParts, getVariableInfo, handleDeleteVariable]);

  // 当 internalValue 从外部变化时，更新 contentEditable
  // 但不要覆盖用户正在输入的内容
  const isUserTypingRef = useRef(false);
  
  useEffect(() => {
    if (contentEditableRef.current && internalValue !== undefined && !isUserTypingRef.current) {
      // 只有当 contentEditable 为空或者内容不匹配时才更新
      const currentText = extractTextFromContentEditable();
      if (currentText !== internalValue) {
        updateContentEditableContent(internalValue, handleDeleteVariable);
      }
    }
  }, [internalValue, updateContentEditableContent, extractTextFromContentEditable, handleDeleteVariable]);

  const popoverContent = (
    <div style={{ width: 400, maxHeight: 400 }}>
      {availableVariables.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
          <div style={{ marginBottom: 8 }}>{t('node.variables.noVariables') || '暂无可用变量'}</div>
          <div style={{ fontSize: 12 }}>
            {t('node.variables.noVariablesTip') || '请先连接上游节点，或直接输入变量表达式：'}{`{{nodeId.variable}}`}
          </div>
        </div>
      ) : (
        <>
          <AntdInput
            placeholder={t('node.variables.searchVariables') || '搜索变量...'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 12 }}
            allowClear
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <List
              size="small"
              dataSource={filteredVariables}
              renderItem={(item) => {
                const previewText = getVariablePreview(item.nodeId, item.variable);
                const content = (
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {item.variable.split('.').pop()}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                      <code
                        style={{
                          background: '#f5f5f5',
                          padding: '2px 4px',
                          borderRadius: 2,
                        }}
                      >
                        {item.value}
                      </code>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                        {item.description}
                      </div>
                    )}
                    {previewText && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#555',
                          marginTop: 2,
                          maxHeight: 40,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ color: '#8c8c8c', marginRight: 4 }}>预览:</span>
                        <span>{previewText}</span>
                      </div>
                    )}
                  </div>
                );

                return (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '8px 12px',
                    }}
                    onClick={() => handleSelect(item.value)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {previewText ? (
                      <Tooltip title={previewText} placement="right">
                        {content}
                      </Tooltip>
                    ) : (
                      content
                    )}
                  </List.Item>
                );
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  const minHeight = rows * 24 + 32; // 估算最小高度

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.contentEditableWrapper}>
        <div
          ref={contentEditableRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={styles.contentEditable}
          style={{ minHeight: `${minHeight}px` }}
          data-placeholder={placeholder}
        />
        <textarea
          ref={textareaRef}
          value={internalValue}
          readOnly
          className={styles.hiddenTextarea}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <Popover
        content={popoverContent}
        title={t('node.variables.selectVariable') || '选择变量'}
        trigger="click"
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
          // 当打开 Popover 时，保存当前光标位置
          if (newOpen && contentEditableRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const container = range.commonAncestorContainer;
              // 检查是否在 contentEditable 内部
              let node: Node | null = container;
              while (node) {
                if (node === contentEditableRef.current) {
                  savedRangeRef.current = range.cloneRange();
                  break;
                }
                node = node.parentNode;
              }
            }
          }
        }}
        placement="bottomLeft"
      >
        <Button
          type="default"
          icon={<ThunderboltOutlined />}
          size="small"
          className={styles.insertButton}
          title={t('node.variables.insertVariable') || '插入变量'}
        >
          {/* 这里只保留图标，移除文字，或者确保文字已正确翻译 */}
          {/* 如果需要显示文字，使用 Tooltip 或者确保按钮够宽 */}
          {/* 根据用户反馈，可能文字没显示出来，这里直接显示内容 */}
          {t('node.variables.insertVariable') || '插入变量'}
        </Button>
      </Popover>
    </div>
  );
};
