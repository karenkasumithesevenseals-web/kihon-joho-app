/**
 * sw.js … サービスワーカー（アプリの裏で動く小さなプログラム）
 *
 * 役割: アプリのファイルを端末に保存（キャッシュ）しておき、電波がなくても開けるようにする。
 *
 *   ネットにつながる → サーバーから最新のファイルを取って表示し、保存分も新しくする
 *   つながらない     → 保存しておいたファイルで表示する
 *
 * 注意: 扱うのは「自分のサイトのファイル」だけ。Firebase の部品・通信（別のサイト）には触らない。
 * 更新のしかた: ファイルを変えて公開するときは、CACHE_NAME の番号を1つ上げる
 *   （古い保存分が消えて、新しいファイルが iPhone などに届く）。
 * このファイルは index.html から登録される。
 */
const CACHE_NAME = "kihon-joho-cache-v10";

// 電波がなくても使えるよう保存しておくファイルの一覧。
// ファイルを足したら、ここにも書き足す（run-sw-check.js が、足りない・ないファイルを見つける）
const CACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./logic.js",
  "./trace-logic.js",
  "./data/trace-problems.js",
  "./sync.js",
  "./firebase-config.js",
  "./manifest.json",
  "./data/questions-r05.js",
  "./data/questions-r06.js",
  "./data/questions-r07.js",
  "./data/questions-r08.js",
  "./data/questions-r08b.js",
  "./assets/images/r05/q02-tables.png",
  "./assets/images/r05/q10-diagram.png",
  "./assets/images/r05/q11-flowchart.png",
  "./assets/images/r05/q13-figure.png",
  "./assets/images/r06/q01-truth-tables.png",
  "./assets/images/r06/q03-cache.png",
  "./assets/images/r06/q13-arrow.png",
  "./assets/images/r06/q19-scatter.png",
  "./assets/images/r07/q03-tree.png",
  "./assets/images/r07/q06-sql-table.png",
  "./assets/images/r07/q14-pert.png",
  "./assets/images/r07/q19-table.png",
  "./assets/images/r08/q01-table.png",
  "./assets/images/r08/q06-circuit-charts.png",
  "./assets/images/r08/q06-notation.png",
  "./assets/images/r08/q07-sql-table.png",
  "./assets/images/r08/q17-table.png",
  "./assets/images/r08b/guide-notation.png",
  "./assets/images/r08b/guide-operators.png",
  "./assets/images/r08b/q01-program.png",
  "./assets/images/r08b/q02-program.png",
  "./assets/images/r08b/q03-program.png",
  "./assets/images/r08b/q04-fig1.png",
  "./assets/images/r08b/q04-fig2.png",
  "./assets/images/r08b/q04-program.png",
  "./assets/images/r08b/q05-figure.png",
  "./assets/images/r08b/q05-program.png",
  "./assets/images/r08b/q06-rules.png",
  "./assets/images/r08b/q06-table.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

// install（はじめて登録されたとき・新しい版になったとき）:
// 上の一覧のファイルをまとめて保存する。skipWaiting() で新しい版をすぐ使い始める
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_ASSETS)));
  self.skipWaiting();
});

// activate（新しい版が動き始めたとき）:
// 名前が今の CACHE_NAME と違う、古い保存分を消す。clients.claim() で開いている画面もすぐ切り替える
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先。取れたら保存も新しくし、つながらないときだけ保存分を使う。
// 別のサイト（Firebase など）と、取ってくる以外の通信（書き込みなど）は、何もせず素通しにする。
// no-cache は「ブラウザの一時保存を使わず、サーバーに問い合わせ直す」指定。
// これがないと、更新したファイルが古いまま返ることがある
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
