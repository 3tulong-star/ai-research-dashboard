# 数据层说明

当前网站只更新“当前选定池”，不做全市场高频轮询。

## 已接入

- `Baostock`：选定池历史日线、涨跌幅、换手率、PE/PB，写入 `data/market-snapshot.json`。
- 官方披露：巨潮资讯、上交所、深交所作为公告、订单、客户定点和技术路线的复核来源，暂不自动把二手新闻当作硬证据。

## 可选扩展

- `AKShare`：补充行业、宏观和另类数据。
- `efinance`：行情监控和备用行情源。
- `pytdx` / `Ashare`：行情故障切换，不作为公告或基本面最终来源。

## 更新方式

```bash
npm run data:update
```

建议在A股收盘后每天执行一次。每条行情包含交易日期和来源；订单、参数、客户认证和路线变化需要进入证据事件表，并保留原始链接、发布时间、抓取时间、证据等级和正/反向判断。

## Codex 定时任务

已配置 Codex Scheduled Task：每周一至周五 19:30 在本地项目目录运行 `npm run data:update`。任务只更新行情快照，不修改选定池、关键假设、Serenity 候选池或投资建议。

该任务依赖电脑开机且 Codex 桌面应用保持运行；如果需要电脑关机后仍然更新，应迁移到 GitHub Actions、Cloudflare Scheduled Worker 或其他云端定时器。

## GitHub Actions 定时任务

项目已经加入 `.github/workflows/update-market-data.yml`。把项目放进 GitHub 仓库后，它会：

1. 每周一至周五北京时间 19:30 运行一次；
2. 安装 `requirements-data.txt` 中的 Baostock；
3. 执行 `scripts/run_data_update.sh`；
4. 只提交 `data/market-snapshot.json`，网站可以通过 GitHub push 触发重新部署。

也可以在 GitHub 的 **Actions → Update market snapshot → Run workflow** 手动触发。

首次启用前，请在仓库的 **Settings → Actions → General → Workflow permissions** 中选择 **Read and write permissions**。如果默认分支启用了必须走 Pull Request 的分支保护规则，自动 push 会被拒绝，需要改为允许 GitHub Actions 直接写入，或后续改成自动提 PR。

GitHub Actions 使用 UTC cron；当前配置的 `30 11 * * 1-5` 对应北京时间工作日 19:30。GitHub 官方说明：定时任务可能因系统负载出现延迟，因此它适合收盘后的日更，不应被当作精确到秒的行情服务。

## GitHub Pages 发布

项目还包含 `.github/workflows/deploy-pages.yml`。它会构建静态网站并发布到 GitHub Pages；普通代码 push 和行情更新工作流完成后都会触发部署。由于行情快照是在构建时导入的，页面部署完成后才会显示最新的 `data/market-snapshot.json`。

首次启用时，在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。预期地址为：

```text
https://3tulong-star.github.io/ai-research-dashboard/
```

开源代码不等于上游数据可以自由再分发。网站公开展示时只保留必要的派生指标与原始来源链接，避免把上游批量数据直接转成公共数据服务。
