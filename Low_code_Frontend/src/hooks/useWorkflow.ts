import { useState, useCallback } from 'react'
import { Node, Edge } from 'reactflow'
import { workflowApi } from '../api/workflow'
import { message } from 'antd'

// 工作流相关Hook
export const useWorkflow = () => {
  const [loading, setLoading] = useState(false)

  // 执行工作流
  const executeWorkflow = useCallback(async (nodes: Node[], edges: Edge[]) => {
    setLoading(true)
    try {
      const executionData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type || 'default',
          config: node.data.config || {},
        })),
        edges: edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
        })),
      }

      const result = await workflowApi.executeWorkflow(executionData)
      
      if (result.success) {
        message.success(`工作流执行完成！共执行 ${result.results.length} 个节点`)
      } else {
        message.warning('工作流执行完成，但有部分节点失败')
      }
      
      return result
    } catch (error: any) {
      message.error(`工作流执行失败: ${error.message || '未知错误'}`)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    executeWorkflow,
  }
}

