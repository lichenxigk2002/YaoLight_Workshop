package controllers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
	"yaolight-workshop/backend/infrastructure/cache"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/user/services"
)

// OAuthController OAuth 登录控制器
type OAuthController struct {
	authService *services.AuthService
}

// NewOAuthController 创建 OAuth 控制器
func NewOAuthController(authService *services.AuthService) *OAuthController {
	return &OAuthController{authService: authService}
}

func (c *OAuthController) redirectURI(ctx *gin.Context, path string) string {
	scheme := "http"
	if ctx.Request.TLS != nil {
		scheme = "https"
	}
	if ctx.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + ctx.Request.Host + "/api/auth" + path
}

// GoogleRedirect 跳转到 Google 授权页（state 可为 bind_xxx 表示绑定流程）
func (c *OAuthController) GoogleRedirect(ctx *gin.Context) {
	if config.GoogleClientID == "" || config.GoogleClientSecret == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=google_not_configured")
		return
	}
	state := ctx.Query("state")
	if state == "" {
		state = "state"
	}
	conf := &oauth2.Config{
		ClientID:     config.GoogleClientID,
		ClientSecret: config.GoogleClientSecret,
		RedirectURL:  c.redirectURI(ctx, "/google/callback"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     google.Endpoint,
	}
	url := conf.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"))
	ctx.Redirect(302, url)
}

// GoogleCallback 处理 Google 回调：绑定流程或登录流程
func (c *OAuthController) GoogleCallback(ctx *gin.Context) {
	if config.GoogleClientID == "" || config.GoogleClientSecret == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=google_not_configured")
		return
	}
	code := ctx.Query("code")
	state := ctx.Query("state")
	if code == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=missing_code")
		return
	}
	conf := &oauth2.Config{
		ClientID:     config.GoogleClientID,
		ClientSecret: config.GoogleClientSecret,
		RedirectURL:  c.redirectURI(ctx, "/google/callback"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     google.Endpoint,
	}
	tok, err := conf.Exchange(ctx.Request.Context(), code)
	if err != nil {
		log.Printf("Google OAuth exchange error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=oauth_exchange_failed")
		return
	}
	client := conf.Client(ctx.Request.Context(), tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		log.Printf("Google userinfo error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=userinfo_failed")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var u struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &u); err != nil {
		log.Printf("Google userinfo parse error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=userinfo_parse_failed")
		return
	}
	// 绑定流程：state=bind_xxx，已登录用户把当前账号绑定 Google
	if strings.HasPrefix(state, "bind_") {
		token := strings.TrimPrefix(state, "bind_")
		userID, ok := cache.GetOAuthBindCache().Get(token)
		cache.GetOAuthBindCache().Delete(token)
		if !ok || userID == 0 {
			ctx.Redirect(302, config.FrontendURL+"/settings/profile?error=bind_expired")
			return
		}
		if err := c.authService.OAuthBind(userID, "google", u.ID, u.Email, u.Name, u.Picture); err != nil {
			log.Printf("OAuth bind error: %v", err)
			ctx.Redirect(302, config.FrontendURL+"/settings/profile?error=bind_failed")
			return
		}
		ctx.Redirect(302, config.FrontendURL+"/settings/profile?oauth=bound")
		return
	}
	loginResp, err := c.authService.OAuthLogin("google", u.ID, u.Email, u.Name, u.Picture)
	if err != nil {
		log.Printf("OAuth login error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=login_failed")
		return
	}
	redirectURL := config.FrontendURL + "/login?token=" + loginResp.Token
	ctx.Redirect(302, redirectURL)
}

// GitHubRedirect 跳转到 GitHub 授权页（state 可为 bind_xxx 表示绑定流程）
func (c *OAuthController) GitHubRedirect(ctx *gin.Context) {
	if config.GitHubClientID == "" || config.GitHubClientSecret == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=github_not_configured")
		return
	}
	state := ctx.Query("state")
	if state == "" {
		state = "state"
	}
	conf := &oauth2.Config{
		ClientID:     config.GitHubClientID,
		ClientSecret: config.GitHubClientSecret,
		RedirectURL:  c.redirectURI(ctx, "/github/callback"),
		Scopes:       []string{"user:email", "read:user"},
		Endpoint:     github.Endpoint,
	}
	url := conf.AuthCodeURL(state)
	ctx.Redirect(302, url)
}

// GitHubCallback 处理 GitHub 回调：绑定流程或登录流程
func (c *OAuthController) GitHubCallback(ctx *gin.Context) {
	if config.GitHubClientID == "" || config.GitHubClientSecret == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=github_not_configured")
		return
	}
	code := ctx.Query("code")
	state := ctx.Query("state")
	if code == "" {
		ctx.Redirect(302, config.FrontendURL+"/login?error=missing_code")
		return
	}
	conf := &oauth2.Config{
		ClientID:     config.GitHubClientID,
		ClientSecret: config.GitHubClientSecret,
		RedirectURL:  c.redirectURI(ctx, "/github/callback"),
		Scopes:       []string{"user:email", "read:user"},
		Endpoint:     github.Endpoint,
	}
	tok, err := conf.Exchange(ctx.Request.Context(), code)
	if err != nil {
		log.Printf("GitHub OAuth exchange error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=oauth_exchange_failed")
		return
	}
	client := conf.Client(ctx.Request.Context(), tok)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		log.Printf("GitHub user error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=userinfo_failed")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var u struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		Email     string `json:"email"`
	}
	if err := json.Unmarshal(body, &u); err != nil {
		log.Printf("GitHub user parse error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=userinfo_parse_failed")
		return
	}
	oauthID := strconv.Itoa(u.ID)
	name := u.Name
	if name == "" {
		name = u.Login
	}
	email := u.Email
	if email == "" {
		email, _ = c.fetchGitHubPrimaryEmail(client)
	}
	// 绑定流程：state=bind_xxx
	if strings.HasPrefix(state, "bind_") {
		token := strings.TrimPrefix(state, "bind_")
		userID, ok := cache.GetOAuthBindCache().Get(token)
		cache.GetOAuthBindCache().Delete(token)
		if !ok || userID == 0 {
			ctx.Redirect(302, config.FrontendURL+"/settings/profile?error=bind_expired")
			return
		}
		if err := c.authService.OAuthBind(userID, "github", oauthID, email, name, u.AvatarURL); err != nil {
			log.Printf("OAuth bind error: %v", err)
			ctx.Redirect(302, config.FrontendURL+"/settings/profile?error=bind_failed")
			return
		}
		ctx.Redirect(302, config.FrontendURL+"/settings/profile?oauth=bound")
		return
	}
	loginResp, err := c.authService.OAuthLogin("github", oauthID, email, name, u.AvatarURL)
	if err != nil {
		log.Printf("OAuth login error: %v", err)
		ctx.Redirect(302, config.FrontendURL+"/login?error=login_failed")
		return
	}
	redirectURL := config.FrontendURL + "/login?token=" + loginResp.Token
	ctx.Redirect(302, redirectURL)
}

func (c *OAuthController) fetchGitHubPrimaryEmail(client *http.Client) (string, error) {
	resp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}
	for _, e := range emails {
		if e.Primary {
			return e.Email, nil
		}
	}
	if len(emails) > 0 {
		return emails[0].Email, nil
	}
	return "", nil
}
