# Frontend migration benchmark

Measured locally on macOS on 2026-11-04 with the same Chromium installation, six demo devices and a local HTTP agent. Three fresh browser contexts per build. Baseline: beta.31 (`68b6585`), classic scripts. Candidate: beta.32, production Vite assets. Timing includes navigation, waiting for six cards and a fixed 100 ms settling delay; it is a comparison probe, not an app startup SLA.

| Metric | beta.31 | beta.32 |
| --- | --- | --- |
| Loaded JavaScript body bytes, each sample | 626,746 | 468,574 |
| Script requests | 11 | 10 |
| Ready probe, three samples (ms) | 241.5 / 168.3 / 171.8 | 210.4 / 185.7 / 198.1 |
| Grid mutation records across five unchanged refreshes | 10 | 10 |

Loaded JavaScript is **25.2% smaller** in this scenario. This comes from production bundling/minification and importing only used icons, despite adding React. These are HTTP body sizes on the local uncompressed server, not installer size, gzip network transfer or memory consumption.

The small timing sample does **not** establish a startup speed improvement. Both implementations preserve grid stability during unchanged refreshes; React adds typed component boundaries and memoization while retaining that behavior. CPU, RAM, large fleets, physical-device command latency and Windows runtime performance were not benchmarked here.

Reproduce against a built dashboard with port 14329 free:

```sh
npm run build:dashboard
node scripts/benchmark-dashboard.mjs
```

The script starts an isolated demo agent, opens three fresh browser contexts, measures Resource Timing script sizes and observes the device grid during five refreshes. It closes its browser/agent and writes `.snapkit-dev/framework-benchmark.json`. The same script was run against beta.31 before replacing its classic script entrypoint. Browser/OS caching and concurrent workloads can affect timing; use more samples and a controlled environment for future latency claims.
