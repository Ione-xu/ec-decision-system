/* ============================================================
   电子商务大数据分析与智能决策支持系统 - 静态演示版前端逻辑
   数据全部本地加载，浏览器端实现推荐/预测/检索等交互
   ============================================================ */
const TITLES = {
  overview: "数据总览", behavior: "用户行为分析", recommend: "智能推荐",
  forecast: "销量预测", supply: "供应链风险监控", sentiment: "评论情感分析",
  marketing: "营销策略优化", pricing: "商品价格优化", search: "商品检索",
};
let charts = [];
const DATA = {};

function $(id) { return document.getElementById(id); }

async function loadData(name) {
  if (!DATA[name]) {
    const res = await fetch(`./data/${name}.json`);
    DATA[name] = await res.json();
  }
  return DATA[name];
}

function loadingHTML() {
  return `<div class="loading"><div class="spinner"></div>数据加载中...</div>`;
}
function emptyHTML(text) {
  return `<div class="empty">${text || "暂无数据"}</div>`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function riskClass(risk) {
  if (/风险|不足|激增|骤降/.test(risk)) return "risk-high";
  if (/平稳/.test(risk)) return "risk-low";
  return "risk-mid";
}
function fmtScore(v) {
  v = Number(v || 0);
  return v >= 100 ? v.toFixed(1) : v.toFixed(2);
}

/* ---------------- 路由 ---------------- */
document.querySelectorAll(".nav-item").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    el.classList.add("active");
    const view = el.dataset.view;
    $("pageTitle").textContent = TITLES[view] || "";
    renderView(view);
  });
});

async function renderView(view) {
  const c = $("content");
  charts.forEach(ch => { if (ch && ch.dispose) ch.dispose(); });
  charts = [];
  c.innerHTML = loadingHTML();
  try {
    const fn = VIEWS[view];
    await fn(c);
  } catch (e) {
    c.innerHTML = `<div class="empty">页面加载失败：${esc(e.message)}</div>`;
  }
}

function makeChart(el, option) {
  const ch = echarts.init(el);
  ch.setOption(option);
  charts.push(ch);
  return ch;
}
function resizeCharts() { charts.forEach(ch => ch.resize()); }
window.addEventListener("resize", resizeCharts);

function kpiCards(list) {
  return `<div class="grid grid-4 mb">` + list.map(k => `
    <div class="kpi-card c-${k.color || "blue"}">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}<span class="unit">${k.unit || ""}</span></div>
      <div class="sub">${k.sub || ""}</div>
    </div>`).join("") + `</div>`;
}
function card(title, body, cls = "") {
  return `<div class="card ${cls}"><h3>${title}</h3>${body}</div>`;
}

/* ---------------- 各功能页 ---------------- */
const VIEWS = {
  async overview(c) {
    const d = await loadData("overview");
    const [trend, actions, cats, hot] = await Promise.all([
      loadData("trend"), loadData("actions"), loadData("category"), loadData("hot")]);
    const k = d.kpis, conv = d.funnel;
    c.innerHTML = kpiCards([
      { label: "在售商品数", value: k.items, unit: "件", color: "blue" },
      { label: "活跃用户数", value: k.users, unit: "人", color: "green" },
      { label: "用户行为记录", value: k.behaviors, unit: "条", color: "orange" },
      { label: "商品评价数", value: k.reviews, unit: "条", color: "purple" },
      { label: "成交订单数", value: k.orders, unit: "笔", color: "red" },
      { label: "人均行为次数", value: k.avg_clicks, unit: "次", color: "cyan" },
      { label: "点击→支付转化率", value: conv.alipay.rate, unit: "%", color: "blue" },
      { label: "加购率", value: conv.cart.rate, unit: "%", color: "green" },
    ]);
    c.innerHTML += `
      <div class="grid grid-2 mb">
        ${card("每日行为趋势", `<div class="chart" id="c-trend"></div>`)}
        ${card("行为类型分布", `<div class="chart" id="c-actions"></div>`)}
      </div>
      <div class="grid grid-2">
        ${card("商品品类分布（Top12）", `<div class="chart" id="c-cats"></div>`)}
        ${card("热门商品 Top8", hotListHTML(hot.slice(0, 8)))}
      </div>`;
    makeChart($("c-trend"), {
      tooltip: { trigger: "axis" },
      legend: { top: 0, data: ["点击", "收藏", "加购", "支付"] },
      grid: { left: 40, right: 20, top: 36, bottom: 30 },
      xAxis: { type: "category", data: trend.map(x => x.date.slice(5)) },
      yAxis: { type: "value" },
      series: [
        { name: "点击", type: "line", smooth: true, data: trend.map(x => x["点击"]), areaStyle: { opacity: 0.08 } },
        { name: "收藏", type: "line", smooth: true, data: trend.map(x => x["收藏"]) },
        { name: "加购", type: "line", smooth: true, data: trend.map(x => x["加购"]) },
        { name: "支付", type: "line", smooth: true, data: trend.map(x => x["支付"]) },
      ],
    });
    makeChart($("c-actions"), {
      tooltip: { trigger: "item" }, legend: { bottom: 0 },
      series: [{ type: "pie", radius: ["40%", "68%"], label: { formatter: "{b}\n{d}%" }, data: actions, color: ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"] }],
    });
    makeChart($("c-cats"), {
      tooltip: {}, grid: { left: 60, right: 30, top: 10, bottom: 40 },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: cats.map(x => x.name).reverse() },
      series: [{ type: "bar", data: cats.map(x => x.value).reverse(), itemStyle: { color: "#3b82f6", borderRadius: [0, 4, 4, 0] }, barWidth: 14 }],
    });
  },

  async behavior(c) {
    const [funnel, trend, rank] = await Promise.all([
      loadData("overview"), loadData("trend"), loadData("user_rank")]);
    const f = funnel.funnel;
    const order = ["click", "collect", "cart", "alipay"];
    const names = { click: "点击", collect: "收藏", cart: "加购", alipay: "支付" };
    c.innerHTML = `
      <div class="grid grid-2 mb">
        ${card("用户行为转化漏斗", `<div class="chart" id="c-funnel"></div>`)}
        ${card("每日行为趋势", `<div class="chart" id="c-trend2"></div>`)}
      </div>
      ${card("活跃用户 Top10", `
        <div class="table-wrap"><table>
        <tr><th>用户ID</th><th>行为次数</th><th>浏览商品数</th><th>加购数</th><th>支付数</th></tr>
        ${rank.map(r => `<tr><td>${esc(r.user)}</td><td>${r.behaviors}</td><td>${r.items}</td><td>${r.carts}</td><td>${r.buys}</td></tr>`).join("")}
        </table></div>`)}`;
    const fdata = order.map(o => f[o].count);
    makeChart($("c-funnel"), {
      tooltip: { trigger: "item", formatter: p => `${p.name}: ${p.value} 次（占比 ${f[p.name === "点击" ? "click" : p.name === "收藏" ? "collect" : p.name === "加购" ? "cart" : "alipay"].rate}%）` },
      series: [{ type: "funnel", left: "10%", width: "80%", sort: "descending", gap: 2,
        label: { formatter: "{b}  {c} 次" },
        data: order.map(o => ({ name: names[o], value: f[o].count })), color: ["#3b82f6", "#22d3ee", "#f59e0b", "#ef4444"] }],
    });
    makeChart($("c-trend2"), {
      tooltip: { trigger: "axis" }, legend: { top: 0, data: ["点击", "加购", "收藏", "支付"] },
      grid: { left: 40, right: 20, top: 36, bottom: 30 },
      xAxis: { type: "category", data: trend.map(x => x.date.slice(5)) }, yAxis: { type: "value" },
      series: [
        { name: "点击", type: "bar", stack: "a", data: trend.map(x => x["点击"]), itemStyle: { color: "#3b82f6" } },
        { name: "加购", type: "bar", stack: "a", data: trend.map(x => x["加购"]), itemStyle: { color: "#10b981" } },
        { name: "收藏", type: "bar", stack: "a", data: trend.map(x => x["收藏"]), itemStyle: { color: "#f59e0b" } },
        { name: "支付", type: "line", data: trend.map(x => x["支付"]), itemStyle: { color: "#ef4444" } },
      ],
    });
  },

  async recommend(c) {
    c.innerHTML = `
      ${card("个性化商品推荐（ItemCF 协同过滤）", `
        <div class="search-row">
          <input type="text" id="recUid" placeholder="输入用户ID，如 u13 / u2625" value="u13">
          <button class="btn" id="recBtn">生成推荐</button>
          <button class="btn btn-outline" id="hotBtn">查看热门推荐</button>
          <span id="recHint" style="color:var(--text-sub);font-size:12px"></span>
        </div>
        <div id="recResult" class="mt"></div>`)}`;
    const resultEl = $("recResult"), hint = $("recHint");
    const itemUser = await loadData("item_user");
    const itemSim = await loadData("item_sim");
    const hot = await loadData("hot");
    const products = await loadData("products");
    const titleMap = {};
    products.forEach(p => { titleMap[p.id] = p.title; });
    const pMeta = {};
    products.forEach(p => { pMeta[p.id] = p; });

    const renderItems = (items) => `<div>` + items.map(it => `
      <div class="item-card">
        <div style="flex:1">
          <div class="title">#${it.id} ${esc(it.title || "")}</div>
          <div class="meta">品类：${esc(it.cat || "—")}</div>
          <div class="score-bar" style="max-width:260px"><i style="width:${Math.min(100, Math.max(5, (it.score || 0) * 10 + 20)).toFixed(0)}%"></i></div>
        </div>
        <div style="text-align:right"><span class="tag tag-blue">热度 ${fmtScore(it.score)}</span></div>
      </div>`).join("") + `</div>`;

    const recommend = (uid) => {
      const hist = itemUser[String(uid)] || [];
      if (!hist.length) {
        return { strategy: "冷启动-热门推荐", hist: [], items: hot.map(h => ({ id: h.id, title: h.title, cat: h.cat, score: h.heat })) };
      }
      const scores = {};
      hist.forEach(iid => {
        const nbrs = itemSim[String(iid)] || [];
        nbrs.forEach(([jid, s]) => {
          if (hist.includes(jid)) return;
          scores[jid] = (scores[jid] || 0) + s;
        });
      });
      const ranked = Object.keys(scores).map(Number).sort((a, b) => scores[b] - scores[a]).slice(0, 10);
      return {
        strategy: "ItemCF 协同过滤",
        hist: hist.slice(-5),
        items: ranked.map(id => ({ id, title: titleMap[id] || "", cat: (pMeta[id] || {}).cat || "", score: scores[id] })),
      };
    };

    const loadUser = () => {
      const uid = $("recUid").value.trim();
      if (!uid) { resultEl.innerHTML = emptyHTML("请输入用户ID"); return; }
      hint.textContent = "基于物品协同过滤：根据用户历史行为相似商品推荐";
      const d = recommend(uid);
      resultEl.innerHTML = `<div class="result-box" style="color:var(--text-sub)">策略：${esc(d.strategy)}${d.hist.length ? " ｜ 用户历史交互：" + d.hist.map(h => esc(titleMap[h] || h)).slice(0, 3).join("、") : ""}</div>` + renderItems(d.items);
    };
    $("recBtn").addEventListener("click", loadUser);
    $("hotBtn").addEventListener("click", () => {
      hint.textContent = "冷启动/热门推荐策略：全站热度 Top";
      resultEl.innerHTML = `<div class="result-box" style="color:var(--text-sub)">策略：全站热门商品推荐</div>` + renderItems(hot.map(h => ({ id: h.id, title: h.title, cat: h.cat, score: h.heat })));
    });
    await loadUser();
  },

  async forecast(c) {
    const fcAll = await loadData("forecast_all");
    const hot = await loadData("hot");
    c.innerHTML = `
      ${card("商品需求（销量）预测", `
        <div class="search-row">
          <input type="text" id="fcId" placeholder="输入商品ID，如 161" value="161">
          <button class="btn" id="fcBtn">预测</button>
          <span style="color:var(--text-sub);font-size:12px">随机森林回归模型，预测未来7天需求强度（点击1/收藏2/加购3/支付4加权）</span>
        </div>
        <div id="fcResult" class="mt"></div>`)}
      <div class="mt">${card("热门商品（可点击预测）", `<div class="tag-cloud" id="fcTags"></div>`)}</div>`;
    const tagBox = $("fcTags");
    tagBox.innerHTML = hot.map(t => `<button class="btn btn-outline" style="margin:4px" data-id="${t.id}">#${t.id} ${esc((t.title || "").slice(0, 12))}</button>`).join("");
    tagBox.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("fcId").value = b.dataset.id; loadForecast(); }));
    const resultEl = $("fcResult");
    const loadForecast = () => {
      const id = $("fcId").value.trim();
      if (!id) return;
      const d = fcAll[String(id)];
      if (!d) { resultEl.innerHTML = emptyHTML("该商品无行为数据"); return; }
      resultEl.innerHTML = `
        <div class="result-box">
          <strong>${esc(d.title)}</strong>
          <div class="meta" style="color:var(--text-sub)">商品ID：${id} ｜ 品类：${esc(d.cat)} ｜ 当前需求强度：${d.current}</div>
          <div class="mt" style="font-size:14px">风险判定：<span class="${riskClass(d.risk)}">${esc(d.risk)}</span>（未来7天均值 ${d.avg}）</div>
          <div style="color:var(--text-sub);font-size:13px;margin-top:4px">决策建议：${esc(d.advice)}</div>
        </div>
        <div class="mt"><div class="chart" id="c-fc"></div></div>`;
      makeChart($("c-fc"), {
        tooltip: { trigger: "axis" }, grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: { type: "category", data: d.dates }, yAxis: { type: "value", name: "需求强度" },
        series: [{ name: "预测需求", type: "line", smooth: true, data: d.fc, areaStyle: { opacity: 0.15 }, itemStyle: { color: "#1d6fe0" } }],
      });
    };
    $("fcBtn").addEventListener("click", loadForecast);
    await loadForecast();
  },

  async supply(c) {
    const d = await loadData("supply_risks");
    c.innerHTML = `
      ${card("供应链风险预警（供需风险监控模型）", `
        <p style="color:var(--text-sub);font-size:13px;margin-bottom:12px">
          基于近期(3天)与前期的需求趋势对比，识别<b>需求激增（供应承压）</b>、<b>需求骤降（滞销）</b>、<b>加购多支付少（转化瓶颈）</b>三类风险，给出风险评分。</p>
        <div class="table-wrap"><table>
        <tr><th>商品</th><th>品类</th><th>近期强度</th><th>前期强度</th><th>趋势</th><th>风险评分</th><th>风险标签</th></tr>
        ${d.map(r => `<tr>
          <td><div style="font-weight:500">#${r.item_id}</div><div style="color:var(--text-sub);font-size:12px">${esc((r.title || "").slice(0, 18))}</div></td>
          <td>${esc(r.category)}</td><td>${r.recent_weight}</td><td>${r.prev_weight}</td>
          <td style="color:${r.trend >= 0 ? "#1a9e57" : "#dc2626"}">${(r.trend * 100).toFixed(1)}%</td>
          <td><div class="score-bar" style="width:80px"><i style="width:${(r.risk_score * 100).toFixed(0)}%"></i></div>${r.risk_score}</td>
          <td>${r.tags.map(t => `<span class="tag tag-${t.includes("激增") ? "orange" : t.includes("骤降") ? "red" : "blue"}">${esc(t)}</span>`).join("")}</td>
        </tr>`).join("")}
        </table></div>`)}`;
  },

  async sentiment(c) {
    const d = await loadData("sentiment");
    const reviews = await loadData("reviews");
    const risk = d.item_risk || [];
    c.innerHTML = kpiCards([
      { label: "评论总数", value: d.total, unit: "条", color: "blue" },
      { label: "正向评论", value: d.positive, unit: `条 · ${d.pos_rate}%`, color: "green" },
      { label: "中性评论", value: d.neutral, unit: "条", color: "orange" },
      { label: "负向评论", value: d.negative, unit: `条 · ${d.neg_rate}%`, color: "red" },
    ]);
    c.innerHTML += `
      <div class="grid grid-2 mb">
        ${card("评论情感分布", `<div class="chart" id="c-senti"></div>`)}
        ${card("差评风险商品 Top10", `
          <div class="table-wrap"><table>
          <tr><th>商品</th><th>评论数</th><th>差评数</th><th>差评率</th></tr>
          ${risk.map(r => `<tr><td>#${r.item_id} ${esc((r.title || "").slice(0, 16))}</td><td>${r.total}</td><td style="color:#dc2626">${r.negative}</td><td>${(r.neg_rate * 100).toFixed(1)}%</td></tr>`).join("")}
          </table></div>`)}
      </div>
      ${card("客户服务优化：近期评论监控", `<div id="c-reviews" class="mt"></div>`)}`;
    makeChart($("c-senti"), {
      tooltip: { trigger: "item" }, legend: { bottom: 0 },
      series: [{ type: "pie", radius: ["38%", "66%"], label: { formatter: "{b}\n{d}%" }, data: d.distribution, color: ["#10b981", "#f59e0b", "#ef4444"] }],
    });
    const colors = { "正向": "green", "中性": "gray", "负向": "red" };
    $("c-reviews").innerHTML = reviews.slice(0, 12).map(r => `
      <div class="item-card">
        <div style="flex:1">
          <div class="title">#${r.id} ${esc(r.title || "")}</div>
          <div class="meta">${esc(r.fb || "")}</div>
          <div class="meta">用户 ${esc(r.user)} · ${r.time}</div>
        </div>
        <span class="tag tag-${colors[r.sent] || "gray"}">${r.sent}</span>
      </div>`).join("") || emptyHTML();
  },

  async marketing(c) {
    const segs = await loadData("segments");
    const us = await loadData("user_seg");
    c.innerHTML = `
      <div class="grid grid-2 mb">
        ${card("用户价值分群（RFM + KMeans）", `
          <div class="table-wrap"><table>
          <tr><th>用户群</th><th>人数</th><th>近度R</th><th>频度F</th><th>价值M</th></tr>
          ${segs.map(s => `<tr><td><span class="tag tag-blue">${esc(s.name)}</span></td><td>${s.count}</td><td>${s.R_mean}</td><td>${s.F_mean}</td><td>${s.M_mean}</td></tr>`).join("")}
          </table></div>`)}
        ${card("各分群营销策略", `${segs.map(s => `
          <div class="item-card"><div><div class="title">${esc(s.name)}</div><div class="meta">${esc(s.strategy)}</div></div></div>`).join("")}`)}
      </div>
      ${card("个性化优惠券模拟（按用户分群自动匹配）", `
        <div class="search-row">
          <input type="text" id="mkUid" placeholder="输入用户ID，如 u13" value="u13">
          <button class="btn" id="mkBtn">生成优惠方案</button>
        </div>
        <div id="mkResult" class="mt"></div>`)}`;
    const mkRes = $("mkResult");
    const loadMk = () => {
      const uid = $("mkUid").value.trim();
      if (!uid) return;
      const row = us.map[String(uid)];
      if (!row) { mkRes.innerHTML = emptyHTML("无该用户行为数据"); return; }
      mkRes.innerHTML = `
        <div class="grid grid-2">
          <div class="result-box">
            <div style="color:var(--text-sub)">用户画像（RFM）</div>
            <div class="mt" style="font-size:15px">近度 R：${row.R} 天 ｜ 频度 F：${row.F} 次 ｜ 价值 M：${row.M}</div>
            <div class="mt"><span class="tag tag-blue">${esc(row.segment)}</span></div>
          </div>
          <div class="result-box" style="background:linear-gradient(135deg,#eff6ff,#f0fdf9)">
            <div style="color:var(--text-sub)">推荐营销方案</div>
            <div class="mt" style="font-size:17px;font-weight:600;color:var(--primary)">${esc(us.coupon[row.segment] || "常规优惠券")}</div>
            <div class="mt" style="color:var(--text-sub);font-size:13px">根据用户${esc(row.segment)}画像自动匹配优惠券策略</div>
          </div>
        </div>`;
    };
    $("mkBtn").addEventListener("click", loadMk);
    await loadMk();
  },

  async pricing(c) {
    const d = await loadData("pricing");
    c.innerHTML = `
      ${card("商品价格优化建议", `
        <p style="color:var(--text-sub);font-size:13px;margin-bottom:12px">
          基于<b>需求强度 + 品类竞争度 + 转化率</b>构造价格弹性代理指标，将商品划分为
          <span class="tag tag-orange">建议促销/降价</span>
          <span class="tag tag-green">可适度提价</span>
          <span class="tag tag-gray">维持现价</span>
          三类，辅助动态定价决策。</p>
        <div class="table-wrap"><table>
        <tr><th>商品</th><th>品类</th><th>点击</th><th>加购</th><th>弹性代理</th><th>定价建议</th></tr>
        ${d.map(r => `
          <tr>
            <td><div style="font-weight:500">#${r.item_id}</div><div style="color:var(--text-sub);font-size:12px">${esc((r.title || "").slice(0, 18))}</div></td>
            <td>${esc(r.category)}</td><td>${r.clicks}</td><td>${r.carts}</td><td>${r.elasticity_proxy}</td>
            <td><span class="tag tag-${r.action.includes("促销") ? "orange" : r.action.includes("提价") ? "green" : "gray"}">${esc(r.action)}</span>
              <div class="meta" style="color:var(--text-sub);font-size:12px;margin-top:4px">${esc(r.reason)}</div></td>
          </tr>`).join("")}
        </table></div>`)}`;
  },

  async search(c) {
    const products = await loadData("products");
    c.innerHTML = `
      ${card("全站商品检索", `
        <div class="search-row">
          <input type="text" id="q" placeholder="输入关键词，如：T恤 / 女装 / 161" style="min-width:260px">
          <button class="btn" id="qBtn">搜索</button>
        </div>
        <div id="qResult" class="mt"></div>`)}`;
    const res = $("qResult");
    const doSearch = () => {
      const q = $("q").value.trim().toLowerCase();
      if (!q) { res.innerHTML = emptyHTML("请输入关键词"); return; }
      const found = products.filter(p =>
        p.title.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || String(p.id).includes(q))
        .sort((a, b) => b.heat - a.heat).slice(0, 20);
      if (!found.length) { res.innerHTML = emptyHTML("未找到相关商品"); return; }
      res.innerHTML = `<div>` + found.map(it => `
        <div class="item-card">
          <div style="flex:1">
            <div class="title">#${it.id} ${esc(it.title)}</div>
            <div class="meta">品类：${esc(it.cat || "—")}</div>
            <div class="score-bar" style="max-width:260px"><i style="width:${Math.min(100, it.heat * 10 + 20).toFixed(0)}%"></i></div>
          </div>
          <div style="text-align:right"><span class="tag tag-blue">热度 ${fmtScore(it.heat)}</span></div>
        </div>`).join("") + `</div>`;
    };
    $("qBtn").addEventListener("click", doSearch);
    $("q").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  },
};

function hotListHTML(list) {
  return `<div>` + list.map(it => `
    <div class="item-card">
      <div style="flex:1"><div class="title">#${it.id} ${esc((it.title || "").slice(0, 24))}</div>
      <div class="meta">品类：${esc(it.cat || "—")}</div></div>
      <span class="tag tag-orange">热度 ${fmtScore(it.heat)}</span>
    </div>`).join("") + `</div>`;
}

/* ---------------- 时钟 ---------------- */
function tick() {
  const now = new Date();
  const pad = x => String(x).padStart(2, "0");
  $("clock").textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(tick, 1000); tick();

/* ---------------- 启动 ---------------- */
renderView("overview");
