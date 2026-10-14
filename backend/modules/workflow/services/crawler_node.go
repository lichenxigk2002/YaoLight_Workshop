package services

import (
	log "yaolight-workshop/backend/infrastructure/logx"

	"yaolight-workshop/backend/infrastructure/database"
	crawlerRepos "yaolight-workshop/backend/modules/crawler/repositories"
)

// executeCrawlerNode 执行爬虫节点
func (e *WorkflowExecutor) executeCrawlerNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	inputData, _ := dataFlow.GetNodeInputData(node.ID)

	finalURL, urlErr := e.resolveCrawlerNodeURL(node, inputData, variableContext)
	if urlErr != nil {
		return *urlErr
	}

	ruleID := getCrawlerRuleID(node.Config)

	var (
		configErr error
		usedRule  bool
	)

	config, err := e.buildCrawlerConfigFromNode(node, finalURL, variableContext)
	if ruleID > 0 {
		config, configErr = e.buildCrawlerConfigFromRule(node, ruleID, finalURL, variableContext)
		usedRule = configErr == nil
	} else {
		configErr = err
	}

	if configErr != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   configErr.Error(),
		}
	}

	ruleRepo := crawlerRepos.NewCrawlerRuleRepository(database.DB)
	if usedRule {
		if err := ruleRepo.IncrementUsage(ruleID); err != nil {
			log.Printf("increment crawler rule usage failed: rule=%d err=%v", ruleID, err)
		}
	}

	result, err := e.crawlerService.Execute(config)
	if usedRule {
		success := err == nil && result != nil && result.Success
		if metricErr := ruleRepo.UpdateMetrics(ruleID, success); metricErr != nil {
			log.Printf("update crawler rule metrics failed: rule=%d err=%v", ruleID, metricErr)
		}
	}
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   err.Error(),
		}
	}

	if !result.Success {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   result.Error,
		}
	}

	outputData := make(map[string]interface{})
	if resultData, ok := result.Data.(map[string]interface{}); ok {
		if data, exists := resultData["data"]; exists {
			outputData["data"] = data
		} else {
			outputData["data"] = resultData
		}
		if html, exists := resultData["html"]; exists {
			outputData["html"] = html
		} else if rawHTML, exists := resultData["raw_html"]; exists {
			outputData["html"] = rawHTML
		}
		if text, exists := resultData["text"]; exists {
			outputData["text"] = text
		} else if extracted, ok := resultData["extracted"].(map[string]interface{}); ok {
			if text, exists := extracted["text"]; exists {
				outputData["text"] = text
			}
		}
	} else {
		outputData["data"] = result.Data
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "crawler",
		Success: true,
		Data:    outputData,
	}
}
