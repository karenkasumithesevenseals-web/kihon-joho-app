/**
 * sync.js … Google ログインと、クラウド（Firestore）との同期。Firebase とのやりとりだけをする。
 * 読み方: ①Firebase の準備 ③クラウドの記録を聞く ②ログイン ④記録を送る ⑤外に公開（window.FeSync）。
 * 何を送るか・画面にどう出すかは script.js と logic.js が決める。ここは「運ぶだけ」。
 * 注意: ES モジュールなので、http(s) で開いたときだけ動く（file:// では動かない）。
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, writeBatch, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

// ① Firebase の準備 ------------------------------------------------------
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

/**
 * Firestore を用意する。端末に記録を保存する仕組み（ネットがなくても使える）を付ける。
 * @returns {object} Firestore
 */
function createFirestore() {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    return initializeFirestore(app, {}); // 端末への保存が使えないときは、保存なしで動かす
  }
}
const db = createFirestore();

let currentUid = null;
let stopListening = null;
let retryTimer = null;
let handlers = {};

/** 聞くのが止まったあと、やり直すまでの待ち時間（ミリ秒）。 */
const RETRY_LISTEN_MS = 15000;

/**
 * エラーを script.js に知らせる。
 * @param {Error} err エラー
 */
function reportError(err) {
  if (handlers.onError) handlers.onError(err);
}

// ③ クラウドの記録を聞く ---------------------------------------------------

/**
 * 聞くのが止まったときに、少し待ってからやり直す予約をする。
 * @param {string} uid 予約したときにログインしていた人の ID（別の人に替わっていたらやり直さない）
 */
function scheduleRetry(uid) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (uid && currentUid === uid) listen();
  }, RETRY_LISTEN_MS);
}

/** 自分の記録（users/{uid}/answers）の変化を聞き始める。端末の保存と、クラウドの両方から届く。エラーで止まったら、少し待ってやり直す。 */
function listen() {
  if (stopListening) stopListening();
  const uid = currentUid;
  stopListening = onSnapshot(
    collection(db, 'users', currentUid, 'answers'),
    { includeMetadataChanges: true },
    (snap) => {
      if (!handlers.onSnapshot) return;
      handlers.onSnapshot({
        docs: snap.docs.map((d) => ({ id: d.id, data: d.data(), pending: d.metadata.hasPendingWrites })),
        fromCache: snap.metadata.fromCache
      });
    },
    (err) => {
      reportError(err);
      scheduleRetry(uid);
    }
  );
}

/** 聞くのをやめる（やり直しの予約も取り消す）。 */
function stop() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (stopListening) { stopListening(); stopListening = null; }
}

/**
 * 同期を始める。ログインの状態が変わるたびに handlers.onAuth が呼ばれる。
 * @param {{onAuth:function, onSnapshot:function, onError:function}} h 画面側の受け取り口
 */
function init(h) {
  handlers = h || {};
  getRedirectResult(auth).catch(reportError);
  onAuthStateChanged(auth, (user) => {
    stop();
    currentUid = user ? user.uid : null;
    if (handlers.onAuth) handlers.onAuth(user ? { uid: user.uid, email: user.email || '' } : null);
    if (user) listen();
  });
}

// ② ログイン ----------------------------------------------------------------

/**
 * Google でログインする。ポップアップが出せない環境では、画面を切り替える方式にする。
 * @returns {Promise<void>} 終わったら解決する
 */
async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      try { await signInWithRedirect(auth, provider); } catch (e2) { reportError(e2); }
    } else if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) {
      // 自分で閉じただけ。何もしない
    } else {
      reportError(e);
    }
  }
}

/**
 * ログアウトする。この端末の記録は消さない。
 * @returns {Promise<void>} 終わったら解決する
 */
async function signOutUser() {
  stop();
  try { await signOut(auth); } catch (e) { reportError(e); }
}

// ④ 記録を送る ----------------------------------------------------------------

/**
 * 記録をクラウドに書く（1回500件まで）。電波がなければ端末に溜めて、つながると自動で送る。
 * @param {{id:string, data:object}[]} items 送る記録（id が書類の名前、data が中身）
 */
function push(items) {
  if (!currentUid || items.length === 0) return;
  const batch = writeBatch(db);
  items.forEach((item) => batch.set(doc(db, 'users', currentUid, 'answers', item.id), item.data));
  batch.commit().catch(reportError);
}

// ⑤ 外に公開 -------------------------------------------------------------------
window.FeSync = { init: init, signIn: signIn, signOutUser: signOutUser, push: push };
document.dispatchEvent(new Event('fesync-ready'));
