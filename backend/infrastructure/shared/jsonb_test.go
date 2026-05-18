package shared

import (
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"
)

func TestJSONBValueAndMarshalNil(t *testing.T) {
	j := JSONB{}

	value, err := j.Value()
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if value != nil {
		t.Fatalf("expected nil driver value, got %#v", value)
	}

	raw, err := json.Marshal(j)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if string(raw) != "null" {
		t.Fatalf("expected null, got %s", raw)
	}
}

func TestJSONBScanFromBytesAndString(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  map[string]interface{}
	}{
		{
			name:  "bytes",
			input: []byte(`{"name":"demo","count":2}`),
			want:  map[string]interface{}{"name": "demo", "count": float64(2)},
		},
		{
			name:  "string",
			input: `{"enabled":true}`,
			want:  map[string]interface{}{"enabled": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var j JSONB
			if err := j.Scan(tt.input); err != nil {
				t.Fatalf("expected nil error, got %v", err)
			}
			if !reflect.DeepEqual(j.Data, tt.want) {
				t.Fatalf("unexpected data: %#v", j.Data)
			}
		})
	}
}

func TestJSONBValueRoundTrip(t *testing.T) {
	original := JSONB{Data: map[string]interface{}{
		"items": []string{"a", "b"},
	}}

	value, err := original.Value()
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := value.([]byte); !ok {
		t.Fatalf("expected driver value to be []byte, got %T", value)
	}

	var scanned JSONB
	if err := scanned.Scan(value.(driver.Value)); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	got := scanned.Data.(map[string]interface{})
	items := got["items"].([]interface{})
	if len(items) != 2 || items[0] != "a" || items[1] != "b" {
		t.Fatalf("unexpected round-trip value: %#v", scanned.Data)
	}
}

func TestPtrReturnsIndependentAddress(t *testing.T) {
	got := Ptr("value")
	if got == nil || *got != "value" {
		t.Fatalf("unexpected pointer: %#v", got)
	}

	*got = "changed"
	if *got != "changed" {
		t.Fatalf("expected pointer to be writable")
	}
}
