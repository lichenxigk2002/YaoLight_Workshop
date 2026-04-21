package controllers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	workflowAPIServices "yaolight-workshop/backend/modules/workflowapi/services"
)

func TestWriteErrorMapsValidationFailuresToBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	controller := &WorkflowAPIController{}
	controller.writeError(ctx, workflowAPIServices.ErrValidationFailed)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected validation errors to map to 400, got %d", recorder.Code)
	}
}

func TestWriteErrorMapsWrappedValidationFailuresToBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	controller := &WorkflowAPIController{}
	controller.writeError(ctx, errors.Join(workflowAPIServices.ErrValidationFailed, errors.New("input.url is required")))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected wrapped validation errors to map to 400, got %d", recorder.Code)
	}
}
