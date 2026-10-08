import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const ROOT = process.cwd();
const USER_AGENT = "ScomDataPlatform/0.2 (+https://github.com/stephencho820/scom-data-platform)";
const DEFAULT_BATCH = 120;
const DEFAULT_DELAY = 500;
const MAX_TEXT_CHARS = 50000;
const REQUEST_TIMEOUT = 20000;

function arg(name, fallback) {
  const prefix = "--" + name + "=";
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

const marketCode = arg("market", "us");
const batchPages = Number(arg("batch", DEFAULT_BATCH));
const specBatch = Math.max(0, Number(arg("spec-batch", 8)));
const delayMs = Number(arg("delay", DEFAULT_DELAY));
const explicitUrl = arg("url", "");
const discoverOnly = process.argv.includes("--discover-only") || batchPages === 0;

const registry = JSON.parse(await readFile(path.join(ROOT, "config/markets.json"), "utf8"));
const crawlScope = JSON.parse(await readFile(path.join(ROOT, "config/crawl-scope.json"), "utf8"));
const catalogRegistry = JSON.parse(await readFile(path.join(ROOT, "config/catalog-sources.json"), "utf8"));
const catalogSourceDefs = catalogRegistry.markets?.[marketCode] || [];
const market = registry.markets.find((item) => item.code === marketCode);
if (!market) throw new Error("Unknown market: " + marketCode);

const base = new URL(market.baseUrl);
const marketPrefix = base.pathname.endsWith("/") ? base.pathname : base.pathname + "/";
const capturedAt = new Date().toISOString();
const knownProductIdentifiers = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const decode = (value = "") =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

const toJsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");

let catalogBrowser = null;

function findCatalogGoods(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) findCatalogGoods(item, out);
    return out;
  }

  const model = String(value.mdlCode || "").trim().toUpperCase();
  const name = String(value.goodsNm || "").trim();
  if (/^SM-[A-Z][0-9]{3}[A-Z0-9]{4,12}$/.test(model) && name) out.push(value);

  for (const child of Object.values(value)) findCatalogGoods(child, out);
  return out;
}

async function fetchCatalogGoodsPages(context, capturedUrl) {
  if (!capturedUrl) return [];

  const products = new Map();
  for (let pageNumber = 1; pageNumber <= 30; pageNumber++) {
    const url = new URL(capturedUrl);
    url.searchParams.set("page", String(pageNumber));
    url.searchParams.set("rows", "50");
    url.searchParams.set("soldOutExceptYn", "N");

    try {
      const response = await context.request.get(url.href, {
        timeout: 30000,
        headers: { "user-agent": USER_AGENT }
      });
      if (!response.ok()) break;

      const payload = await response.json();
      const goods = findCatalogGoods(payload);
      let added = 0;

      for (const item of goods) {
        const model = String(item.mdlCode || "").trim().toUpperCase();
        if (!model || products.has(model)) continue;
        products.set(model, item);
        added += 1;
      }

      console.error(
        "catalog goodsList page=" + pageNumber +
        " parsed=" + goods.length +
        " new=" + added +
        " total=" + products.size
      );

      if (!goods.length || added === 0) break;
    } catch (error) {
      console.error("catalog goodsList pagination failed: " + error.message);
      break;
    }
  }

  return [...products.values()];
}

function parseCatalogApiGoods(goods, source) {
  const rows = [];

  for (const item of goods) {
    const modelCode = String(item.mdlCode || "").trim().toUpperCase();
    const name = String(item.goodsNm || "").replace(/\s+/g, " ").trim();
    if (!/^SM-[A-Z][0-9]{3}[A-Z0-9]{4,12}$/.test(modelCode) || !name) continue;

    const saleStatCd = String(item.saleStatCd ?? "").trim();
    const stockQty = Number(item.stockQty);
    const hasStock = !Number.isFinite(stockQty) || stockQty > 0;
    const sellable = saleStatCd === "12" && hasStock;
    const lifecycleStatus = sellable ? "current_sellable" : "current_unavailable";
    const numericPrice = Number(item.salePrice ?? item.curPrice ?? item.maxSalePrice ?? 0);
    const price = sellable && Number.isFinite(numericPrice) && numericPrice > 0
      ? String(numericPrice)
      : "";

    const key = sha(marketCode + "|" + modelCode.toLowerCase()).slice(0, 24);
    const detailUrl = productDetailUrl(source, item, modelCode);
    const row = {
      key,
      market: marketCode,
      url: detailUrl,
      name,
      sku: modelCode,
      model: modelCode,
      brand: "Samsung",
      offers: {
        price,
        currency: marketCode === "kr" ? "KRW" : "",
        availability: sellable
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock"
      },
      specs: [],
      captured_at: capturedAt,
      catalog_source_id: source.id,
      catalog_source_url: source.url,
      catalog_category: source.category,
      catalog_group_path: String(item.grpPath || "").trim(),
      product_detail_url: detailUrl,
      lifecycle_status: lifecycleStatus,
      catalog_verified_at: capturedAt,
      catalog_sale_status: saleStatCd,
      catalog_stock_qty: Number.isFinite(stockQty) ? stockQty : null
    };

    row.fingerprint = sha(JSON.stringify({
      name: row.name,
      sku: row.sku,
      offers: row.offers,
      lifecycle_status: lifecycleStatus,
      catalog_sale_status: saleStatCd
    }));

    rows.push(row);
  }

  return rows;
}


function productDetailUrl(source, item, modelCode) {
  const groupPath = String(item?.grpPath || "").trim().replace(/^\/+|\/+$/g, "");
  if (!groupPath) return source.url;

  const category = String(source.category || "").trim().replace(/^\/+|\/+$/g, "");
  try {
    return new URL(category + "/" + groupPath + "/" + encodeURIComponent(modelCode) + "/", base).href;
  } catch {
    return source.url;
  }
}

function normalizeSpecValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;])/g, "$1")
    .trim();
}

function specUnit(value) {
  const match = String(value || "").match(/\b(mm|cm|g|kg|mAh|GB|TB|Hz|GHz|MP|nit|nits)\b/i);
  return match ? match[1] : "";
}


function specKeyForName(name) {
  const value = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  const rules = [
    [/배터리 용량|battery capacity/, "battery_capacity"],
    [/배터리 수명|battery life|비디오 재생/, "battery_life"],
    [/^배터리$|^battery$/, "battery"],
    [/커버 디스플레이 크기/, "cover_display_size"],
    [/메인 디스플레이 크기/, "main_display_size"],
    [/디스플레이 크기|screen size/, "display_size"],
    [/커버 디스플레이 해상도/, "cover_display_resolution"],
    [/메인 디스플레이 해상도/, "main_display_resolution"],
    [/디스플레이 해상도|resolution/, "display_resolution"],
    [/커버 디스플레이 최대 밝기/, "cover_display_brightness"],
    [/메인 디스플레이 최대 밝기/, "main_display_brightness"],
    [/가변주사율|refresh rate/, "refresh_rate"],
    [/스토리지|저장 용량|storage/, "storage"],
    [/메모리|memory|ram/, "memory"],
    [/프로세서|^ap$|processor|chipset/, "processor"],
    [/코어|core/, "cpu_cores"],
    [/초광각 카메라/, "ultrawide_camera"],
    [/광각 카메라/, "wide_camera"],
    [/망원 카메라/, "telephoto_camera"],
    [/전면 카메라/, "front_camera"],
    [/^카메라$|camera/, "camera"],
    [/^줌$|zoom/, "zoom"],
    [/^무게$|weight/, "weight"],
    [/접힌 상태의 크기/, "folded_dimensions"],
    [/^크기|dimensions/, "dimensions"],
    [/글래스|glass/, "glass"],
    [/프레임|frame/, "frame"],
    [/방수|water resistance/, "water_resistance"],
    [/연결성|connectivity/, "connectivity"],
    [/s펜|s pen/, "s_pen"],
    [/바디 재질|body material/, "body_material"],
    [/기본 밴드|band/, "band"],
    [/베젤|bezel/, "bezel"]
  ];
  for (const [pattern, key] of rules) if (pattern.test(value)) return key;
  return value
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "spec";
}

function normalizeSpecEntries(specs, source = "other") {
  const rows = [];
  const seen = new Set();

  for (const item of specs || []) {
    const name = normalizeSpecValue(item?.name);
    const value = normalizeSpecValue(item?.value);
    if (!name || !value || name === value) continue;

    const key = specKeyForName(name);
    const signature = key + "|" + value.toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);

    const unit = item.unit || specUnit(value);
    rows.push({
      key,
      name,
      value,
      ...(unit ? { unit } : {}),
      source: item.source || source
    });
  }

  return rows;
}

function validPdpSpec(item) {
  const key = String(item?.key || specKeyForName(item?.name || ""));
  const value = normalizeSpecValue(item?.value);
  if (!value) return false;

  const validators = {
    weight: /\b\d{2,4}(?:\.\d+)?\s*g\b/i,
    dimensions: /\d+(?:\.\d+)?\s*[x×]\s*\d+/i,
    folded_dimensions: /\d+(?:\.\d+)?\s*[x×]\s*\d+/i,
    display_size: /\b\d{2,3}(?:\.\d+)?\s*(?:mm|inch|inches|")\b/i,
    main_display_size: /\b\d{2,3}(?:\.\d+)?\s*(?:mm|inch|inches|")\b/i,
    cover_display_size: /\b\d{2,3}(?:\.\d+)?\s*(?:mm|inch|inches|")\b/i,
    display_resolution: /\d{3,4}\s*[x×]\s*\d{3,4}/i,
    main_display_resolution: /\d{3,4}\s*[x×]\s*\d{3,4}/i,
    cover_display_resolution: /\d{3,4}\s*[x×]\s*\d{3,4}/i,
    battery: /\b\d{3,5}\s*mAh\b/i,
    battery_capacity: /\b\d{3,5}\s*mAh\b/i,
    memory: /\b\d{1,2}\s*GB\b/i,
    storage: /\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/i,
    refresh_rate: /\b\d+(?:\s*[~\-]\s*\d+)?\s*Hz\b/i,
    wide_camera: /\b\d+(?:\.\d+)?\s*MP\b/i,
    ultrawide_camera: /\b\d+(?:\.\d+)?\s*MP\b/i,
    telephoto_camera: /\b\d+(?:\.\d+)?\s*MP\b/i,
    front_camera: /\b\d+(?:\.\d+)?\s*MP\b/i,
    water_resistance: /\bIP\d{2}\b/i
  };

  const validator = validators[key];
  return validator ? validator.test(value) : false;
}

function sanitizeSpecs(specs) {
  return normalizeSpecEntries(specs, "other").filter((item) => {
    if (item.source !== "samsung_pdp") return true;
    return validPdpSpec(item);
  });
}

function catalogFamilySlug(row) {
  const groupPath = String(row?.catalog_group_path || "").trim().replace(/^\/+|\/+$/g, "");
  if (!groupPath) return "";
  return groupPath
    .replace(/-(?:sm-)?[a-z]\d{3,}[a-z0-9-]*$/i, "")
    .replace(/-cpo$/i, "")
    .replace(/-+$/g, "");
}


function specFamilyKey(row) {
  const name = normalizeSpecValue(row?.name || "");
  if (row?.catalog_category === "watches") {
    if (/워치8\s*클래식/i.test(name)) return "watch8-classic";
    if (/워치8/i.test(name)) return "watch8";
    if (/워치9/i.test(name)) return "watch9";
    if (/워치\s*울트라2/i.test(name)) return "watch-ultra2";
    return "watch:" + catalogFamilySlug(row);
  }
  return catalogFamilySlug(row);
}

function watchSpecsUrlForRow(row) {
  if (row?.catalog_category !== "watches") return "";
  const name = normalizeSpecValue(row?.name || "");
  let slug = "";
  if (/워치9/i.test(name)) slug = "galaxy-watch9";
  else if (/워치\s*울트라2/i.test(name)) slug = "galaxy-watch-ultra2";
  else if (/워치8\s*클래식/i.test(name)) slug = "galaxy-watch8-classic";
  else if (/워치8/i.test(name)) slug = "galaxy-watch8";
  if (!slug) return "";
  return new URL("watches/galaxy-watch/" + slug + "/specs/", base).href;
}

function stripListPrefix(value) {
  return normalizeSpecValue(value).replace(/^\d+\.\s*/, "").trim();
}

function watchSpecDefinition(label) {
  const text = stripListPrefix(label);
  const defs = [
    [/^인프라$/i, "network", "인프라"],
    [/^위치 기술$/i, "gps", "위치 기술"],
    [/^Wi-?Fi$/i, "wifi", "Wi-Fi"],
    [/^NFC$/i, "nfc", "NFC"],
    [/^블루투스 버전$/i, "bluetooth", "블루투스 버전"],
    [/^운영체제$/i, "os", "운영체제"],
    [/^종류 \(Main Display\)$/i, "display_type", "디스플레이 종류"],
    [/^크기 \(Main Display\)$/i, "main_display_size", "메인 디스플레이 크기"],
    [/^해상도 \(Main Display\)$/i, "main_display_resolution", "메인 디스플레이 해상도"],
    [/^CPU 속도$/i, "cpu_speed", "CPU 속도"],
    [/^CPU 종류$/i, "processor", "CPU 종류"],
    [/^메모리 \(GB\)$/i, "memory", "메모리"],
    [/^스토리지\(저장 용량\) \(GB\)$/i, "storage", "스토리지(저장 용량)"],
    [/^센서$/i, "sensors", "센서"],
    [/^본체 크기 \(세로x가로x두께, mm\)$/i, "dimensions", "본체 크기"],
    [/^본체 무게 \(g\)$/i, "weight", "본체 무게"],
    [/^내구성$/i, "durability", "내구성"],
    [/^배터리 용량 \(mAh, Typical\)$/i, "battery_capacity", "배터리 용량"],
    [/^사용 시간 \(AOD 끔, 시간\)$/i, "battery_life_aod_off", "사용 시간 (AOD 끔)"],
    [/^사용 시간 \(AOD 켬, 시간\)$/i, "battery_life_aod_on", "사용 시간 (AOD 켬)"],
    [/^보안 업데이트 지원 기한$/i, "security_updates_until", "보안 업데이트 지원 기한"]
  ];
  for (const [pattern, key, name] of defs) if (pattern.test(text)) return { key, name, label: text };
  return null;
}

function watchSpecValue(def, rawValue) {
  let value = stripListPrefix(rawValue);
  if (!value) return "";

  if (def.key === "memory" && /^\d+(?:\.\d+)?$/.test(value)) value += " GB";
  if (def.key === "storage" && /^\d+(?:\.\d+)?$/.test(value)) value += " GB";
  if (def.key === "weight" && /^\d+(?:\.\d+)?$/.test(value)) value += " g";
  if (def.key === "battery_capacity" && /^\d+(?:\.\d+)?$/.test(value)) value += " mAh";
  if (def.key === "dimensions" && /\d/.test(value) && !/mm/i.test(value)) value += " mm";
  if (/^battery_life_/.test(def.key) && /^최대\s*\d+(?:\.\d+)?$/.test(value)) value += " 시간";

  return value;
}

async function renderWatchSpecs(row) {
  const specsUrl = watchSpecsUrlForRow(row);
  const chromePath = process.env.CHROME_PATH || "";
  if (!specsUrl || !chromePath) return { specs: [], sourceUrl: specsUrl };

  const { chromium } = await import("playwright-core");
  if (!catalogBrowser) {
    catalogBrowser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }

  const page = await catalogBrowser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 1200 }
  });

  try {
    await page.goto(specsUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const lines = bodyText.split(/\n+/).map(stripListPrefix).filter(Boolean);

    const target = normalizeModelLabel(row.name);
    const candidates = [];
    for (let index = 0; index < lines.length; index++) {
      if (normalizeModelLabel(lines[index]) !== target) continue;
      const next = lines.slice(index + 1, index + 12);
      if (next.some((line) => /^(?:네트워크|오디오\/비디오|연결|운영체제|디스플레이)$/i.test(line))) {
        candidates.push(index);
      }
    }

    const start = candidates[0] ?? -1;
    if (start < 0) {
      console.error("watch specs variant not found " + row.sku + ": " + row.name + " at " + page.url());
      return { specs: [], sourceUrl: page.url() || specsUrl, modelLabel: row.name };
    }

    let end = Math.min(lines.length, start + 350);
    for (let index = start + 8; index < end; index++) {
      if (/^갤럭시 워치/i.test(lines[index]) &&
          /\([^)]*(?:블루투스|LTE)[^)]*\)/i.test(lines[index]) &&
          normalizeModelLabel(lines[index]) !== target) {
        end = index;
        break;
      }
    }

    const segment = lines.slice(start + 1, end);
    const specs = [];
    const seen = new Set();

    for (let index = 0; index < segment.length; index++) {
      const def = watchSpecDefinition(segment[index]);
      if (!def) continue;

      let value = "";
      for (let offset = 1; offset <= 4 && index + offset < segment.length; offset++) {
        const candidate = segment[index + offset];
        if (!candidate || watchSpecDefinition(candidate)) break;
        if (/^(?:네트워크|오디오\/비디오|연결|운영체제|디스플레이|프로세서|메모리\/스토리지|센서|외관 사양|배터리|소프트웨어 지원|상품 기본정보)$/i.test(candidate)) continue;
        value = watchSpecValue(def, candidate);
        if (value) break;
      }
      if (!value) continue;

      const signature = def.key + "|" + value.toLowerCase();
      if (seen.has(signature)) continue;
      seen.add(signature);
      const unit = specUnit(value);
      specs.push({
        key: def.key,
        name: def.name,
        value,
        ...(unit ? { unit } : {}),
        source: "samsung_specs"
      });
    }

    console.error("watch specs " + row.sku + ": " + specs.length + " specs from " + page.url());
    return {
      specs,
      sourceUrl: page.url() || specsUrl,
      modelLabel: row.name
    };
  } finally {
    await page.close();
  }
}

function compareUrlForCatalogRow(row) {
  let family = catalogFamilySlug(row);
  const category = String(row?.catalog_category || "").trim().replace(/^\/+|\/+$/g, "");
  if (!family || !category) return "";

  // Samsung KR uses one shared comparison page for the base and Plus variants.
  if (/^galaxy-s26-plus$/i.test(family)) family = "galaxy-s26";
  if (/^galaxy-s25-plus$/i.test(family)) family = "galaxy-s25";

  try {
    return new URL(category + "/" + family + "/compare/", base).href;
  } catch {
    return "";
  }
}


function isKnownSpecLabel(value) {
  const text = normalizeSpecValue(value);
  return /^(?:무게|크기(?:\([^)]*\))?|접힌 상태의 크기(?:\s*\([^)]*\))?|카메라|광각 카메라|초광각 카메라|망원 카메라|전면 카메라|줌|배터리|배터리 용량|배터리 수명|비디오 재생|AP|프로세서|코어|디스플레이 크기|커버 디스플레이 크기|메인 디스플레이 크기|디스플레이 해상도|커버 디스플레이 해상도|메인 디스플레이 해상도|커버 디스플레이 최대 밝기 \(Peak Brightness\)|메인 디스플레이 최대 밝기 \(Peak Brightness\)|커버 디스플레이 가변주사율|메인 디스플레이 가변주사율|스토리지\(저장 용량\)|메모리|프레임|글래스|방수|연결성|S펜 호환|바디 재질|기본 밴드|베젤)$/i.test(text);
}

function plausibleCompareValue(value, label) {
  const text = normalizeSpecValue(value);
  if (!text || text === normalizeSpecValue(label) || isKnownSpecLabel(text)) return false;
  if (/^(?:-|—|비교하기|제품별|주요 스펙|스펙 비교|고지사항|전체 스펙)/i.test(text)) return false;
  if (text.length > 180) return false;
  return true;
}


function catalogModelLabel(row) {
  return normalizeSpecValue(row?.name || "")
    .replace(/\s*(?:자급제|통신사폰).*$/i, "")
    .replace(/\s*\([^)]*(?:블루투스|LTE|mm|삼성닷컴|삼성 강남)[^)]*\)\s*$/i, "")
    .trim();
}

function normalizeModelLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/galaxy/g, "갤럭시")
    .replace(/ultra/g, "울트라")
    .replace(/edge/g, "엣지")
    .replace(/classic/g, "클래식")
    .replace(/plus/g, "+")
    .replace(/[\s·|ㅣ()\[\]{}_-]+/g, "")
    .trim();
}

function compareSelectionMatches(row, selectedModel) {
  const target = normalizeModelLabel(catalogModelLabel(row));
  const selected = normalizeModelLabel(selectedModel);
  return !target || !selected || target === selected;
}

async function renderCompareSpecs(row) {
  const compareUrl = compareUrlForCatalogRow(row);
  const chromePath = process.env.CHROME_PATH || "";
  if (!compareUrl || !chromePath) return { specs: [], sourceUrl: compareUrl };

  const { chromium } = await import("playwright-core");
  if (!catalogBrowser) {
    catalogBrowser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }

  const page = await catalogBrowser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 1200 }
  });

  try {
    await page.goto(compareUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1600);

    const expanders = page.getByText(/전체 스펙 더 보기/i);
    if (await expanders.count()) {
      try {
        await expanders.first().click({ timeout: 1500 });
        await page.waitForTimeout(500);
      } catch {}
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const selectedModel =
      bodyText.match(/현재 선택된 모델\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
      bodyText.match(/currently selected model\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
      "";

    if (selectedModel && !compareSelectionMatches(row, selectedModel)) {
      console.error(
        "spec compare model mismatch " + row.sku +
        ": target=" + catalogModelLabel(row) +
        "; selected=" + selectedModel +
        "; url=" + page.url()
      );
      return { specs: [], sourceUrl: page.url() || compareUrl, modelLabel: selectedModel };
    }

    const rawRows = await page.locator("tr").evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll("th,td")]
          .map((cell) => (cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
      ).filter((cells) => cells.length)
    );

    const specs = [];
    const seen = new Set();
    let pendingLabel = "";

    const push = (label, value) => {
      const name = normalizeSpecValue(label);
      const normalizedValue = normalizeSpecValue(value);
      if (!isKnownSpecLabel(name) || !plausibleCompareValue(normalizedValue, name)) return;
      const key = specKeyForName(name);
      const signature = key + "|" + normalizedValue.toLowerCase();
      if (seen.has(signature)) return;
      seen.add(signature);
      const unit = specUnit(normalizedValue);
      specs.push({
        key,
        name,
        value: normalizedValue,
        ...(unit ? { unit } : {}),
        source: "catalog_compare"
      });
    };

    for (const cells of rawRows) {
      const normalized = cells.map(normalizeSpecValue).filter(Boolean);
      if (!normalized.length) continue;

      const labels = normalized.filter(isKnownSpecLabel);
      if (labels.length) {
        const label = labels[0];
        const values = normalized.filter((cell) => cell !== label && !isKnownSpecLabel(cell));
        const value = values.find((candidate) => plausibleCompareValue(candidate, label));
        if (value) {
          push(label, value);
          pendingLabel = "";
        } else {
          pendingLabel = label;
        }
        continue;
      }

      if (pendingLabel) {
        const value = normalized.find((candidate) => plausibleCompareValue(candidate, pendingLabel));
        if (value) push(pendingLabel, value);
        pendingLabel = "";
      }
    }

    console.error("spec compare rendered " + row.sku + ": rows=" + rawRows.length + " specs=" + specs.length + " from " + page.url());

    if (specs.length < 5) {
      const at = bodyText.search(/(?:^|\n)스펙(?:\n|$)/m);
      const sample = at >= 0 ? bodyText.slice(at, at + 4500) : bodyText.slice(0, 3000);
      console.error("spec compare rendered sample " + row.sku + ": " + sample.replace(/\s+/g, " ").slice(0, 2200));
    }

    return { specs, sourceUrl: page.url() || compareUrl, modelLabel: selectedModel || catalogModelLabel(row) };
  } finally {
    await page.close();
  }
}

async function fetchCompareSpecs(row) {
  return renderCompareSpecs(row);
}

function knownSpecPatterns() {
  return [
    ["weight", "무게", /(?:^|\n)무게\s*[:：]?\s*([^\n]{1,80})/i],
    ["dimensions", "크기", /(?:^|\n)(?:크기|제품 크기|크기\s*\([^\n]+\))\s*[:：]?\s*([^\n]{1,100})/i],
    ["display_size", "디스플레이 크기", /(?:^|\n)(?:메인 )?디스플레이 크기\s*[:：]?\s*([^\n]{1,80})/i],
    ["display_resolution", "디스플레이 해상도", /(?:^|\n)(?:메인 )?디스플레이 해상도\s*[:：]?\s*([^\n]{1,80})/i],
    ["display_brightness", "디스플레이 최대 밝기", /(?:^|\n)(?:메인 )?디스플레이 최대 밝기[^\n]*\s*[:：]?\s*([^\n]{1,80})/i],
    ["refresh_rate", "디스플레이 가변주사율", /(?:^|\n)(?:메인 )?디스플레이 가변주사율\s*[:：]?\s*([^\n]{1,80})/i],
    ["processor", "프로세서", /(?:^|\n)프로세서\s*[:：]?\s*([^\n]{1,100})/i],
    ["cpu_cores", "코어", /(?:^|\n)코어\s*[:：]?\s*([^\n]{1,80})/i],
    ["battery", "배터리", /(?:^|\n)배터리\s*[:：]?\s*([^\n]{1,100})/i],
    ["memory", "메모리", /(?:^|\n)메모리\s*[:：]?\s*([^\n]{1,80})/i],
    ["storage", "스토리지(저장 용량)", /(?:^|\n)스토리지(?:\(저장 용량\))?\s*[:：]?\s*([^\n]{1,80})/i],
    ["wide_camera", "광각 카메라", /(?:^|\n)광각 카메라\s*[:：]?\s*([^\n]{1,100})/i],
    ["ultrawide_camera", "초광각 카메라", /(?:^|\n)초광각 카메라\s*[:：]?\s*([^\n]{1,100})/i],
    ["telephoto_camera", "망원 카메라", /(?:^|\n)망원 카메라\s*[:：]?\s*([^\n]{1,100})/i],
    ["front_camera", "전면 카메라", /(?:^|\n)전면 카메라\s*[:：]?\s*([^\n]{1,100})/i],
    ["water_resistance", "방수", /(?:^|\n)방수\s*[:：]?\s*([^\n]{1,80})/i],
    ["connectivity", "연결성", /(?:^|\n)연결성\s*[:：]?\s*([^\n]{1,120})/i],
    ["body_material", "바디 재질", /(?:^|\n)바디 재질\s*[:：]?\s*([^\n]{1,80})/i],
    ["bezel", "베젤", /(?:^|\n)베젤\s*[:：]?\s*([^\n]{1,80})/i]
  ];
}

function extractSamsungSpecsFromText(text) {
  const normalized = String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const specs = [];
  const seen = new Set();

  for (const [key, name, pattern] of knownSpecPatterns()) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const value = normalizeSpecValue(match[1]);
    if (!value || value === name || /^(?:제품별|주요 스펙|스펙 비교하기|비교하기)/i.test(value)) continue;
    const signature = key + "|" + value.toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);

    const unit = specUnit(value);
    specs.push({
      key,
      name,
      value,
      ...(unit ? { unit } : {}),
      source: "samsung_pdp"
    });
  }

  const directPatterns = [
    ["weight", "무게", /(?:Galaxy|갤럭시)[^\n]{0,120}?([0-9]{2,4}(?:\.[0-9]+)?\s*g)\s*무게/i],
    ["battery", "배터리", /\b([0-9]{3,5}\s*mAh)\b/i],
    ["memory", "메모리", /(?:^|\n)([0-9]{1,2}\s*GB)\s*(?:메모리|RAM)\b/i],
    ["display_size", "디스플레이 크기", /(?:^|\n)([0-9]{2,3}(?:\.[0-9]+)?\s*mm)\s*디스플레이\b/i]
  ];

  for (const [key, name, pattern] of directPatterns) {
    if (specs.some((item) => item.key === key)) continue;
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = normalizeSpecValue(match[1]);
    specs.push({ key, name, value, ...(specUnit(value) ? { unit: specUnit(value) } : {}), source: "samsung_pdp" });
  }

  return specs.filter(validPdpSpec);
}

async function renderProductSpecs(product) {
  const chromePath = process.env.CHROME_PATH || "";
  if (!chromePath || !product?.product_detail_url || product.product_detail_url === product.catalog_source_url) {
    return { specs: [], sourceUrl: product?.product_detail_url || product?.url || "" };
  }

  const { chromium } = await import("playwright-core");
  if (!catalogBrowser) {
    catalogBrowser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }

  const page = await catalogBrowser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 1200 }
  });

  try {
    await page.goto(product.product_detail_url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1800);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    let specs = extractSamsungSpecsFromText(bodyText);

    // Product configuration near the top often exposes storage/memory even when the comparison table is lazy.
    if (!specs.some((item) => item.key === "storage")) {
      const storage = bodyText.match(/(?:용량|스토리지)[\s\S]{0,160}?([0-9]+\s*(?:GB|TB))/i);
      if (storage) specs.push({ key: "storage", name: "스토리지(저장 용량)", value: normalizeSpecValue(storage[1]), unit: storage[1].match(/GB|TB/i)?.[0] || "", source: "samsung_pdp" });
    }
    if (!specs.some((item) => item.key === "memory")) {
      const memory = bodyText.match(/([0-9]+\s*GB)\s*(?:\||ㅣ)\s*([0-9]+\s*GB)/);
      if (memory) specs.push({ key: "memory", name: "메모리", value: normalizeSpecValue(memory[2]), unit: "GB", source: "samsung_pdp" });
    }

    const sourceUrl = page.url();
    console.error("spec PDP " + product.sku + ": " + specs.length + " normalized specs from " + sourceUrl);

    if (!specs.length) {
      const markerIndex = bodyText.search(/(?:^|\n)스펙(?:\n|$)/m);
      const sample = markerIndex >= 0
        ? bodyText.slice(markerIndex, markerIndex + 3500)
        : bodyText.slice(0, 2500);
      console.error("spec PDP empty sample " + product.sku + ": " + sample.replace(/\s+/g, " ").slice(0, 1800));
    }

    return { specs, sourceUrl };
  } finally {
    await page.close();
  }
}

async function renderCatalogHtml(url) {
  const chromePath = process.env.CHROME_PATH || "";
  if (!chromePath) throw new Error("CHROME_PATH is not configured for rendered catalog fallback");

  const { chromium } = await import("playwright-core");
  if (!catalogBrowser) {
    catalogBrowser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }

  const page = await catalogBrowser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 1200 }
  });

  const fragmentsByModel = new Map();
  const catalogPayloads = [];

  page.on("response", async (response) => {
    try {
      const contentType = String(response.headers()["content-type"] || "").toLowerCase();
      if (!/json|javascript|text/.test(contentType)) return;
      const responseUrl = response.url();
      if (!responseUrl.includes("samsung.com")) return;

      const body = await response.text();
      const models = [...new Set((body.match(/SM-[A-Z0-9-]+/gi) || []).map((value) => value.toUpperCase()))];
      if (!models.length) return;

      catalogPayloads.push({ url: responseUrl, contentType, body, models });
    } catch {}
  });

  const collectVisibleProducts = async () => {
    const text = await page.locator("body").innerText().catch(() => "");
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index++) {
      const matches = [...lines[index].matchAll(/SM-[A-Z0-9-]+/gi)];
      for (const match of matches) {
        const model = match[0].toUpperCase();
        const from = Math.max(0, index - 14);
        const to = Math.min(lines.length, index + 32);
        const fragment = lines.slice(from, to).join("\n");
        const previous = fragmentsByModel.get(model) || "";
        if (fragment.length > previous.length) fragmentsByModel.set(model, fragment);
      }
    }
  };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await collectVisibleProducts();

    let stagnant = 0;
    let previousCount = fragmentsByModel.size;
    let previousY = -1;

    for (let round = 0; round < 140; round++) {
      const state = await page.evaluate(() => ({
        y: window.scrollY,
        height: document.documentElement.scrollHeight,
        viewport: window.innerHeight
      }));

      const nextY = Math.min(state.height, state.y + Math.max(650, Math.floor(state.viewport * 0.72)));
      await page.evaluate((y) => window.scrollTo(0, y), nextY);
      await page.waitForTimeout(180);
      await collectVisibleProducts();

      const newCount = fragmentsByModel.size;
      if (newCount > previousCount) stagnant = 0;
      else stagnant += 1;

      const after = await page.evaluate(() => ({
        y: window.scrollY,
        height: document.documentElement.scrollHeight,
        viewport: window.innerHeight
      }));

      const reachedBottom = after.y + after.viewport >= after.height - 24;
      const didNotMove = Math.abs(after.y - previousY) < 2;
      previousCount = newCount;
      previousY = after.y;

      if (reachedBottom && stagnant >= 5) {
        const buttons = page.locator("button:visible");
        const count = await buttons.count();
        let expanded = false;

        for (let index = count - 1; index >= 0; index--) {
          const button = buttons.nth(index);
          const label = (await button.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
          if (!/^(더\s*보기|load\s*more|view\s*more)(?:\s*\/.*)?$/i.test(label)) continue;
          try {
            await button.click({ timeout: 1800 });
            await page.waitForTimeout(700);
            await collectVisibleProducts();
            if (fragmentsByModel.size > newCount) {
              expanded = true;
              stagnant = 0;
              console.error("catalog rendered: load-more expanded models " + newCount + " -> " + fragmentsByModel.size);
              break;
            }
          } catch {}
        }

        if (!expanded) break;
      }

      if (didNotMove && stagnant >= 8) break;
    }

    console.error("catalog rendered: accumulated visible model cards=" + fragmentsByModel.size + "; payloads=" + catalogPayloads.length);

    const goodsListUrl = catalogPayloads.find((item) => item.url.includes("/cxhr/pf/goodsList"))?.url || "";
    let apiGoods = await fetchCatalogGoodsPages(page.context(), goodsListUrl);

    if (!apiGoods.length) {
      const fallback = [];
      for (const payload of catalogPayloads.filter((item) => item.url.includes("/cxhr/pf/goodsList"))) {
        try {
          fallback.push(...findCatalogGoods(JSON.parse(payload.body)));
        } catch {}
      }
      apiGoods = [...new Map(
        fallback.map((item) => [String(item.mdlCode || "").toUpperCase(), item])
      ).values()];
    }

    console.error("catalog rendered: API catalog goods=" + apiGoods.length);
    return {
      visibleText: [...fragmentsByModel.values()].join("\n\n"),
      apiGoods
    };
  } finally {
    await page.close();
  }
}
async function closeCatalogBrowser() {
  if (catalogBrowser) {
    await catalogBrowser.close();
    catalogBrowser = null;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(response.status + " " + response.statusText);

    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    let body = buffer;
    if (/gzip/i.test(contentType) || url.toLowerCase().endsWith(".gz")) {
      try {
        body = gunzipSync(buffer);
      } catch {
        body = buffer;
      }
    }

    return { text: body.toString("utf8"), finalUrl: response.url, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text) {
  const sitemaps = [];
  const groups = [];
  let agents = [];
  let disallow = [];
  let allow = [];
  let directivesStarted = false;

  const flush = () => {
    if (agents.length) groups.push({ agents, disallow, allow });
    agents = [];
    disallow = [];
    allow = [];
    directivesStarted = false;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }

    if (key === "user-agent") {
      if (directivesStarted) flush();
      if (value) agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "disallow" || key === "allow") && agents.length) {
      directivesStarted = true;
      if (!value) continue;
      if (key === "disallow") disallow.push(value);
      if (key === "allow") allow.push(value);
    }
  }

  flush();
  const wildcard = groups.find((group) => group.agents.includes("*")) || { disallow: [], allow: [] };
  return { sitemaps, disallow: wildcard.disallow, allow: wildcard.allow };
}

function robotPatternMatches(url, pattern) {
  const parsed = new URL(url);
  const target = parsed.pathname + parsed.search;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  let escaped = "";

  for (const char of body) {
    if (char === "*") escaped += ".*";
    else if ("\\^$+?.()|{}[]".includes(char)) escaped += "\\" + char;
    else escaped += char;
  }

  return new RegExp("^" + escaped + (anchored ? "$" : "")).test(target);
}

function allowedByRobots(url, rules) {
  const matches = [];
  for (const pattern of rules.disallow || []) {
    if (robotPatternMatches(url, pattern)) matches.push({ type: "disallow", length: pattern.replace(/\*/g, "").length });
  }
  for (const pattern of rules.allow || []) {
    if (robotPatternMatches(url, pattern)) matches.push({ type: "allow", length: pattern.replace(/\*/g, "").length });
  }
  if (!matches.length) return true;
  matches.sort((a, b) => b.length - a.length || (a.type === "allow" ? -1 : 1));
  return matches[0].type === "allow";
}

function xmlLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => {
    const raw = match[1].trim().replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "").trim();
    return decode(raw);
  });
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function discoverUrls(sitemapSeeds) {
  let frontier = [...new Set(sitemapSeeds)];
  const seenMaps = new Set();
  const urls = new Set();
  const failedSitemaps = [];
  const concurrency = 8;

  while (frontier.length) {
    const current = frontier.filter((url) => url && !seenMaps.has(url));
    frontier = [];
    for (const url of current) seenMaps.add(url);
    if (!current.length) continue;

    const results = await mapLimit(current, concurrency, async (sitemapUrl) => {
      try {
        const { text } = await fetchText(sitemapUrl);
        return {
          sitemapUrl,
          locs: xmlLocs(text),
          isIndex: /<sitemapindex[\s>]/i.test(text)
        };
      } catch (error) {
        failedSitemaps.push({ url: sitemapUrl, error: error.message });
        console.error("sitemap failed: " + sitemapUrl + ": " + error.message);
        return null;
      }
    });

    for (const result of results.filter(Boolean)) {
      if (result.isIndex) {
        for (const loc of result.locs) {
          try {
            const candidate = new URL(loc);
            if (candidate.origin === base.origin && !seenMaps.has(candidate.href)) frontier.push(candidate.href);
          } catch {}
        }
      } else {
        for (const loc of result.locs) {
          try {
            const candidate = new URL(loc);
            if (candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix)) urls.add(candidate.href);
          } catch {}
        }
      }
    }

    frontier = [...new Set(frontier)];
  }

  return { urls: [...urls], sitemapCount: seenMaps.size, failedSitemaps };
}

function tagAttr(html, tagName, attrName, expected) {
  const tags = html.match(new RegExp("<" + tagName + "\\b[^>]*>", "gi")) || [];
  for (const tag of tags) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? ""])
    );
    const actual = (attrs[attrName] || "").toLowerCase();
    if (!expected || actual.split(/\s+/).includes(expected.toLowerCase())) return attrs;
  }
  return null;
}

function visibleText(html) {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

function structuredSpecs(product) {
  const values = Array.isArray(product?.additionalProperty)
    ? product.additionalProperty
    : product?.additionalProperty
      ? [product.additionalProperty]
      : [];

  return values
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: String(item.name || item.propertyID || "").trim(),
      value: item.value ?? item.valueReference?.name ?? "",
      ...(item.unitText || item.unitCode ? { unit: String(item.unitText || item.unitCode) } : {})
    }))
    .filter((item) => item.name && item.value !== "");
}

function skuFromUrl(pageUrl) {
  const match = String(pageUrl).match(/(?:^|[-/])sku-([^/?#]+)/i);
  return match ? match[1].toUpperCase() : "";
}

function evidenceSnippet(text, regex, max = 320) {
  const match = String(text || "").match(regex);
  if (!match || match.index === undefined) return "";
  const start = Math.max(0, match.index - Math.floor(max / 3));
  return String(text).slice(start, start + max).trim();
}

function evidenceOption(page, type, label, regex, details = null, confidence = "high", applicability = "product") {
  const evidence = evidenceSnippet(page.text, regex);
  if (!evidence) return null;
  return {
    type,
    available: true,
    label,
    details,
    evidence,
    confidence,
    applicability,
    source_url: page.canonical_url || page.url,
    captured_at: page.captured_at
  };
}

function extractCommerce(page, sourceUrl = "") {
  const pick = (type, label, regex, details = null) =>
    evidenceOption(page, type, label, regex, details);

  const compact = (values) => values.filter(Boolean);
  const value = String(sourceUrl || page?.canonical_url || page?.url || "").toLowerCase();
  const durableEligible = /\/(smartphones?|mobile|tablets?|watches?|galaxy-watch|galaxy-buds|galaxy-ring|galaxy-book|laptops?|computers?|tvs?|televisions?|projectors?|monitors?|refrigerators?|washers?|washing-machines?|dryers?|dishwashers?|ranges?|cooktops?|wall-ovens?|microwaves?|vacuums?|air-conditioners?|air-purifiers?)\//.test(value);
  const installEligible = /\/(tvs?|televisions?|projectors?|refrigerators?|washers?|washing-machines?|dryers?|dishwashers?|ranges?|cooktops?|wall-ovens?|microwaves?|air-conditioners?)\//.test(value);
  const subscriptionEligible = /\/(smartphones?|mobile|tablets?|tvs?|televisions?|refrigerators?|washers?|washing-machines?|dryers?|dishwashers?|air-conditioners?)\//.test(value);

  const result = {
    purchase_methods: compact([
      pick("financing", "Financing / installments", /\b(pay in monthly installments|monthly payments?|installment plan|0% finance|finance from|net 30,? 60,? 90)\b|[0-9]{1,2}개월.{0,12}(무이자|할부)|무이자.{0,12}할부/i)
    ]),
    subscriptions: compact([
      pick("subscription", "Subscription / rental", /\b(subscribe (?:and|to)|subscription (?:plan|price|payment)|rental plan|upgrade program)\b|구독.{0,20}(월 납부|요금|플랜|가입)|렌탈.{0,20}(요금|가입|플랜)/i)
    ]),
    trade_in: compact([
      pick("trade_in", "Trade-in", /(?:trade[- ]?in.{0,80}(?:discount|credit|value|device|applied|yes|no|learn more))|(?:discount|credit|value).{0,40}trade[- ]?in|보상판매.{0,30}(신청|금액|혜택|기기)|중고.{0,12}보상.{0,20}(금액|신청|혜택)/i)
    ]),
    protection: compact([
      pick("samsung_care_plus", "Samsung Care+", /(?:add|select|choose).{0,30}samsung\s*care\+?|samsung\s*care\+?.{0,50}(?:policy|coverage|quantity|add|select|choose)|삼성케어(?:플러스|\+).{0,30}(?:가입|선택|추가|보장|요금)/i),
      pick("extended_warranty", "Extended warranty", /(?:add|select|choose).{0,30}extended warranty|extended warranty.{0,40}(?:add|coverage|plan)|보증.{0,8}연장.{0,20}(?:가입|선택|요금)/i)
    ]),
    delivery: compact([
      pick("delivery", "Delivery / shipping", /\b(delivery (?:arrives|to|options?|date)|free shipping|doorstep delivery|shipping (?:available|date|options?))\b|(?:무료배송|배송비|배송일|배송 예정|배송 옵션|제품 배송\/설치)/i)
    ]),
    installation: compact([
      pick("installation", "Installation", /\b(standard installation charges|installation service|professional installation|add installation)\b|(?:추가 설치비|설치 서비스|설치상품|설치 환경|전문 설치)/i)
    ]),
    haul_away: compact([
      pick("haul_away", "Haul away / recycling", /\b(?:add )?haul[- ]?away|old appliance removal (?:available|service|option)|we(?:'|’)ll take away your old\b|폐가전.{0,12}(?:수거 신청|무상 수거|회수 신청|수거 서비스)|기존.{0,10}(?:가전|제품).{0,10}(?:수거 신청|회수 신청)/i)
    ]),
    bundles: compact([
      pick("bundle", "Bundle / add-on", /\b(bundle (?:and save|discount|offer)|bundle builder|add[- ]?on offer|accessor(?:y|ies) offer)\b|묶음.{0,12}(?:할인|혜택)|패키지.{0,8}할인/i)
    ]),
    membership: compact([
      pick("rewards", "Rewards / membership", /(?:earn|redeem|save).{0,30}samsung rewards|get exclusive deals with a samsung business account|멤버십 포인트.{0,30}(?:적립|사용|예상)|리워드.{0,20}(?:적립|사용)/i)
    ]),
    promotions: compact([
      pick("promotion", "Promotion / discount", /\b(?:claim )?cashback|save (?:up to )?[£$€]?[0-9]+|[0-9]+% (?:off|discount)|special offer\b|쿠폰.{0,20}(?:적용|할인)|[0-9]+%.{0,8}할인|즉시.{0,8}할인/i)
    ])
  };

  if (!durableEligible) {
    result.trade_in = [];
    result.protection = [];
  }
  if (!subscriptionEligible) result.subscriptions = [];
  if (!installEligible) {
    result.installation = [];
    result.haul_away = [];
  }

  return result;
}

function audienceFromUrl(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes("/business/")) return "business";
  return value ? "consumer" : "unknown";
}

function categoryPathFromUrl(url) {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const ignored = new Set(["us", "uk", "sec", "business", "buy", "product", "products"]);
    return segments
      .filter((segment) => !ignored.has(segment.toLowerCase()))
      .filter((segment) => !/^sku-/i.test(segment))
      .slice(0, 4)
      .map((segment) => decodeURIComponent(segment).replace(/-/g, " "));
  } catch {
    return [];
  }
}

function pathMatchesAny(url, patterns = []) {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  return patterns.some((pattern) => pathname.includes(String(pattern).toLowerCase()));
}

function isTargetUrl(url) {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }

  if (pathname.includes("/support/model/")) {
    return [...knownProductIdentifiers].some((identifier) =>
      identifier.length >= 5 && pathname.includes(identifier)
    );
  }

  if (pathMatchesAny(url, crawlScope.excludePathPatterns || [])) return false;
  return pathMatchesAny(url, crawlScope.includePathPatterns || []);
}

function targetPriority(url) {
  let score = -priority(url);
  const value = String(url).toLowerCase();
  for (const pattern of crawlScope.priorityPatterns || []) {
    if (value.includes(String(pattern).toLowerCase())) score += 10;
  }
  if (!value.includes("/business/")) score += 3;
  return -score;
}

function catalogTextLines(html) {
  return decode(
    String(html || "")
      .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(?:div|li|p|section|article|h[1-6]|button|a|span)>/gi, "\n")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function plausibleCatalogName(line) {
  const value = String(line || "").trim();
  if (!value || value.length < 3 || value.length > 120) return false;
  if (/^(?:NEW|Image:|선택됨|블루투스|LTE|자급제|구매하기|더 알아보기|비교하기|혜택가|기준가|최대 혜택가|적립 예정 포인트)$/i.test(value)) return false;
  if (/^[0-9,.]+\s*(?:원|GB|TB|mm|%|P)?$/i.test(value)) return false;
  if (/^(?:색상|컬러|스토리지|저장 용량|연결 방식|평점|리뷰수)/i.test(value)) return false;
  if (/[{}:;]|^\.|"?(?:mdlCode|grpPath|imgChipURL|actvPhonePlanVer)"?/i.test(value)) return false;
  return /(?:갤럭시|Galaxy|Samsung|삼성)/i.test(value);
}

function priceFromCatalogWindow(text) {
  const patterns = [
    /(?:최대\s*)?혜택가.{0,80}?([0-9][0-9,]{2,})\s*원/i,
    /(?:판매가|가격).{0,80}?([0-9][0-9,]{2,})\s*원/i,
    /([0-9][0-9,]{3,})\s*원/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replaceAll(",", "");
  }
  return "";
}

function parseCatalogListing(html, source) {
  const lines = catalogTextLines(html);
  const pattern = new RegExp(source.model_pattern || "SM-[A-Z][0-9]{3}[A-Z0-9]{4,12}", "i");
  const rows = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index++) {
    const modelMatch = lines[index].match(pattern);
    if (!modelMatch) continue;
    const modelCode = modelMatch[0].toUpperCase();
    if (seen.has(modelCode)) continue;

    let name = "";
    for (let offset = 1; offset <= 10; offset++) {
      const candidate = lines[index - offset];
      if (plausibleCatalogName(candidate)) {
        name = candidate;
        break;
      }
    }
    if (!name) name = modelCode;

    const window = lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 28)).join(" ");
    const unavailable = /품절|일시품절|재고\s*없음|out of stock|sold out/i.test(window);
    const hasBuyAction = /구매하기|buy now|add to cart/i.test(window);
    const lifecycleStatus = hasBuyAction && !unavailable ? "current_sellable" : "current_unavailable";
    const price = lifecycleStatus === "current_sellable" ? priceFromCatalogWindow(window) : "";

    const key = sha(marketCode + "|" + modelCode.toLowerCase()).slice(0, 24);
    rows.push({
      key,
      market: marketCode,
      url: source.url,
      name,
      sku: modelCode,
      model: modelCode,
      brand: "Samsung",
      offers: {
        price,
        currency: marketCode === "kr" ? "KRW" : "",
        availability: lifecycleStatus === "current_sellable"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock"
      },
      specs: [],
      captured_at: capturedAt,
      catalog_source_id: source.id,
      catalog_source_url: source.url,
      catalog_category: source.category,
      lifecycle_status: lifecycleStatus,
      catalog_verified_at: capturedAt
    });
    rows[rows.length - 1].fingerprint = sha(JSON.stringify({
      name: rows[rows.length - 1].name,
      sku: rows[rows.length - 1].sku,
      offers: rows[rows.length - 1].offers,
      lifecycle_status: lifecycleStatus
    }));
    seen.add(modelCode);
  }

  return rows;
}

function productCatalogCategory(product) {
  const value = String(product?.url || "").toLowerCase();
  if (value.includes("/smartphones/")) return "smartphones";
  if (value.includes("/watches/") || value.includes("/galaxy-watch/")) return "watches";
  return "";
}

function buildLifecycleResolver(catalogRows, successfulCatalogSources) {
  const byIdentity = new Map();
  for (const row of catalogRows) {
    for (const identity of [row.sku, row.model]) {
      const normalized = String(identity || "").trim().toLowerCase();
      if (normalized) byIdentity.set(normalized, row);
    }
  }

  const coveredCategories = new Set(
    catalogSourceDefs
      .filter((source) => successfulCatalogSources.has(source.id))
      .map((source) => source.category)
  );

  return (product) => {
    const stableIdentities = [product.sku, product.model]
      .map((identity) => String(identity || "").trim().toLowerCase())
      .filter(Boolean);

    for (const normalized of stableIdentities) {
      if (byIdentity.has(normalized)) {
        const catalog = byIdentity.get(normalized);
        const sellable = catalog.lifecycle_status === "current_sellable";
        return {
          lifecycle_status: catalog.lifecycle_status,
          catalog_current: true,
          sellable,
          catalog_enforced: true,
          commerce_eligible: sellable,
          catalog_source_id: catalog.catalog_source_id,
          catalog_source_url: catalog.catalog_source_url,
          catalog_verified_at: catalog.catalog_verified_at
        };
      }
    }

    const category = productCatalogCategory(product);
    if (category && coveredCategories.has(category)) {
      if (!stableIdentities.length) {
        return {
          lifecycle_status: "unverified",
          catalog_current: null,
          sellable: null,
          catalog_enforced: true,
          commerce_eligible: false,
          catalog_source_id: "",
          catalog_source_url: "",
          catalog_verified_at: capturedAt
        };
      }

      return {
        lifecycle_status: "legacy",
        catalog_current: false,
        sellable: false,
        catalog_enforced: true,
        commerce_eligible: false,
        catalog_source_id: "",
        catalog_source_url: "",
        catalog_verified_at: capturedAt
      };
    }

    return {
      lifecycle_status: "unverified",
      catalog_current: null,
      sellable: null,
      catalog_enforced: false,
      commerce_eligible: null,
      catalog_source_id: "",
      catalog_source_url: "",
      catalog_verified_at: null
    };
  };
}

function normalizeCatalogName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function findProductObjects(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) findProductObjects(item, out);
    return out;
  }
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "product")) out.push(value);
  for (const child of Object.values(value)) findProductObjects(child, out);
  return out;
}

function parseProducts(html, pageUrl) {
  const products = [];
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      for (const product of findProductObjects(parsed)) {
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        const name = String(product.name || "").trim();
        const sku = String(product.sku || product.mpn || skuFromUrl(pageUrl) || "").trim();
        const model = String(product.model || product.productID || "").trim();
        const specs = normalizeSpecEntries(structuredSpecs(product), "json_ld");
        const keySeed = sku || model || name || pageUrl;
        const normalized = {
          key: sha(marketCode + "|" + keySeed.toLowerCase()).slice(0, 24),
          market: marketCode,
          url: pageUrl,
          name,
          sku,
          model,
          brand: typeof product.brand === "string" ? product.brand : (product.brand?.name || "Samsung"),
          offers: offers ? {
            price: offers.price ?? offers.lowPrice ?? "",
            currency: offers.priceCurrency ?? "",
            availability: offers.availability ?? ""
          } : null,
          specs,
          captured_at: capturedAt
        };

        normalized.fingerprint = sha(JSON.stringify({
          name: normalized.name,
          sku: normalized.sku,
          model: normalized.model,
          brand: normalized.brand,
          offers: normalized.offers,
          specs: normalized.specs
        }));

        products.push(normalized);
      }
    } catch {}
  }
  return products;
}

function extractPage(html, finalUrl, discoveredUrl) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const metaDescription = (tagAttr(html, "meta", "name", "description") || {}).content || "";
  const canonicalAttrs = tagAttr(html, "link", "rel", "canonical");
  const canonical = canonicalAttrs?.href ? new URL(canonicalAttrs.href, finalUrl).href : finalUrl;
  const text = visibleText(html);

  const record = {
    id: sha(canonical).slice(0, 24),
    market: marketCode,
    discovered_url: discoveredUrl,
    url: finalUrl,
    canonical_url: canonical,
    title,
    description: decode(metaDescription),
    text,
    captured_at: capturedAt
  };

  record.content_hash = sha(JSON.stringify({
    canonical_url: record.canonical_url,
    title: record.title,
    description: record.description,
    text: record.text
  }));
  return record;
}

function priority(url) {
  const value = url.toLowerCase();
  let score = 0;
  if (/\/smartphones?\//.test(value)) score += 5;
  if (/\/tablets?\//.test(value)) score += 5;
  if (/\/tvs?\//.test(value)) score += 5;
  if (/\/monitors?\//.test(value)) score += 4;
  if (/\/refrigerators?\//.test(value)) score += 4;
  if (/\/washers?|\/washing-machines?\//.test(value)) score += 4;
  if (/\/support\//.test(value)) score += 2;
  if (/\/buy\//.test(value)) score += 4;
  return -score;
}

function chooseBatch(urls, visitedUrls, previousCursor, requestedBatch) {
  if (!urls.length || requestedBatch <= 0) return { selected: [], nextCursor: previousCursor || 0, wrapped: false };

  const size = Math.min(requestedBatch, urls.length);
  const selected = [];
  const chosen = new Set();
  for (const url of urls) {
    if (!visitedUrls.has(url)) {
      selected.push(url);
      chosen.add(url);
      if (selected.length >= size) return { selected, nextCursor: previousCursor || 0, wrapped: false };
    }
  }

  const cursor = Math.max(0, Number(previousCursor || 0)) % urls.length;
  let scanned = 0;
  while (selected.length < size && scanned < urls.length) {
    const candidate = urls[(cursor + scanned) % urls.length];
    if (!chosen.has(candidate)) {
      selected.push(candidate);
      chosen.add(candidate);
    }
    scanned += 1;
  }

  return { selected, nextCursor: (cursor + scanned) % urls.length, wrapped: cursor + scanned >= urls.length };
}

function supportType(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes("manual")) return "manual";
  if (value.includes("download")) return "download";
  if (value.includes("warranty")) return "warranty";
  if (value.includes("repair")) return "repair";
  return "support";
}

function pageForProduct(product, pages) {
  const direct = pages.find((page) =>
    page.canonical_url === product.url ||
    page.url === product.url ||
    page.discovered_url === product.url
  );
  if (direct) return direct;

  const identity = String(product.sku || product.model || "").toLowerCase();
  if (!identity) return null;
  return pages.find((page) =>
    String(page.url || "").toLowerCase().includes(identity) ||
    String(page.canonical_url || "").toLowerCase().includes(identity) ||
    String(page.title || "").toLowerCase().includes(identity)
  ) || null;
}

function buildDataMarts(pages, products, lifecycleFor, catalogRows) {
  const productMaster = [];
  const productSpecs = [];
  const marketOffers = [];
  const commerceOptions = [];
  const taxonomyMap = new Map();
  const currentCatalogNames = new Set(
    catalogRows.map((row) => normalizeCatalogName(row.name)).filter(Boolean)
  );

  for (const product of products) {
    if (!product.sku && !product.model && !product.name) continue;
    if (!product.sku && !product.model && currentCatalogNames.has(normalizeCatalogName(product.name))) {
      continue;
    }

    const page = pageForProduct(product, pages);
    const sourceUrl = product.url || page?.canonical_url || page?.url || market.baseUrl;
    const categoryPath = categoryPathFromUrl(sourceUrl);
    const lifecycle = lifecycleFor(product);
    const isDetail = /\/buy\//i.test(sourceUrl) ||
      (!!product.sku && String(sourceUrl).toLowerCase().includes(product.sku.toLowerCase())) ||
      (!!product.model && String(sourceUrl).toLowerCase().includes(product.model.toLowerCase()));
    const commerceAllowed = lifecycle.commerce_eligible !== false &&
      lifecycle.lifecycle_status !== "current_unavailable" &&
      lifecycle.lifecycle_status !== "legacy";
    const commerce = page && isDetail && commerceAllowed
      ? extractCommerce(page, sourceUrl)
      : {
      purchase_methods: [],
      subscriptions: [],
      trade_in: [],
      protection: [],
      delivery: [],
      installation: [],
      haul_away: [],
      bundles: [],
      membership: [],
      promotions: []
    };

    productMaster.push({
      market_product_key: product.key,
      market: marketCode,
      audience: audienceFromUrl(sourceUrl),
      name: product.name || "",
      sku: product.sku || "",
      model: product.model || "",
      brand: product.brand || "Samsung",
      category_path: categoryPath,
      product_url: product.product_detail_url || sourceUrl,
      source_urls: [...new Set([product.product_detail_url, sourceUrl, page?.canonical_url, page?.url].filter(Boolean))],
      lifecycle_status: lifecycle.lifecycle_status,
      catalog_current: lifecycle.catalog_current,
      sellable: lifecycle.sellable,
      catalog_enforced: lifecycle.catalog_enforced,
      commerce_eligible: lifecycle.commerce_eligible,
      catalog_source_id: lifecycle.catalog_source_id,
      catalog_source_url: lifecycle.catalog_source_url,
      catalog_verified_at: lifecycle.catalog_verified_at,
      captured_at: product.captured_at || page?.captured_at || capturedAt
    });

    productSpecs.push({
      market_product_key: product.key,
      market: marketCode,
      sku: product.sku || "",
      model: product.model || "",
      specs: product.specs || [],
      source_url: product.spec_source_url || product.product_detail_url || sourceUrl,
      source_model: product.spec_model_label || "",
      captured_at: product.spec_captured_at || product.captured_at || capturedAt
    });

    if (lifecycle.commerce_eligible !== false &&
        lifecycle.lifecycle_status !== "legacy" &&
        lifecycle.lifecycle_status !== "current_unavailable") {
      const currentUnavailable = false;
      const offerCore = {
        market_product_key: product.key,
        market: marketCode,
        lifecycle_status: lifecycle.lifecycle_status,
        price: currentUnavailable ? "" : (product.offers?.price ?? ""),
        currency: currentUnavailable ? (product.offers?.currency ?? "") : (product.offers?.currency ?? ""),
        availability: currentUnavailable
          ? "https://schema.org/OutOfStock"
          : (product.offers?.availability ?? ""),
        purchase_url: sourceUrl,
        promotions: currentUnavailable ? [] : commerce.promotions,
        captured_at: product.captured_at || capturedAt
      };
      offerCore.fingerprint = sha(JSON.stringify({
        lifecycle_status: offerCore.lifecycle_status,
        price: offerCore.price,
        currency: offerCore.currency,
        availability: offerCore.availability,
        promotions: offerCore.promotions.map(({ type, label, evidence }) => ({ type, label, evidence }))
      }));
      marketOffers.push(offerCore);
    }

    const commerceCore = {
      market_product_key: product.key,
      market: marketCode,
      purchase_methods: commerce.purchase_methods,
      subscriptions: commerce.subscriptions,
      trade_in: commerce.trade_in,
      protection: commerce.protection,
      delivery: commerce.delivery,
      installation: commerce.installation,
      haul_away: commerce.haul_away,
      bundles: commerce.bundles,
      membership: commerce.membership,
      source_url: sourceUrl,
      captured_at: page?.captured_at || product.captured_at || capturedAt
    };
    commerceCore.lifecycle_status = lifecycle.lifecycle_status;
    commerceCore.fingerprint = sha(JSON.stringify({
      purchase_methods: commerceCore.purchase_methods,
      subscriptions: commerceCore.subscriptions,
      trade_in: commerceCore.trade_in,
      protection: commerceCore.protection,
      delivery: commerceCore.delivery,
      installation: commerceCore.installation,
      haul_away: commerceCore.haul_away,
      bundles: commerceCore.bundles,
      membership: commerceCore.membership
    }));
    if (lifecycle.commerce_eligible !== false &&
        lifecycle.lifecycle_status !== "legacy" &&
        lifecycle.lifecycle_status !== "current_unavailable") {
      commerceOptions.push(commerceCore);
    }

    if (categoryPath.length) {
      const key = categoryPath.join(" > ");
      if (!taxonomyMap.has(key)) {
        taxonomyMap.set(key, {
          taxonomy_key: sha(marketCode + "|" + key.toLowerCase()).slice(0, 24),
          market: marketCode,
          path: categoryPath,
          source_url: sourceUrl,
          captured_at: product.captured_at || capturedAt
        });
      }
    }
  }

  const supportResources = pages
    .filter((page) => /\/support\/|manual|download|warranty|repair/i.test(page.canonical_url || page.url || ""))
    .map((page) => ({
      support_key: page.id,
      market: marketCode,
      type: supportType(page.canonical_url || page.url),
      title: page.title || "",
      description: page.description || "",
      source_url: page.canonical_url || page.url,
      captured_at: page.captured_at
    }));

  return {
    productMaster,
    productSpecs,
    marketOffers,
    commerceOptions,
    supportResources,
    taxonomy: [...taxonomyMap.values()],
    currentCatalog: catalogRows
  };
}

function toProductHistoryRecord(product) {
  const row = {
    key: product.key,
    market: product.market,
    url: product.url || "",
    name: product.name || "",
    sku: product.sku || "",
    model: product.model || "",
    brand: product.brand || "Samsung",
    specs: product.specs || [],
    captured_at: product.captured_at || capturedAt
  };
  row.fingerprint = sha(JSON.stringify({
    name: row.name,
    sku: row.sku,
    model: row.model,
    brand: row.brand,
    specs: row.specs
  }));
  return row;
}

function normalizeProductHistory(rows) {
  const normalized = [];
  const latest = new Map();

  for (const item of rows) {
    if (!item?.key) continue;
    const row = toProductHistoryRecord(item);
    if (latest.get(row.key) === row.fingerprint) continue;
    normalized.push(row);
    latest.set(row.key, row.fingerprint);
  }

  return normalized;
}

async function appendChangedHistory(file, rows, { pruneToCurrent = false } = {}) {
  let history = await readJsonl(file);
  const allowedKeys = new Set(rows.map((row) => row.market_product_key || row.key).filter(Boolean));

  if (pruneToCurrent) {
    history = history.filter((item) => allowedKeys.has(item.market_product_key || item.key));
  }

  const latest = new Map();
  for (const item of history) {
    const key = item.market_product_key || item.key;
    if (key) latest.set(key, item.fingerprint || "");
  }
  for (const row of rows) {
    const key = row.market_product_key || row.key;
    if (!key) continue;
    if (latest.get(key) !== row.fingerprint) {
      history.push(row);
      latest.set(key, row.fingerprint);
    }
  }
  await writeFile(file, toJsonl(history));
  return history.length;
}

const currentDir = path.join(ROOT, "data/current", marketCode);
const historyDir = path.join(ROOT, "data/history/products");
const offerHistoryDir = path.join(ROOT, "data/history/offers");
const commerceHistoryDir = path.join(ROOT, "data/history/commerce_options");
const martDir = path.join(ROOT, "data/marts", marketCode);
const manifestDir = path.join(ROOT, "data/manifests");
const manifestFile = path.join(manifestDir, marketCode + ".json");
const metaFile = path.join(currentDir, "meta.json");

await mkdir(currentDir, { recursive: true });
await mkdir(historyDir, { recursive: true });
await mkdir(offerHistoryDir, { recursive: true });
await mkdir(commerceHistoryDir, { recursive: true });
await mkdir(martDir, { recursive: true });
await mkdir(manifestDir, { recursive: true });

const existingPages = await readJsonl(path.join(currentDir, "pages.jsonl"));
const existingProducts = await readJsonl(path.join(currentDir, "products.jsonl"));
const existingSpecRows = await readJsonl(path.join(martDir, "product_specs.jsonl"));
const existingSpecsByKey = new Map(existingSpecRows.map((row) => [row.market_product_key, row]));
for (const product of existingProducts) {
  for (const identifier of [product.sku, product.model]) {
    const normalized = String(identifier || "").trim().toLowerCase();
    if (normalized) knownProductIdentifiers.add(normalized);
  }
}
const existingMeta = await readJson(metaFile, {});
const previousManifest = await readJson(manifestFile, { cursor: 0, cycle: 0, visited_urls: [] });

const catalogRows = [];
const catalogPages = [];
const successfulCatalogSources = new Set();
const failedCatalogSources = [];

for (const source of catalogSourceDefs) {
  try {
    const { text: html, finalUrl, contentType } = await fetchText(source.url);
    if (!/html/i.test(contentType) && !/<html[\s>]/i.test(html)) throw new Error("Catalog source was not HTML");
    const page = extractPage(html, finalUrl, source.url);
    catalogPages.push(page);
    const rawModelMatches = [...String(html).matchAll(/SM-[A-Z0-9-]+/gi)];
    console.error("catalog " + source.id + ": raw model tokens=" + new Set(rawModelMatches.map((match) => match[0].toUpperCase())).size);

    let rows = parseCatalogListing(html, source);
    if (!rows.length) {
      console.error("catalog " + source.id + ": static HTML has no product cards; using rendered/API fallback");
      const rendered = await renderCatalogHtml(source.url);
      rows = rendered.apiGoods.length
        ? parseCatalogApiGoods(rendered.apiGoods, source)
        : parseCatalogListing(rendered.visibleText, source);
    }

    for (const row of rows) {
      const existingProduct = existingProducts.find((item) => item.key === row.key);
      const existingSpecRow = existingSpecsByKey.get(row.key);
      row.specs = sanitizeSpecs(
        (existingProduct?.specs?.length ? existingProduct.specs : null) ||
        (existingSpecRow?.specs?.length ? existingSpecRow.specs : null) ||
        []
      );
      row.spec_source_url = existingProduct?.spec_source_url || existingSpecRow?.source_url || "";
      row.spec_model_label = existingProduct?.spec_model_label || existingSpecRow?.source_model || "";

      const family = catalogFamilySlug(row);
      const hasCompareSpecs = row.specs.some((item) => item.source === "catalog_compare");
      if (hasCompareSpecs && !row.spec_model_label) {
        if (/^(?:galaxy-s25|galaxy-s26)$/i.test(family)) {
          row.specs = [];
          row.spec_source_url = "";
        } else {
          row.spec_model_label = catalogModelLabel(row);
        }
      }

      catalogRows.push(row);
    }
    successfulCatalogSources.add(source.id);
    console.error("catalog " + source.id + ": " + rows.length + " current products");
  } catch (error) {
    failedCatalogSources.push({ id: source.id, url: source.url, error: error.message });
    console.error("catalog failed: " + source.url + ": " + error.message);
  }
}

if (catalogRows.length && specBatch > 0 && marketCode === "kr") {
  const familyRows = new Map();

  for (const row of catalogRows) {
    const family = specFamilyKey(row);
    if (!family) continue;
    if (!familyRows.has(family)) familyRows.set(family, []);
    familyRows.get(family).push(row);
  }

  const families = [...familyRows.entries()]
    .map(([family, rows]) => {
      const specCount = Math.max(0, ...rows.map((row) => sanitizeSpecs(row.specs).length));
      return {
        family,
        rows,
        specCount,
        priority:
          rows.some((row) => row.lifecycle_status === "current_sellable" && sanitizeSpecs(row.specs).length < 5) ? 0 :
          rows.some((row) => row.lifecycle_status === "current_unavailable" && sanitizeSpecs(row.specs).length < 5) ? 1 : 9
      };
    })
    .filter((group) => group.priority < 9)
    .sort((a, b) =>
      a.priority - b.priority ||
      a.specCount - b.specCount ||
      a.family.localeCompare(b.family)
    )
    .slice(0, specBatch);

  console.error(
    "spec enrichment: " + families.length +
    " families queued; total catalog families=" + familyRows.size
  );

  for (const group of families) {
    const representative =
      group.rows.find((row) => row.lifecycle_status === "current_sellable") ||
      group.rows[0];

    let enriched = representative.catalog_category === "watches"
      ? await renderWatchSpecs(representative)
      : await fetchCompareSpecs(representative);

    if (enriched.specs.length < 5 && representative.catalog_category !== "watches") {
      const fallback = await renderProductSpecs(representative).catch((error) => {
        console.error("spec PDP failed " + representative.sku + ": " + error.message);
        return { specs: [], sourceUrl: representative.product_detail_url };
      });
      if (fallback.specs.length > enriched.specs.length) enriched = fallback;
    }

    const trustedSpecs = sanitizeSpecs(enriched.specs);
    if (!trustedSpecs.length) continue;

    for (const product of group.rows) {
      product.specs = trustedSpecs;
      product.spec_captured_at = capturedAt;
      product.spec_source_url = enriched.sourceUrl || compareUrlForCatalogRow(product) || product.product_detail_url;
      product.spec_model_label = enriched.modelLabel || catalogModelLabel(representative);
      product.fingerprint = sha(JSON.stringify({
        name: product.name,
        sku: product.sku,
        offers: product.offers,
        specs: product.specs,
        lifecycle_status: product.lifecycle_status
      }));
    }
  }
}

await closeCatalogBrowser();

const lifecycleFor = buildLifecycleResolver(catalogRows, successfulCatalogSources);

const robotsUrl = new URL("/robots.txt", base).href;
let robots = { sitemaps: [], disallow: [], allow: [] };
try {
  robots = parseRobots((await fetchText(robotsUrl)).text);
} catch (error) {
  console.error("robots unavailable: " + error.message);
}

const marketSitemaps = robots.sitemaps.filter((value) => {
  try {
    const candidate = new URL(value);
    return candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix);
  } catch {
    return false;
  }
});

const preferredSitemap = new URL("sitemap.xml", base).href;
const seeds = [...new Set(marketSitemaps.length ? [...marketSitemaps, preferredSitemap] : [preferredSitemap])];

console.error("discovering sitemap inventory for " + marketCode + "...");
const discovery = await discoverUrls(seeds);
const discoveredUrls = discovery.urls
  .filter((url) => {
    try {
      const candidate = new URL(url);
      return candidate.origin === base.origin && candidate.pathname.startsWith(marketPrefix);
    } catch {
      return false;
    }
  })
  .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));

const crawlableUrls = discoveredUrls.filter((url) => allowedByRobots(url, robots));
if (!crawlableUrls.length && !explicitUrl) throw new Error("No crawlable URLs discovered for " + marketCode);

const targetUrls = crawlableUrls
  .filter(isTargetUrl)
  .sort((a, b) => targetPriority(a) - targetPriority(b) || a.localeCompare(b));
if (!targetUrls.length && !explicitUrl) throw new Error("No data-mart target URLs discovered for " + marketCode);

const urlHash = sha(targetUrls.join("\n"));
const cursorBase = previousManifest.url_hash === urlHash
  ? Number(previousManifest.cursor || 0)
  : Math.min(Number(previousManifest.cursor || 0), Math.max(targetUrls.length - 1, 0));

const targetSet = new Set(targetUrls);
const visitedUrls = new Set((previousManifest.visited_urls || []).filter((url) => targetSet.has(url)));
for (const page of existingPages) {
  for (const candidate of [page.discovered_url, page.url, page.canonical_url]) {
    if (candidate && targetSet.has(candidate)) visitedUrls.add(candidate);
  }
}

let cycle = Number(previousManifest.cycle || 0);
let selected = [];
let nextCursor = cursorBase;
let wrapped = false;

if (explicitUrl) {
  selected = [explicitUrl];
} else if (!discoverOnly) {
  const batch = chooseBatch(targetUrls, visitedUrls, cursorBase, batchPages);
  selected = batch.selected;
  nextCursor = batch.nextCursor;
  wrapped = batch.wrapped;
  if (wrapped) cycle += 1;
}

const manifest = {
  version: 3,
  market: marketCode,
  base_url: market.baseUrl,
  discovered_at: capturedAt,
  sitemap_seed_count: seeds.length,
  sitemap_count: discovery.sitemapCount,
  failed_sitemaps: discovery.failedSitemaps,
  discovered_urls_total: discoveredUrls.length,
  crawlable_urls_total: crawlableUrls.length,
  target_urls_total: targetUrls.length,
  url_hash: urlHash,
  cursor: nextCursor,
  cycle,
  visited_urls_total: visitedUrls.size,
  visited_urls: [...visitedUrls].sort(),
  target_urls: targetUrls,
  urls: crawlableUrls
};

await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

if (discoverOnly) {
  const coveragePercent = targetUrls.length ? Math.round((visitedUrls.size / targetUrls.length) * 10000) / 100 : 0;

  await writeFile(metaFile, JSON.stringify({
    ...existingMeta,
    market: marketCode,
    base_url: market.baseUrl,
    inventory_updated_at: capturedAt,
    sitemap_count: discovery.sitemapCount,
    failed_sitemaps: discovery.failedSitemaps.length,
    discovered_urls_total: discoveredUrls.length,
    crawlable_urls_total: crawlableUrls.length,
    target_urls_total: targetUrls.length,
    coverage_urls: visitedUrls.size,
    coverage_pages: visitedUrls.size,
    coverage_percent: coveragePercent,
    crawl_cursor: nextCursor,
    crawl_cycle: cycle
  }, null, 2) + "\n");

  console.error("inventory: " + marketCode + ": " + targetUrls.length + " mart target URLs from " + crawlableUrls.length + " crawlable URLs across " + discovery.sitemapCount + " sitemaps");
  process.exit(0);
}

if (!selected.length) throw new Error("No URLs selected for crawl for " + marketCode);

console.error("inventory: " + marketCode + ": " + targetUrls.length + " mart target URLs from " + crawlableUrls.length + " crawlable URLs; crawling batch of " + selected.length);

const crawledPages = [...catalogPages];
const crawledProducts = new Map(catalogRows.map((product) => [product.key, product]));
const successfulUrls = new Set();
let failures = 0;

for (let index = 0; index < selected.length; index++) {
  const discoveredUrl = selected[index];
  try {
    const { text: html, finalUrl, contentType } = await fetchText(discoveredUrl);
    successfulUrls.add(discoveredUrl);
    if (!/html/i.test(contentType) && !/<html[\s>]/i.test(html)) continue;
    const page = extractPage(html, finalUrl, discoveredUrl);
    if (page.text) crawledPages.push(page);
    for (const product of parseProducts(html, page.canonical_url)) crawledProducts.set(product.key, product);
    console.error("[" + (index + 1) + "/" + selected.length + "] ok " + discoveredUrl);
  } catch (error) {
    failures += 1;
    console.error("[" + (index + 1) + "/" + selected.length + "] failed " + discoveredUrl + ": " + error.message);
  }
  if (delayMs > 0 && index < selected.length - 1) await sleep(delayMs);
}

if (!crawledPages.length) throw new Error("Crawl produced zero pages for " + marketCode + "; previous data left untouched");

const pageMap = new Map();
for (const page of existingPages) {
  const key = page.id || sha(page.canonical_url || page.url || JSON.stringify(page)).slice(0, 24);
  pageMap.set(key, page);
}
for (const page of crawledPages) pageMap.set(page.id, page);

const productMap = new Map(existingProducts.map((product) => [product.key, product]));
for (const product of crawledProducts.values()) productMap.set(product.key, product);

const historyFile = path.join(historyDir, marketCode + ".jsonl");
const history = normalizeProductHistory(await readJsonl(historyFile));
const latestFingerprint = new Map();
for (const item of history) latestFingerprint.set(item.key, item.fingerprint);
for (const product of crawledProducts.values()) {
  const historyRecord = toProductHistoryRecord(product);
  if (latestFingerprint.get(historyRecord.key) !== historyRecord.fingerprint) {
    history.push(historyRecord);
    latestFingerprint.set(historyRecord.key, historyRecord.fingerprint);
  }
}

const allPages = [...pageMap.values()].sort((a, b) => String(a.canonical_url || a.url || "").localeCompare(String(b.canonical_url || b.url || "")));
const allProducts = [...productMap.values()].sort((a, b) => String(a.name || a.model || a.sku || "").localeCompare(String(b.name || b.model || b.sku || "")));

for (const url of successfulUrls) visitedUrls.add(url);

manifest.visited_urls_total = visitedUrls.size;
manifest.visited_urls = [...visitedUrls].sort();
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

const coveragePercent = targetUrls.length ? Math.round((visitedUrls.size / targetUrls.length) * 10000) / 100 : 0;

const marts = buildDataMarts(allPages, allProducts, lifecycleFor, catalogRows);
await writeFile(path.join(martDir, "product_master.jsonl"), toJsonl(marts.productMaster));
await writeFile(path.join(martDir, "product_specs.jsonl"), toJsonl(marts.productSpecs));
await writeFile(path.join(martDir, "market_offers.jsonl"), toJsonl(marts.marketOffers));
await writeFile(path.join(martDir, "commerce_options.jsonl"), toJsonl(marts.commerceOptions));
await writeFile(path.join(martDir, "support_resources.jsonl"), toJsonl(marts.supportResources));
await writeFile(path.join(martDir, "taxonomy.jsonl"), toJsonl(marts.taxonomy));
await writeFile(path.join(martDir, "catalog_current.jsonl"), toJsonl(marts.currentCatalog));

const offerHistoryVersions = await appendChangedHistory(
  path.join(offerHistoryDir, marketCode + ".jsonl"),
  marts.marketOffers,
  { pruneToCurrent: true }
);
const commerceHistoryVersions = await appendChangedHistory(
  path.join(commerceHistoryDir, marketCode + ".jsonl"),
  marts.commerceOptions,
  { pruneToCurrent: true }
);

await writeFile(path.join(currentDir, "pages.jsonl"), toJsonl(allPages));
await writeFile(path.join(currentDir, "products.jsonl"), toJsonl(allProducts));
await writeFile(historyFile, toJsonl(history));
await writeFile(metaFile, JSON.stringify({
  market: marketCode,
  base_url: market.baseUrl,
  captured_at: capturedAt,
  inventory_updated_at: capturedAt,
  sitemap_count: discovery.sitemapCount,
  failed_sitemaps: discovery.failedSitemaps.length,
  discovered_urls_total: discoveredUrls.length,
  crawlable_urls_total: crawlableUrls.length,
  target_urls_total: targetUrls.length,
  crawl_cursor: nextCursor,
  crawl_cycle: cycle,
  batch_requested: selected.length,
  batch_success: crawledPages.length,
  failures,
  coverage_urls: visitedUrls.size,
  coverage_pages: visitedUrls.size,
  coverage_percent: coveragePercent,
  pages_written: allPages.length,
  products_written: allProducts.length,
  history_versions: history.length,
  marts: {
    product_master: marts.productMaster.length,
    product_specs: marts.productSpecs.length,
    product_specs_with_values: marts.productSpecs.filter((row) => (row.specs || []).length > 0).length,
    market_offers: marts.marketOffers.length,
    commerce_options: marts.commerceOptions.length,
    support_resources: marts.supportResources.length,
    taxonomy: marts.taxonomy.length,
    catalog_current: marts.currentCatalog.length,
    lifecycle: {
      current_sellable: marts.productMaster.filter((row) => row.lifecycle_status === "current_sellable").length,
      current_unavailable: marts.productMaster.filter((row) => row.lifecycle_status === "current_unavailable").length,
      legacy: marts.productMaster.filter((row) => row.lifecycle_status === "legacy").length,
      unverified: marts.productMaster.filter((row) => row.lifecycle_status === "unverified").length,
      commerce_eligible: marts.productMaster.filter((row) => row.commerce_eligible === true).length,
      commerce_suppressed: marts.productMaster.filter((row) => row.commerce_eligible === false).length
    },
    catalog_sources_ok: successfulCatalogSources.size,
    catalog_sources_failed: failedCatalogSources.length,
    offer_history_versions: offerHistoryVersions,
    commerce_history_versions: commerceHistoryVersions
  }
}, null, 2) + "\n");

console.error("done: " + marketCode + ": " + crawledPages.length + "/" + selected.length + " batch pages ok; " + allPages.length + " total unique pages stored; " + visitedUrls.size + "/" + targetUrls.length + " mart target URLs visited (" + coveragePercent + "%); " + allProducts.length + " products; " + marts.commerceOptions.length + " commerce mart rows; " + failures + " failures");
