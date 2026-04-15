package hub

import (
	"encoding/json"
	"sync"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/gorilla/websocket"
)

// Client 表示一个 WebSocket 连接（与用户绑定）
type Client struct {
	UserID uint
	Conn   *websocket.Conn
	Send   chan []byte
}

// Hub 维护所有在线用户的连接，按 userID 推送消息
type Hub struct {
	// userID -> 该用户的连接列表（支持多端）
	clients map[uint]map[*Client]struct{}
	mu      sync.RWMutex
}

// NewHub 创建 Hub
func NewHub() *Hub {
	return &Hub{
		clients: make(map[uint]map[*Client]struct{}),
	}
}

// Register 注册连接，绑定到 userID
func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[client.UserID] == nil {
		h.clients[client.UserID] = make(map[*Client]struct{})
	}
	h.clients[client.UserID][client] = struct{}{}
	count := len(h.clients[client.UserID])
	log.Printf("[notification hub] 连接已建立: userID=%d, 该用户当前连接数=%d", client.UserID, count)
	go client.writePump()
}

// Unregister 注销连接
func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m, ok := h.clients[client.UserID]; ok {
		delete(m, client)
		remaining := len(m)
		if remaining == 0 {
			delete(h.clients, client.UserID)
		}
		log.Printf("[notification hub] 连接已断开: userID=%d, 该用户剩余连接数=%d", client.UserID, remaining)
	}
	close(client.Send)
}

// SendToUser 向指定用户的所有连接推送消息（如新通知）
func (h *Hub) SendToUser(userID uint, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[notification hub] marshal payload: %v", err)
		return
	}
	h.mu.RLock()
	m, ok := h.clients[userID]
	numClients := 0
	if ok && m != nil {
		numClients = len(m)
	}
	h.mu.RUnlock()
	if numClients == 0 {
		log.Printf("[notification hub] 推送跳过: userID=%d 当前无在线连接", userID)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	sent := 0
	for c := range m {
		select {
		case c.Send <- data:
			sent++
		default:
			// 避免阻塞
		}
	}
	log.Printf("[notification hub] 已推送: userID=%d, 连接数=%d, 成功发送=%d", userID, numClients, sent)
}

// writePump 将 Send channel 中的数据写入 WebSocket
func (c *Client) writePump() {
	defer func() {
		c.Conn.Close()
	}()
	for msg := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}
