# 把 OpenRouter 代理真正跑通：一次服务器部署排障记录

这次做的事，表面上只是“让服务器也能用 GPT、Claude、Gemini”。真动手以后才发现，问题根本不在模型本身，而在一整条链路里：宿主机网络、代理客户端、Docker 容器、Compose 环境变量、CI/CD 发布策略，最后才轮到应用代码。

我把这次过程整理下来，不是为了展示命令有多复杂，而是因为这种问题特别典型。很多时候本地能用、服务器不能用，最后都不是“代码不行”，而是部署层有一两处认识偏差，正好卡在最关键的地方。

## 起点：本地正常，服务器报地区限制

项目里 `gpt`、`claude`、`gemini`、`grok` 这些能力，实际上都走的是 OpenRouter。我的本地环境开了代理，所以一直没问题。放到服务器上以后，请求直接报错：

```text
API request failed with status 403:
{"error":{"message":"This model is not available in your region.","code":403}}
```

最开始很容易误判，以为是模型配置错了，或者 OpenRouter 的 key 有问题。后来才确认，问题其实很直接：服务器出口地区不被 OpenRouter 某些模型接受。

这件事一旦确认，方向就变清楚了。不是去改业务逻辑，而是让服务器上的 OpenRouter 请求走代理，而且只让这几个 provider 走，别把其他能力一起带偏。

## 第一层判断：不要上来就开全局代理

这类问题最危险的处理方式，就是直接在机器上开全局代理，然后希望一切自己变好。短期可能能通，长期基本一定出问题。

这个项目里还有很多别的外部能力：

- 支付
- OAuth
- 数据库和 Redis 的连接
- 爬虫
- 国内模型 provider

这些东西没必要为了 OpenRouter 一起走代理。更稳的做法，是把代理控制在应用层，只让 OpenRouter 相关 provider 走代理。

所以后面的改法不是“给服务器配代理”，而是“给后端里这几个 provider 单独配代理”。

## 第二层判断：容器里的 127.0.0.1 不是宿主机

这是这次最关键、也最容易踩的坑。

一开始的直觉是：宿主机上把代理开在 `127.0.0.1:7890`，应用里填这个地址就行。这个想法在非容器环境下没问题，但项目部署在 Docker 里，backend 是个容器。

一旦进了容器，`127.0.0.1` 指向的是容器自己，不是宿主机。

这就意味着：即使宿主机上的代理开在 `127.0.0.1:7890`，容器里也不能直接填这个地址。容器要访问宿主机，需要一个宿主机可解析的入口，比如：

```env
OPENROUTER_PROXY_URL=http://host.docker.internal:7890
```

同时，Compose 里还得加：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

这个地方没理顺，后面所有测试都会出现一种很迷惑的现象：宿主机自己 curl 能通，应用里还是不通。

## 第三层判断：.env 写了，不等于容器拿到了

这次还有一个很典型的问题：服务器 `.env` 里明明已经写了：

```env
OPENROUTER_PROXY_URL=http://host.docker.internal:7890
```

但容器里实际 `printenv` 一看，什么都没有。

问题不在 `.env`，而在 Compose。

很多人会默认以为 `.env` 里的变量会自动进入容器，其实不是。`.env` 只是变量来源，真正要不要注入到容器，还是看 `docker-compose.yml` 有没有显式透传。

所以测试环境和生产环境的 Compose 里，都要给 `backend` 和 `migrate` 增加这些变量：

```yaml
AI_HTTP_PROXY_URL: ${AI_HTTP_PROXY_URL:-}
OPENROUTER_PROXY_URL: ${OPENROUTER_PROXY_URL:-}
GPT_PROXY_URL: ${GPT_PROXY_URL:-}
CLAUDE_PROXY_URL: ${CLAUDE_PROXY_URL:-}
GEMINI_PROXY_URL: ${GEMINI_PROXY_URL:-}
GROK_PROXY_URL: ${GROK_PROXY_URL:-}
```

只有做完这一步，后端容器才真的会开始尝试走代理。

## 第四层判断：代理开着，不代表容器能连上

中间有一段时间，错误从“地区不支持”变成了：

```text
proxyconnect tcp: dial tcp 172.17.0.1:7890: connect: connection refused
```

这个错误其实是个好消息，因为它说明应用已经开始尝试走代理了。问题不再是应用没用代理，而是代理没被正确暴露给容器。

继续往下查，发现 `mihomo` 当时只监听了：

```text
127.0.0.1:7890
```

而 Docker 容器访问宿主机时，走的是类似 `172.17.0.1:7890` 这样的地址。宿主机只绑回环地址，容器自然连不上。

最后把 `mihomo` 配成：

```yaml
allow-lan: true
bind-address: 0.0.0.0
```

监听变成：

```text
*:7890
```

容器这层才真正打通。

这个细节特别重要。很多“宿主机 curl 正常、容器请求失败”的问题，根因都是监听地址太保守，而不是代理客户端没启动。

## 第五层判断：代理通了，节点地区未必对

最绕的一段，是代理已经通了，但 OpenRouter 还是报：

```text
This model is not available in your region.
```

继续查代理出口 IP，结果发现当前出口在香港：

```json
{
  "ip": "103.17.98.27",
  "country": "HK"
}
```

这时候问题就不是代码、容器、配置了，而是节点本身。

机场订阅里虽然有美国、日本、新加坡节点，但 `mihomo` 默认挑到的未必是这些。它可能因为延迟或者默认策略，优先选到香港。对某些服务来说，香港也许足够；对 OpenRouter 某些模型来说，不够。

最后的处理思路很简单：不要让它“自动随便选”，而是显式限制候选节点范围。

我最终把 `proxy-groups` 调整成优先美国，其次日本、新加坡的策略。这个改动不花哨，但非常有效。很多时候所谓“代理没用”，其实不是代理失效，而是代理出口选错了。

## 第六层判断：CI/CD 的问题，不能怪到代理头上

这次还顺手暴露出一个和代理无关、但对部署影响很大的问题。

原来的 CI/CD 在测试和生产环境里，都是全量 `compose up`。流程大概是：

```bash
docker compose pull
docker compose up -d postgres redis
docker compose run --rm backend migrate
docker compose up -d
```

一跑就炸，错误表面上看起来很吓人：

```text
redis Error Get "https://registry-1.docker.io/v2/": context deadline exceeded
postgres Error context canceled
```

这很容易让人误会成“是不是我们改了代理配置，把 Docker 搞坏了”。其实不是。

真正的问题是：服务器拉 Docker Hub 基础镜像不稳定，而 CI/CD 每次都去碰 `postgres` 和 `redis`，把一个本来不该在这次发布里出现的问题也拉进来了。

后来把 workflow 改成只更新应用容器：

```bash
docker compose pull backend frontend
docker compose run --rm backend migrate
docker compose up -d backend frontend
```

这个问题就干净很多。

这件事给我的启发很明确：数据库和缓存这种基础设施服务，不该和前后端代码一起每次全量重部署。部署链路越“贪心”，排障成本越高。

## 这次最有价值的收获，不是命令，是排查顺序

回头看，这次真正有价值的不是哪一行配置，而是排查顺序终于顺了。

以前遇到这类问题，很容易在应用层来回怀疑：

- 是不是 key 不对
- 是不是模型名错了
- 是不是 OpenRouter 本身抽风

这次的经验反过来告诉我，更靠谱的顺序应该是：

1. 先确认宿主机出网是否正常
2. 再确认宿主机代理是否可用
3. 再确认代理出口地区到底在哪
4. 再确认容器能不能访问宿主机代理
5. 再确认 Compose 是否把变量传进容器
6. 最后再看应用代码和 provider 配置

这个顺序一旦建立起来，很多原本看起来像“玄学”的问题，其实都能一层层拆开。

## 最终方案，其实并不复杂

把整个过程收束一下，最后真正稳定的方案其实很朴素：

- 宿主机安装 `mihomo`
- `mihomo` 监听 `0.0.0.0:7890`
- `mihomo` 节点优先选美国、日本、新加坡
- Docker Compose 通过 `host.docker.internal` 把宿主机代理暴露给容器
- 后端代码只让 OpenRouter 相关 provider 走代理
- CI/CD 只更新前后端，不动 `postgres/redis`

方案不复杂，复杂的是走到这个方案前，必须把一堆隐含前提一个个排干净。

## 最后

这次折腾下来，我最大的感受不是“又学会了一套代理配置”，而是对部署环境这件事更有敬畏了。

本地能跑通，很多时候只是开始。真正决定系统能不能稳定上线的，往往是那些平时不太显眼的东西：网络出口、容器边界、配置透传、节点选择、发布策略。

这些东西平时不出问题，一旦出问题，就不是改一行业务代码能解决的。

所以这篇记录不是“如何优雅地给服务器挂代理”，更像是一次提醒：工程问题很多时候都不在表面。看到报错，不急着下结论，先判断它属于哪一层，事情反而会简单很多。
