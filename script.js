/**
 * script.js … 画面の動きと、端末への保存。
 * 読み方: ①道具 ②保存 ③画面の切り替え ④ホーム ⑤問題 ⑥成績 ⑦設定 ⑨クラウド同期 ⑩模擬試験 ⑪トレース練習 ⑧はじまり の順に並んでいる。
 * 計算は logic.js（FeLogic）、問題は data/（FE_QUESTIONS_R05 など、年度ごと）にある。
 * 画面の文字は textContent で入れる（innerHTML は使わない）。
 */
(function () {
  'use strict';

  var L = FeLogic;
  /**
   * 科目A の問題（令和5〜8年度の公開問題）を1つの一覧に合わせたもの。
   * 模擬試験・合格の目安・分野ごとの成績・「ぜんぶ混ぜて」は、この科目A の一覧だけを使う。
   */
  var QUESTIONS = [].concat(FE_QUESTIONS_R05, FE_QUESTIONS_R06, FE_QUESTIONS_R07, FE_QUESTIONS_R08);
  /** 科目B の問題（令和8年度の公開問題）。科目A の一覧とは混ぜない。 */
  var QUESTIONS_B = FE_QUESTIONS_R08B;
  /** 科目A と科目B を合わせた一覧。履歴から問題を引くとき（byId）と、今日の復習だけが使う。 */
  var QUESTIONS_ALL = QUESTIONS.concat(QUESTIONS_B);
  var KEYS = { answers: 'feAnswers', settings: 'feSettings', device: 'feDeviceId', exam: 'feExamState', trace: 'feTraceProgress' };
  /** 選択肢の記号。科目A は4つ（ア〜エ）、科目B は最大10個（ア〜コ）。 */
  var MARKS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'];
  var DAILY_GOAL = 20;
  var SESSION_SIZE = 20;
  var VIEWS = ['home', 'quiz', 'stats', 'settings', 'exam', 'exam-result', 'trace'];
  var byId = {};
  QUESTIONS_ALL.forEach(function (q) { byId[q.id] = q; });

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
   * 科目B の画像（プログラムなど）は、読みやすい大きさ（画像の幅の半分）で出し、はみ出す分は枠の中で横に動かせる。
   * 押すと全画面で大きく見られる（openZoom）。
   * @param {HTMLElement} box 画像を入れる入れ物
   * @param {object} q 問題（images: [{src, alt}] を持つことがある）
   */
  function renderImages(box, q) {
    clear(box);
    var list = Array.isArray(q.images) ? q.images : [];
    var zoomable = q.category === 'subjectB';
    box.classList.toggle('scrollx', zoomable);
    list.forEach(function (im) {
      box.appendChild(zoomable ? makeZoomableImage(im) : makeImage(im, 'qimg'));
    });
    if (zoomable && list.length > 0) box.appendChild(el('p', '画像は左右に動かせます。押すと、大きく見られます。', 'fine'));
    box.hidden = list.length === 0;
  }

  /**
   * 画像の要素を作る。
   * @param {{src:string, alt:string}} im 画像の情報
   * @param {string} className クラス名
   * @returns {HTMLImageElement} 画像の要素
   */
  function makeImage(im, className) {
    var img = el('img', null, className);
    img.src = im.src;
    img.alt = im.alt || '';
    return img;
  }

  /**
   * 押すと大きく見られる画像（ボタンの中に画像を入れたもの）を作る。画像の幅の半分で出す。
   * @param {{src:string, alt:string}} im 画像の情報
   * @returns {HTMLButtonElement} ボタン
   */
  function makeZoomableImage(im) {
    var b = el('button', null, 'imgbtn');
    b.type = 'button';
    b.setAttribute('aria-label', (im.alt || '画像') + '（押すと大きく見られます）');
    var img = el('img', null, 'qimg zoomable');
    function setSize() { if (img.naturalWidth) img.style.width = Math.round(img.naturalWidth / 2) + 'px'; }
    img.addEventListener('load', setSize);
    img.src = im.src;
    img.alt = im.alt || '';
    if (img.complete) setSize();
    b.appendChild(img);
    b.addEventListener('click', function () { openZoom(im); });
    return b;
  }

  /**
   * 画像を全画面で大きく見る窓を開く（画像そのものの大きさで出す。はみ出す分は動かして見る）。
   * @param {{src:string, alt:string}} im 画像の情報
   */
  function openZoom(im) {
    var dlg = $('zoom-dialog');
    var img = $('zoom-img');
    img.src = im.src;
    img.alt = im.alt || '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('zoom-close').focus({ preventScroll: true });
  }

  /** 画像を大きく見る窓を閉じる。 */
  function closeZoom() {
    var dlg = $('zoom-dialog');
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  /** 擬似言語の約束事のまとめ（IPA 公式ではなく、独自のまとめ）。「擬似言語の説明」の窓に文字で出す。 */
  var PSEUDO_GUIDE = [
    '配列の要素番号は 1 から始まります（C言語の 0 から、とは違います）。',
    '「変数 ← 式」は代入です。右の値を、左の変数に入れます（比べるときは「＝」を使います）。',
    'for (i を a から b まで 1 ずつ増やす) は、i を a から b まで順に変えながら、中の処理をくり返します。「減らす」のときは大きい方から小さい方へ進みます。a が b より大きい（増やす場合）と、1回も実行しません。',
    '「未定義」は、値が入っていない状態です。',
    '「{}」は、要素が 0 個の配列です。「配列の末尾に ○ を追加する」は、いちばん後ろに足すことです。',
    'return は、値を返して関数を終わります。'
  ];

  /** 「擬似言語の説明」の窓の中身（画像2枚と、約束事のまとめ）を作る。起動時に1回だけ呼ぶ。 */
  function buildGuide() {
    var body = $('guide-body');
    clear(body);
    var imgs = [
      { src: 'assets/images/r08b/guide-notation.png', alt: '擬似言語の記述形式の表（宣言・代入・if・while・do・for の書き方）' },
      { src: 'assets/images/r08b/guide-operators.png', alt: '演算子の優先順位の表、論理型の定数、配列、未定義についての説明' }
    ];
    imgs.forEach(function (im) {
      var b = el('button', null, 'imgbtn full');
      b.type = 'button';
      b.setAttribute('aria-label', im.alt + '（押すと大きく見られます）');
      b.appendChild(makeImage(im, 'qimg'));
      b.addEventListener('click', function () { openZoom(im); });
      body.appendChild(b);
    });
    body.appendChild(el('p', '画像は IPA が公開している「擬似言語の記述形式」です。押すと大きく見られます。', 'fine'));
    var box = el('div', null, 'card');
    box.appendChild(el('b', '約束事のまとめ（このアプリの独自のまとめで、IPA 公式ではありません）'));
    var ul = el('ul', null, 'guide-list');
    PSEUDO_GUIDE.forEach(function (t) { ul.appendChild(el('li', t)); });
    box.appendChild(ul);
    body.appendChild(box);
  }

  /** 「擬似言語の説明」の窓を開く（問題を見ながら読める。スマホは全画面、PC は右側）。 */
  function openGuide() {
    var dlg = $('guide-panel');
    if (typeof dlg.show === 'function') dlg.show(); else dlg.setAttribute('open', '');
    $('app').classList.add('guide-open');
    $('guide-close').focus({ preventScroll: true });
  }

  /** 「擬似言語の説明」の窓を閉じる。 */
  function closeGuide() {
    var dlg = $('guide-panel');
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    $('app').classList.remove('guide-open');
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
   * @returns {boolean} この端末に保存できたら true
   */
  function saveAnswer(a) { return saveAnswers([a]); }

  /**
   * 回答の記録をまとめて足して保存する。
   * 保存の直前に、ほかのタブが足した記録を読み直して合流させる（消さないため）。
   * 保存できなくても、このページを開いている間は覚えている。
   * @param {object[]} list 回答の記録の一覧
   * @returns {boolean} この端末に保存できたら true（保存を止めているとき・容量がいっぱいのときは false。クラウドへは送る）
   */
  function saveAnswers(list) {
    answers = L.mergeAnswers(answers, list);
    var saved = persistAnswers();
    pushToCloud(list);
    renderSyncBar();
    return saved;
  }

  /**
   * いまの記録を端末に保存する。保存の直前に、ほかのタブが足した記録を読み直して合流させる（消さないため）。
   * 保存してあるデータが読めないときは、元のデータを守るため書かない。
   * @returns {boolean} 端末に書けたら true。書かなかった（保存を止めている）・書けなかった（容量など）ときは false
   */
  function persistAnswers() {
    if (saveBlocked) return false;
    var latest = L.inspectStoredAnswers(readStorage(KEYS.answers));
    if (latest.broken || latest.dropped > 0) { saveBlocked = true; return false; }
    answers = L.mergeAnswers(answers, latest.answers);
    storageOk = writeStorage(KEYS.answers, JSON.stringify(answers));
    return storageOk;
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
  /** ホームの大きなボタンが「今日の復習」か（false なら「新しい問題を始める」）。renderHome が決める。 */
  var homeHasDue = false;

  /**
   * 指定の画面を出して、中身を描き直す。
   * @param {string} name 'home' / 'quiz' / 'stats' / 'settings' / 'exam' / 'exam-result' / 'trace'
   */
  function showView(name) {
    if (name !== 'quiz') closeGuide();
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
    if (name === 'trace') renderTrace();
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
    homeHasDue = due.length > 0;
    $('due-count').hidden = !homeHasDue;
    // 復習が 0件のとき、大きなボタンは「新しい問題を始める」になる（押すと科目A のぜんぶ混ぜて）
    $('review-title').textContent = homeHasDue ? '今日の復習' : '新しい問題を始める';
    $('review-note').textContent = homeHasDue
      ? '忘れたころの問題（1日後→3日後→7日後→14日後に再び出ます）。正解すると間隔が延び、間違えると明日に戻ります。'
      : '今日の復習はありません。科目A の問題を、ぜんぶ混ぜて出します。';
    // まだ 1問も解いていない人にだけ、はじめの手順を出す
    $('start-guide').hidden = answers.length > 0;

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
    tiles.appendChild(makeTile('ぜんぶ混ぜて', '全 ' + QUESTIONS.length + '問から出します（科目A だけ）', { type: 'all' }));
    var tilesB = $('home-tiles-b');
    clear(tilesB);
    var unseenB = QUESTIONS_B.filter(function (q) { return !results.has(q.id); }).length;
    tilesB.appendChild(makeTile('科目B 令和8年度の公開問題（' + QUESTIONS_B.length + '問だけ・本番は 20問）',
      '長めのプログラムを読んで、空欄に入る答えを選びます。未回答 ' + unseenB + '問 ／ 全 ' + QUESTIONS_B.length + '問',
      { type: 'category', value: 'subjectB' }));
    var tilesT = $('home-tiles-trace');
    clear(tilesT);
    var tb = el('button', null, 'tile');
    tb.type = 'button';
    tb.appendChild(el('b', '擬似言語のトレース練習'));
    tb.appendChild(el('span', 'プログラムを 1行ずつ動かして、変数の値の変化を追います。自作の ' + TRACE_PROBLEMS.length + '問。'));
    tb.addEventListener('click', function () { showView('trace'); });
    tilesT.appendChild(tb);
    renderExamCard();
  }

  // ⑤ 問題 ----------------------------------------------------------------

  /**
   * 出題に使う問題の一覧を、条件の種類で切り替える。
   *   今日の復習 → 科目A+B（どちらの間違いも復習に出す）／ 科目B のタイル → 科目B だけ／ それ以外 → 科目A だけ
   * @param {object} filter {type:'review'|'all'|'category'|'sub', value?}
   * @returns {object[]} 使う問題の一覧
   */
  function questionsForFilter(filter) {
    if (filter.type === 'review') return QUESTIONS_ALL;
    if (filter.type === 'category' && filter.value === 'subjectB') return QUESTIONS_B;
    return QUESTIONS;
  }

  /**
   * 問題を始める。出す問題を決めて、問題の画面を出す。
   * @param {object} filter {type:'review'|'all'|'category'|'sub', value?}
   */
  function startSession(filter) {
    var results = L.collectQuestionResults(answers);
    session = {
      filter: filter,
      ids: L.buildSession(questionsForFilter(filter), results, filter, SESSION_SIZE, Date.now()),
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
      var b = el('button', null, 'choice' + (q.choices.length >= 8 ? ' many' : ''));
      b.type = 'button';
      b.appendChild(el('span', MARKS[i], 'k'));
      b.appendChild(el('span', text, 'ct'));
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
    var isB = q.category === 'subjectB';
    var label = isB ? '科目B' : (L.CATEGORY_LABELS[q.category] || '') + '系';
    $('q-progress').textContent = label + ' ・ ' + q.sub + ' ・ ' + (session.index + 1) + ' / ' + session.ids.length;
    $('q-guide').hidden = !isB;
    $('q-bnote').hidden = !isB;
    if (!isB) closeGuide();
    $('q-expl-text').className = isB ? 'pre' : '';
    $('q-tag').textContent = session.wasSeen ? '復習' : '新しい問題';
    $('q-text').textContent = q.text;
    $('q-source').textContent = q.isSample
      ? '画面確認用の架空の問題です。'
      : isB
        ? '出典: IPA（情報処理推進機構）基本情報技術者試験 科目B 公開問題（令和8年度）。解説は独自に書いたもので、IPA 公式ではありません。'
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
      judge.appendChild(el('b', '科目Aの練習の目安（本番の判定ではありません）'));
      judge.appendChild(el('div', est.gapPercent === 0 ? '練習の線（60%）を超えています' : '練習の線（60%）まで あと ' + est.gapPercent + '%', 'judge-main'));
      judge.appendChild(el('p', '初めて見た問題の正答率 ' + Math.round(est.rate * 100) + '%（直近 ' + est.sampleSize + '問）。', 'fine'));
    }
    judge.appendChild(el('p', '本番の合格には、科目A と 科目B の両方で 600点以上（1000点満点）が必要です。この目安は、科目A だけの練習用で、60% は点数ではなく仮の線です。科目B の成績は入っていません。', 'note'));

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
      note.textContent = '画面を閉じている間も、時間は進みます。';
      discard.textContent = '破棄する（採点しない）';
      resume.textContent = '模擬試験の続きから（残り ' + L.formatClock(left) + '）';
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
      if (!window.confirm('この模擬試験を破棄します。採点はせず、答えた分も成績に入りません。元には戻せません。よろしいですか？')) return;
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

  /** 残り時間が、この時間（ミリ秒）以下になったら、色と文字で知らせる。 */
  var EXAM_URGENT_MS = 5 * 60 * 1000;

  /** 残り時間の表示を更新する。0になったら終了する。試験の画面でなければ仕掛けを止める。5分以下は色を変えて、文字でも知らせる。 */
  function tickExamTimer() {
    if (!exam || currentView !== 'exam') { stopExamTimer(); return; }
    var left = L.examRemainingMs(exam, Date.now());
    var urgent = left <= EXAM_URGENT_MS;
    $('x-timer').textContent = '残り ' + L.formatClock(left) + (urgent ? '（もうすぐ終わります）' : '');
    $('x-timer').classList.toggle('urgent', urgent);
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
      ? '未回答が ' + unanswered + '問 あります。このまま採点して終わりますか？'
      : '模擬試験を終わって、採点します。よろしいですか？';
    if (window.confirm(message)) finishExam();
  }

  /**
   * 模擬試験を終える。採点して、答えた分を成績（answers）に足し、途中の保存を消して、結果画面を出す。
   * 先に成績へ足してから保存を消す（途中で失敗しても答えを失わないため）。二重には動かない。
   * 成績を端末に保存できなかったときは、途中の保存を消さずに残し、結果画面で知らせる（答えを失わないため）。
   */
  function finishExam() {
    if (!exam || examFinishing) return;
    examFinishing = true;
    try {
      var now = Date.now();
      var grade = L.gradeExam(exam, QUESTIONS);
      var saved = saveAnswers(L.examAnswersToRecord(exam, QUESTIONS, now, deviceId));
      examResult = { grade: grade, qids: exam.qids.slice(), timeUp: L.examRemainingMs(exam, now) <= 0, saved: saved };
      if (saved) removeStorage(KEYS.exam);
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
    var warn = $('xr-warn');
    warn.hidden = examResult.saved !== false;
    if (!warn.hidden) {
      warn.textContent = 'この端末に成績を保存できませんでした。' +
        (sync.loggedIn ? 'ログイン中なので、クラウドには送っています。' : 'ログインしていないので、このページを閉じると今回の成績は消えます。') +
        '模擬試験の途中の保存は消さずに残してあります。';
    }
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

  // ⑪ トレース練習 -------------------------------------------------------
  // 擬似言語のプログラムを1行ずつ動かして見る画面。動かす計算は trace-logic.js（FeTrace）、問題は data/trace-problems.js。
  // 成績は端末だけの localStorage（feTraceProgress）。科目A・科目B の成績（feAnswers）には入れない。

  var T = FeTrace;
  var traceStored = T.parseProgress(readStorage(KEYS.trace));
  /** 練習の成績。保存が読めないとき（traceBlocked）は、上書きしないため保存を止める。 */
  var traceProgress = traceStored.progress;
  var traceBlocked = traceStored.broken;

  /**
   * いま開いている練習の状態。problem が null なら、問題の一覧を出している。
   *   problem: 問題 / run: T.run の結果 / idx: いま何番目のステップか / mode: 'watch'（見る）か 'predict'（予想する）
   *   asked・correct・missed: 予想の成績 / answered: 答え終えたステップ番号の記録 / pending: いま出している問題
   *   feedback: 当たり・はずれの文 / recorded: 最後まで進んだことを成績に入れたか
   */
  var trace = { problem: null, run: null, idx: 0, mode: 'watch', asked: 0, correct: 0, missed: [], answered: {}, pending: null, feedback: null, feedbackKind: null, recorded: false, bridge: { picked: null } };

  /** 練習の成績を保存する（保存が読めないときは何もしない）。 */
  function saveTraceProgress() {
    if (traceBlocked) return;
    if (!writeStorage(KEYS.trace, JSON.stringify(traceProgress))) storageOk = false;
    renderSyncBar();
  }

  /** トレース画面を描く。問題を開いていれば実行画面、なければ一覧。 */
  function renderTrace() {
    var warn = $('tr-warn');
    warn.hidden = !traceBlocked;
    if (traceBlocked) warn.textContent = '保存してある練習の記録が読めません。記録を守るため、保存を止めています（今回の分は、閉じると消えます）。';
    $('tr-list').hidden = trace.problem !== null;
    $('tr-run').hidden = trace.problem === null;
    if (trace.problem) renderTraceRun(); else renderTraceList();
  }

  /** 問題の一覧を描く（問題ごとに「未挑戦／できた／予想 5/7」を文字で出す）。 */
  function renderTraceList() {
    var box = $('tr-problems');
    clear(box);
    var now = Date.now();
    TRACE_PROBLEMS.forEach(function (p, i) {
      var st = T.problemStatus(traceProgress, p.id, now);
      var b = el('button', null, 'tile');
      b.type = 'button';
      b.appendChild(el('b', (i + 1) + '. ' + p.title + (p.level ? '（' + p.level + '）' : '')));
      b.appendChild(el('span', p.learn));
      b.appendChild(el('span', '状態: ' + st.label + (st.again ? '　・　3日以上たちました。もう一度やってみましょう' : '')));
      b.addEventListener('click', function () { openTrace(p.id); });
      box.appendChild(b);
    });
  }

  /**
   * 問題を開いて、最初の状態にする。
   * @param {string} id 問題の id
   */
  function openTrace(id) {
    var p = TRACE_PROBLEMS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    trace.problem = p;
    trace.run = T.run(p.code);
    trace.mode = 'watch';
    resetTraceRun();
    renderTrace();
    window.scrollTo(0, 0);
  }

  /** いまの問題を、最初から（ステップ0・予想の成績も0）にやり直す。 */
  function resetTraceRun() {
    trace.idx = 0;
    trace.asked = 0;
    trace.correct = 0;
    trace.missed = [];
    trace.answered = {};
    trace.pending = null;
    trace.feedback = null;
    trace.feedbackKind = null;
    trace.recorded = false;
    trace.bridge = { picked: null };
    $('tr-q-inputs').dataset.qid = '';
  }

  /** 実行画面を描く（コードの行・変数の表・説明・予想の問題・最後の表示）。 */
  function renderTraceRun() {
    var p = trace.problem;
    var steps = trace.run.steps;
    var step = steps[trace.idx];
    var last = trace.idx === steps.length - 1;
    var atEnd = last && trace.run.finished;
    var hintLines = trace.pending && trace.pending.hint >= 1 ? p.hintLines : [];

    $('tr-title').textContent = p.title;
    $('tr-learn').textContent = p.learn;
    $('tr-mode-watch').setAttribute('aria-pressed', String(trace.mode === 'watch'));
    $('tr-mode-predict').setAttribute('aria-pressed', String(trace.mode === 'predict'));

    // コードの行
    var noteOf = {};
    p.notes.forEach(function (n) { noteOf[n.line] = n; });
    $('tr-code-head').textContent = step.next === null
      ? (atEnd ? '終わりました（これ以上、実行する行はありません）' : 'ここで止まりました')
      : '次に実行する行（まだ実行していません）';
    var code = $('tr-code');
    clear(code);
    p.code.split('\n').forEach(function (text, i) {
      var no = i + 1;
      var li = el('li', null, 'cl');
      if (no === step.next) { li.classList.add('next'); li.setAttribute('aria-current', 'step'); }
      if (no === step.ran) li.classList.add('ran');
      if (hintLines.indexOf(no) >= 0) li.classList.add('hint');
      li.appendChild(el('span', no === step.next ? '▶' : '', 'mk'));
      li.appendChild(el('span', String(no), 'ln'));
      li.appendChild(el('span', text === '' ? ' ' : text, 'tx'));
      if (no === step.ran && trace.idx > 0) li.appendChild(el('span', 'いま実行した', 'tag'));
      code.appendChild(li);
    });

    // 次に実行する行の説明
    var note = $('tr-note');
    clear(note);
    if (step.next !== null && noteOf[step.next]) {
      note.appendChild(el('b', step.next + '行目の説明'));
      var nt = el('p', noteOf[step.next].text);
      nt.style.margin = '6px 0 0';
      note.appendChild(nt);
      if (noteOf[step.next].cDiff) note.appendChild(el('p', 'C言語とちがう所です', 'tag warn'));
    } else {
      note.appendChild(el('b', '説明'));
      note.appendChild(el('p', step.next === null ? '実行する行は、もうありません。' : '', 'fine'));
    }
    if (trace.idx > 0 && step.note) note.appendChild(el('p', '直前の行: ' + step.note, 'fine'));

    // 変数の表
    var tbody = $('tr-vars').querySelector('tbody');
    clear(tbody);
    // 関数を呼んでいるときは、呼び出しごとに表を分ける（いま動いている関数を一番上に。再帰でも n が別の入れ物だと分かる）
    var frames = step.frames;
    var topIdx = frames.length - 1;
    var multi = frames.length > 1;
    var hasOwn = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
    if (!multi && Object.keys(frames[0].vars).length === 0) {
      var er = el('tr');
      var ec = el('td', 'まだ変数はありません', 'fine');
      ec.colSpan = 3;
      er.appendChild(ec);
      tbody.appendChild(er);
    }
    for (var fi = topIdx; fi >= 0; fi--) {
      var fvars = frames[fi].vars;
      if (multi) {
        var hr = el('tr', null, 'fhead');
        var hc = el('th', fi === 0 ? '本体（大域の変数もここ）' : (fi === topIdx ? '動いている関数: ' : '呼び出し元: ') + (frames[fi].label || frames[fi].name));
        hc.colSpan = 3;
        hr.appendChild(hc);
        tbody.appendChild(hr);
      }
      var fnames = Object.keys(fvars);
      if (multi && fnames.length === 0) {
        var nr = el('tr');
        var nc = el('td', '（変数はありません）', 'fine');
        nc.colSpan = 3;
        nr.appendChild(nc);
        tbody.appendChild(nr);
      }
      fnames.forEach(function (name) {
        // 変わった印は、いま動いている関数の変数と、関数から書き換えた大域の変数につける
        var changed = step.assigned.indexOf(name) >= 0 && (fi === topIdx || (fi === 0 && !hasOwn(frames[topIdx].vars, name)));
        var tr = el('tr', null, changed ? 'changed' : '');
        tr.appendChild(el('th', name));
        tr.appendChild(el('td', T.showValue(fvars[name]), 'val'));
        var mark = el('td');
        if (changed) mark.appendChild(el('span', '変わった', 'tag warn'));
        tr.appendChild(mark);
        tbody.appendChild(tr);
      });
    }

    renderTraceQuestion();

    // 当たり・はずれ
    var fb = $('tr-feedback');
    fb.hidden = !trace.feedback;
    clear(fb);
    fb.className = 'expl' + (trace.feedbackKind ? ' ' + trace.feedbackKind : '');
    if (trace.feedback) {
      var sign = trace.feedbackKind === 'ok' ? '○ ' : (trace.feedbackKind === 'ng' ? '× ' : '');
      fb.appendChild(el('p', sign + trace.feedback));
    }

    // エラー・最後
    var done = $('tr-done');
    clear(done);
    done.hidden = !(last && (trace.run.error || atEnd));
    if (last && trace.run.error) {
      done.appendChild(el('b', trace.run.error.line + '行目でエラーです'));
      done.appendChild(el('p', trace.run.error.message));
    } else if (atEnd) {
      done.appendChild(el('b', 'できました'));
      done.appendChild(el('p', trace.mode === 'predict'
        ? '予想の正解 ' + trace.correct + ' / ' + trace.asked + '（1回目で当たった数）'
        : '最後まで見ました。「予想する」で、自分の力を試してみましょう。'));
      var bar = el('div', null, 'row');
      var again = el('button', 'もう一度', 'btn main');
      again.type = 'button';
      again.addEventListener('click', function () { resetTraceRun(); renderTraceRun(); });
      var toList = el('button', '一覧へ', 'btn');
      toList.type = 'button';
      toList.addEventListener('click', backToTraceList);
      bar.appendChild(again);
      bar.appendChild(toList);
      done.appendChild(bar);
      if (p.bridge) done.appendChild(buildTraceBridge(p));
    }

    // ボタン
    $('tr-reset').classList.toggle('main', atEnd);
    $('tr-back').disabled = trace.idx === 0;
    $('tr-next').disabled = last || trace.pending !== null;
    $('tr-branch').disabled = last || trace.mode === 'predict';
    $('tr-end').disabled = last || trace.mode === 'predict';
  }

  /**
   * 「本番の形でも解いてみよう」（空欄を選ぶ問題）の欄を作る。最後まで進んだあとに出す。
   * 同じプログラムの1行を空欄にして、選択肢から選ばせる。答えたら正解・解説を出し、成績に残す。
   * @param {object} p 問題（bridge を持つもの）
   * @returns {HTMLElement} 欄
   */
  function buildTraceBridge(p) {
    var b = p.bridge;
    var picked = trace.bridge.picked;
    var wrap = el('div', null, 'bridge');
    wrap.appendChild(el('b', '本番の形でも解いてみよう'));
    wrap.appendChild(el('p', b.question));
    var ol = el('ol', null, 'code');
    p.code.split('\n').forEach(function (text, i) {
      var no = i + 1;
      var li = el('li', null, 'cl' + (no === b.line ? ' next' : ''));
      li.appendChild(el('span', '', 'mk'));
      li.appendChild(el('span', String(no), 'ln'));
      li.appendChild(el('span', no === b.line ? b.template.replace('■', '［　　］') : (text === '' ? ' ' : text), 'tx'));
      if (no === b.line) li.appendChild(el('span', '空欄', 'tag'));
      ol.appendChild(li);
    });
    wrap.appendChild(ol);
    var box = el('div', null, 'choices');
    b.choices.forEach(function (text, i) {
      var btn = el('button', null, 'choice' + (picked !== null && i === b.answerIndex ? ' right' : '') + (picked === i && i !== b.answerIndex ? ' wrong' : ''));
      btn.type = 'button';
      btn.disabled = picked !== null;
      btn.appendChild(el('span', MARKS[i], 'k'));
      btn.appendChild(el('span', text, 'ct'));
      btn.appendChild(el('span', picked !== null && i === b.answerIndex ? '正解' : (picked === i ? 'あなたの答え' : ''), 'm'));
      btn.addEventListener('click', function () { pickTraceBridge(i); });
      box.appendChild(btn);
    });
    wrap.appendChild(box);
    if (picked !== null) {
      var ok = picked === b.answerIndex;
      var ex = el('div', null, 'expl');
      ex.appendChild(el('p', (ok ? '正解です。' : '不正解です。') + '正解は ' + MARKS[b.answerIndex] + ' です。'));
      ex.appendChild(el('p', b.explain));
      wrap.appendChild(ex);
    }
    return wrap;
  }

  /**
   * 「本番の形」の選択肢を選んだ。正解かどうかを成績に残して、画面を描き直す。
   * @param {number} i 選んだ選択肢の番号（0 から）
   */
  function pickTraceBridge(i) {
    if (trace.bridge.picked !== null) return;
    trace.bridge.picked = i;
    traceProgress = T.recordBridge(traceProgress, trace.problem.id, i === trace.problem.bridge.answerIndex, Date.now());
    saveTraceProgress();
    renderTraceRun();
    var shown = $('tr-done').querySelector('.bridge .expl');
    if (shown) shown.scrollIntoView({ block: 'nearest' });
  }

  /** 予想の問題の欄を描く。問題がなければ隠す。 */
  function renderTraceQuestion() {
    var box = $('tr-question');
    var pend = trace.pending;
    box.hidden = !pend;
    if (!pend) return;
    var q = pend.q;
    $('tr-q-title').textContent = q.kind === 'value'
      ? q.line + '行目を実行すると、どうなる？'
      : q.kind === 'index'
        ? q.line + '行目を実行すると、配列 ' + q.name + ' の何番目の要素が変わる（増える）？'
        : q.line + '行目を実行したあと、次に実行される行は？';
    var inputs = $('tr-q-inputs');
    // 入力欄は、描き直しても書きかけを消さないよう、問題が変わったときだけ作る
    var qid = String(trace.idx);
    if (inputs.dataset.qid !== qid) {
      clear(inputs);
      inputs.dataset.qid = qid;
      if (q.kind === 'value') {
        q.items.forEach(function (it) {
          var row = el('label', null, 'qi');
          row.appendChild(el('span', it.name + ' の値'));
          var f = el('input', null, 'field');
          f.type = 'text';
          f.setAttribute('autocomplete', 'off');
          f.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitTraceAnswer(); });
          row.appendChild(f);
          inputs.appendChild(row);
        });
        if (q.items.some(function (it) { return typeof it.answer === 'string'; })) inputs.appendChild(el('p', '文字の値は、"B" のように " をつけても、B だけでもかまいません。', 'fine'));
        if (q.items.some(function (it) { return typeof it.answer === 'boolean'; })) inputs.appendChild(el('p', '真偽は「真」か「偽」で答えます。', 'fine'));
      } else if (q.kind === 'index') {
        var rowI = el('label', null, 'qi');
        rowI.appendChild(el('span', q.name + ' の何番目（数字）'));
        var fi2 = el('input', null, 'field');
        fi2.type = 'text';
        fi2.setAttribute('inputmode', 'numeric');
        fi2.setAttribute('autocomplete', 'off');
        fi2.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitTraceAnswer(); });
        rowI.appendChild(fi2);
        inputs.appendChild(rowI);
        inputs.appendChild(el('p', '番号は 1 から数えます。配列の末尾に足す行なら、足されたあとの番号です。', 'fine'));
      } else {
        var row2 = el('label', null, 'qi');
        row2.appendChild(el('span', '次の行'));
        var sel = el('select', null, 'field');
        trace.problem.code.split('\n').forEach(function (text, i) {
          var o = el('option', (i + 1) + '行目　' + text.trim());
          o.value = String(i + 1);
          sel.appendChild(o);
        });
        var oe = el('option', 'プログラムの終わり');
        oe.value = 'end';
        sel.appendChild(oe);
        row2.appendChild(sel);
        inputs.appendChild(row2);
      }
      var first = inputs.querySelector('input,select');
      if (first) first.focus({ preventScroll: true });
    }
    var ht = $('tr-q-hint-text');
    ht.hidden = pend.hint < 2;
    ht.textContent = pend.hint >= 2 ? 'ヒント: ' + trace.problem.hintText : '';
    $('tr-q-hint').textContent = pend.hint === 0 ? 'ヒント（着目する行を光らせる）' : pend.hint === 1 ? 'ヒント（考え方）' : 'ヒントは以上です';
    $('tr-q-hint').disabled = pend.hint >= 2;
  }

  /** 「次の1行へ」: 見るモードは1行進める。予想モードで問う行の前なら、先に問題を出す。 */
  function traceNext() {
    var steps = trace.run.steps;
    if (trace.pending || trace.idx >= steps.length - 1) return;
    trace.feedback = null;
    trace.feedbackKind = null;
    if (trace.mode === 'predict' && !trace.answered[trace.idx]) {
      var q = T.predictQuestion(steps, trace.idx, trace.problem.predictLines);
      if (q) {
        trace.pending = { q: q, tries: 0, hint: 0 };
        $('tr-q-inputs').dataset.qid = '';
        renderTraceRun();
        return;
      }
    }
    trace.idx++;
    afterTraceMove();
  }

  /** 1つ戻る（出している問題があれば、取りやめて戻る）。 */
  function traceBack() {
    if (trace.idx === 0) return;
    trace.pending = null;
    trace.feedback = null;
    trace.feedbackKind = null;
    trace.idx--;
    renderTraceRun();
  }

  /**
   * 次の分かれ道（条件を調べる行）まで、または最後まで進める（見るモードだけ）。
   * @param {boolean} toEnd true なら最後まで、false なら次の分かれ道まで
   */
  function traceJump(toEnd) {
    var steps = trace.run.steps;
    if (trace.mode !== 'watch' || trace.idx >= steps.length - 1) return;
    trace.feedback = null;
    trace.feedbackKind = null;
    var j = toEnd ? steps.length - 1 : trace.idx + 1;
    while (!toEnd && j < steps.length - 1 && !steps[j].branch) j++;
    trace.idx = j;
    afterTraceMove();
  }

  /** 動いたあとの後始末: 最後まで進んだら成績に入れ、画面を描き直す。 */
  function afterTraceMove() {
    var steps = trace.run.steps;
    if (trace.idx === steps.length - 1 && trace.run.finished && !trace.recorded) {
      trace.recorded = true;
      traceProgress = T.recordFinish(traceProgress, trace.problem.id,
        { mode: trace.mode, asked: trace.asked, correct: trace.correct, missed: trace.missed }, Date.now());
      saveTraceProgress();
    }
    renderTraceRun();
  }

  /** 「答える」: 答え合わせをする。はずれは1回だけやり直せる。 */
  function submitTraceAnswer() {
    var pend = trace.pending;
    if (!pend) return;
    var q = pend.q;
    var fields = $('tr-q-inputs').querySelectorAll('input,select');
    var ok;
    var detail;
    // 空欄や、数字を答える所に数字でない文字を入れたときは、はずれに数えず、入れ直してもらう
    var bad = false;
    fields.forEach(function (f, i) {
      var v = String(f.value).trim();
      var wantNumber = q.kind === 'index' || (q.kind === 'value' && typeof q.items[i].answer === 'number');
      if (v === '' || (wantNumber && !T.isNumberText(v))) bad = true;
    });
    if (bad) {
      trace.feedback = '入力を確かめてください（空欄、または数字で答える所に数字以外が入っています）。はずれには数えません。';
      trace.feedbackKind = null;
      renderTraceRun();
      return;
    }
    if (q.kind === 'value') {
      ok = q.items.every(function (it, i) { return T.matchValue(it.answer, fields[i].value); });
      detail = '正しくは ' + q.items.map(function (it) { return it.name + ' ＝ ' + T.showValue(it.answer); }).join('、') +
        '（' + q.items.map(function (it) { return T.explainValue(q.line, it); }).join('、') + '）';
    } else if (q.kind === 'index') {
      ok = String(fields[0].value).normalize('NFKC').trim() === String(q.answer);
      detail = '正しくは ' + q.answer + ' 番目（' + q.line + '行目で ' + q.name + ' の ' + q.answer + ' 番目が書き換わる、または足されるため）';
    } else {
      var right = q.answer === null ? 'end' : String(q.answer);
      ok = fields[0].value === right;
      detail = '正しくは ' + (q.answer === null ? 'プログラムの終わり' : q.answer + '行目') + '（' + q.note + '）';
    }
    if (!ok && pend.tries === 0) {
      pend.tries = 1;
      trace.feedback = 'はずれです。もう一度だけ答えられます。ヒントも使えます。';
      trace.feedbackKind = 'ng';
      renderTraceRun();
      return;
    }
    trace.asked++;
    if (ok) {
      if (pend.tries === 0) trace.correct++;
      trace.feedback = pend.tries === 0 ? '当たり！' : '2回目で当たり。（成績には、1回目で当たった数だけ数えます）';
      trace.feedbackKind = 'ok';
    } else {
      trace.missed.push(q.kind);
      trace.feedback = 'はずれ。' + detail;
      trace.feedbackKind = 'ng';
    }
    trace.answered[trace.idx] = true;
    trace.pending = null;
    trace.idx++;
    afterTraceMove();
  }

  /** ヒントを1段階進める（1: 着目する行を光らせる、2: 考え方の一言）。 */
  function traceHint() {
    if (!trace.pending || trace.pending.hint >= 2) return;
    trace.pending.hint++;
    renderTraceRun();
  }

  /**
   * 見る／予想するを切り替える。切り替えると、最初からやり直す。
   * @param {string} mode 'watch' か 'predict'
   */
  function setTraceMode(mode) {
    if (trace.mode === mode) return;
    trace.mode = mode;
    resetTraceRun();
    renderTraceRun();
  }

  /** 一覧に戻る。 */
  function backToTraceList() {
    trace.problem = null;
    trace.run = null;
    renderTrace();
  }

  $('tr-reset').addEventListener('click', function () { resetTraceRun(); renderTraceRun(); });
  $('tr-back').addEventListener('click', traceBack);
  $('tr-next').addEventListener('click', traceNext);
  $('tr-branch').addEventListener('click', function () { traceJump(false); });
  $('tr-end').addEventListener('click', function () { traceJump(true); });
  $('tr-q-submit').addEventListener('click', submitTraceAnswer);
  $('tr-q-hint').addEventListener('click', traceHint);
  $('tr-mode-watch').addEventListener('click', function () { setTraceMode('watch'); });
  $('tr-mode-predict').addEventListener('click', function () { setTraceMode('predict'); });
  $('tr-to-list').addEventListener('click', backToTraceList);

  // キーボード: → で次へ、← で戻る。入力欄・選択欄の中、窓を開いている間は効かせない
  document.addEventListener('keydown', function (e) {
    if (currentView !== 'trace' || !trace.problem) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if ($('guide-panel').open || $('zoom-dialog').open) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') traceNext(); else traceBack();
  });

  // ⑧ はじまり ------------------------------------------------------------

  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.go === 'quiz') openQuiz(); else showView(b.dataset.go);
    });
  });
  $('btn-review').addEventListener('click', function () { startSession(homeHasDue ? { type: 'review' } : { type: 'all' }); });
  $('tr-guide').addEventListener('click', openGuide);
  $('btn-exam-start').addEventListener('click', startExam);
  $('btn-exam-resume').addEventListener('click', function () { showView('exam'); });
  $('btn-exam-discard').addEventListener('click', discardExam);
  $('x-quit').addEventListener('click', discardExam);
  $('x-prev').addEventListener('click', function () { if (exam) goExam(exam.current - 1); });
  $('x-next').addEventListener('click', function () { if (exam) goExam(exam.current + 1); });
  $('x-mark').addEventListener('click', toggleExamMark);
  $('x-finish').addEventListener('click', onExamFinishClick);
  $('q-submit').addEventListener('click', onSubmit);
  $('q-guide').addEventListener('click', openGuide);
  $('guide-close').addEventListener('click', closeGuide);
  $('zoom-close').addEventListener('click', closeZoom);
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

  buildGuide();
  renderSyncBar();
  applySettings();
  loadExam();
  showView('home');
  startSync();
})();
