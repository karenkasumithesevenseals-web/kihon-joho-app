/**
 * trace-problems.js … 「トレース練習」の練習問題（自作。IPA の問題は写していない）。
 *
 * 役割: 擬似言語のプログラムを1行ずつ動かして、変数の値の変化を追う練習の問題を並べたもの。
 *   画面（script.js のトレース画面）が読み込んで、一覧と実行画面に使う。動かす部品は trace-logic.js。
 * 読み方: 1問が { id, title, learn, code, notes, expected, predictLines, hintLines, hintText }。
 *   id          問題の名前（成績の保存にも使うので、あとから変えない）
 *   title       一覧に出す題名
 *   learn       この問題で学ぶこと（一覧と結果に出す）
 *   code        擬似言語のプログラム（1行目が1行、と数える。空行も1行）
 *   notes       行ごとの説明 [{ line: 行番号, text: 1文の説明, cDiff: true なら「C言語とちがう」の印 }]
 *   expected    最後まで動かしたときの変数の値（run-data-check.js が、実際に動かして合うか点検する）
 *   predictLines  「予想する」モードで問う行（その行を動かす直前に「どうなる？」と聞く）。動かすと 3〜8 回になるように選ぶ
 *   hintLines   ヒント1で光らせる行
 *   hintText    ヒント2の一言（考え方）
 *   bridge      （あれば）本番の科目B と同じ「空欄を選ぶ」問題。最後まで進んだあとに出す。
 *               { question: 問題文, line: 空欄にする行, template: その行の文字（■ が空欄）, choices: 選択肢の文字の並び,
 *                 answerIndex: 正解の番号（0 から）, goal: 正解を入れて動かしたときの最後の変数の値（一部でよい）, explain: 解説 }
 * 点検: node run-data-check.js が、期待値・説明の抜け・問う回数を確かめる。
 *   bridge は、どの選択肢を入れてもプログラムを実際に動かして、正解の選択肢だけが goal と合うことも確かめる。
 */
const TRACE_PROBLEMS = [
  {
    id: 'swap',
    title: '2つの値を入れ替える',
    learn: '代入は「右の値を左に入れる」。入れ替えには一時的な入れ物（一時変数）がいる。',
    code: [
      '整数型: a ← 3',
      '整数型: b ← 5',
      '整数型: t',
      't ← a',
      'a ← b',
      'b ← t'
    ].join('\n'),
    notes: [
      { line: 1, text: '変数 a を作り、3 を入れる。', cDiff: true },
      { line: 2, text: '変数 b を作り、5 を入れる。' },
      { line: 3, text: '変数 t を作るだけ。値はまだ入っていない（未定義）。' },
      { line: 4, text: 'a の値を、t に避難させる。', cDiff: true },
      { line: 5, text: 'b の値を a に入れる。a の元の値は t にある。' },
      { line: 6, text: '避難させておいた t の値を b に入れる。' }
    ],
    expected: { a: 5, b: 3, t: 3 },
    predictLines: [4, 5, 6],
    hintLines: [4, 5],
    hintText: '「←」は右の値を左に入れる。入れたあとの左の変数は、前の値が消えます。'
  },
  {
    id: 'grade',
    title: '点数から評価を決める',
    learn: 'if / elseif / else は、上から調べて「最初に真になった所」だけを実行する。',
    code: [
      '整数型: p ← 75',
      '文字列型: g',
      'if (p ≧ 80)',
      '  g ← "A"',
      'elseif (p ≧ 70)',
      '  g ← "B"',
      'elseif (p ≧ 60)',
      '  g ← "C"',
      'else',
      '  g ← "D"',
      'endif'
    ].join('\n'),
    notes: [
      { line: 1, text: '点数 p を 75 にする。' },
      { line: 2, text: '評価を入れる変数 g を作る（まだ未定義）。' },
      { line: 3, text: 'p が 80 以上か調べる。真なら 4 行目へ、偽なら次の条件へ。' },
      { line: 4, text: '評価を "A" にする。' },
      { line: 5, text: '前の条件が偽のときだけ調べる。p が 70 以上か。' },
      { line: 6, text: '評価を "B" にする。' },
      { line: 7, text: 'ここまでの条件がすべて偽のときだけ調べる。' },
      { line: 8, text: '評価を "C" にする。' },
      { line: 9, text: 'どの条件も真でなかったときの処理の始まり。' },
      { line: 10, text: '評価を "D" にする。' },
      { line: 11, text: 'if の終わり。' }
    ],
    expected: { p: 75, g: 'B' },
    predictLines: [3, 5, 6],
    hintLines: [3, 5],
    hintText: '真になる条件を見つけたら、それより下の条件は調べません。'
  },
  {
    id: 'sum5',
    title: '1 から 5 までの合計',
    learn: 'for は、終わりの値も含めて繰り返す。（終わったあとの i の値は、本番では当てにしない。ここでは動きの確認のために表に出しています。）',
    code: [
      '整数型: s ← 0',
      '整数型: i',
      'for (i を 1 から 5 まで 1 ずつ増やす)',
      '  s ← s ＋ i',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '合計を入れる s を 0 にする。' },
      { line: 2, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 3, text: 'i を 1 から 5 まで 1 ずつ増やして繰り返す。5 も含む。', cDiff: true },
      { line: 4, text: 's に、いまの i を足す。' },
      { line: 5, text: '繰り返しの終わり。3 行目に戻って i を 1 増やす。' }
    ],
    expected: { s: 15, i: 6 },
    predictLines: [4],
    hintLines: [3, 4],
    hintText: 'i が 1 のとき s は 0＋1、2 のとき…と順に足されます。',
    bridge: {
      question: 'プログラムの最後に s が 15 になるように、空欄に入れる正しいものを選びなさい。',
      line: 3,
      template: 'for (i を 1 から ■ まで 1 ずつ増やす)',
      choices: ['4', '5', '6', 's'],
      answerIndex: 1,
      goal: { s: 15 },
      explain: 'for は終わりの値も含めて繰り返すので、5 にすると 1＋2＋3＋4＋5＝15 です。4 だと 10、6 だと 21 になります。s はまだ 0 なので、繰り返しません。'
    }
  },
  {
    id: 'mod-rest',
    title: '引き算の繰り返しで余りを出す',
    learn: 'while は、繰り返す前に条件を調べる。条件が偽になったところで、繰り返しを終わる。',
    code: [
      '整数型: n ← 17',
      '整数型: d ← 5',
      '整数型: q ← 0',
      'while (n ≧ d)',
      '  n ← n － d',
      '  q ← q ＋ 1',
      'endwhile'
    ].join('\n'),
    notes: [
      { line: 1, text: '割られる数 n を 17 にする。' },
      { line: 2, text: '割る数 d を 5 にする。' },
      { line: 3, text: '引いた回数（商）を数える q を 0 にする。' },
      { line: 4, text: 'n が d 以上か調べる。真なら中を実行し、偽なら終わる。' },
      { line: 5, text: 'n から d を引く。' },
      { line: 6, text: '引いた回数を 1 増やす。' },
      { line: 7, text: '繰り返しの終わり。4 行目に戻って、また条件を調べる。' }
    ],
    expected: { n: 2, d: 5, q: 3 },
    predictLines: [4, 5],
    hintLines: [4, 5],
    hintText: 'n が d より小さくなったら繰り返しは終わり。そのときの n が余り（17 mod 5）です。',
    bridge: {
      question: '17 を 5 で割った余りが n に入るように、空欄に入れる正しいものを選びなさい。',
      line: 5,
      template: '  n ← n － ■',
      choices: ['d', '1', 'q', 'n'],
      answerIndex: 0,
      goal: { n: 2, q: 3 },
      explain: '引き算で割り算をするので、n から割る数 d を引きます。1 を引くと繰り返す回数が変わり、q や n を引いても割り算になりません。'
    }
  },
  {
    id: 'array-sum',
    title: '配列の合計',
    learn: '配列の番号は 1 から始まる。dataの要素数 は、配列の個数。',
    code: [
      '整数型の配列: data ← {4, 7, 1, 8, 5}',
      '整数型: s ← 0',
      '整数型: i',
      'for (i を 1 から dataの要素数 まで 1 ずつ増やす)',
      '  s ← s ＋ data[i]',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '5 個の値が入った配列 data を作る。', cDiff: true },
      { line: 2, text: '合計を入れる s を 0 にする。' },
      { line: 3, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 4, text: 'i を 1 から、配列の個数（5）まで 1 ずつ増やして繰り返す。' },
      { line: 5, text: 's に data の i 番目を足す。番号は 1 から。', cDiff: true },
      { line: 6, text: '繰り返しの終わり。4 行目に戻る。' }
    ],
    expected: { data: [4, 7, 1, 8, 5], s: 25, i: 6 },
    predictLines: [5],
    hintLines: [1, 5],
    hintText: 'data[1] は最初の値 4 です（0 番目はありません）。'
  },
  {
    id: 'array-max',
    title: '配列の最大値',
    learn: '「いままでで一番大きい値」を変数に持ち、大きいものが見つかったら入れ替える。',
    code: [
      '整数型の配列: data ← {3, 9, 4, 12, 7}',
      '整数型: best ← data[1]',
      '整数型: i',
      'for (i を 2 から dataの要素数 まで 1 ずつ増やす)',
      '  if (data[i] ＞ best)',
      '    best ← data[i]',
      '  endif',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '5 個の値が入った配列 data を作る。' },
      { line: 2, text: '最大値の候補 best を、最初の値 3 にする。' },
      { line: 3, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 4, text: '最初の値は済んでいるので、i は 2 番目から最後まで進める。' },
      { line: 5, text: 'i 番目が、いまの最大値 best より大きいか調べる。' },
      { line: 6, text: '大きかったときだけ、best をその値に置き換える。' },
      { line: 7, text: 'if の終わり。' },
      { line: 8, text: '繰り返しの終わり。4 行目に戻る。' }
    ],
    expected: { data: [3, 9, 4, 12, 7], best: 12, i: 6 },
    predictLines: [5, 6],
    hintLines: [5, 6],
    hintText: 'best は、条件が真のときだけ変わります。4 や 7 のように小さい値では変わりません。',
    bridge: {
      question: '配列 data の最大値が best に入るように、空欄に入れる正しいものを選びなさい。',
      line: 5,
      template: '  if (data[i] ＞ ■)',
      choices: ['best', 'i', 'data[1]', '0'],
      answerIndex: 0,
      goal: { best: 12 },
      explain: 'いままでの最大値 best と比べるのが正解です。i（番号）や固定の値と比べると、最後に見た値で上書きされてしまい、12 になりません。'
    }
  },
  {
    id: 'linear-search',
    title: '配列から値を探す（線形探索）',
    learn: '見つかったら「繰り返し処理を終了する」で途中で抜ける。pos の最初の値 0 は「まだ見つかっていない」目印。',
    code: [
      '整数型の配列: data ← {6, 2, 9, 4}',
      '整数型: target ← 9',
      '整数型: pos ← 0',
      '整数型: i',
      'for (i を 1 から dataの要素数 まで 1 ずつ増やす)',
      '  if (data[i] ＝ target)',
      '    pos ← i',
      '    繰り返し処理を終了する',
      '  endif',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '4 個の値が入った配列 data を作る。' },
      { line: 2, text: '探す値 target を 9 にする。' },
      { line: 3, text: '見つかった番号を入れる pos を 0（まだ見つからない）にする。' },
      { line: 4, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 5, text: 'i を 1 から最後まで進めて、順に調べる。' },
      { line: 6, text: 'i 番目が探す値と等しいか調べる。「＝」は等しいかの比較。', cDiff: true },
      { line: 7, text: '見つかった番号 i を pos に入れる。' },
      { line: 8, text: '見つかったので、繰り返しを途中で終わる。' },
      { line: 9, text: 'if の終わり。' },
      { line: 10, text: '繰り返しの終わり。5 行目に戻る。' }
    ],
    expected: { data: [6, 2, 9, 4], target: 9, pos: 3, i: 3 },
    predictLines: [6, 7],
    hintLines: [6, 8],
    hintText: '見つかったら残りの 4 番目は調べません。終わったときの i は 3 のままです。',
    bridge: {
      question: '9 が見つかった番号 3 が pos に入るように、空欄に入れる正しいものを選びなさい。',
      line: 6,
      template: '  if (data[■] ＝ target)',
      choices: ['i', 'i ＋ 1', 'pos', '1'],
      answerIndex: 0,
      goal: { pos: 3 },
      explain: 'i 番目の値と比べるので data[i] です。i ＋ 1 だと 1 つ先を見てしまい 2 が入ります。pos は 0 なので範囲の外、1 だと最初の値だけを見続けます。'
    }
  },
  {
    id: 'move-last',
    title: '末尾の値を先頭へ移す',
    learn: '後ろから順にずらす。前からずらすと、同じ値で上書きされてしまう。',
    code: [
      '整数型の配列: data ← {10, 20, 30, 40, 50}',
      '整数型: last ← data[dataの要素数]',
      '整数型: i',
      'for (i を 5 から 2 まで 1 ずつ減らす)',
      '  data[i] ← data[i － 1]',
      'endfor',
      'data[1] ← last'
    ].join('\n'),
    notes: [
      { line: 1, text: '5 個の値が入った配列 data を作る。' },
      { line: 2, text: '末尾の値 50 を、last に避難させる。' },
      { line: 3, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 4, text: 'i を 5 から 2 まで、1 ずつ減らしながら繰り返す。' },
      { line: 5, text: 'i 番目に、1 つ前（i－1 番目）の値を入れる。' },
      { line: 6, text: '繰り返しの終わり。4 行目に戻る。' },
      { line: 7, text: '先頭（1 番目）に、避難させておいた値を入れる。' }
    ],
    expected: { data: [50, 10, 20, 30, 40], last: 50, i: 1 },
    predictLines: [5, 7],
    hintLines: [2, 5],
    hintText: '後ろから動かすので、まだ動かしていない前の値は、書き換えられずに残っています。',
    bridge: {
      question: 'data が {50, 10, 20, 30, 40} になるように、空欄に入れる正しいものを選びなさい。',
      line: 4,
      template: 'for (i を 5 から ■ まで 1 ずつ減らす)',
      choices: ['1', '2', '3', '4'],
      answerIndex: 1,
      goal: { data: [50, 10, 20, 30, 40] },
      explain: '2 番目まで動かす必要があります。3 にすると {50, 20, 20, 30, 40}、4 にすると {50, 20, 30, 30, 40} になり、動かし足りません。1 にすると、data[1] に data[0] を入れようとして、範囲の外でエラーになります。'
    }
  },
  {
    id: 'char-count',
    title: '文字を数える',
    learn: '1 文字ずつの文字列を並べた配列を、順に調べる。文字の比較も「＝」。（本番では、問題文の説明に従う。）',
    code: [
      '文字列型の配列: word ← {"b", "a", "n", "a", "n", "a"}',
      '文字列型: target ← "a"',
      '整数型: count ← 0',
      '整数型: i',
      'for (i を 1 から wordの要素数 まで 1 ずつ増やす)',
      '  if (word[i] ＝ target)',
      '    count ← count ＋ 1',
      '  endif',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '1 文字ずつの文字列を 6 個並べた配列 word を作る。' },
      { line: 2, text: '数える文字 target を "a" にする。' },
      { line: 3, text: '数えた個数 count を 0 にする。' },
      { line: 4, text: '数える変数 i を作る（まだ未定義）。' },
      { line: 5, text: 'i を 1 から最後まで進めて、1 文字ずつ調べる。' },
      { line: 6, text: 'i 番目の文字が target と等しいか調べる。' },
      { line: 7, text: '等しかったときだけ、count を 1 増やす。' },
      { line: 8, text: 'if の終わり。' },
      { line: 9, text: '繰り返しの終わり。5 行目に戻る。' }
    ],
    expected: { word: ['b', 'a', 'n', 'a', 'n', 'a'], target: 'a', count: 3, i: 7 },
    predictLines: [6],
    hintLines: [6, 7],
    hintText: '"a" と等しい文字のときだけ count が増えます。"b" と "n" では増えません。'
  },
  {
    id: 'binary-search',
    title: '二分探索',
    learn: '真ん中を調べて、探す範囲を半分にしていく。÷ は、整数どうしなら商（切り捨て）。',
    code: [
      '整数型の配列: data ← {2, 5, 8, 12, 16, 23, 38}',
      '整数型: target ← 38',
      '整数型: low ← 1',
      '整数型: high ← dataの要素数',
      '整数型: mid',
      '整数型: pos ← 0',
      'while (low ≦ high and pos ＝ 0)',
      '  mid ← (low ＋ high) ÷ 2',
      '  if (data[mid] ＝ target)',
      '    pos ← mid',
      '  elseif (data[mid] ＜ target)',
      '    low ← mid ＋ 1',
      '  else',
      '    high ← mid － 1',
      '  endif',
      'endwhile'
    ].join('\n'),
    notes: [
      { line: 1, text: '小さい順に並んだ 7 個の配列 data を作る。' },
      { line: 2, text: '探す値 target を 38 にする。' },
      { line: 3, text: '探す範囲の左端 low を 1 番目にする。' },
      { line: 4, text: '探す範囲の右端 high を最後の番号にする。' },
      { line: 5, text: '真ん中の番号を入れる mid を作る（まだ未定義）。' },
      { line: 6, text: '見つかった番号 pos を 0（まだ見つからない）にする。' },
      { line: 7, text: '範囲が残っていて、まだ見つかっていない間、繰り返す。' },
      { line: 8, text: 'low と high の真ん中の番号を求める。÷ は商（切り捨て）。' },
      { line: 9, text: '真ん中の値が、探す値と等しいか調べる。' },
      { line: 10, text: '見つかったので、番号を pos に入れる。' },
      { line: 11, text: '等しくなければ、真ん中の値が探す値より小さいか調べる。' },
      { line: 12, text: '小さいので、探す範囲を真ん中の右側に狭める。' },
      { line: 13, text: 'どちらでもないとき（真ん中の値のほうが大きい）。' },
      { line: 14, text: '探す範囲を真ん中の左側に狭める。' },
      { line: 15, text: 'if の終わり。' },
      { line: 16, text: '繰り返しの終わり。7 行目に戻る。' }
    ],
    expected: { data: [2, 5, 8, 12, 16, 23, 38], target: 38, low: 7, high: 7, mid: 7, pos: 7 },
    predictLines: [8, 9],
    hintLines: [8, 9],
    hintText: '真ん中の値と比べて、探す値が大きければ右側、小さければ左側だけを調べ直します。',
    bridge: {
      question: '38 が見つかった番号 7 が pos に入り、必ず繰り返しが終わるように、空欄に入れる正しいものを選びなさい。',
      line: 12,
      template: '    low ← ■',
      choices: ['mid ＋ 1', 'mid', 'mid － 1', '1'],
      answerIndex: 0,
      goal: { pos: 7 },
      explain: '真ん中の値は探す値より小さいと分かっているので、真ん中自身も外して mid ＋ 1 から調べ直します。mid や mid － 1 だと、low が 6 のとき mid も 6 のままで同じ場所を調べ続け、終わりません。1 にすると、いつまでも最初から調べ直します。'
    }
  },
  {
    id: 'stack',
    title: 'スタック（積み上げ）',
    learn: '最後に入れたものを最初に取り出す（後入れ先出し）。関数の外の「大域:」の変数は、関数から書き換えられる。',
    code: [
      '大域: 整数型の配列: stack ← {0, 0, 0, 0}',
      '大域: 整数型: top ← 0',
      '○push(整数型: v)',
      '  top ← top ＋ 1',
      '  stack[top] ← v',
      '○整数型: pop()',
      '  整数型: v',
      '  v ← stack[top]',
      '  top ← top － 1',
      '  return v',
      '整数型: a',
      '整数型: b',
      'push(10)',
      'push(20)',
      'push(30)',
      'a ← pop()',
      'b ← pop()'
    ].join('\n'),
    notes: [
      { line: 1, text: '大域の配列 stack を作る。関数からも見える。' },
      { line: 2, text: '大域の変数 top（いちばん上の位置）を 0（空）にする。' },
      { line: 3, text: '手続 push。値 v を積む。' },
      { line: 4, text: 'いちばん上の位置を 1 つ上げる。' },
      { line: 5, text: '上げた位置に、値 v を入れる。' },
      { line: 6, text: '関数 pop。いちばん上の値を取り出して返す。' },
      { line: 7, text: 'この関数の中だけで使う変数 v を作る。' },
      { line: 8, text: 'いちばん上の値を v に取り出す。' },
      { line: 9, text: 'いちばん上の位置を 1 つ下げる（値は配列に残る）。' },
      { line: 10, text: '取り出した値 v を、呼び出した所へ返す。' },
      { line: 11, text: '本体の変数 a を作る（まだ未定義）。' },
      { line: 12, text: '本体の変数 b を作る（まだ未定義）。' },
      { line: 13, text: '10 を積む。' },
      { line: 14, text: '20 を積む。' },
      { line: 15, text: '30 を積む。' },
      { line: 16, text: '取り出した値を a に入れる。' },
      { line: 17, text: '取り出した値を b に入れる。' }
    ],
    expected: { stack: [10, 20, 30, 0], top: 1, a: 30, b: 20 },
    predictLines: [5, 9, 16, 17],
    hintLines: [4, 9],
    hintText: '積むときは top を上げてから入れる、取り出すときは取り出してから top を下げる。最後に積んだ 30 が最初に出ます。',
    bridge: {
      question: 'pop で、最後に積んだ値が取り出され、次の pop で 20 が出るように、空欄に入れる正しいものを選びなさい。',
      line: 9,
      template: '  top ← ■',
      choices: ['top － 1', 'top ＋ 1', '0', 'v'],
      answerIndex: 0,
      goal: { top: 1, a: 30, b: 20 },
      explain: '取り出したら位置を 1 つ下げます。top ＋ 1 だと上へ進んでしまい、0 だと次の pop で範囲の外（0 番目）を読みます。v は取り出した値で、位置ではありません。'
    }
  },
  {
    id: 'factorial',
    title: '階乗（再帰）',
    learn: '関数が自分自身を呼ぶ（再帰）。呼び出しごとに引数 n は別の入れ物になる。',
    code: [
      '○整数型: fact(整数型: n)',
      '  if (n ≦ 1)',
      '    return 1',
      '  endif',
      '  return n × fact(n － 1)',
      '整数型: r',
      'r ← fact(4)'
    ].join('\n'),
    notes: [
      { line: 1, text: '関数 fact。n の階乗（n × (n－1) × … × 1）を返す。' },
      { line: 2, text: 'n が 1 以下か調べる。ここが再帰の終わりの目印。' },
      { line: 3, text: '1 以下なら 1 を返す。これ以上は呼ばない。' },
      { line: 4, text: 'if の終わり。' },
      { line: 5, text: 'n に、fact(n－1) の結果をかけて返す。自分を呼ぶ。' },
      { line: 6, text: '結果を入れる変数 r を作る（まだ未定義）。' },
      { line: 7, text: 'fact(4) を呼び出して、結果を r に入れる。' }
    ],
    expected: { r: 24 },
    predictLines: [2, 7],
    hintLines: [2, 5],
    hintText: '呼び出しは fact(4)→fact(3)→fact(2)→fact(1) と深くなり、戻るときに 1×2×3×4 とかけ算が進みます。',
    bridge: {
      question: 'fact(4) が 24 になるように、空欄に入れる正しいものを選びなさい。',
      line: 5,
      template: '  return n × ■',
      choices: ['fact(n － 1)', 'fact(n)', 'fact(n ＋ 1)', 'n － 1'],
      answerIndex: 0,
      goal: { r: 24 },
      explain: '1 つ小さい n で自分を呼びます。fact(n) だと同じ n で呼び続けて終わらず、fact(n ＋ 1) は大きくなる一方で終わりに近づきません。n － 1 は呼び出しではなく、ただの数です。'
    }
  },
  {
    id: 'bubble',
    title: '4つの値を小さい順に並べる（発展）',
    learn: '隣どうしを比べて、逆になっていたら入れ替える。これを繰り返すと並ぶ。ステップが多いので「次の分かれ道まで」が便利。',
    code: [
      '整数型の配列: a ← {4, 2, 3, 1}',
      '整数型: i, j, t',
      'for (i を 1 から 3 まで 1 ずつ増やす)',
      '  for (j を 1 から 4 － i まで 1 ずつ増やす)',
      '    if (a[j] ＞ a[j ＋ 1])',
      '      t ← a[j]',
      '      a[j] ← a[j ＋ 1]',
      '      a[j ＋ 1] ← t',
      '    endif',
      '  endfor',
      'endfor'
    ].join('\n'),
    notes: [
      { line: 1, text: '4 個の値が入った配列 a を作る。' },
      { line: 2, text: '変数 i, j, t を作る（まだ未定義）。' },
      { line: 3, text: '外側の繰り返し。i 回目で、後ろから i 個目までが決まる。' },
      { line: 4, text: '内側の繰り返し。隣どうしを 4－i 組だけ比べる。' },
      { line: 5, text: '左の値が右の値より大きい（逆になっている）か調べる。' },
      { line: 6, text: '左の値を、一時変数 t に避難させる。' },
      { line: 7, text: '左に、右の値を入れる。' },
      { line: 8, text: '右に、避難させておいた値を入れる。これで入れ替わり。' },
      { line: 9, text: 'if の終わり。' },
      { line: 10, text: '内側の繰り返しの終わり。4 行目に戻る。' },
      { line: 11, text: '外側の繰り返しの終わり。3 行目に戻る。' }
    ],
    expected: { a: [1, 2, 3, 4], i: 4, j: 2, t: 2 },
    predictLines: [5],
    hintLines: [5, 6],
    hintText: '1 回目の外側の繰り返しで、いちばん大きい 4 が、いちばん右まで運ばれます。'
  }
];

if (typeof module !== 'undefined' && module.exports) { module.exports = TRACE_PROBLEMS; }
