/**
 * trace-logic.js … 擬似言語（基本情報の科目Bで使う、プログラムの書き方）を「1行ずつ動かして記録する」部品。
 * 画面や保存には触りません。
 *
 * 読み方（全体の流れ）:
 *   プログラムの文字 ──▶ 1. 整える（記号をそろえ、注釈を消す）
 *                   ──▶ 2. 行ごとに読む（字句に分ける → 文の木にする）
 *                   ──▶ 3. 動かす（1行動かすたびに、変数の表を1枚記録する）
 *   一番下の return { run: run } が、外から使える部品です。
 *
 * 使う人: script.js（画面）、trace-tests.js（自動チェック）。
 *
 * 今の範囲: 代入・変数の宣言・if/elseif/else・while・do-while・for・配列（配列の配列も）・文字列・真偽値、
 *   関数・手続（○ の行）・return・再帰（深さ50まで）・大域の変数・÷（整数どうしは切り捨ての商）。
 * 入れないもの: 日本語の文条件（「nが2以下」など）・二次元配列 a[行, 列]・クラス。使うと、わかりやすいエラーになります。
 */
const FeTrace = (function () {
  'use strict';

  /** 動かしてよい最大のステップ数（これを超えたら「終わらないプログラム」として止める）。 */
  var DEFAULT_MAX_STEPS = 2000;

  /** 関数の呼び出しが重なってよい最大の深さ（これを超えたら、終わらない再帰として止める）。 */
  var MAX_CALL_DEPTH = 50;

  /**
   * 日本語の単語の一覧（長いものを先に並べる）。ここにある言葉だけが、式の中の日本語として読める。
   */
  var WORDS = [
    '繰り返し処理を終了する', 'ずつ増やす', 'ずつ減らす', '未定義でない', '未定義の値',
    'を追加する', 'の要素数', 'の末尾', '未定義', 'から', 'まで', 'が', 'を', 'に'
  ];

  /**
   * 読めないときに投げるエラー（行番号つき）。
   * @param {number} line 行番号（1 から）
   * @param {string} message やさしい日本語の説明
   * @returns {Error} 行番号を持ったエラー
   */
  function traceError(line, message) {
    var e = new Error(message);
    e.traceLine = line;
    return e;
  }

  // ============================================================
  // 1. 整える
  // ============================================================

  /**
   * ソースを整える。全角を半角にそろえ、注釈（二重スラッシュの行末まで、と、スラッシュ＋星で囲んだ所）を消す。注釈の中の改行は残すので、行番号は変わらない。
   * @param {string} src 擬似言語のプログラム
   * @returns {string[]} 行ごとの文字（配列の i 番目が i+1 行目）
   */
  function normalizeSource(src) {
    var s = String(src).normalize('NFKC');
    s = s.replace(/[“”‘’']/g, '"').replace(/、/g, ',').replace(/[◯〇]/g, '○');
    var out = '';
    var i = 0;
    var inString = false;
    while (i < s.length) {
      var ch = s[i];
      if (ch === '"') { inString = !inString; out += ch; i++; continue; }
      if (!inString && ch === '/' && s[i + 1] === '*') {
        i += 2;
        while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { out += s[i] === '\n' ? '\n' : ' '; i++; }
        i += 2;
        continue;
      }
      if (!inString && ch === '/' && s[i + 1] === '/') {
        while (i < s.length && s[i] !== '\n') i++;
        continue;
      }
      if (ch === '\n') inString = false;
      out += ch;
      i++;
    }
    return out.split(/\r?\n/);
  }

  // ============================================================
  // 2. 読む（字句 → 文）
  // ============================================================

  /**
   * 1行の文字を、字句（意味のある最小の単位）の並びに分ける。
   * @param {string} text 1行の文字（整えたあと）
   * @param {number} line 行番号（エラー用）
   * @returns {{t:string, v:*}[]} 字句の並び。t は num / str / id / op / word / unknown / ( ) [ ] { } , ←
   */
  function tokenize(text, line) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (/\s/.test(ch)) { i++; continue; }
      var m;
      if ((m = /^[0-9]+(\.[0-9]+)?/.exec(text.slice(i)))) {
        tokens.push({ t: 'num', v: Number(m[0]) });
        i += m[0].length;
      } else if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i)))) {
        var w = m[0];
        if (w === 'mod' || w === 'and' || w === 'or' || w === 'not') tokens.push({ t: 'op', v: w });
        else if (w === 'true') tokens.push({ t: 'bool', v: true });
        else if (w === 'false') tokens.push({ t: 'bool', v: false });
        else tokens.push({ t: 'id', v: w });
        i += w.length;
      } else if (ch === '"') {
        var end = text.indexOf('"', i + 1);
        if (end < 0) throw traceError(line, '文字列の終わりの " が見つかりません');
        tokens.push({ t: 'str', v: text.slice(i + 1, end) });
        i = end + 1;
      } else if (text.slice(i, i + 2) === '<-') {
        tokens.push({ t: '←', v: '←' }); i += 2;
      } else if (text.slice(i, i + 2) === '<=') {
        tokens.push({ t: 'op', v: '<=' }); i += 2;
      } else if (text.slice(i, i + 2) === '>=') {
        tokens.push({ t: 'op', v: '>=' }); i += 2;
      } else if (text.slice(i, i + 2) === '<>' || text.slice(i, i + 2) === '!=') {
        tokens.push({ t: 'op', v: '!=' }); i += 2;
      } else if (text.slice(i, i + 2) === '==') {
        tokens.push({ t: 'op', v: '=' }); i += 2;
      } else if (ch === '←') {
        tokens.push({ t: '←', v: '←' }); i++;
      } else if ('()[]{},'.indexOf(ch) >= 0) {
        tokens.push({ t: ch, v: ch }); i++;
      } else if (ch === '×' || ch === '*') { tokens.push({ t: 'op', v: '*' }); i++; }
      else if (ch === '÷' || ch === '/') { tokens.push({ t: 'op', v: '/' }); i++; }
      else if (ch === '＋' || ch === '+') { tokens.push({ t: 'op', v: '+' }); i++; }
      else if (ch === '−' || ch === '-' || ch === '－') { tokens.push({ t: 'op', v: '-' }); i++; }
      else if (ch === '≦' || ch === '≤') { tokens.push({ t: 'op', v: '<=' }); i++; }
      else if (ch === '≧' || ch === '≥') { tokens.push({ t: 'op', v: '>=' }); i++; }
      else if (ch === '≠') { tokens.push({ t: 'op', v: '!=' }); i++; }
      else if (ch === '<' || ch === '>' || ch === '=') { tokens.push({ t: 'op', v: ch }); i++; }
      else if (ch.charCodeAt(0) > 127) {
        // 日本語など。単語の一覧に合うものは「単語」、合わないものは「読めない言葉」にする
        var matched = null;
        for (var k = 0; k < WORDS.length; k++) {
          if (text.startsWith(WORDS[k], i)) { matched = WORDS[k]; break; }
        }
        if (matched) { tokens.push({ t: 'word', v: matched }); i += matched.length; }
        else {
          var j = i;
          while (j < text.length && text.charCodeAt(j) > 127 && !/\s/.test(text[j]) && !WORDS.some(function (x) { return text.startsWith(x, j); })) j++;
          if (j === i) j = i + 1;
          tokens.push({ t: 'unknown', v: text.slice(i, j) });
          i = j;
        }
      } else {
        throw traceError(line, '「' + ch + '」は読めない記号です');
      }
    }
    return tokens;
  }

  /**
   * 字句の並びから式の木を作る部品（再帰下降の読み取り）。
   * @param {{t:string, v:*}[]} tokens 字句の並び
   * @param {number} line 行番号（エラー用）
   * @returns {object} pos（いま読んでいる位置）と、peek / next / expect / parseExpr などの関数
   */
  function makeParser(tokens, line) {
    var p = { pos: 0 };

    function peek() { return tokens[p.pos]; }
    function next() { return tokens[p.pos++]; }
    function isOp(tok, values) { return tok && tok.t === 'op' && values.indexOf(tok.v) >= 0; }

    /** 読めない所に出会ったときのエラーを作る（日本語の文章らしければ、その説明をつける）。 */
    function syntaxFail(tok) {
      if (!tok) return traceError(line, '式が途中で終わっています');
      if (tok.t === 'word' || tok.t === 'unknown') {
        return traceError(line, '日本語の文章のような書き方「' + tok.v + '」は、まだ読めません。式（＜ ＝ など）で書かれた所だけ動かせます');
      }
      return traceError(line, '「' + (tok.v === undefined ? tok.t : tok.v) + '」のところが読めません');
    }

    /** 指定の字句を1つ読む。違えばエラー。 */
    function expect(type, what) {
      var tok = peek();
      if (!tok || tok.t !== type) {
        if (tok && (tok.t === 'word' || tok.t === 'unknown')) throw syntaxFail(tok);
        throw traceError(line, (what || type) + ' が見つかりません');
      }
      return next();
    }

    /** 式全体（一番弱い「or」から読み始める）。 */
    function parseExpr() { return parseOr(); }

    function parseOr() {
      var left = parseAnd();
      while (isOp(peek(), ['or'])) { next(); left = { k: 'bin', op: 'or', a: left, b: parseAnd() }; }
      return left;
    }

    function parseAnd() {
      var left = parseRel();
      while (isOp(peek(), ['and'])) { next(); left = { k: 'bin', op: 'and', a: left, b: parseRel() }; }
      return left;
    }

    function parseRel() {
      var left = parseAdd();
      for (;;) {
        var tok = peek();
        if (isOp(tok, ['<', '<=', '>', '>=', '=', '!='])) {
          next();
          left = { k: 'bin', op: tok.v, a: left, b: parseAdd() };
        } else if (tok && tok.t === 'word' && tok.v === 'が' && tokens[p.pos + 1] && tokens[p.pos + 1].t === 'word' &&
                   (tokens[p.pos + 1].v === '未定義' || tokens[p.pos + 1].v === '未定義でない')) {
          next();
          var notUndef = next().v === '未定義でない';
          left = { k: 'isUndef', a: left, negate: notUndef };
        } else break;
      }
      return left;
    }

    function parseAdd() {
      var left = parseMul();
      while (isOp(peek(), ['+', '-'])) { var op = next().v; left = { k: 'bin', op: op, a: left, b: parseMul() }; }
      return left;
    }

    function parseMul() {
      var left = parseUnary();
      while (isOp(peek(), ['*', '/', 'mod'])) { var op = next().v; left = { k: 'bin', op: op, a: left, b: parseUnary() }; }
      return left;
    }

    function parseUnary() {
      var tok = peek();
      if (isOp(tok, ['not', '+', '-'])) { next(); return { k: 'unary', op: tok.v, a: parseUnary() }; }
      return parsePostfix();
    }

    function parsePostfix() {
      var node = parsePrimary();
      for (;;) {
        var tok = peek();
        if (tok && tok.t === '[') {
          next();
          var index = parseExpr();
          if (peek() && peek().t === ',') throw traceError(line, '二次元配列 a[行, 列] は使えません（配列の配列 a[行][列] で書いてください）');
          expect(']', '」');
          node = { k: 'index', a: node, i: index };
        } else if (tok && tok.t === 'word' && tok.v === 'の要素数') {
          next();
          node = { k: 'length', a: node };
        } else break;
      }
      return node;
    }

    function parsePrimary() {
      var tok = next();
      if (!tok) throw traceError(line, '式が途中で終わっています');
      if (tok.t === 'num' || tok.t === 'str' || tok.t === 'bool') return { k: 'lit', v: tok.v };
      if (tok.t === 'word' && tok.v === '未定義の値') return { k: 'lit', v: undefined };
      if (tok.t === 'id') {
        if (peek() && peek().t === '(') {
          next();
          var args = [];
          if (peek() && peek().t === ')') { next(); return { k: 'call', name: tok.v, args: args }; }
          for (;;) {
            args.push(parseExpr());
            if (peek() && peek().t === ',') { next(); continue; }
            expect(')', ')');
            break;
          }
          return { k: 'call', name: tok.v, args: args };
        }
        return { k: 'var', name: tok.v };
      }
      if (tok.t === '(') {
        var inner = parseExpr();
        expect(')', ')');
        return inner;
      }
      if (tok.t === '{') {
        var items = [];
        if (peek() && peek().t === '}') { next(); return { k: 'array', items: items }; }
        for (;;) {
          items.push(parseExpr());
          if (peek() && peek().t === ',') { next(); continue; }
          expect('}', '}');
          break;
        }
        return { k: 'array', items: items };
      }
      throw syntaxFail(tok);
    }

    /** 全部読み終えたか確かめる（余りがあればエラー）。 */
    function expectEnd() {
      if (p.pos < tokens.length) throw syntaxFail(tokens[p.pos]);
    }

    return { p: p, peek: peek, next: next, expect: expect, parseExpr: parseExpr, expectEnd: expectEnd, syntaxFail: syntaxFail, isOp: isOp };
  }

  /**
   * 「(条件)」の形の行（if / elseif / while）から、条件の式を取り出す。
   * @param {string} text 1行の文字（if などの言葉を取ったあと）
   * @param {number} line 行番号
   * @returns {object} 条件の式の木
   */
  function parseCondition(text, line) {
    var ps = makeParser(tokenize(text, line), line);
    ps.expect('(', '(');
    var cond = ps.parseExpr();
    ps.expect(')', ')');
    ps.expectEnd();
    return cond;
  }

  /**
   * 「for (i を 1 から 5 まで 1 ずつ増やす)」の行を読む。
   * @param {string} text 1行の文字（for を取ったあと）
   * @param {number} line 行番号
   * @returns {{name:string, from:object, to:object, step:object, down:boolean}} for の設定
   */
  function parseForHeader(text, line) {
    var ps = makeParser(tokenize(text, line), line);
    ps.expect('(', '(');
    var name = ps.expect('id', '変数名').v;
    var w = ps.expect('word', '「を」');
    if (w.v !== 'を') throw ps.syntaxFail(w);
    var from = ps.parseExpr();
    if (ps.expect('word', '「から」').v !== 'から') throw traceError(line, '「から」が見つかりません');
    var to = ps.parseExpr();
    if (ps.expect('word', '「まで」').v !== 'まで') throw traceError(line, '「まで」が見つかりません');
    var step = ps.parseExpr();
    var dir = ps.expect('word', '「ずつ増やす」か「ずつ減らす」').v;
    if (dir !== 'ずつ増やす' && dir !== 'ずつ減らす') throw traceError(line, '「ずつ増やす」か「ずつ減らす」と書いてください');
    ps.expect(')', ')');
    ps.expectEnd();
    return { name: name, from: from, to: to, step: step, down: dir === 'ずつ減らす' };
  }

  /**
   * 左辺（代入や末尾への追加の相手）を読む。「a」か「a[式]」。
   * @param {object} ps makeParser の結果
   * @param {number} line 行番号
   * @returns {{name:string, indexes:object[]}} 左辺。indexes は a[i][j] の i, j の式の並び（なければ空）
   */
  function parseTarget(ps, line) {
    var name = ps.expect('id', '変数名').v;
    var indexes = [];
    while (ps.peek() && ps.peek().t === '[') {
      ps.next();
      indexes.push(ps.parseExpr());
      if (ps.peek() && ps.peek().t === ',') throw traceError(line, '二次元配列 a[行, 列] は使えません（配列の配列 a[行][列] で書いてください）');
      ps.expect(']', ']');
    }
    return { name: name, indexes: indexes };
  }

  /**
   * 文のうち、1行で終わるもの（宣言・代入・末尾に追加・繰り返しを終了する）を読む。
   * @param {string} text 1行の文字
   * @param {number} line 行番号
   * @returns {object} 文の木
   */
  function parseSimpleStatement(text, line) {
    if (text === '繰り返し処理を終了する') return { type: 'break', line: line };

    var decl = /^(?:大域\s*:\s*)?([^\s:←]*型[^\s:←]*)\s*:\s*(.+)$/.exec(text);
    if (decl && /^実数型/.test(decl[1])) {
      throw traceError(line, '実数型（小数）は、まだ使えません。割り算の結果が切り捨てになってしまうためです');
    }
    if (decl) {
      var dp = makeParser(tokenize(decl[2], line), line);
      var items = [];
      for (;;) {
        var name = dp.expect('id', '変数名').v;
        var init = null;
        if (dp.peek() && dp.peek().t === '←') { dp.next(); init = dp.parseExpr(); }
        items.push({ name: name, init: init });
        if (dp.peek() && dp.peek().t === ',') { dp.next(); continue; }
        break;
      }
      dp.expectEnd();
      return { type: 'decl', line: line, items: items, isGlobal: /^大域/.test(text) };
    }

    var lineTokens = tokenize(text, line);
    if (lineTokens[0] && lineTokens[0].t === 'id' && lineTokens[1] && lineTokens[1].t === '(') {
      var cp = makeParser(lineTokens, line);
      var callExpr = cp.parseExpr();
      cp.expectEnd();
      return { type: 'callstmt', line: line, expr: callExpr };
    }
    var ps = makeParser(lineTokens, line);
    var target = parseTarget(ps, line);
    var tok = ps.peek();
    if (tok && tok.t === '←') {
      ps.next();
      var value = ps.parseExpr();
      ps.expectEnd();
      return { type: 'assign', line: line, target: target, value: value };
    }
    if (tok && tok.t === 'word' && tok.v === 'の末尾') {
      ps.next();
      if (ps.expect('word', '「に」').v !== 'に') throw traceError(line, '「の末尾 に ○○ を追加する」の形で書いてください');
      var added = ps.parseExpr();
      if (ps.expect('word', '「を追加する」').v !== 'を追加する') throw traceError(line, '「の末尾 に ○○ を追加する」の形で書いてください');
      ps.expectEnd();
      return { type: 'append', line: line, target: target, value: added };
    }
    throw ps.syntaxFail(tok || null);
  }

  /**
   * 行の並び（関数の外の行、または1つの関数の中の行）を、文の木の並びに読む。
   * @param {{no:number, text:string, indent:number}[]} lines 行の並び（空の行は取り除いたもの）
   * @returns {object[]} 文の木の並び
   */
  function parseStatements(lines) {
    var ctx = { lines: lines, i: 0 };

    /** 行の最初の言葉（if / while など）を返す。なければ null。 */
    function keywordOf(text) {
      var m = /^(elseif|else|endif|if|endwhile|while|do|endfor|for|return)(?![A-Za-z0-9_])/.exec(text);
      return m ? m[1] : null;
    }

    /**
     * 文の並びを、終わりの言葉に出会うまで読む（終わりの行は読み進めずに残す）。
     * @param {string[]} enders 終わりを表す言葉の一覧
     * @param {(number|null)} doIndent do の行の字下げ（do-while の while を見分けるため）
     * @returns {object[]} 文の木の並び
     */
    function parseBlock(enders, doIndent) {
      var stmts = [];
      while (ctx.i < ctx.lines.length) {
        var ln = ctx.lines[ctx.i];
        var kw = keywordOf(ln.text);
        if (kw && enders.indexOf(kw) >= 0) {
          if (kw !== 'while' || (doIndent !== null && ln.indent === doIndent)) return stmts;
        }
        stmts.push(parseStatement());
      }
      return stmts;
    }

    /** 1つの文（複数行のものも含む）を読む。 */
    function parseStatement() {
      var ln = ctx.lines[ctx.i];
      var kw = keywordOf(ln.text);
      var line = ln.no;
      if (kw === 'return') {
        ctx.i++;
        var rest = ln.text.slice(6).trim();
        if (rest === '') return { type: 'return', line: line, value: null };
        var rp = makeParser(tokenize(rest, line), line);
        var rvalue = rp.parseExpr();
        rp.expectEnd();
        return { type: 'return', line: line, value: rvalue };
      }
      if (kw === 'endif' || kw === 'elseif' || kw === 'else') throw traceError(line, '対応する if がありません');
      if (kw === 'endwhile') throw traceError(line, '対応する while がありません');
      if (kw === 'endfor') throw traceError(line, '対応する for がありません');
      if (kw === 'while' && /^while\s*\(/.test(ln.text) === false) throw traceError(line, 'while の書き方が読めません');

      if (kw === 'if') {
        ctx.i++;
        var branches = [{ line: line, cond: parseCondition(ln.text.slice(2), line), body: parseBlock(['elseif', 'else', 'endif'], null) }];
        var elseBody = null;
        for (;;) {
          var cur = ctx.lines[ctx.i];
          if (!cur) throw traceError(line, 'if に対応する endif が見つかりません');
          var ck = keywordOf(cur.text);
          if (ck === 'elseif') {
            ctx.i++;
            branches.push({ line: cur.no, cond: parseCondition(cur.text.slice(6), cur.no), body: parseBlock(['elseif', 'else', 'endif'], null) });
          } else if (ck === 'else') {
            if (cur.text !== 'else') throw traceError(cur.no, 'else の行には、ほかの言葉を書けません');
            if (elseBody) throw traceError(cur.no, 'else が2つあります');
            ctx.i++;
            elseBody = parseBlock(['endif'], null);
          } else if (ck === 'endif') {
            ctx.i++;
            break;
          } else {
            throw traceError(line, 'if に対応する endif が見つかりません');
          }
        }
        return { type: 'if', line: line, branches: branches, elseBody: elseBody };
      }

      if (kw === 'while') {
        ctx.i++;
        var wcond = parseCondition(ln.text.slice(5), line);
        var wbody = parseBlock(['endwhile'], null);
        if (!ctx.lines[ctx.i] || keywordOf(ctx.lines[ctx.i].text) !== 'endwhile') throw traceError(line, 'while に対応する endwhile が見つかりません');
        ctx.i++;
        return { type: 'while', line: line, cond: wcond, body: wbody };
      }

      if (kw === 'do') {
        if (ln.text !== 'do') throw traceError(line, 'do の行には、ほかの言葉を書けません');
        ctx.i++;
        var dbody = parseBlock(['while'], ln.indent);
        var endLine = ctx.lines[ctx.i];
        if (!endLine || keywordOf(endLine.text) !== 'while') throw traceError(line, 'do に対応する while（条件）が見つかりません');
        ctx.i++;
        return { type: 'dowhile', line: line, condLine: endLine.no, cond: parseCondition(endLine.text.slice(5), endLine.no), body: dbody };
      }

      if (kw === 'for') {
        ctx.i++;
        var head = parseForHeader(ln.text.slice(3), line);
        var fbody = parseBlock(['endfor'], null);
        if (!ctx.lines[ctx.i] || keywordOf(ctx.lines[ctx.i].text) !== 'endfor') throw traceError(line, 'for に対応する endfor が見つかりません');
        ctx.i++;
        return { type: 'for', line: line, head: head, body: fbody };
      }

      ctx.i++;
      return parseSimpleStatement(ln.text, line);
    }

    return parseBlock([], null);
  }

  /**
   * 関数・手続の宣言の行「○整数型: fact(整数型: n)」を読む。
   * @param {string} text 1行の文字（先頭は ○）
   * @param {number} line 行番号
   * @returns {{name:string, params:string[]}} 名前と、引数の名前の並び（型は読み飛ばす）
   */
  function parseFunctionHeader(text, line) {
    var m = /^○\s*(?:[^()]*?:\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/.exec(text);
    if (!m) throw traceError(line, '関数の宣言「○整数型: 名前(整数型: 引数)」の形が読めません');
    var params = [];
    var inner = m[2].trim();
    if (inner !== '') {
      inner.split(',').forEach(function (piece) {
        var nm = piece.slice(piece.lastIndexOf(':') + 1).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) throw traceError(line, '引数の名前「' + nm + '」が読めません');
        params.push(nm);
      });
    }
    return { name: m[1], params: params };
  }

  /**
   * プログラム全体を読む。「○」で始まる行は関数の宣言で、その下の字下げした行が中身。
   * それ以外の行（関数の外）が、上から順に動かす本体になる。
   * @param {string[]} rawLines 整えたあとの行の並び
   * @returns {{body:object[], funcs:object}} body: 本体の文の木の並び / funcs: 名前 → {name, params, line, body}
   */
  function parseProgram(rawLines) {
    var lines = [];
    rawLines.forEach(function (text, idx) {
      var trimmed = text.trim();
      if (trimmed === '') return;
      lines.push({ no: idx + 1, text: trimmed, indent: text.length - text.replace(/^\s+/, '').length });
    });
    var mainLines = [];
    var funcs = {};
    var i = 0;
    while (i < lines.length) {
      var ln = lines[i];
      if (ln.text.charAt(0) !== '○') { mainLines.push(ln); i++; continue; }
      var header = parseFunctionHeader(ln.text, ln.no);
      if (Object.prototype.hasOwnProperty.call(funcs, header.name)) throw traceError(ln.no, '関数・手続 ' + header.name + ' が2つあります');
      var bodyLines = [];
      i++;
      while (i < lines.length && lines[i].text.charAt(0) !== '○' && lines[i].indent > ln.indent) { bodyLines.push(lines[i]); i++; }
      if (bodyLines.length === 0) throw traceError(ln.no, '関数の中身（○の行より字下げした行）がありません');
      funcs[header.name] = { name: header.name, params: header.params, line: ln.no, body: parseStatements(bodyLines) };
    }
    return { body: parseStatements(mainLines), funcs: funcs };
  }

  // ============================================================
  // 3. 動かす
  // ============================================================

  /**
   * 値を写す（配列は中身まで別のものにする。前のステップの表示が後から変わらないように）。
   * @param {*} v 値
   * @returns {*} 写した値
   */
  function cloneValue(v) {
    return Array.isArray(v) ? v.map(cloneValue) : v;
  }

  /**
   * 値を、ステップの補足に出す文字にする。
   * @param {*} v 値
   * @returns {string} 表示用の文字
   */
  function showValue(v) {
    if (v === undefined) return '未定義';
    if (typeof v === 'boolean') return v ? '真' : '偽';
    if (typeof v === 'string') return '"' + v + '"';
    if (Array.isArray(v)) return '{' + v.map(showValue).join(', ') + '}';
    return String(v);
  }

  /**
   * 読んだプログラムを動かして、ステップの一覧を作る。
   * @param {{body:object[], funcs:object}} program parseProgram の結果（本体の文の木と、関数の一覧）
   * @param {number} maxSteps 最大のステップ数
   * @returns {{steps:object[], error:(object|null)}} ステップの一覧と、動かしている途中のエラー
   */
  function execute(program, maxSteps) {
    var funcs = program.funcs;
    var globals = {};                              // 「大域:」で宣言した変数（どの関数からも見える）
    var stack = [{ name: 'main', vars: {} }];      // 呼び出しの積み重ね（一番下が本体、一番上がいま動いている所）
    var steps = [];
    var loopDepth = 0;

    /** 表（オブジェクト）に、その名前があるか。 */
    function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

    /** いま動いている所（一番上の呼び出し）。 */
    function top() { return stack[stack.length - 1]; }

    /**
     * 変数の置き場所を探す。いまの呼び出しの中 → 大域の順。見つからなければ null。
     * @param {string} name 変数の名前
     * @returns {(object|null)} その変数を持っている表
     */
    function holderOf(name) {
      var t = top();
      if (has(t.vars, name)) return t.vars;
      if (has(globals, name)) return globals;
      return null;
    }

    /** いまの積み重ねを写して、ステップ用の frames を作る（一番下の表には大域の変数も入れる）。 */
    function snapshotFrames() {
      return stack.map(function (f, i) {
        var src = i === 0 ? Object.assign({}, globals, f.vars) : f.vars;
        var copy = {};
        Object.keys(src).forEach(function (k) { copy[k] = cloneValue(src[k]); });
        var frame = { name: f.name, vars: copy };
        if (f.label) frame.label = f.label;
        return frame;
      });
    }

    /** いまの変数の表を写して、ステップを1つ足す。isCall は「関数を呼び出した」ステップの印。 */
    function pushStep(line, note, assigned, assignedIndex, branch, isCall) {
      if (steps.length - 1 >= maxSteps) {
        throw traceError(line, '終わらないプログラムのようです（' + maxSteps + ' ステップで止めました）');
      }
      var step = { ran: line, next: null, frames: snapshotFrames(), assigned: assigned || [], note: note || '' };
      if (assignedIndex !== undefined) step.assignedIndex = assignedIndex;
      if (branch) step.branch = true; // 条件を調べる行（分かれ道）
      if (isCall) step.call = true;
      steps.push(step);
    }

    /** 数でなければエラー。 */
    function needNumber(v, line, what) {
      if (v === undefined) throw traceError(line, what + 'に、値の入っていない（未定義の）ものを使いました');
      if (typeof v !== 'number') throw traceError(line, what + 'は数でなければなりません（いまは ' + showValue(v) + '）');
      return v;
    }

    /** 式を計算する。 */
    function evalExpr(n, line) {
      switch (n.k) {
        case 'lit': return n.v;
        case 'var': {
          var holder = holderOf(n.name);
          if (!holder) throw traceError(line, '変数 ' + n.name + ' は、まだ宣言も代入もされていません');
          return holder[n.name];
        }
        case 'call': return callFunction(n, line);
        case 'array': return n.items.map(function (x) { return cloneValue(evalExpr(x, line)); });
        case 'length': {
          var arr = evalExpr(n.a, line);
          if (!Array.isArray(arr)) throw traceError(line, '「の要素数」は配列にだけ使えます');
          return arr.length;
        }
        case 'index': {
          var a = evalExpr(n.a, line);
          if (!Array.isArray(a)) throw traceError(line, '[ ] は配列にだけ使えます');
          var i = needNumber(evalExpr(n.i, line), line, '要素番号');
          if (!Number.isInteger(i) || i < 1 || i > a.length) throw traceError(line, '要素番号 ' + i + ' は範囲の外です（この配列は 1 から ' + a.length + ' まで）');
          return a[i - 1];
        }
        case 'isUndef': {
          var u = evalExpr(n.a, line) === undefined;
          return n.negate ? !u : u;
        }
        case 'unary': {
          var uv = evalExpr(n.a, line);
          if (n.op === 'not') {
            if (typeof uv !== 'boolean') throw traceError(line, 'not は真か偽にだけ使えます');
            return !uv;
          }
          var un = needNumber(uv, line, n.op === '-' ? 'マイナスをつける値' : 'プラスをつける値');
          return n.op === '-' ? -un : un;
        }
        case 'bin': return evalBinary(n, line);
        default: throw traceError(line, '読めない式です');
      }
    }

    /** 2つの値の演算を計算する。 */
    function evalBinary(n, line) {
      if (n.op === 'and' || n.op === 'or') {
        var left = evalExpr(n.a, line);
        if (typeof left !== 'boolean') throw traceError(line, n.op + ' は真か偽にだけ使えます');
        if (n.op === 'and' && !left) return false;
        if (n.op === 'or' && left) return true;
        var right = evalExpr(n.b, line);
        if (typeof right !== 'boolean') throw traceError(line, n.op + ' は真か偽にだけ使えます');
        return right;
      }
      var x = evalExpr(n.a, line);
      var y = evalExpr(n.b, line);
      if (n.op === '=' || n.op === '!=') {
        var same = Array.isArray(x) || Array.isArray(y) ? JSON.stringify(x) === JSON.stringify(y) : x === y;
        return n.op === '=' ? same : !same;
      }
      if (n.op === '<' || n.op === '<=' || n.op === '>' || n.op === '>=') {
        if (!(typeof x === 'number' && typeof y === 'number') && !(typeof x === 'string' && typeof y === 'string')) {
          needNumber(x, line, '比べる値');
          needNumber(y, line, '比べる値');
        }
        if (n.op === '<') return x < y;
        if (n.op === '<=') return x <= y;
        if (n.op === '>') return x > y;
        return x >= y;
      }
      var nx = needNumber(x, line, '計算する値');
      var ny = needNumber(y, line, '計算する値');
      if (n.op === '+') return nx + ny;
      if (n.op === '-') return nx - ny;
      if (n.op === '*') return nx * ny;
      if (ny === 0) throw traceError(line, '0 で割ることはできません');
      if (n.op === '/') return Number.isInteger(nx) && Number.isInteger(ny) ? Math.trunc(nx / ny) : nx / ny; // 整数どうしは商（切り捨て）
      return nx % ny;
    }

    /** 条件を計算して、真か偽かを返す（真偽でなければエラー）。 */
    function evalCondition(cond, line) {
      var v = evalExpr(cond, line);
      if (typeof v !== 'boolean') throw traceError(line, '条件が真か偽になっていません（いまは ' + showValue(v) + '）。「a ＝ 1」のような比較で書いてください');
      return v;
    }

    /**
     * 左辺 a[i][j] が指す要素を探す。範囲外ならエラー。
     * @returns {{arr:object[], pos:number}} 要素を持っている配列と、その中の番号（1 から）
     */
    function elementLocation(target, line) {
      var holder = holderOf(target.name);
      if (!holder) throw traceError(line, '変数 ' + target.name + ' は、まだ宣言も代入もされていません');
      var arr = holder[target.name];
      var pos = 0;
      for (var k = 0; k < target.indexes.length; k++) {
        if (!Array.isArray(arr)) throw traceError(line, (k === 0 ? target.name : '途中の要素') + ' は配列ではありません');
        pos = needNumber(evalExpr(target.indexes[k], line), line, '要素番号');
        if (!Number.isInteger(pos) || pos < 1 || pos > arr.length) throw traceError(line, '要素番号 ' + pos + ' は範囲の外です（この配列は 1 から ' + arr.length + ' まで）');
        if (k < target.indexes.length - 1) arr = arr[pos - 1];
      }
      return { arr: arr, pos: pos };
    }

    /**
     * 関数・手続を呼び出して、戻り値を返す（呼び出しの積み重ねに1段足して中身を動かす）。
     * @param {{name:string, args:object[]}} n 呼び出しの式
     * @param {number} line 呼び出している行
     * @returns {*} 戻り値（return のない手続は未定義）
     */
    function callFunction(n, line) {
      var fn = has(funcs, n.name) ? funcs[n.name] : null;
      if (!fn) throw traceError(line, '関数・手続 ' + n.name + ' が見つかりません（○ の行で宣言されていません）');
      if (n.args.length !== fn.params.length) throw traceError(line, n.name + ' には引数が ' + fn.params.length + ' 個必要です（いまは ' + n.args.length + ' 個）');
      var vals = n.args.map(function (a) { return evalExpr(a, line); });
      if (stack.length - 1 >= MAX_CALL_DEPTH) {
        throw traceError(line, '呼び出しが深すぎます（' + MAX_CALL_DEPTH + ' 回まで）。終わらない再帰かもしれません');
      }
      var label = n.name + '(' + fn.params.map(function (p, i) { return p + ' = ' + showValue(vals[i]); }).join(', ') + ')';
      var frame = { name: n.name, label: label, vars: {} };
      fn.params.forEach(function (p, i) { frame.vars[p] = vals[i]; });
      stack.push(frame);
      var savedLoop = loopDepth;
      loopDepth = 0; // 関数の外の繰り返しは、中から抜けられない
      var sig;
      try {
        pushStep(line, label + ' を呼び出す', fn.params.slice(), undefined, false, true);
        sig = execBlock(fn.body);
      } finally {
        loopDepth = savedLoop;
        stack.pop();
      }
      return sig && sig.ret ? sig.value : undefined;
    }

    /** 文の並びを動かす。「繰り返しを終了する」なら 'break'、return なら {ret:true, value} を返す（途中で抜ける合図）。 */
    function execBlock(stmts) {
      for (var k = 0; k < stmts.length; k++) {
        var sig = execStmt(stmts[k]);
        if (sig) return sig;
      }
      return null;
    }

    /** 1つの文を動かす。 */
    function execStmt(s) {
      var line = s.line;
      switch (s.type) {
        case 'decl': {
          var names = [];
          s.items.forEach(function (it) {
            var initial = it.init ? cloneValue(evalExpr(it.init, line)) : undefined;
            (s.isGlobal ? globals : top().vars)[it.name] = initial;
            if (it.init) names.push(it.name);
          });
          pushStep(line, '', names);
          return null;
        }
        case 'assign': {
          var value = cloneValue(evalExpr(s.value, line));
          if (s.target.indexes.length > 0) {
            var loc = elementLocation(s.target, line);
            loc.arr[loc.pos - 1] = value;
            pushStep(line, '', [s.target.name], loc.pos);
          } else {
            (holderOf(s.target.name) || top().vars)[s.target.name] = value;
            pushStep(line, '', [s.target.name]);
          }
          return null;
        }
        case 'append': {
          var base = evalExpr({ k: 'var', name: s.target.name }, line);
          if (s.target.indexes.length > 0) {
            var where = elementLocation(s.target, line);
            base = where.arr[where.pos - 1];
          }
          if (!Array.isArray(base)) throw traceError(line, s.target.name + ' は配列ではありません');
          base.push(cloneValue(evalExpr(s.value, line)));
          pushStep(line, '', [s.target.name], base.length);
          return null;
        }
        case 'break':
          if (loopDepth === 0) throw traceError(line, '「繰り返し処理を終了する」は、繰り返しの中だけで使えます');
          pushStep(line, '繰り返しを抜ける', []);
          return 'break';
        case 'if': {
          for (var b = 0; b < s.branches.length; b++) {
            var br = s.branches[b];
            var ok = evalCondition(br.cond, br.line);
            pushStep(br.line, '条件は' + (ok ? '真' : '偽') + 'なので、' + (ok ? 'この中を実行する' : '次へ進む'), [], undefined, true);
            if (ok) return execBlock(br.body);
          }
          return s.elseBody ? execBlock(s.elseBody) : null;
        }
        case 'while': {
          loopDepth++;
          try {
            for (;;) {
              var wok = evalCondition(s.cond, line);
              pushStep(line, '条件は' + (wok ? '真' : '偽') + 'なので、' + (wok ? '繰り返す' : '繰り返しを終わる'), [], undefined, true);
              if (!wok) break;
              var wsig = execBlock(s.body);
              if (wsig === 'break') break;
              if (wsig) return wsig;
            }
          } finally { loopDepth--; }
          return null;
        }
        case 'dowhile': {
          loopDepth++;
          try {
            for (;;) {
              var dsig = execBlock(s.body);
              if (dsig === 'break') break;
              if (dsig) return dsig;
              var dok = evalCondition(s.cond, s.condLine);
              pushStep(s.condLine, '条件は' + (dok ? '真' : '偽') + 'なので、' + (dok ? 'もう一度繰り返す' : '繰り返しを終わる'), [], undefined, true);
              if (!dok) break;
            }
          } finally { loopDepth--; }
          return null;
        }
        case 'for': {
          var h = s.head;
          var from = needNumber(evalExpr(h.from, line), line, 'for の始めの値');
          var to = needNumber(evalExpr(h.to, line), line, 'for の終わりの値');
          var stepBy = needNumber(evalExpr(h.step, line), line, 'for の増やす（減らす）値');
          if (stepBy <= 0) throw traceError(line, 'for の増やす（減らす）値は 1 以上にしてください');
          var cur = from;
          loopDepth++;
          try {
            for (;;) {
              (holderOf(h.name) || top().vars)[h.name] = cur;
              var within = h.down ? cur >= to : cur <= to;
              pushStep(line, h.name + ' は ' + cur + '。終わりの値 ' + to + (h.down ? ' 以上' : ' 以下') + 'か？ ' +
                (within ? 'はい。繰り返す' : 'いいえ。繰り返しを終わる'), [h.name], undefined, true);
              if (!within) break;
              var fsig = execBlock(s.body);
              if (fsig === 'break') break;
              if (fsig) return fsig;
              cur = h.down ? cur - stepBy : cur + stepBy;
            }
          } finally { loopDepth--; }
          return null;
        }
        case 'return': {
          if (stack.length === 1) throw traceError(line, 'return は関数の中だけで使えます');
          var rv = s.value ? cloneValue(evalExpr(s.value, line)) : undefined;
          pushStep(line, s.value ? showValue(rv) + ' を返す' : 'ここで関数を終わる', []);
          return { ret: true, value: rv };
        }
        case 'callstmt':
          evalExpr(s.expr, line);
          return null;
        default: throw traceError(line, '読めない文です');
      }
    }

    steps.push({ ran: null, next: null, frames: [{ name: 'main', vars: {} }], assigned: [], note: '' });
    var error = null;
    try {
      execBlock(program.body);
    } catch (e) {
      if (e.traceLine === undefined) throw e;
      error = { line: e.traceLine, message: e.message };
    }
    return { steps: steps, error: error };
  }

  /**
   * 擬似言語のプログラムを読んで、1行ずつ動かした記録を作る。
   * @param {string} code 擬似言語のプログラム
   * @param {{maxSteps?:number}} [options] maxSteps: 最大のステップ数（省略は 2000）
   * @returns {{steps:object[], error:({line:number, message:string}|null), finished:boolean}}
   *   steps の1つ: { ran: 実行した行（最初は null）, next: 次に実行する行（最後は null）,
   *   frames: [{name, vars}]（実行したあとの変数の表）, assigned: 代入された変数の名前, assignedIndex: 配列の要素の番号（あれば）, note: 補足 }
   *   error: 読めない・動かせないときの行番号と説明。finished: 最後まで動いたら true。
   */
  function run(code, options) {
    var maxSteps = options && options.maxSteps ? options.maxSteps : DEFAULT_MAX_STEPS;
    var program;
    try {
      program = parseProgram(normalizeSource(code));
    } catch (e) {
      if (e.traceLine === undefined) throw e;
      return {
        steps: [{ ran: null, next: null, frames: [{ name: 'main', vars: {} }], assigned: [], note: '' }],
        error: { line: e.traceLine, message: e.message },
        finished: false
      };
    }
    var result = execute(program, maxSteps);
    // 「次に実行する行」は、次のステップが実行する行。最後は、エラーならその行、そうでなければなし
    var steps = result.steps;
    for (var i = 0; i < steps.length; i++) {
      if (i + 1 < steps.length) steps[i].next = steps[i + 1].ran;
      else steps[i].next = result.error ? result.error.line : null;
    }
    return { steps: steps, error: result.error, finished: result.error === null };
  }

  // ============================================================
  // 4. 予想する練習の問題づくりと、答え合わせ
  // ============================================================

  /**
   * 「いまのステップ k から、次の1行を動かす前」に出す予想の問題を作る。
   * 問う行（predictLines）を次に動かすときだけ問題になる。
   *   値の問題 … その行で代入される変数（配列以外）の、動かしたあとの値
   *   次の行の問題 … 条件の行を動かしたあと、次に実行される行
   *   番号の問題 … 配列の要素を書き換える（または末尾に足す）行で、何番の要素が変わるか
   * @param {object[]} steps run() の steps
   * @param {number} k いまのステップの番号
   * @param {number[]} predictLines 問う行の番号の一覧
   * @returns {(object|null)} 問題。{kind:'value', line, items:[{name, prev, answer}]} か {kind:'next', line, answer, note} か {kind:'index', line, name, answer}。問わないときは null
   */
  function predictQuestion(steps, k, predictLines) {
    var target = steps[k + 1];
    if (!target || predictLines.indexOf(target.ran) < 0) return null;
    if (target.call) return null; // 「呼び出す」ステップは問わない（中身の行で問う）
    var depth = target.frames.length - 1; // 問う行を動かしている呼び出しの深さ
    /** その呼び出しの表から変数を探す。なければ一番下の表（大域の変数がある所）。 */
    function valueOf(frames, name) {
      var f = frames[depth];
      if (f && Object.prototype.hasOwnProperty.call(f.vars, name)) return f.vars[name];
      return frames[0].vars[name];
    }
    var items = target.assigned.filter(function (name) { return !Array.isArray(valueOf(target.frames, name)); }).map(function (name) {
      return { name: name, prev: valueOf(steps[k].frames, name), answer: valueOf(target.frames, name) };
    });
    if (items.length > 0) return { kind: 'value', line: target.ran, items: items };
    if (target.branch) return { kind: 'next', line: target.ran, answer: target.next, note: target.note };
    if (target.assignedIndex !== undefined && target.assigned.length > 0) {
      return { kind: 'index', line: target.ran, name: target.assigned[0], answer: target.assignedIndex };
    }
    return null;
  }

  /**
   * 入力された文字を、答え合わせ用にそろえる（全角を半角に、いろいろなマイナス記号を - に、前後の空白を取る）。
   * @param {string} text 入力された文字
   * @returns {string} そろえた文字
   */
  function normalizeAnswerText(text) {
    return String(text).normalize('NFKC').trim().replace(/[−‐-―ー]/g, '-');
  }

  /**
   * 入力された文字が、数（整数か小数。マイナスつきも）の形か調べる。
   * @param {string} text 入力された文字
   * @returns {boolean} 数の形なら true
   */
  function isNumberText(text) {
    return /^-?[0-9]+(\.[0-9]+)?$/.test(normalizeAnswerText(text));
  }

  /**
   * 値の答えが合っているか調べる（全角でも、文字列の " の有無でも、真偽の「真・偽」でもよい）。
   * @param {*} answer 正しい値
   * @param {string} text 入力された文字
   * @returns {boolean} 合っていれば true
   */
  function matchValue(answer, text) {
    var raw = normalizeAnswerText(text);
    if (answer === '') return raw === '""'; // 空の文字列は "" と書いて答える
    var t = raw.replace(/^"(.*)"$/, '$1');
    if (t === '') return false;
    if (answer === undefined) return t === '未定義';
    if (typeof answer === 'number') return isNumberText(t) && Number(t) === answer;
    if (typeof answer === 'boolean') return answer ? (t === '真' || t === 'true') : (t === '偽' || t === 'false');
    return t === answer;
  }

  /**
   * はずれたときの、行番号つきの理由の文を作る。
   * @param {number} line 行番号
   * @param {{name:string, prev:*, answer:*}} item 値の問題の1つ
   * @returns {string} 例: 「4行目で a が 3 から 7 に変わるため」
   */
  function explainValue(line, item) {
    if (item.prev === item.answer) return line + '行目で ' + item.name + ' に代入されるのは ' + showValue(item.answer) + '（前と同じ値）のため';
    return line + '行目で ' + item.name + ' が ' + showValue(item.prev) + ' から ' + showValue(item.answer) + ' に変わるため';
  }

  // ============================================================
  // 5. 成績（端末だけ。localStorage のキー feTraceProgress に入れる）
  // ============================================================

  /** 外した問題を「もう一度」と出すまでの日数。 */
  var AGAIN_DAYS = 3;

  /**
   * 空の成績を作る。
   * @returns {{v:number, problems:object}} 空の成績
   */
  function emptyProgress() { return { v: 1, problems: {} }; }

  /**
   * 保存してある文字を成績に直す。読めないときは broken（上書きしないための印）。
   * @param {(string|null)} raw 保存してある文字
   * @returns {{progress:object, broken:boolean}} 成績と、読めなかったか
   */
  function parseProgress(raw) {
    if (raw === null || raw === undefined || raw === '') return { progress: emptyProgress(), broken: false };
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.v === 1 && obj.problems && typeof obj.problems === 'object' && !Array.isArray(obj.problems)) return { progress: obj, broken: false };
    } catch (e) { /* 読めない */ }
    return { progress: emptyProgress(), broken: true };
  }

  /**
   * 最後まで進んだことを成績に足す（もとの成績は変えず、新しい成績を返す）。
   * @param {object} progress いまの成績
   * @param {string} id 問題の id
   * @param {{mode:string, asked:number, correct:number, missed:string[]}} info mode は 'watch'（見る）か 'predict'（予想する）。missed は外した種類（'value' か 'next'）
   * @param {number} now いまの時刻（ミリ秒）
   * @returns {object} 新しい成績
   */
  function recordFinish(progress, id, info, now) {
    var next = { v: 1, problems: Object.assign({}, progress.problems) };
    var entry = Object.assign({}, next.problems[id] || {}, { doneAt: now });
    if (info.mode === 'predict') entry.predict = { asked: info.asked, correct: info.correct, missed: info.missed.slice(), at: now };
    next.problems[id] = entry;
    return next;
  }

  /**
   * 「本番の形（空欄を選ぶ）」の問題に答えたことを成績に足す（もとの成績は変えず、新しい成績を返す）。
   * @param {object} progress いまの成績
   * @param {string} id 問題の id
   * @param {boolean} ok 正解だったか
   * @param {number} now いまの時刻（ミリ秒）
   * @returns {object} 新しい成績
   */
  function recordBridge(progress, id, ok, now) {
    var next = { v: 1, problems: Object.assign({}, progress.problems) };
    var old = next.problems[id] || {};
    next.problems[id] = Object.assign({}, old, { doneAt: old.doneAt || now, bridge: { ok: ok, at: now } });
    return next;
  }

  /**
   * 一覧に出す、問題ごとの状態を文字で返す（色だけにしない）。
   * @param {object} progress 成績
   * @param {string} id 問題の id
   * @param {number} now いまの時刻（ミリ秒）
   * @returns {{label:string, again:boolean}} label: 「未挑戦」「できた（10/18）」「予想 5/7（10/18）」。本番の形に答えていれば「・本番の形 正解」を足す。again: 予想を外していて AGAIN_DAYS 日以上たった
   */
  function problemStatus(progress, id, now) {
    var e = progress.problems[id];
    if (!e) return { label: '未挑戦', again: false };
    var d = new Date(e.predict ? e.predict.at : e.doneAt);
    var date = '（' + (d.getMonth() + 1) + '/' + d.getDate() + '）';
    var bridge = e.bridge ? '・本番の形 ' + (e.bridge.ok ? '正解' : '不正解') : '';
    if (e.predict) {
      var again = e.predict.correct < e.predict.asked && now - e.predict.at >= AGAIN_DAYS * 86400000;
      return { label: '予想 ' + e.predict.correct + '/' + e.predict.asked + date + bridge, again: again };
    }
    return { label: 'できた' + date + bridge, again: false };
  }

  return {
    run: run,
    DEFAULT_MAX_STEPS: DEFAULT_MAX_STEPS,
    AGAIN_DAYS: AGAIN_DAYS,
    showValue: showValue,
    predictQuestion: predictQuestion,
    matchValue: matchValue,
    isNumberText: isNumberText,
    explainValue: explainValue,
    emptyProgress: emptyProgress,
    parseProgress: parseProgress,
    recordFinish: recordFinish,
    recordBridge: recordBridge,
    problemStatus: problemStatus
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = FeTrace; }
