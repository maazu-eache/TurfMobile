const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/features/match/screens/MatchSummaryScreen.js', 'utf-8');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator']
  });
  console.log('No syntax errors found by Babel!');
} catch (e) {
  console.error(e);
}
