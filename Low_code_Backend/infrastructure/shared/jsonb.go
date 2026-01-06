package shared

import (
	"database/sql/driver"
	"encoding/json"
)

// JSONB 自定义JSONB类型，用于PostgreSQL的JSONB字段
// 支持对象（map）和数组（slice）
type JSONB struct {
	Data interface{}
}

// Value 实现driver.Valuer接口
func (j JSONB) Value() (driver.Value, error) {
	if j.Data == nil {
		return nil, nil
	}
	return json.Marshal(j.Data)
}

// Scan 实现sql.Scanner接口
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		j.Data = nil
		return nil
	}

	var bytes []byte
	var ok bool

	// 处理不同类型的输入
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		// 尝试转换为字节
		if bytes, ok = value.([]byte); !ok {
			return nil
		}
	}

	// 先尝试解析为 interface{}，支持对象和数组
	var result interface{}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return err
	}

	j.Data = result
	return nil
}

// MarshalJSON 实现 json.Marshaler 接口
func (j JSONB) MarshalJSON() ([]byte, error) {
	if j.Data == nil {
		return []byte("null"), nil
	}
	return json.Marshal(j.Data)
}

// UnmarshalJSON 实现 json.Unmarshaler 接口
func (j *JSONB) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		j.Data = nil
		return nil
	}
	return json.Unmarshal(data, &j.Data)
}
