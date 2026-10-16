/**
 * questions-sample.js … 画面確認用の「架空の」サンプル問題（12問）。
 * 本物の問題（IPA 公開問題）は、あとで年度ごとのファイルとして足す。
 * 1問の形: id, category(technology/management/strategy), sub(小分野), text, choices(4つ), answerIndex(正解の番号 0〜3), explanation, isSample, sourceUrl
 */
const FE_QUESTIONS = [
  { id: 'S001', category: 'technology', sub: '基礎理論', text: '2進数 10110 を10進数で表したものはどれか。', choices: ['20', '22', '26', '44'], answerIndex: 1, explanation: '各けたの重みは右から 1・2・4・8・16。10110 は 16＋4＋2＝22 です。', isSample: true, sourceUrl: '' },
  { id: 'S002', category: 'technology', sub: '基礎理論', text: '16進数 2F を10進数で表したものはどれか。', choices: ['15', '32', '47', '63'], answerIndex: 2, explanation: '2F の 2 は 16 が 2 個で 32、F は 15。32＋15＝47 です。', isSample: true, sourceUrl: '' },
  { id: 'S003', category: 'technology', sub: '基礎理論', text: '2進数 1100 と 1010 のAND（論理積）の結果はどれか。', choices: ['1000', '1110', '0110', '0100'], answerIndex: 0, explanation: 'AND は両方が1のけただけ1になります。左から 1・0・0・0 で 1000 です。', isSample: true, sourceUrl: '' },
  { id: 'S004', category: 'technology', sub: 'コンピュータ構成', text: 'MTBF が 90 時間、MTTR が 10 時間の装置の稼働率はどれか。', choices: ['0.1', '0.8', '0.9', '0.99'], answerIndex: 2, explanation: '稼働率＝MTBF÷(MTBF＋MTTR)＝90÷100＝0.9 です。', isSample: true, sourceUrl: '' },
  { id: 'S005', category: 'technology', sub: 'データベース', text: '関係データベースの表で、主キーの説明として適切なものはどれか。', choices: ['他の表の列を参照する列', '表の中の行を1つに特定できる列（の組）', '同じ値を何度も入れられる列', '値を入れなくてもよい列'], answerIndex: 1, explanation: '主キーは、行を1つに特定するための列で、重複や空の値は認められません。', isSample: true, sourceUrl: '' },
  { id: 'S006', category: 'technology', sub: 'ネットワーク', text: 'HTTPS で通常使われるポート番号はどれか。', choices: ['21', '25', '80', '443'], answerIndex: 3, explanation: '21 は FTP、25 は SMTP、80 は HTTP、443 が HTTPS です。', isSample: true, sourceUrl: '' },
  { id: 'S007', category: 'technology', sub: 'セキュリティ', text: '共通鍵暗号方式の説明として適切なものはどれか。', choices: ['暗号化と復号に異なる鍵を使う', '暗号化と復号に同じ鍵を使う', '鍵を使わずに暗号化する', '復号に公開鍵を使う'], answerIndex: 1, explanation: '共通鍵暗号方式は、暗号化と復号に同じ鍵を使います。異なる鍵を使うのは公開鍵暗号方式です。', isSample: true, sourceUrl: '' },
  { id: 'S008', category: 'technology', sub: 'アルゴリズム', text: '昇順に並んだ8個のデータから二分探索で目的の値を探すとき、最大で何回比較が必要か。', choices: ['2回', '3回', '4回', '8回'], answerIndex: 2, explanation: '1回比較するごとに候補が約半分になります。8→4→2→1 と進み、最大で4回です。', isSample: true, sourceUrl: '' },
  { id: 'S009', category: 'management', sub: 'プロジェクトマネジメント', text: 'プロジェクトのクリティカルパスの説明として適切なものはどれか。', choices: ['作業の費用が最も高い経路', '作業に余裕が最も多い経路', '全体の所要日数を決める、最も長い経路', '担当者が最も多い経路'], answerIndex: 2, explanation: 'クリティカルパスは、プロジェクト全体の所要日数を決める、最も長い作業の経路です。この経路が遅れると全体が遅れます。', isSample: true, sourceUrl: '' },
  { id: 'S010', category: 'management', sub: 'サービスマネジメント', text: 'SLA（サービスレベルアグリーメント）の説明として適切なものはどれか。', choices: ['システムの設計書の書き方の規則', 'ソフトウェアの利用許諾契約', '障害時のデータ復旧手順書', 'サービスの品質について提供者と利用者が結ぶ合意'], answerIndex: 3, explanation: 'SLA は、サービスの品質（稼働率や応答時間など）について、提供者と利用者があらかじめ決めておく合意です。', isSample: true, sourceUrl: '' },
  { id: 'S011', category: 'strategy', sub: '経営戦略', text: '投資額に対して得られた利益の割合を表す指標はどれか。', choices: ['KPI', 'ROI', 'SLA', 'BPR'], answerIndex: 1, explanation: 'ROI（投資利益率）＝利益÷投資額。KPI は重要業績評価指標、BPR は業務プロセスの見直しです。', isSample: true, sourceUrl: '' },
  { id: 'S012', category: 'strategy', sub: '経営戦略', text: 'SWOT分析で、外部環境の好ましい要因を表すのはどれか。', choices: ['強み', '弱み', '機会', '脅威'], answerIndex: 2, explanation: 'S＝強み、W＝弱み、O＝機会、T＝脅威。強みと弱みは内部、機会と脅威は外部の要因です。', isSample: true, sourceUrl: '' }
];

if (typeof module !== 'undefined' && module.exports) { module.exports = FE_QUESTIONS; }
