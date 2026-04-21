package services

import (
	"fmt"
	"strconv"
	"strings"

	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	workflowServices "yaolight-workshop/backend/modules/workflow/services"
)

func validateContractSchema(value interface{}, schema interface{}, path string) error {
	if schema == nil {
		return nil
	}

	schemaMap, ok := schema.(map[string]interface{})
	if !ok || len(schemaMap) == 0 {
		return nil
	}

	if path == "" {
		path = "input"
	}

	if enumValues, ok := schemaMap["enum"].([]interface{}); ok && len(enumValues) > 0 {
		matched := false
		for _, item := range enumValues {
			if fmt.Sprintf("%v", item) == fmt.Sprintf("%v", value) {
				matched = true
				break
			}
		}
		if !matched {
			return fmt.Errorf("%s must match one of enum values", path)
		}
	}

	schemaType, _ := schemaMap["type"].(string)
	switch strings.ToLower(strings.TrimSpace(schemaType)) {
	case "", "any":
		return nil
	case "object":
		obj, ok := value.(map[string]interface{})
		if !ok {
			return fmt.Errorf("%s must be an object", path)
		}

		if requiredFields, ok := schemaMap["required"].([]interface{}); ok {
			for _, field := range requiredFields {
				name := strings.TrimSpace(fmt.Sprintf("%v", field))
				if name == "" {
					continue
				}
				if _, exists := obj[name]; !exists {
					return fmt.Errorf("%s.%s is required", path, name)
				}
			}
		}

		properties, _ := schemaMap["properties"].(map[string]interface{})
		for name, childSchema := range properties {
			childValue, exists := obj[name]
			if !exists {
				continue
			}
			if err := validateContractSchema(childValue, childSchema, path+"."+name); err != nil {
				return err
			}
		}
		return nil
	case "array":
		items, ok := value.([]interface{})
		if !ok {
			return fmt.Errorf("%s must be an array", path)
		}
		itemSchema := schemaMap["items"]
		if itemSchema == nil {
			return nil
		}
		for idx, item := range items {
			if err := validateContractSchema(item, itemSchema, fmt.Sprintf("%s[%d]", path, idx)); err != nil {
				return err
			}
		}
		return nil
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("%s must be a string", path)
		}
		return nil
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("%s must be a boolean", path)
		}
		return nil
	case "integer":
		if !isIntegerValue(value) {
			return fmt.Errorf("%s must be an integer", path)
		}
		return nil
	case "number":
		if _, ok := contractToFloat64(value); !ok {
			return fmt.Errorf("%s must be a number", path)
		}
		return nil
	default:
		return nil
	}
}

func isIntegerValue(value interface{}) bool {
	switch v := value.(type) {
	case int, int32, int64, uint, uint32, uint64:
		return true
	case float64:
		return v == float64(int64(v))
	case string:
		_, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		return err == nil
	default:
		return false
	}
}

func contractToFloat64(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case int:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	case float32:
		return float64(v), true
	case float64:
		return v, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}

func applyContractMapping(source interface{}, mapping interface{}) interface{} {
	if mapping == nil {
		return source
	}

	mappingMap, ok := mapping.(map[string]interface{})
	if !ok || len(mappingMap) == 0 {
		return source
	}

	result := map[string]interface{}{}
	for targetPath, rule := range mappingMap {
		if strings.TrimSpace(targetPath) == "" {
			continue
		}
		value := resolveMappingRule(source, rule)
		setValueAtPath(result, targetPath, value)
	}
	return result
}

func resolveMappingRule(source interface{}, rule interface{}) interface{} {
	switch v := rule.(type) {
	case string:
		return getValueAtPath(source, v)
	case map[string]interface{}:
		if literal, ok := v["value"]; ok {
			return literal
		}
		path := ""
		if rawPath, ok := v["path"].(string); ok {
			path = rawPath
		}
		value := getValueAtPath(source, path)
		if value == nil {
			if fallback, ok := v["default"]; ok {
				return fallback
			}
		}
		return value
	default:
		return v
	}
}

func getValueAtPath(source interface{}, path string) interface{} {
	path = strings.TrimSpace(path)
	if path == "" || path == "." {
		return source
	}
	value, found, err := workflowServices.TryGetDataByPath(source, path)
	if err != nil || !found {
		return nil
	}
	return value
}

func setValueAtPath(target map[string]interface{}, path string, value interface{}) {
	parts := strings.Split(strings.TrimSpace(path), ".")
	if len(parts) == 0 {
		return
	}

	current := target
	for idx, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return
		}

		if idx == len(parts)-1 {
			current[part] = value
			return
		}

		next, ok := current[part].(map[string]interface{})
		if !ok {
			next = map[string]interface{}{}
			current[part] = next
		}
		current = next
	}
}

func normalizeArtifactExposure(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "none":
		return "none"
	case "selected":
		return "selected"
	default:
		return "all"
	}
}

func toStringSet(raw interface{}) map[string]struct{} {
	out := map[string]struct{}{}
	items, ok := raw.([]interface{})
	if !ok {
		return out
	}
	for _, item := range items {
		text := strings.TrimSpace(fmt.Sprintf("%v", item))
		if text == "" {
			continue
		}
		out[text] = struct{}{}
	}
	return out
}

func filterArtifactsByExposure(artifacts []artifactModels.Artifact, exposeMode string, exposedNodeIDs map[string]struct{}) []artifactModels.Artifact {
	switch exposeMode {
	case "none":
		return nil
	case "selected":
		if len(exposedNodeIDs) == 0 {
			return nil
		}
		filtered := make([]artifactModels.Artifact, 0, len(artifacts))
		for _, item := range artifacts {
			if _, ok := exposedNodeIDs[item.NodeID]; ok {
				filtered = append(filtered, item)
			}
		}
		return filtered
	default:
		return artifacts
	}
}
