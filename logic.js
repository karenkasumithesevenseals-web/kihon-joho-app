/**
 * logic.js … 基本情報アプリの「計算の部品」。画面や保存には触りません。
 * 読み方: 一番下の return { ... } が、外から使える部品の一覧です。
 * 使う人: script.js（画面）、tests.js（自動チェック）。
 */
const FeLogic = (function () {
  'use strict';

  var DAY_MS = 86400000;
  /** 連続で正解した回数ごとの、次に出すまでの日数（1回→1日、2回→3日、3回→7日、4回以上→14日）。 */
  var REVIEW_INTERVALS_DAYS = [1, 3, 7, 14];
  /** 大分野の名前（問題データの category と対応）。 */
  var CATEGORY_LABELS = { technology: 'テクノロジ', management: 'マネジメント', strategy: 'ストラテジ' };

  /**
   * その日の 0 時（端末の時間帯）をミリ秒で返す。
   * @param {number} ms 時刻（ミリ秒）
   * @returns {number} その日の 0 時
   */
  function startOfDay(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * 日付に日数を足す（0 時のまま）。
   * @param {number} dayMs 日の 0 時
   * @param {number} days 足す日数
   * @returns {number} 足したあとの日の 0 時
   */
  function addDays(dayMs, days) {
    var d = new Date(dayMs);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  /**
   * 連続正解の回数から、次に出すまでの日数を返す。0回（間違えた直後）も 1 日。
   * @param {number} streak 最後から数えて連続で正解した回数
   * @returns {number} 日数（1・3・7・14 のどれか）
   */
  function reviewIntervalDays(streak) {
    var i = Math.min(Math.max(streak, 1), REVIEW_INTERVALS_DAYS.length) - 1;
    return REVIEW_INTERVALS_DAYS[i];
  }

  /**
   * 回答の記録に付ける、重ならない ID を作る。
   * @param {string} deviceId 端末の ID
   * @param {number} atMs 回答した時刻（ミリ秒）
   * @param {function} [rand] 0以上1未満の数を返す関数（テスト用。省略すると Math.random）
   * @returns {string} 「端末ID-時刻-乱数」の形の文字
   */
  function makeAnswerId(deviceId, atMs, rand) {
    var r = (rand || Math.random)();
    return deviceId + '-' + atMs + '-' + Math.floor(r * 1679616).toString(36);
  }

  /**
   * 回答の記録として正しい形か確かめる。
   * @param {*} a 調べるもの
   * @returns {boolean} 正しければ true
   */
  function isValidAnswer(a) {
    return !!a && typeof a.id === 'string' && typeof a.qid === 'string' &&
      typeof a.correct === 'boolean' && typeof a.at === 'number' && isFinite(a.at);
  }

  /**
   * 端末に保存してある文字を点検して、使える記録と、読めなかった状況を返す。
   * @param {string|null} text 保存してある文字（JSON）
   * @returns {{answers:object[], broken:boolean, dropped:number}}
   *   answers: 使える記録の一覧 / broken: 文字そのものが読めない（壊れている）なら true / dropped: 形が合わず除いた件数
   */
  function inspectStoredAnswers(text) {
    if (!text) return { answers: [], broken: false, dropped: 0 };
    var data;
    try { data = JSON.parse(text); } catch (e) { return { answers: [], broken: true, dropped: 0 }; }
    if (!Array.isArray(data)) return { answers: [], broken: true, dropped: 0 };
    var good = data.filter(isValidAnswer);
    return { answers: good, broken: false, dropped: data.length - good.length };
  }

  /**
   * 端末に保存してある文字から、回答の記録の一覧を取り出す。壊れていたら空にする。
   * @param {string|null} text 保存してある文字（JSON）
   * @returns {object[]} 回答の記録の一覧（形の合わないものは除く）
   */
  function parseStoredAnswers(text) {
    return inspectStoredAnswers(text).answers;
  }

  /**
   * 2つの記録の一覧を1つにする。同じ ID は1つにして、時刻の順に並べる。
   * @param {object[]} a 記録の一覧
   * @param {object[]} b もう1つの記録の一覧
   * @returns {object[]} 合流した一覧（新しい配列）
   */
  function mergeAnswers(a, b) {
    var seen = {};
    var out = [];
    a.concat(b).forEach(function (x) {
      if (seen[x.id]) return;
      seen[x.id] = true;
      out.push(x);
    });
    out.sort(function (p, q) { return p.at - q.at; });
    return out;
  }

  /**
   * 回答の記録から、問題ごとの結果をまとめる。同じ ID の記録は1回として数える。
   * @param {object[]} answers 回答の記録の一覧（順番は問わない）
   * @returns {Map<string, object>} 問題ID → {qid, firstCorrect, firstAt, latestCorrect, lastAt, streak, count}
   */
  function collectQuestionResults(answers) {
    var sorted = answers.slice().sort(function (a, b) { return a.at - b.at; });
    var seenIds = {};
    var map = new Map();
    sorted.forEach(function (a) {
      if (seenIds[a.id]) return;
      seenIds[a.id] = true;
      var r = map.get(a.qid);
      if (!r) {
        r = { qid: a.qid, firstCorrect: a.correct, firstAt: a.at, latestCorrect: a.correct, lastAt: a.at, streak: 0, count: 0 };
        map.set(a.qid, r);
      }
      r.latestCorrect = a.correct;
      r.lastAt = a.at;
      r.count += 1;
      r.streak = a.correct ? r.streak + 1 : 0;
    });
    return map;
  }

  /**
   * 次に復習する日（その日の 0 時）を返す。
   * @param {object} result 問題ごとの結果
   * @returns {number} 復習する日の 0 時
   */
  function dueDay(result) {
    return addDays(startOfDay(result.lastAt), reviewIntervalDays(result.streak));
  }

  /**
   * 今日（以前から）復習する問題の ID を、古い順に返す。
   * @param {Map} results collectQuestionResults の結果
   * @param {number} nowMs 今の時刻（ミリ秒）
   * @returns {string[]} 問題IDの一覧
   */
  function collectDueQuestionIds(results, nowMs) {
    var today = startOfDay(nowMs);
    var due = [];
    results.forEach(function (r) {
      var day = dueDay(r);
      if (day <= today) due.push({ qid: r.qid, day: day });
    });
    due.sort(function (a, b) { return a.day - b.day || (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0); });
    return due.map(function (x) { return x.qid; });
  }

  /**
   * 今日解いた数を返す（同じ ID は1回）。
   * @param {object[]} answers 回答の記録の一覧
   * @param {number} nowMs 今の時刻（ミリ秒）
   * @returns {number} 今日の回答数
   */
  function countAnswersOnDay(answers, nowMs) {
    var today = startOfDay(nowMs);
    var seen = {};
    var n = 0;
    answers.forEach(function (a) {
      if (seen[a.id]) return;
      seen[a.id] = true;
      if (startOfDay(a.at) === today) n += 1;
    });
    return n;
  }

  /**
   * 目標日まであと何日かを返す。
   * @param {string} dateStr 「2026-12-01」の形の日付
   * @param {number} nowMs 今の時刻（ミリ秒）
   * @returns {number|null} 日数（当日は 0、過ぎていれば負）。日付でなければ null
   */
  function daysUntil(dateStr, nowMs) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    var p = dateStr.split('-').map(Number);
    var target = new Date(p[0], p[1] - 1, p[2]).getTime();
    if (!isFinite(target)) return null;
    return Math.round((target - startOfDay(nowMs)) / DAY_MS);
  }

  /** 合格の目安に使う正答率（練習用の目安）。 */
  var PASS_TARGET_RATE = 0.6;
  /** 回答の記録の mode（どの画面で答えたか）。一問一答・復習・模擬試験。これ以外はクラウドから受け取らない。 */
  var KNOWN_MODES = ['quiz', 'review', 'exam'];
  /** 合格の目安を出すのに必要な「初めて見た問題」の数。 */
  var MIN_FIRST_ANSWERS = 50;
  /** 合格の目安の計算に使う、直近の「初めて見た問題」の数。 */
  var RECENT_FIRST_ANSWERS = 120;

  /**
   * 集計用の入れ物 obj の key に、1問分（正解か）を足す。
   * @param {object} obj 集計の入れ物
   * @param {string} key 分野の名前
   * @param {boolean} ok 正解なら true
   */
  function addToGroup(obj, key, ok) {
    var g = obj[key] || (obj[key] = { correct: 0, total: 0, rate: 0 });
    g.total += 1;
    if (ok) g.correct += 1;
    g.rate = g.correct / g.total;
  }

  /**
   * 大分野・小分野ごとの正答率を出す。各問題の「最初の答え」で数える。
   * @param {Map} results collectQuestionResults の結果
   * @param {object[]} questions 問題データ（category と sub を持つ）
   * @returns {{category:object, sub:object}} 分野ごとの {correct, total, rate}。問題データにないIDは数えない
   */
  function accuracyByGroup(results, questions) {
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var category = {};
    var sub = {};
    results.forEach(function (r) {
      var q = byId[r.qid];
      if (!q) return;
      addToGroup(category, q.category, r.firstCorrect);
      addToGroup(sub, q.sub, r.firstCorrect);
    });
    return { category: category, sub: sub };
  }

  /**
   * 合格の目安（練習用）を出す。初めて見た問題の直近の正答率で決める。
   * @param {Map} results collectQuestionResults の結果
   * @param {object[]} questions 問題データ
   * @param {{minCount?:number}} [options] minCount: 判定に必要な問題数（動作確認用に変えられる。問題の総数を超えない）
   * @returns {object} 足りないとき {status:'insufficient', needed}、足りるとき {status:'ok', rate, gapPercent, sampleSize}
   */
  function passEstimate(results, questions, options) {
    // 問題が少ないときは、問題の総数を上限にする（20問しかなくても、20問解けば目安が出る）。0問のときは判定しない
    var minCount = Math.max(1, Math.min((options && options.minCount) || MIN_FIRST_ANSWERS, questions.length));
    var known = {};
    questions.forEach(function (q) { known[q.id] = true; });
    var firsts = [];
    results.forEach(function (r) { if (known[r.qid]) firsts.push(r); });
    firsts.sort(function (a, b) { return a.firstAt - b.firstAt; });
    if (firsts.length < minCount) return { status: 'insufficient', needed: minCount - firsts.length };
    var recent = firsts.slice(-RECENT_FIRST_ANSWERS);
    var correct = recent.filter(function (r) { return r.firstCorrect; }).length;
    var rate = correct / recent.length;
    return {
      status: 'ok',
      rate: rate,
      // 目安の 60% まで、あと何%か。切り上げる（59.6% を「届いている」にしないため）。
      // 先に 1000000 倍して四捨五入するのは、0.6 − 0.5 のような小数の誤差で、ぴったりの値が 1% 多く出ないようにするため
      gapPercent: Math.max(0, Math.ceil(Math.round((PASS_TARGET_RATE - rate) * 1000000) / 10000)),
      sampleSize: recent.length
    };
  }

  /**
   * 配列をランダムに並べ替えた新しい配列を返す（元は変えない）。
   * @param {any[]} list 並べ替えたい配列
   * @param {function} rand 0以上1未満の数を返す関数
   * @returns {any[]} 並べ替えた配列
   */
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /**
   * 出題する問題の ID の一覧を作る。
   * @param {object[]} questions 問題データ
   * @param {Map} results collectQuestionResults の結果
   * @param {{type:string, value?:string}} filter type は 'review'(今日の復習) / 'all' / 'category' / 'sub'
   * @param {number} limit 最大の問題数
   * @param {number} nowMs 今の時刻（ミリ秒）
   * @param {function} [rand] 乱数の関数（テスト用）
   * @returns {string[]} 問題IDの一覧。まだ解いていない問題が先、そのあと古く解いた順。復習は期限の古い順
   */
  function buildSession(questions, results, filter, limit, nowMs, rand) {
    rand = rand || Math.random;
    var known = {};
    questions.forEach(function (q) { known[q.id] = true; });
    if (filter.type === 'review') {
      return collectDueQuestionIds(results, nowMs).filter(function (id) { return known[id]; }).slice(0, limit);
    }
    var pool = questions.filter(function (q) {
      if (filter.type === 'category') return q.category === filter.value;
      if (filter.type === 'sub') return q.sub === filter.value;
      return true;
    });
    var unseen = shuffle(pool.filter(function (q) { return !results.has(q.id); }), rand).map(function (q) { return q.id; });
    var seen = pool.filter(function (q) { return results.has(q.id); })
      .sort(function (a, b) { return results.get(a.id).lastAt - results.get(b.id).lastAt; })
      .map(function (q) { return q.id; });
    return unseen.concat(seen).slice(0, limit);
  }

  /**
   * 記録を、クラウドに書く形にする（ID は書類の名前にするので含めない。undefined を入れない）。
   * @param {object} a 回答の記録
   * @returns {{qid:string, choice:number, correct:boolean, at:number, mode:string, deviceId:string}} クラウドに書く中身
   */
  function answerToDoc(a) {
    return {
      qid: a.qid,
      choice: typeof a.choice === 'number' ? a.choice : -1,
      correct: a.correct,
      at: a.at,
      mode: a.mode || 'quiz',
      deviceId: a.deviceId || ''
    };
  }

  /**
   * クラウドの1件を、回答の記録に戻す。形が合わなければ null。
   * @param {string} id 書類の名前（記録の ID）
   * @param {object|null} data クラウドに入っていた中身
   * @returns {object|null} 回答の記録、または null
   */
  function docToAnswer(id, data) {
    if (!data || typeof data !== 'object') return null;
    // クラウドから来た値は、番号と mode を厳しく見る（端末に保存した記録の検査 isValidAnswer は、今ある成績を守るため厳しくしない）
    var choice = data.choice === undefined ? -1 : data.choice;
    if (!Number.isInteger(choice) || choice < -1 || choice > 9) return null;
    var mode = data.mode === undefined ? 'quiz' : data.mode;
    if (KNOWN_MODES.indexOf(mode) < 0) return null;
    var a = { id: id, qid: data.qid, choice: choice, correct: data.correct, at: data.at, mode: mode, deviceId: data.deviceId };
    return isValidAnswer(a) ? a : null;
  }

  /**
   * この端末にあって、クラウドにまだない記録だけを返す。
   * @param {object[]} local この端末の記録の一覧
   * @param {object} remoteIds クラウドにある記録の ID を {ID: true} の形で並べたもの
   * @returns {object[]} 送るべき記録の一覧
   */
  function answersToUpload(local, remoteIds) {
    return local.filter(function (a) { return !remoteIds[a.id]; });
  }

  /**
   * 配列を、size 件ずつに分ける（1回に送れる件数に上限があるため）。
   * @param {any[]} list 分けたい配列
   * @param {number} size 1つの塊の件数
   * @returns {any[][]} 塊の一覧
   */
  function chunkList(list, size) {
    var out = [];
    for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  /**
   * 同期の状態を、帯に出す言葉と一緒に返す。
   * @param {{sdkReady:boolean, loggedIn:boolean, serverConfirmed:boolean, pendingCount:number, error:boolean, online:boolean}} s
   *   sdkReady: 同期の部品を読み込めたか / loggedIn: ログイン中か / serverConfirmed: 今回の起動でクラウドと照合できたか
   *   pendingCount: 送信待ちの件数 / error: クラウドのエラーがあるか / online: ネットにつながっているか
   * @returns {{state:string, text:string, trouble:boolean}} state: 状態の名前 / text: 帯の言葉 / trouble: 目立たせるか
   */
  function syncStatus(s) {
    if (!s.sdkReady) return { state: 'unavailable', text: 'クラウド同期を使えません。この端末に保存中', trouble: false };
    if (!s.loggedIn) {
      return s.error
        ? { state: 'login-error', text: 'ログインできませんでした。もう一度お試しください', trouble: true }
        : { state: 'local', text: 'この端末に保存中（ログインすると同期します）', trouble: false };
    }
    if (s.error) return { state: 'error', text: 'クラウドにつながりません。この端末に保存中です。つながると自動で送ります', trouble: true };
    if (s.pendingCount > 0) {
      return s.online
        ? { state: 'pending', text: '送信中（' + s.pendingCount + '件）', trouble: false }
        : { state: 'pending-offline', text: 'この端末に保存ずみ。送信待ち ' + s.pendingCount + '件（つながると自動で送ります）', trouble: true };
    }
    if (!s.serverConfirmed) {
      return s.online
        ? { state: 'checking', text: '同期を確認中…', trouble: false }
        : { state: 'offline', text: 'オフライン。この端末の記録を表示中', trouble: false };
    }
    return { state: 'synced', text: '同期ずみ', trouble: false };
  }

  // ---- 模擬試験 ----------------------------------------------------------

  /**
   * 模擬試験の設定。本番の科目A は 60問・90分。
   * ratio（分野ごとの問題数の配分）は仮の値。本物の問題を足すとき、実際の年度の出題数を見て直す。
   */
  var EXAM_CONFIG = { count: 60, minutes: 90, ratio: { technology: 40, management: 8, strategy: 12 } };

  /**
   * 問題数に合わせた制限時間を返す（本番の問題数より少ないときは、時間も比例して短くする）。
   * @param {number} count 出す問題の数
   * @param {object} [config] 設定（省略すると EXAM_CONFIG）
   * @returns {number} 制限時間（ミリ秒）。本番の問題数を超えても、本番の時間まで
   */
  function examLimitMs(count, config) {
    config = config || EXAM_CONFIG;
    var n = Math.max(0, Math.min(count, config.count));
    return Math.round(config.minutes * 60000 * n / config.count);
  }

  /**
   * 模擬試験で出す問題を選び、問題 ID の並びで返す。
   * 分野ごとの数は配分（ratio）に近づける。ある分野の問題が足りないときは、ほかの分野から補う。
   * @param {object[]} questions 問題データ
   * @param {object} [config] 設定（省略すると EXAM_CONFIG）
   * @param {function} [rand] 乱数の関数（テスト用。省略すると Math.random）
   * @returns {string[]} 出す問題の ID（出す順）。問題がなければ空
   */
  function buildExam(questions, config, rand) {
    config = config || EXAM_CONFIG;
    rand = rand || Math.random;
    var n = Math.min(config.count, questions.length);
    if (n <= 0) return [];
    var cats = Object.keys(config.ratio);
    var totalRatio = cats.reduce(function (s, c) { return s + config.ratio[c]; }, 0);
    // 分野ごとの枠: 小数を切り捨てて、足りない分は小数の大きい分野から1つずつ足す
    var quota = {};
    var rest = [];
    var used = 0;
    cats.forEach(function (c) {
      var raw = n * config.ratio[c] / totalRatio;
      quota[c] = Math.floor(raw);
      used += quota[c];
      rest.push({ cat: c, frac: raw - quota[c] });
    });
    rest.sort(function (a, b) { return b.frac - a.frac; });
    for (var i = 0; used < n && i < rest.length; i++, used++) quota[rest[i].cat] += 1;

    var chosen = [];
    var left = [];
    cats.forEach(function (c) {
      var pool = shuffle(questions.filter(function (q) { return q.category === c; }), rand);
      chosen = chosen.concat(pool.slice(0, quota[c]));
      left = left.concat(pool.slice(quota[c]));
    });
    questions.forEach(function (q) { if (cats.indexOf(q.category) < 0) left.push(q); });
    if (chosen.length < n) chosen = chosen.concat(shuffle(left, rand).slice(0, n - chosen.length));
    return shuffle(chosen, rand).map(function (q) { return q.id; });
  }

  /**
   * 新しい模擬試験の状態を作る。
   * @param {string[]} qids 出す問題の ID（出す順）
   * @param {number} now 開始の時刻（ミリ秒）
   * @param {object} [config] 設定（省略すると EXAM_CONFIG）
   * @returns {object} {version, startedAt, limitMs, qids, picks, marks, current}
   */
  function newExamState(qids, now, config) {
    return { version: 1, startedAt: now, limitMs: examLimitMs(qids.length, config), qids: qids.slice(), picks: {}, marks: [], current: 0 };
  }

  /**
   * 残り時間を返す。端末の時計が戻っても、制限時間を超えない。
   * @param {{startedAt:number, limitMs:number}} state 模擬試験の状態
   * @param {number} now 今の時刻（ミリ秒）
   * @returns {number} 残り時間（ミリ秒、0〜limitMs）
   */
  function examRemainingMs(state, now) {
    return Math.max(0, Math.min(state.limitMs, state.startedAt + state.limitMs - now));
  }

  /**
   * ミリ秒を「分:秒」の文字にする（秒は切り上げ）。
   * @param {number} ms 時間（ミリ秒）
   * @returns {string} 例 '89:05'。0以下は '00:00'
   */
  function formatClock(ms) {
    var sec = Math.ceil(Math.max(0, ms) / 1000);
    var mm = Math.floor(sec / 60);
    var ss = sec % 60;
    return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /**
   * 端末に保存してある模擬試験の文字を点検して、状態を取り出す。
   * @param {string|null} text 保存してある文字（JSON）
   * @returns {{state:object|null, broken:boolean}} 空なら {state:null, broken:false}。形が合わないものは {state:null, broken:true}
   */
  function parseExamState(text) {
    if (!text) return { state: null, broken: false };
    var bad = { state: null, broken: true };
    var d;
    try { d = JSON.parse(text); } catch (e) { return bad; }
    if (!d || typeof d !== 'object' || d.version !== 1) return bad;
    if (typeof d.startedAt !== 'number' || !isFinite(d.startedAt)) return bad;
    if (typeof d.limitMs !== 'number' || !isFinite(d.limitMs) || d.limitMs <= 0) return bad;
    var isText = function (x) { return typeof x === 'string'; };
    if (!Array.isArray(d.qids) || d.qids.length === 0 || !d.qids.every(isText)) return bad;
    if (!d.picks || typeof d.picks !== 'object' || Array.isArray(d.picks)) return bad;
    var picksOk = Object.keys(d.picks).every(function (k) { var v = d.picks[k]; return Number.isInteger(v) && v >= 0 && v <= 3; });
    if (!picksOk) return bad;
    if (!Array.isArray(d.marks) || !d.marks.every(isText)) return bad;
    if (!Number.isInteger(d.current)) return bad;
    return {
      state: {
        version: 1, startedAt: d.startedAt, limitMs: d.limitMs, qids: d.qids, picks: d.picks, marks: d.marks,
        current: Math.min(Math.max(d.current, 0), d.qids.length - 1)
      },
      broken: false
    };
  }

  /**
   * 模擬試験を採点する。未回答は不正解として数える。問題データにない ID は数えない。
   * @param {object} state 模擬試験の状態
   * @param {object[]} questions 問題データ
   * @returns {{total:number, correct:number, answered:number, unanswered:number, rate:number, byCategory:object, wrong:{qid:string, choice:number}[]}}
   *   rate: 正答率（0〜1。問題がなければ 0）/ byCategory: 分野ごとの {correct,total,rate} / wrong: 間違いと未回答（未回答の choice は -1）
   */
  function gradeExam(state, questions) {
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var ids = state.qids.filter(function (id) { return byId[id]; });
    var byCategory = {};
    var wrong = [];
    var correct = 0;
    var answered = 0;
    ids.forEach(function (id) {
      var q = byId[id];
      var pick = state.picks[id];
      var isAnswered = typeof pick === 'number';
      var ok = isAnswered && pick === q.answerIndex;
      if (isAnswered) answered += 1;
      addToGroup(byCategory, q.category, ok);
      if (ok) correct += 1; else wrong.push({ qid: id, choice: isAnswered ? pick : -1 });
    });
    return {
      total: ids.length, correct: correct, answered: answered, unanswered: ids.length - answered,
      rate: ids.length > 0 ? correct / ids.length : 0, byCategory: byCategory, wrong: wrong
    };
  }

  /**
   * 模擬試験の答えを、成績に足す記録にする（答えた問題だけ。mode は 'exam'）。
   * 記録の時刻は 1ms ずつずらして、IDが重ならないようにする。
   * @param {object} state 模擬試験の状態
   * @param {object[]} questions 問題データ
   * @param {number} now 終了の時刻（ミリ秒）
   * @param {string} deviceId 端末の ID
   * @param {function} [rand] 乱数の関数（テスト用）
   * @returns {object[]} 回答の記録の一覧（出題順）
   */
  function examAnswersToRecord(state, questions, now, deviceId, rand) {
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var out = [];
    state.qids.forEach(function (id) {
      var q = byId[id];
      var pick = state.picks[id];
      if (!q || typeof pick !== 'number') return;
      var at = now + out.length;
      out.push({ id: makeAnswerId(deviceId, at, rand), qid: id, choice: pick, correct: pick === q.answerIndex, at: at, mode: 'exam', deviceId: deviceId });
    });
    return out;
  }

  return {
    CATEGORY_LABELS: CATEGORY_LABELS,
    reviewIntervalDays: reviewIntervalDays,
    makeAnswerId: makeAnswerId,
    inspectStoredAnswers: inspectStoredAnswers,
    parseStoredAnswers: parseStoredAnswers,
    mergeAnswers: mergeAnswers,
    answerToDoc: answerToDoc,
    docToAnswer: docToAnswer,
    answersToUpload: answersToUpload,
    chunkList: chunkList,
    syncStatus: syncStatus,
    collectQuestionResults: collectQuestionResults,
    collectDueQuestionIds: collectDueQuestionIds,
    countAnswersOnDay: countAnswersOnDay,
    daysUntil: daysUntil,
    accuracyByGroup: accuracyByGroup,
    passEstimate: passEstimate,
    buildSession: buildSession,
    PASS_TARGET_RATE: PASS_TARGET_RATE,
    EXAM_CONFIG: EXAM_CONFIG,
    examLimitMs: examLimitMs,
    buildExam: buildExam,
    newExamState: newExamState,
    examRemainingMs: examRemainingMs,
    formatClock: formatClock,
    parseExamState: parseExamState,
    gradeExam: gradeExam,
    examAnswersToRecord: examAnswersToRecord
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = FeLogic; }
