import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, Tooltip } from 'antd';
import styles from './BaseNode.module.scss';

export interface BaseNodeConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
  showInput?: boolean;
  showOutput?: boolean;
  inputCount?: number; // 输入端口数量（用于合并节点）
  outputCount?: number; // 输出端口数量（用于条件节点）
  forceMultipleInputs?: boolean;
  inputHandlePrefix?: string;
}

/**
 * 基础节点组件
 * 提供统一的节点外观和结构
 * 其他节点组件应该基于此组件进行封装
 */
const BaseNode: React.FC<NodeProps & BaseNodeConfig> = ({
  data,
  selected,
  icon,
  color,
  label,
  showInput = true,
  showOutput = true,
  inputCount = 1,
  outputCount = 1,
  forceMultipleInputs = false,
  inputHandlePrefix = 'input',
}) => {
  const displayLabel = data.label || label;
  const metaLines = Array.isArray((data as any).metaLines)
    ? ((data as any).metaLines as Array<string | number | null | undefined>)
        .filter((item) => item !== null && item !== undefined && String(item).trim())
        .map((item) => String(item))
    : [];
  const connectionDirection = data.connectionDirection || 'vertical';
  const diffMark = (data as any).diffMark; // 'add' | 'remove' | 'update' | undefined
  
  const diffClass = diffMark === 'add' ? styles.diffAdd :
                    diffMark === 'remove' ? styles.diffRemove :
                    diffMark === 'update' ? styles.diffUpdate : '';

  return (
    <div
      className={`${styles.baseNode} ${selected ? styles.selected : ''}`}
      data-node-type={data.type}
      style={{ ['--node-accent' as string]: color }}
    >
      {data.executionStatus && (
        <div
          className={`${styles.statusBadge} ${
            data.executionStatus === 'success'
              ? styles.status_success
              : data.executionStatus === 'failed'
              ? styles.status_failed
              : styles.status_pending
          }`}
        >
          {(() => {
            const color =
              data.executionStatus === 'success'
                ? '#52c41a'
                : data.executionStatus === 'failed'
                ? '#f5222d'
                : '#8c8c8c';
            if (data.executionStatus === 'success') {
              return (
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <path d="M2 6 L5 9 L10 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
            }
            if (data.executionStatus === 'failed') {
              return (
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <path d="M3 3 L9 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M9 3 L3 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              );
            }
            return (
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M2 6 L10 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            );
          })()}
        </div>
      )}
      {/* 输入端口 */}
      {showInput && (
        <>
          {inputCount === 1 && !forceMultipleInputs ? (
            // 单个输入端口
            connectionDirection === 'vertical' ? (
              <Handle
                type="target"
                position={Position.Top}
                id="input"
                className={styles.handle}
                style={{ left: '50%', transform: 'translateX(-50%)' }}
              />
            ) : (
              <Handle
                type="target"
                position={Position.Left}
                id="input"
                className={styles.handle}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            )
          ) : (
            // 多个输入端口（合并节点）
            connectionDirection === 'vertical' ? (
              <>
                {Array.from({ length: inputCount }).map((_, index) => (
                  <Handle
                    key={`${inputHandlePrefix}-${index}`}
                    type="target"
                    position={Position.Top}
                    id={`${inputHandlePrefix}-${index}`}
                    className={styles.handle}
                    style={{ left: `${((index + 1) * 100) / (inputCount + 1)}%` }}
                  />
                ))}
              </>
            ) : (
              <>
                {Array.from({ length: inputCount }).map((_, index) => (
                  <Handle
                    key={`${inputHandlePrefix}-${index}`}
                    type="target"
                    position={Position.Left}
                    id={`${inputHandlePrefix}-${index}`}
                    className={styles.handle}
                    style={{ top: `${((index + 1) * 100) / (inputCount + 1)}%` }}
                  />
                ))}
              </>
            )
          )}
        </>
      )}

      {/* 节点卡片 */}
      <Card
        size="small"
        variant="outlined"
        className={`${styles.nodeCard} ${diffClass}`}
        styles={{ body: { padding: '12px' }, header: { display: 'none', padding: 0, minHeight: 0 } }}
      >
        <div className={styles.nodeHeader}>
          <div className={styles.nodeIdentity}>
            <span className={styles.nodeIconBubble}>{icon}</span>
            <Tooltip title={label}>
              <div className={styles.nodePill}>
                <span className={styles.nodeTag}>{label}</span>
              </div>
            </Tooltip>
          </div>
        </div>
        <div className={styles.nodeContent}>
          <div className={styles.nodeTitleRow}>
            <Tooltip title={displayLabel}>
              <div className={styles.nodeTitle}>{displayLabel}</div>
            </Tooltip>
            {metaLines.length ? (
              <Tooltip
                title={
                  <div className={styles.metaTooltip}>
                    {metaLines.map((line, index) => (
                      <div key={`${line}-${index}`}>{line}</div>
                    ))}
                  </div>
                }
              >
                <button type="button" className={styles.nodeInfoTrigger} aria-label="查看节点详情">
                  !
                </button>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </Card>

      {/* 输出端口 */}
      {showOutput && (
        <>
          {outputCount === 1 ? (
            // 单个输出端口
            connectionDirection === 'vertical' ? (
              <Handle
                type="source"
                position={Position.Bottom}
                id="output"
                className={styles.handle}
                style={{ left: '50%', transform: 'translateX(-50%)' }}
              />
            ) : (
              <Handle
                type="source"
                position={Position.Right}
                id="output"
                className={styles.handle}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            )
          ) : (
            // 多个输出端口（条件节点）
            connectionDirection === 'vertical' ? (
              <>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id="true"
                  className={styles.handle}
                  style={{ background: 'rgba(82, 196, 26, 0.78)', left: '30%' }}
                />
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id="false"
                  className={styles.handle}
                  style={{ background: 'rgba(245, 34, 45, 0.74)', left: '70%' }}
                />
              </>
            ) : (
              <>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="true"
                  className={styles.handle}
                  style={{ background: 'rgba(82, 196, 26, 0.78)', top: '30%' }}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id="false"
                  className={styles.handle}
                  style={{ background: 'rgba(245, 34, 45, 0.74)', top: '70%' }}
                />
              </>
            )
          )}
        </>
      )}
    </div>
  );
};

export default BaseNode;
