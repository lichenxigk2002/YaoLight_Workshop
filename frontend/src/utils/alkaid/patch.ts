import { Node, Edge } from 'reactflow';
import { 
    NodeData, 
    EdgeData, 
    transformNodesFromLoadFormat, 
    transformEdgesFromLoadFormat 
} from '../workflowTransformers';
import { PatchItem } from '../../components/Alkaid/types/progress';

export type PatchOp = 'add' | 'remove' | 'set' | 'set_edges';

export interface PatchItemExt extends Omit<PatchItem, 'node' | 'value'> {
  id: string; // local unique id for UI
  selected: boolean;
  targetType: 'node' | 'edge' | 'graph';
  node?: NodeData; // Backend sends NodeData
  value?: unknown; // Could be EdgeData[] or field value
}

export interface PatchPreviewResult {
  nodes: Node[];
  edges: Edge[];
  nodeMark: Record<string, 'add' | 'remove' | 'update' | 'none'>;
  edgeMark: Record<string, 'add' | 'remove' | 'update' | 'none'>;
}

/**
 * Apply patches to current graph for preview purpose.
 * Generates a "visual graph" that includes removed nodes (marked as 'remove')
 * and new nodes (marked as 'add').
 */
export function applyPatchForPreview(
  currentNodes: Node[],
  currentEdges: Edge[],
  patchList: PatchItemExt[],
  getNodeLabel: (type: string) => string = (t) => t
): PatchPreviewResult {
  // Deep copy to avoid mutating original
  const nodes = JSON.parse(JSON.stringify(currentNodes)) as Node[];
  const edges = JSON.parse(JSON.stringify(currentEdges)) as Edge[];
  
  const nodeMark: Record<string, 'add' | 'remove' | 'update' | 'none'> = {};
  const edgeMark: Record<string, 'add' | 'remove' | 'update' | 'none'> = {};

  // Indexing for fast access
  const nodesById = new Map(nodes.map(n => [n.id, n]));
  
  // 1. Process Nodes
  for (const patch of patchList) {
    if (!patch.selected) continue;

    if (patch.op === 'add' && patch.node) {
        // Transform NodeData to Node
        const newNodes = transformNodesFromLoadFormat([patch.node], getNodeLabel);
        if (newNodes.length > 0) {
            const newNode = newNodes[0];
            if (nodesById.has(newNode.id)) {
                 // Overwrite logic: update existing node
                 // Backend appends new node effectively replacing the old one's data.
                 // We should replace, not merge, to match backend behavior.
                 const idx = nodes.findIndex(n => n.id === newNode.id);
                 if (idx !== -1) {
                     nodes[idx] = newNode;
                 }
                 nodesById.set(newNode.id, newNode);
                 nodeMark[newNode.id] = 'update';
            } else {
                nodes.push(newNode);
                nodesById.set(newNode.id, newNode);
                nodeMark[newNode.id] = 'add';
            }
        }
    } else if (patch.op === 'remove' && patch.nodeId) {
        if (nodesById.has(patch.nodeId)) {
            // Mark as removed, do NOT delete from array yet (for visual diff)
            nodeMark[patch.nodeId] = 'remove';
        }
    } else if (patch.op === 'set' && patch.nodeId) {
        const node = nodesById.get(patch.nodeId);
        if (node) {
            if (patch.path === 'data' && patch.value) {
                // Backend replaces the entire data object, so we must do the same.
                // Previous logic was merging: node.data = { ...node.data, ...(patch.value as object) };
                node.data = patch.value as object;
                nodeMark[patch.nodeId] = 'update';
            } else if (patch.path === 'position' && patch.value) {
                // Backend replaces the entire position object.
                node.position = patch.value as any;
                nodeMark[patch.nodeId] = 'update';
            }
        }
    }
  }

  // 2. Process Edges (set_edges)
  // set_edges replaces the WHOLE edge list.
  let targetEdges: Edge[] = [...edges]; 
  let edgesReplaced = false;

  for (const patch of patchList) {
      if (!patch.selected) continue;
      if (patch.op === 'set_edges' && Array.isArray(patch.value)) {
          const newEdgeData = patch.value as EdgeData[];
          targetEdges = transformEdgesFromLoadFormat(newEdgeData);
          edgesReplaced = true;
      }
  }

  if (edgesReplaced) {
      // Diff logic
      const targetEdgeIds = new Set(targetEdges.map(e => e.id));
      const currentEdgeIds = new Set(edges.map(e => e.id));

      // Mark removed: Edges in current but not in target
      for (const edge of edges) {
          if (!targetEdgeIds.has(edge.id)) {
              edgeMark[edge.id] = 'remove';
          }
      }

      // Mark added: Edges in target but not in current
      for (const edge of targetEdges) {
          if (!currentEdgeIds.has(edge.id)) {
              edges.push(edge);
              edgeMark[edge.id] = 'add';
          }
          // Edges in both are kept implicitly (already in edges array)
      }
  }

  // 3. Consistency Check: Remove edges connected to removed nodes
  // If a node is marked 'remove', any edge connected to it should also be marked 'remove'.
  for (const edge of edges) {
      const sourceMark = nodeMark[edge.source];
      const targetMark = nodeMark[edge.target];
      if (sourceMark === 'remove' || targetMark === 'remove') {
          edgeMark[edge.id] = 'remove';
      }
  }

  return { nodes, edges, nodeMark, edgeMark };
}

/**
 * Get the clean graph for saving (stripping removed items)
 */
export function getFinalGraphFromPreview(
    previewResult: PatchPreviewResult
): { nodes: Node[], edges: Edge[] } {
    // 1. Filter out nodes marked as 'remove'
    const nodes = previewResult.nodes.filter(n => previewResult.nodeMark[n.id] !== 'remove')
        .map(n => {
            // Clean up diffMark from data
            const newData = { ...n.data };
            if ('diffMark' in newData) {
                delete newData.diffMark;
            }
            // Clean up style borders injected during preview
            const newStyle = { ...n.style };
            if (newStyle.border) delete newStyle.border;
            if (newStyle.backgroundColor) delete newStyle.backgroundColor;
            if (newStyle.opacity) delete newStyle.opacity;
            
            return { ...n, data: newData, style: newStyle };
        });

    // 2. Filter out edges marked as 'remove'
    let edges = previewResult.edges.filter(e => previewResult.edgeMark[e.id] !== 'remove')
        .map(e => {
            // Clean up edge styles
            const newStyle = { ...e.style };
            if (newStyle.stroke) delete newStyle.stroke;
            if (newStyle.strokeWidth) delete newStyle.strokeWidth;
            if (newStyle.strokeDasharray) delete newStyle.strokeDasharray;
            
            return { ...e, style: newStyle, animated: false }; // Reset animation if it was added for preview
        });
    
    // 3. Final safety check: remove edges with dangling source/target
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    
    return { nodes, edges };
}
