/**
 * script.js … 画面の動きと、端末への保存。
 * 読み方: ①道具 ②保存 ③画面の切り替え ④ホーム ⑤問題 ⑥成績 ⑦設定 ⑨クラウド同期 ⑩模擬試験 ⑧はじまり の順に並んでいる。
 * 計算は logic.js（FeLogic）、問題は data/（FE_QUESTIONS_R05 など、年度ごと）にある。
 * 画面の文字は textContent で入れる（innerHTML は使わない）。
 */
(function () {
  'use strict';

  var L = FeLogic;
  /** 全年度の問題（令和5〜8年度の科目A 公開問題）を1つの一覧に合わせたもの。 */
  var QUESTIONS = [].concat(FE_QUESTIONS_R05, FE_QUESTIONS_R06, FE_QUESTIONS_R07, FE_QUESTIONS_R08);
  var KEYS = { answers: 'feAnswers', settings: 'feSettings', device: 'feDeviceId', exam: 'feExamState' };
  var MARKS = ['ア', 'イ', 'ウ', 'エ'];
  var DAILY_GOAL = 20;
  var SESSION_SIZE = 20;
  var VIEWS = ['home', 'quiz', 'stats', 'settings', 'exam', 'exam-result'];
  var byId = {};
  QUESTIONS.forEach(function (q) { byId[q.id] = q; });

  // ① 道具 ------------------------------------------------------------

  /**
   * id から要素を取る。
   * @param {string} id 要素の id
   * @returns {HTMLElement} 見つかった要素
   */
  function $(id) { return document.getElementById(id); }

  /**
   * 要素を作って、文字とクラス名を付ける。
   * @param {string} tag タグ名（例: 'div'）
   * @param {string|null} [text] 中に入れる文字（textContent で入れる）
   * @param {string} [className] クラス名
   * @returns {HTMLElement} 作った要素
   */
  function el(tag, text, className) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  /**
   * 要素の中身を空にする。
   * @param {HTMLElement} node 空にする要素
   */
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /**
   * 問題の図・表の画像を、入れ物に並べる。画像がない問題は、入れ物を空にして隠す。
   * 画像が読み込めないときは、説明文（alt）が表示される。
   * @param {HTMLElement} box 画像を入れる入れ物
   * @param {object} q 問題（images: [{src, alt}] を持つことがある）
   */
  function renderImages(box, q) {
    clear(box);
    var list = Array.isArray(q.images) ? q.images : [];
    list.forEach(function (im) {
      var img = el('img', null, 'qimg');
      img.src = im.src;
      img.alt = im.alt || '';
      box.appendChild(img);
    });
    box.hidden = list.length === 0;
  }

  // ② 保存（端末の localStorage） ---------------------------------------

  /**
   * 保存してある文字を読む。
   * @param {string} key 保存の名前
   * @returns {string|null} 保存してある文字。なければ、または使えないときは null
   */
  function readStorage(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  /**
   * 文字を保存する。
   * @param {string} key 保存の名前
   * @param {string} value 保存する文字
   * @returns {boolean} 保存できたら true、使えないときは false
   */
  function writeStorage(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }

  /**
   * 保存してある文字を消す。
   * @param {string} key 保存の名前
   */
  function removeStorage(key) { try { localStorage.removeItem(key); } catch (e) { /* 使えないときは何もしない */ } }

  /**
   * 端末に保存ができるか、試し書きで確かめる。
   * @returns {boolean} できれば true
   */
  function probeStorage() {
    try { localStorage.setItem('feProbe', '1'); localStorage.removeItem('feProbe'); return true; } catch (e) { return false; }
  }

  var stored = L.inspectStoredAnswers(readStorage(KEYS.answers));
  var answers = stored.answers;
  /** 保存してある記録が読めない（壊れている）ときは true。元のデータを守るため、上書きしない。 */
  var saveBlocked = stored.broken || stored.dropped > 0;
  var storageOk = probeStorage();
  /** クラウド同期の状態。画面の帯・設定画面の表示は、ここから決める。 */
  var sync = { sdkReady: false, loggedIn: false, email: '', serverConfirmed: false, pendingCount: 0, error: false, lastUploadAt: 0 };
  /** 送れていない記録を、クラウドに送り直すときの最短の間隔（ミリ秒）。ずっと失敗する場合に送り続けないため。 */
  var RESEND_INTERVAL_MS = 30000;

  /**
   * 回答の記録を1件足して保存する。
   * @param {object} a 回答の記録
   */
  function saveAnswer(a) { saveAnswers([a]); }

  /**
   * 回答の記録をまとめて足して保存する。
   * 保存の直前に、ほかのタブが足した記録を読み直して合流させる（消さないため）。
   * 保存できなくても、このページを開いている間は覚えている。
   * @param {object[]} list 回答の記録の一覧
   */
  function saveAnswers(list) {
    answers = L.mergeAnswers(answers, list);
    persistAnswers();
    pushToCloud(list);
    renderSyncBar();
  }

  /**
   * いまの記録を端末に保存する。保存の直前に、ほかのタブが足した記録を読み直して合流させる（消さないため）。
   * 保存してあるデータが読めないときは、元のデータを守るため書かない。
   */
  function persistAnswers() {
    if (saveBlocked) return;
    var latest = L.inspectStoredAnswers(readStorage(KEYS.answers));
    if (latest.broken || latest.dropped > 0) { saveBlocked = true; return; }
    answers = L.mergeAnswers(answers, latest.answers);
    storageOk = writeStorage(KEYS.answers, JSON.stringify(answers));
  }

  /**
   * 設定（目標日・文字の大きさ）を読む。
   * @returns {{targetDate:string, large:boolean}} 設定。読めなければ初期値
   */
  function loadSettings() {
    try {
      var s = JSON.parse(readStorage(KEYS.settings) || '{}');
      return { targetDate: typeof s.targetDate === 'string' ? s.targetDate : '', large: s.large === true };
    } catch (e) { return { targetDate: '', large: false }; }
  }
  var settings = loadSettings();

  /** 設定を保存する。保存できなければ、上の帯でお知らせする。 */
  function saveSettings() {
    if (!writeStorage(KEYS.settings, JSON.stringify(settings))) storageOk = false;
    renderSyncBar();
  }

  /**
   * この端末の ID を返す（なければ作って保存）。
   * @returns {string} 端末の ID
   */
  function getDeviceId() {
    var id = readStorage(KEYS.device);
    if (!id) {
      id = 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
      writeStorage(KEYS.device, id);
    }
    return id;
  }
  var deviceId = getDeviceId();

  /**
   * 同期の状態を計算する（帯と設定画面で同じ判断を使う）。
   * @returns {{state:string, text:string, trouble:boolean}} 状態・言葉・目立たせるか
   */
  function currentSyncStatus() {
    return L.syncStatus({
      sdkReady: sync.sdkReady, loggedIn: sync.loggedIn, serverConfirmed: sync.serverConfirmed,
      pendingCount: sync.pendingCount, error: sync.error, online: navigator.onLine !== false
    });
  }

  /** 上の帯に、保存と同期の状態を出す。困ったときだけ目立たせる。 */
  function renderSyncBar() {
    var st = currentSyncStatus();
    var text = st.text;
    if (saveBlocked) {
      text = sync.loggedIn
        ? '保存してあるデータが読めません。この端末への保存を止めています（クラウドには送っています）'
        : '保存してあるデータが読めません。記録を守るため、保存を止めています（今回の分は、閉じると消えます）';
    }
    else if (!storageOk) text = 'この端末に保存できません。このまま続けると、閉じたときに記録が消えます';
    $('sync').className = 'sync' + (saveBlocked || !storageOk || st.trouble ? ' wait' : '');
    $('sync-text').textContent = text;
  }

  // ③ 画面の切り替え -----------------------------------------------------

  var session = null;
  var currentView = 'home';

  /**
   * 指定の画面を出して、中身を描き直す。
   * @param {string} name 'home' / 'quiz' / 'stats' / 'settings' / 'exam' / 'exam-result'
   */
  function showView(name) {
    if (name !== 'exam') stopExamTimer();
    if (name === 'exam' && currentView !== 'exam') examBuilt = -1;
    currentView = name;
    VIEWS.forEach(function (v) { $('view-' + v).hidden = (v !== name); });
    document.querySelectorAll('#nav button').forEach(function (b) {
      if (b.dataset.go === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'home') renderHome();
    if (name === 'quiz') renderQuiz();
    if (name === 'stats') renderStats();
    if (name === 'settings') renderSettings();
    if (name === 'exam') renderExam();
    if (name === 'exam-result') renderExamResult();
    var heading = $('view-' + name).querySelector('.title');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  /** いま出ている画面の数字だけ描き直す（フォーカスは動かさない）。 */
  function renderCurrent() {
    if (currentView === 'home') renderHome();
    else if (currentView === 'stats') renderStats();
  }

  /** 「続きから」: 途中の問題があればそこへ。なければ今日の復習を始める。 */
  function openQuiz() {
    if (!session || session.index >= session.ids.length) startSession({ type: 'review' });
    else showView('quiz');
  }

  // ④ ホーム --------------------------------------------------------------

  /**
   * 分野のタイルを1つ作る。押すと、その条件で問題を始める。
   * @param {string} title タイトル
   * @param {string} note 補足の文
   * @param {object} filter buildSession に渡す条件
   * @returns {HTMLElement} ボタン
   */
  function makeTile(title, note, filter) {
    var b = el('button', null, 'tile');
    b.type = 'button';
    b.appendChild(el('b', title));
    b.appendChild(el('span', note));
    b.addEventListener('click', function () { startSession(filter); });
    return b;
  }

  /** ホーム画面を描く（今日の復習の数・目標日・今日の進み・分野のタイル）。 */
  function renderHome() {
    var now = Date.now();
    var results = L.collectQuestionResults(answers);
    var due = L.collectDueQuestionIds(results, now).filter(function (id) { return byId[id]; });
    $('due-count').textContent = String(due.length);

    var days = L.daysUntil(settings.targetDate, now);
    $('target-text').textContent = days === null
      ? '未設定（設定画面で決められます）'
      : days >= 0 ? settings.targetDate + '（あと ' + days + ' 日）' : settings.targetDate + '（' + (-days) + ' 日前に過ぎました）';

    var today = $('today-text');
    clear(today);
    today.appendChild(document.createTextNode(DAILY_GOAL + '問　'));
    today.appendChild(el('span', Math.min(L.countAnswersOnDay(answers, now), DAILY_GOAL) + ' / ' + DAILY_GOAL + ' 完了', 'tag'));

    var tiles = $('home-tiles');
    clear(tiles);
    Object.keys(L.CATEGORY_LABELS).forEach(function (cat) {
      var pool = QUESTIONS.filter(function (q) { return q.category === cat; });
      var unseen = pool.filter(function (q) { return !results.has(q.id); }).length;
      tiles.appendChild(makeTile(L.CATEGORY_LABELS[cat] + '系', '未回答 ' + unseen + '問 ／ 全 ' + pool.length + '問', { type: 'category', value: cat }));
    });
    tiles.appendChild(makeTile('ぜんぶ混ぜて', '全 ' + QUESTIONS.length + '問から出します', { type: 'all' }));
    renderExamCard();
  }

  // ⑤ 問題 ----------------------------------------------------------------

  /**
   * 問題を始める。出す問題を決めて、問題の画面を出す。
   * @param {object} filter {type:'review'|'all'|'category'|'sub', value?}
   */
  function startSession(filter) {
    var results = L.collectQuestionResults(answers);
    session = {
      filter: filter,
      ids: L.buildSession(QUESTIONS, results, filter, SESSION_SIZE, Date.now()),
      index: 0, correct: 0, picked: -1, answered: false, wasSeen: false, ok: false, nextText: '', builtIndex: -1
    };
    showView('quiz');
  }

  /**
   * 選択肢のボタンを作り直す（問題が変わったときだけ呼ぶ。押すたびには作り直さない）。
   * @param {object} q 出す問題
   */
  function buildChoices(q) {
    var box = $('q-choices');
    clear(box);
    q.choices.forEach(function (text, i) {
      var b = el('button', null, 'choice');
      b.type = 'button';
      b.appendChild(el('span', MARKS[i], 'k'));
      b.appendChild(el('span', text));
      b.appendChild(el('span', '', 'm'));
      b.addEventListener('click', function () { pickChoice(i); });
      box.appendChild(b);
    });
  }

  /**
   * 選択肢の見た目（選択中・正解・不正解）を、いまの状態に合わせる。ボタンは作り直さない。
   * @param {object} q 出している問題
   */
  function paintChoices(q) {
    var buttons = $('q-choices').children;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var mark = b.querySelector('.m');
      b.setAttribute('aria-pressed', String(session.picked === i));
      b.classList.remove('right', 'wrong');
      mark.textContent = '';
      if (session.answered) {
        if (i === q.answerIndex) { b.classList.add('right'); mark.textContent = '✓ 正解'; }
        else if (i === session.picked) { b.classList.add('wrong'); mark.textContent = '✕ あなたの答え'; }
      }
    }
  }

  /**
   * 問題の画面を描く。状態は session に入っている。
   * 空（出す問題がない）・終わり・出題中の3つの見た目がある。
   */
  function renderQuiz() {
    var empty = $('quiz-empty'), body = $('quiz-body'), done = $('quiz-done'), action = $('q-action');
    empty.hidden = body.hidden = done.hidden = action.hidden = true;
    if (!session) { openQuiz(); return; }

    if (session.ids.length === 0) {
      $('quiz-empty-text').textContent = session.filter.type === 'review'
        ? '今日の復習はありません。新しい問題を解いてみましょう。'
        : 'この分野の問題はまだありません。';
      empty.hidden = false;
      return;
    }
    if (session.index >= session.ids.length) {
      $('q-done-text').textContent = session.ids.length + '問中 ' + session.correct + '問 正解でした。';
      done.hidden = false;
      return;
    }

    var q = byId[session.ids[session.index]];
    var isNewQuestion = session.builtIndex !== session.index;
    if (isNewQuestion) {
      session.wasSeen = L.collectQuestionResults(answers).has(q.id);
      buildChoices(q);
      renderImages($('q-images'), q);
      session.builtIndex = session.index;
    }
    body.hidden = false;
    action.hidden = false;
    $('q-progress').textContent = (L.CATEGORY_LABELS[q.category] || '') + '系 ・ ' + q.sub + ' ・ ' + (session.index + 1) + ' / ' + session.ids.length;
    $('q-tag').textContent = session.wasSeen ? '復習' : '新しい問題';
    $('q-text').textContent = q.text;
    $('q-source').textContent = q.isSample
      ? '画面確認用の架空の問題です。'
      : '出典: IPA（情報処理推進機構）基本情報技術者試験 科目A 公開問題（令和5〜8年度）。解説は独自に書いたもので、IPA 公式ではありません。';
    paintChoices(q);

    var expl = $('q-expl');
    var submit = $('q-submit');
    if (session.answered) {
      expl.hidden = false;
      $('q-verdict').textContent = (session.ok ? '正解です。' : '不正解です。') + '正解は ' + MARKS[q.answerIndex] + ' です。';
      $('q-expl-text').textContent = q.explanation;
      $('q-next').textContent = session.nextText;
      submit.textContent = session.index + 1 >= session.ids.length ? '結果を見る' : '次の問題へ';
      submit.disabled = false;
    } else {
      expl.hidden = true;
      $('q-next').textContent = '答えると決まります';
      submit.textContent = '答える';
      submit.disabled = session.picked < 0;
    }
    if (isNewQuestion) {
      // 画面を読み上げる人のために、新しい問題の文へフォーカスを移す
      $('q-text').tabIndex = -1;
      $('q-text').focus({ preventScroll: true });
    }
  }

  /**
   * 選択肢を選ぶ（まだ確定しない）。答えたあとは選び直せない。
   * @param {number} i 選んだ番号（0〜3）
   */
  function pickChoice(i) {
    if (!session || session.answered) return;
    session.picked = i;
    renderQuiz();
  }

  /**
   * 「答える」「次の問題へ」ボタンの動き。
   * 1回目: 正誤を確定して記録を保存。2回目: 次の問題へ進む。
   */
  function onSubmit() {
    if (!session) return;
    var q = byId[session.ids[session.index]];
    if (!session.answered) {
      if (session.picked < 0) return;
      var ok = session.picked === q.answerIndex;
      var now = Date.now();
      saveAnswer({
        id: L.makeAnswerId(deviceId, now), qid: q.id, choice: session.picked, correct: ok,
        at: now, mode: session.filter.type === 'review' ? 'review' : 'quiz', deviceId: deviceId
      });
      session.answered = true;
      session.ok = ok;
      if (ok) session.correct += 1;
      var r = L.collectQuestionResults(answers).get(q.id);
      session.nextText = ok ? L.reviewIntervalDays(r.streak) + '日後（' + r.streak + '回続けて正解）' : '明日（最初からやり直し）';
    } else {
      session.index += 1;
      session.picked = -1;
      session.answered = false;
    }
    renderQuiz();
  }

  // ⑥ 成績 ----------------------------------------------------------------

  /**
   * 成績の棒を1行つくる。filter があれば、押すとその分野の問題を始める。
   * @param {string} label 分野の名前
   * @param {{rate:number}|undefined} group その分野の集計（なければ「―」）
   * @param {object|null} filter 押したときの出題条件（なければ押せない）
   * @param {boolean} showLine 60% の目安線を出すか
   * @returns {HTMLElement} 1行
   */
  function barRow(label, group, filter, showLine) {
    var row = filter ? el('button', null, 'bar-row') : el('div', null, 'bar-row');
    if (filter) {
      row.type = 'button';
      row.addEventListener('click', function () { startSession(filter); });
    }
    var rate = group ? group.rate : 0;
    row.appendChild(el('span', label));
    var bar = el('div', null, 'bar');
    var fill = el('i', null, group && rate < L.PASS_TARGET_RATE ? 'low' : '');
    fill.style.width = Math.round(rate * 100) + '%';
    bar.appendChild(fill);
    if (showLine) {
      var line = el('span', null, 'pass');
      line.style.left = (L.PASS_TARGET_RATE * 100) + '%';
      bar.appendChild(line);
    }
    row.appendChild(bar);
    row.appendChild(el('span', group ? Math.round(rate * 100) + '%' : '―', 'num'));
    return row;
  }

  /**
   * 成績の画面を描く。合格の目安・大分野・小分野の順。
   * 開発用: アドレスの最後に ?min=5 を付けると、判定に必要な問題数を変えられる（動作確認用）。
   */
  function renderStats() {
    var results = L.collectQuestionResults(answers);
    var min = Number(new URLSearchParams(location.search).get('min'));
    var est = L.passEstimate(results, QUESTIONS, min > 0 ? { minCount: min } : undefined);

    var judge = $('stats-judge');
    clear(judge);
    if (est.status === 'insufficient') {
      judge.appendChild(el('b', 'まだ判定できません'));
      judge.appendChild(el('p', '初めて見た問題を、あと ' + est.needed + '問 解くと、合格の目安が出ます。', 'fine'));
    } else {
      judge.appendChild(el('span', '練習の目安', 'fine'));
      judge.appendChild(el('div', est.gapPercent === 0 ? '合格の目安に届いています' : '合格の目安まで あと ' + est.gapPercent + '%', 'judge-main'));
      judge.appendChild(el('p', '初めて見た問題の正答率 ' + Math.round(est.rate * 100) + '%（直近 ' + est.sampleSize + '問）。本番の合否は科目ごとの得点で決まります。ここは練習用の目安です。', 'fine'));
    }

    var acc = L.accuracyByGroup(results, QUESTIONS);
    var cat = $('stats-cat');
    clear(cat);
    Object.keys(L.CATEGORY_LABELS).forEach(function (k) {
      cat.appendChild(barRow(L.CATEGORY_LABELS[k] + '系', acc.category[k], null, true));
    });

    var sub = $('stats-sub');
    clear(sub);
    var names = [];
    QUESTIONS.forEach(function (q) { if (names.indexOf(q.sub) < 0) names.push(q.sub); });
    var any = false;
    names.forEach(function (name) {
      if (acc.sub[name]) { any = true; sub.appendChild(barRow(name, acc.sub[name], { type: 'sub', value: name }, false)); }
    });
    if (!any) sub.appendChild(el('p', 'まだ記録がありません。', 'fine'));
  }

  // ⑦ 設定 ----------------------------------------------------------------

  /** 文字の大きさの設定を画面に反映する。 */
  function applySettings() {
    $('app').classList.toggle('large', settings.large);
    var label = settings.large ? '文字を標準に戻す' : '文字を大きく';
    $('large-btn').textContent = label;
    $('large-btn').setAttribute('aria-pressed', String(settings.large));
    $('q-large').textContent = label;
  }

  /** 設定画面を描く。 */
  function renderSettings() {
    $('target-input').value = settings.targetDate;
    applySettings();
    renderSyncCard();
  }

  /** 文字の大きさを切り替える。 */
  function toggleLarge() {
    settings.large = !settings.large;
    saveSettings();
    applySettings();
  }

  // ⑨ クラウド同期 ----------------------------------------------------------

  /**
   * 設定画面の「クラウド同期」の枠を描く。
   * 同期の部品を読み込めていないのに、電波がある（機内モードで起動して、あとから電波が戻った場合など）ときは、
   * 「同期を読み込み直す」ボタンを出す（読み込みの失敗は、画面の中では覚えられたままなので、画面ごと読み込み直す）。
   */
  function renderSyncCard() {
    var st = currentSyncStatus();
    $('sync-unavailable').hidden = sync.sdkReady;
    $('sync-reload-btn').hidden = sync.sdkReady || navigator.onLine === false || document.readyState !== 'complete';
    $('sync-card-status').textContent = st.text;
    $('sync-account').textContent = sync.loggedIn ? sync.email : '（ログインしていません）';
    $('sync-login-btn').hidden = !sync.sdkReady || sync.loggedIn;
    $('sync-logout-btn').hidden = !sync.loggedIn;
  }

  /**
   * 記録をクラウドに送る（ログイン中だけ。400件ずつに分ける）。
   * @param {object[]} list 送る記録の一覧
   */
  function pushToCloud(list) {
    if (!sync.loggedIn || !window.FeSync) return;
    L.chunkList(list, 400).forEach(function (chunk) {
      window.FeSync.push(chunk.map(function (a) { return { id: a.id, data: L.answerToDoc(a) }; }));
    });
  }

  /**
   * ログインの状態が変わったとき（sync.js から呼ばれる）。
   * @param {{uid:string, email:string}|null} user ログイン中の人。ログアウトなら null
   */
  function onCloudAuth(user) {
    sync.loggedIn = !!user;
    sync.email = user ? user.email : '';
    sync.serverConfirmed = false;
    sync.pendingCount = 0;
    sync.error = false;
    sync.lastUploadAt = 0;
    renderSyncBar();
    renderSyncCard();
  }

  /**
   * クラウドの記録が届いたとき（sync.js から呼ばれる）。
   * 端末の記録に合流させて保存する。クラウドと照合できたときは、端末にだけある記録（初回や、送れなかった分）を送る。
   * 送れない状態が続いても送り続けないよう、送り直しは RESEND_INTERVAL_MS 以上あける。
   * エラーの印は、すべて送れて送信待ちもなくなったときに消す。
   * @param {{docs:{id:string, data:object, pending:boolean}[], fromCache:boolean}} snap 届いた内容
   */
  function onCloudSnapshot(snap) {
    var remote = [];
    var remoteIds = {};
    var pending = 0;
    snap.docs.forEach(function (d) {
      var a = L.docToAnswer(d.id, d.data);
      if (a) { remote.push(a); remoteIds[a.id] = true; }
      if (d.pending) pending += 1;
    });
    answers = L.mergeAnswers(answers, remote);
    persistAnswers();
    sync.pendingCount = pending;
    if (!snap.fromCache) sync.serverConfirmed = true;
    var missing = snap.fromCache ? [] : L.answersToUpload(answers, remoteIds);
    if (missing.length > 0 && Date.now() - sync.lastUploadAt > RESEND_INTERVAL_MS) {
      sync.lastUploadAt = Date.now();
      pushToCloud(missing);
    }
    if (!snap.fromCache && missing.length === 0 && pending === 0) sync.error = false;
    renderSyncBar();
    renderSyncCard();
    renderCurrent();
  }

  /** クラウドでエラーが起きたとき（sync.js から呼ばれる）。帯でお知らせする。 */
  function onCloudError() {
    sync.error = true;
    renderSyncBar();
    renderSyncCard();
  }

  /** 同期の部品（window.FeSync）が使えるようになったら、同期を始める。 */
  function startSync() {
    if (!window.FeSync || sync.sdkReady) return;
    sync.sdkReady = true;
    window.FeSync.init({ onAuth: onCloudAuth, onSnapshot: onCloudSnapshot, onError: onCloudError });
    renderSyncBar();
    renderSyncCard();
  }

  // ⑩ 模擬試験 --------------------------------------------------------------

  /** 試験の途中の状態（なければ null）。端末の KEYS.exam に保存する。 */
  var exam = null;
  /** 保存してある模擬試験が読めないとき true。元のデータを守るため、新しく始めない・上書きしない。 */
  var examBlocked = false;
  /** 直前に終えた試験の結果（結果画面に出す分。閉じると消える。答えは answers に残っている）。 */
  var examResult = null;
  /** 残り時間の表示を1秒ごとに更新する仕掛け（動いていなければ null）。 */
  var examTimer = null;
  /** 終了の処理をしている間 true（時間切れと「終了する」が重なっても、二重に記録しないため）。 */
  var examFinishing = false;
  /** 選択肢のボタンを作ってある問題の位置（作り直しが要るかの判断に使う。-1 は未作成）。 */
  var examBuilt = -1;

  /**
   * 端末に保存してある模擬試験を読む。読めなければ examBlocked にして、上書きしないようにする。
   * 問題データにない問題は外す（全部ない場合は読めない扱い）。
   */
  function loadExam() {
    var parsed = L.parseExamState(readStorage(KEYS.exam));
    examBlocked = parsed.broken;
    exam = parsed.state;
    if (!exam) return;
    var ids = exam.qids.filter(function (id) { return byId[id]; });
    if (ids.length === 0) { exam = null; examBlocked = true; return; }
    if (ids.length !== exam.qids.length) {
      exam.qids = ids;
      exam.current = Math.min(exam.current, ids.length - 1);
    }
  }

  /** いまの模擬試験の状態を端末に保存する。読めない保存があるときは書かない。 */
  function saveExam() {
    if (examBlocked || !exam) return;
    if (!writeStorage(KEYS.exam, JSON.stringify(exam))) storageOk = false;
    renderSyncBar();
  }

  /**
   * ホームの「模擬試験」の枠を描く。
   * 状態は4つ: 読めない保存がある／途中の試験がある／問題がない／始められる。
   * 途中の試験が時間切れなら、ここで自動的に終了する。
   */
  function renderExamCard() {
    var text = $('exam-card-text'), note = $('exam-card-note');
    var start = $('btn-exam-start'), resume = $('btn-exam-resume'), discard = $('btn-exam-discard');
    start.hidden = resume.hidden = discard.hidden = true;
    if (examBlocked) {
      text.textContent = '保存してある模擬試験のデータが読めません。';
      note.textContent = '元のデータを守るため、新しい模擬試験は始めません。不要なら下のボタンで消せます（成績の記録は消えません）。';
      discard.textContent = '読めない模擬試験の保存を消す';
      discard.hidden = false;
      return;
    }
    if (exam) {
      var left = L.examRemainingMs(exam, Date.now());
      if (left <= 0) { finishExam(); return; }
      text.textContent = '途中の模擬試験があります（' + Object.keys(exam.picks).length + ' / ' + exam.qids.length + '問 回答ずみ・残り ' + L.formatClock(left) + '）。';
      note.textContent = 'やめている間も時間は進みます。';
      discard.textContent = 'この模擬試験をやめる';
      resume.hidden = false;
      discard.hidden = false;
      return;
    }
    if (QUESTIONS.length === 0) {
      text.textContent = '問題がありません。';
      note.textContent = '';
      return;
    }
    var total = Math.min(L.EXAM_CONFIG.count, QUESTIONS.length);
    var minutes = Math.round(L.examLimitMs(total, L.EXAM_CONFIG) / 60000);
    text.textContent = '本番と同じ形式の練習です。' + total + '問・' + minutes + '分。試験中は正解と解説を出しません。';
    note.textContent = total < L.EXAM_CONFIG.count
      ? 'いまは問題が少ないため ' + total + '問・' + minutes + '分です（問題を足すと ' + L.EXAM_CONFIG.count + '問・' + L.EXAM_CONFIG.minutes + '分になります）。'
      : '終わると、答えた分を成績に足します。';
    start.hidden = false;
  }

  /** 模擬試験を新しく始める。出す問題を決めて、保存して、試験の画面を出す。 */
  function startExam() {
    if (exam || examBlocked) return;
    var qids = L.buildExam(QUESTIONS, L.EXAM_CONFIG);
    if (qids.length === 0) return;
    exam = L.newExamState(qids, Date.now(), L.EXAM_CONFIG);
    saveExam();
    showView('exam');
  }

  /**
   * 途中の模擬試験をやめる（答えは成績に入れない）。読めない保存を消すときにも使う。確認してから消す。
   */
  function discardExam() {
    if (examBlocked) {
      if (!window.confirm('読めない模擬試験の保存を消します。成績の記録は消えません。よろしいですか？')) return;
      removeStorage(KEYS.exam);
      examBlocked = false;
    } else if (exam) {
      if (!window.confirm('この模擬試験をやめます。答えた分は成績に入りません。よろしいですか？')) return;
      removeStorage(KEYS.exam);
      exam = null;
    }
    showView('home');
  }

  /**
   * 試験中の選択肢のボタンを作り直す（問題が変わったときだけ呼ぶ）。
   * @param {object} q 出す問題
   */
  function buildExamChoices(q) {
    var box = $('x-choices');
    clear(box);
    q.choices.forEach(function (text, i) {
      var b = el('button', null, 'choice');
      b.type = 'button';
      b.appendChild(el('span', MARKS[i], 'k'));
      b.appendChild(el('span', text));
      b.addEventListener('click', function () { pickExamChoice(i); });
      box.appendChild(b);
    });
  }

  /** 番号の一覧を描く（回答ずみ・見直しの印・今の問題が分かるようにする）。 */
  function renderExamGrid() {
    var grid = $('x-grid');
    clear(grid);
    exam.qids.forEach(function (id, i) {
      var answered = typeof exam.picks[id] === 'number';
      var marked = exam.marks.indexOf(id) >= 0;
      var b = el('button', String(i + 1) + (marked ? '★' : ''), 'cell' + (answered ? ' done' : '') + (i === exam.current ? ' now' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', '問' + (i + 1) + (answered ? ' 回答ずみ' : ' 未回答') + (marked ? ' 印あり' : '') + (i === exam.current ? ' 表示中' : ''));
      b.addEventListener('click', function () { goExam(i); });
      grid.appendChild(b);
    });
  }

  /**
   * 試験中の画面を描く。時間切れなら、描かずに終了する。
   * 正解・解説は出さない。
   */
  function renderExam() {
    if (!exam) { showView('home'); return; }
    if (L.examRemainingMs(exam, Date.now()) <= 0) { finishExam(); return; }
    var q = byId[exam.qids[exam.current]];
    var isNewQuestion = examBuilt !== exam.current;
    if (isNewQuestion) {
      buildExamChoices(q);
      renderImages($('x-images'), q);
      examBuilt = exam.current;
    }
    $('x-progress').textContent = '問' + (exam.current + 1) + ' / ' + exam.qids.length + ' ・ ' + (L.CATEGORY_LABELS[q.category] || '') + '系';
    $('x-text').textContent = q.text;
    var picked = exam.picks[q.id];
    var buttons = $('x-choices').children;
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(picked === i));
    var marked = exam.marks.indexOf(q.id) >= 0;
    $('x-mark').setAttribute('aria-pressed', String(marked));
    $('x-mark').textContent = marked ? '見直しの印をはずす' : '見直しの印をつける';
    $('x-prev').disabled = exam.current === 0;
    $('x-next').disabled = exam.current >= exam.qids.length - 1;
    renderExamGrid();
    startExamTimer();
    tickExamTimer();
    if (isNewQuestion) {
      $('x-text').tabIndex = -1;
      $('x-text').focus({ preventScroll: true });
    }
  }

  /**
   * 選択肢を選ぶ（試験中は選び直せる）。選ぶたびに保存する。
   * @param {number} i 選んだ番号（0〜3）
   */
  function pickExamChoice(i) {
    if (!exam) return;
    exam.picks[exam.qids[exam.current]] = i;
    saveExam();
    renderExam();
  }

  /** 今の問題の「見直しの印」をつける／はずす。 */
  function toggleExamMark() {
    if (!exam) return;
    var id = exam.qids[exam.current];
    var at = exam.marks.indexOf(id);
    if (at >= 0) exam.marks.splice(at, 1); else exam.marks.push(id);
    saveExam();
    renderExam();
  }

  /**
   * 指定の問題へ移る。
   * @param {number} i 問題の位置（0 から）。範囲の外なら何もしない
   */
  function goExam(i) {
    if (!exam || i < 0 || i >= exam.qids.length) return;
    exam.current = i;
    saveExam();
    renderExam();
  }

  /** 残り時間の表示を更新する。0になったら終了する。試験の画面でなければ仕掛けを止める。 */
  function tickExamTimer() {
    if (!exam || currentView !== 'exam') { stopExamTimer(); return; }
    var left = L.examRemainingMs(exam, Date.now());
    $('x-timer').textContent = '残り ' + L.formatClock(left);
    if (left <= 0) finishExam();
  }

  /** 残り時間の更新（1秒ごと）を始める。すでに動いていれば何もしない。 */
  function startExamTimer() { if (examTimer === null) examTimer = setInterval(tickExamTimer, 1000); }

  /** 残り時間の更新を止める。 */
  function stopExamTimer() { if (examTimer !== null) { clearInterval(examTimer); examTimer = null; } }

  /** 「終了する」ボタン。未回答があれば、確認してから終了する。 */
  function onExamFinishClick() {
    if (!exam) return;
    var unanswered = exam.qids.length - Object.keys(exam.picks).length;
    var message = unanswered > 0
      ? '未回答が ' + unanswered + '問 あります。このまま終了しますか？'
      : '模擬試験を終了して、採点します。よろしいですか？';
    if (window.confirm(message)) finishExam();
  }

  /**
   * 模擬試験を終える。採点して、答えた分を成績（answers）に足し、途中の保存を消して、結果画面を出す。
   * 先に成績へ足してから保存を消す（途中で失敗しても答えを失わないため）。二重には動かない。
   */
  function finishExam() {
    if (!exam || examFinishing) return;
    examFinishing = true;
    try {
      var now = Date.now();
      var grade = L.gradeExam(exam, QUESTIONS);
      saveAnswers(L.examAnswersToRecord(exam, QUESTIONS, now, deviceId));
      examResult = { grade: grade, qids: exam.qids.slice(), timeUp: L.examRemainingMs(exam, now) <= 0 };
      removeStorage(KEYS.exam);
      exam = null;
    } finally {
      examFinishing = false;
    }
    showView('exam-result');
  }

  /** 結果画面を描く。点数・練習の目安・分野ごとの正答率・間違えた問題の解説。 */
  function renderExamResult() {
    if (!examResult) { showView('home'); return; }
    var g = examResult.grade;
    var box = $('xr-score');
    clear(box);
    box.appendChild(el('span', examResult.timeUp ? '時間切れで終了しました' : '終了しました', 'fine'));
    box.appendChild(el('div', g.correct + ' / ' + g.total + '問 正解（' + Math.round(g.rate * 100) + '%）', 'judge-main'));
    var target = Math.round(L.PASS_TARGET_RATE * 100);
    var needed = Math.ceil(Math.round(g.total * L.PASS_TARGET_RATE * 1000) / 1000) - g.correct;
    box.appendChild(el('p', needed <= 0 ? '練習の目安 ' + target + '% に届いています。' : '練習の目安 ' + target + '% まで あと ' + needed + '問です。', 'fine'));
    box.appendChild(el('p', '本番の合否は科目ごとの得点で決まります。これは練習用の目安です。' +
      (g.unanswered > 0 ? '未回答は ' + g.unanswered + '問でした（不正解として数え、成績の記録には入れていません）。' : ''), 'fine'));

    var cat = $('xr-cat');
    clear(cat);
    Object.keys(L.CATEGORY_LABELS).forEach(function (k) {
      cat.appendChild(barRow(L.CATEGORY_LABELS[k] + '系', g.byCategory[k], null, true));
    });

    var list = $('xr-wrong');
    clear(list);
    if (g.wrong.length === 0) list.appendChild(el('p', '全問正解です。', 'fine'));
    g.wrong.forEach(function (w) {
      var q = byId[w.qid];
      var card = el('div', null, 'card');
      card.appendChild(el('b', '問' + (examResult.qids.indexOf(w.qid) + 1) + '　' + (L.CATEGORY_LABELS[q.category] || '') + '系 ・ ' + q.sub));
      card.appendChild(el('p', q.text, 'qtext'));
      var imgs = el('div', null, 'qimages');
      renderImages(imgs, q);
      card.appendChild(imgs);
      card.appendChild(el('p', 'あなたの答え: ' + (w.choice >= 0 ? MARKS[w.choice] + ' ' + q.choices[w.choice] : '未回答'), 'fine'));
      card.appendChild(el('p', '正解: ' + MARKS[q.answerIndex] + ' ' + q.choices[q.answerIndex], 'fine'));
      var ex = el('div', null, 'expl');
      ex.appendChild(el('p', q.explanation));
      card.appendChild(ex);
      list.appendChild(card);
    });
  }

  // ⑧ はじまり ------------------------------------------------------------

  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.go === 'quiz') openQuiz(); else showView(b.dataset.go);
    });
  });
  $('btn-review').addEventListener('click', function () { startSession({ type: 'review' }); });
  $('btn-exam-start').addEventListener('click', startExam);
  $('btn-exam-resume').addEventListener('click', function () { showView('exam'); });
  $('btn-exam-discard').addEventListener('click', discardExam);
  $('x-quit').addEventListener('click', discardExam);
  $('x-prev').addEventListener('click', function () { if (exam) goExam(exam.current - 1); });
  $('x-next').addEventListener('click', function () { if (exam) goExam(exam.current + 1); });
  $('x-mark').addEventListener('click', toggleExamMark);
  $('x-finish').addEventListener('click', onExamFinishClick);
  $('q-submit').addEventListener('click', onSubmit);
  $('large-btn').addEventListener('click', toggleLarge);
  $('q-large').addEventListener('click', toggleLarge);
  $('target-input').addEventListener('change', function (e) { settings.targetDate = e.target.value; saveSettings(); });

  // ほかのタブで記録が増えたら、取り込んで画面の数字を更新する
  window.addEventListener('storage', function (e) {
    if (e.key !== KEYS.answers) return;
    var latest = L.inspectStoredAnswers(e.newValue);
    if (latest.broken || latest.dropped > 0) return;
    answers = L.mergeAnswers(answers, latest.answers);
    renderCurrent();
  });

  $('sync-login-btn').addEventListener('click', function () {
    if (!window.FeSync) return;
    sync.error = false; // 前回の失敗の表示を消してから、もう一度ログインを試す
    renderSyncBar();
    renderSyncCard();
    window.FeSync.signIn();
  });
  $('sync-logout-btn').addEventListener('click', function () { if (window.FeSync) window.FeSync.signOutUser(); });
  $('sync-reload-btn').addEventListener('click', function () { location.reload(); });
  window.addEventListener('online', renderSyncCard);
  window.addEventListener('offline', renderSyncCard);
  window.addEventListener('online', renderSyncBar);
  window.addEventListener('offline', renderSyncBar);
  document.addEventListener('fesync-ready', startSync);

  renderSyncBar();
  applySettings();
  loadExam();
  showView('home');
  startSync();
})();
