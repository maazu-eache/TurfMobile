export const getPlayerTags = (player) => {
  const tags = [];
  if (!player) return tags;
  
  // Batting tags
  const batRuns = player.batting?.runs || 0;
  const batBalls = player.batting?.balls || 0;
  const batFours = player.batting?.fours || 0;
  const batSixes = player.batting?.sixes || 0;
  const sr = batBalls > 0 ? (batRuns / batBalls) * 100 : 0;
  const boundaryPercentage = batRuns > 0 ? ((batFours * 4 + batSixes * 6) / batRuns) * 100 : 0;

  let hasBattingTag = false;
  if (batBalls >= 10) {
    if (sr > 150 && boundaryPercentage > 50) { tags.push({ name: 'Destroyer', type: 'batting', desc: 'An aggressive batter who dominates bowlers with a high boundary percentage.' }); hasBattingTag = true; }
    else if (sr > 130) { tags.push({ name: 'Hard Hitter', type: 'batting', desc: 'A powerful striker who consistently scores at a quick pace.' }); hasBattingTag = true; }
    else if (sr > 100 && boundaryPercentage < 40) { tags.push({ name: 'Accumulator', type: 'batting', desc: 'Loves to rotate strike and build innings more than hitting boundaries.' }); hasBattingTag = true; }
    else if (sr <= 100) { tags.push({ name: 'Steady Batter', type: 'batting', desc: 'A reliable player who focuses on preserving their wicket.' }); hasBattingTag = true; }
  }

  if (!hasBattingTag) {
    tags.push({ name: 'Classicist', type: 'batting', desc: 'A traditional batter who plays according to the situation.' });
  }

  // Bowling tags
  const bowlRuns = player.bowling?.runs || 0;
  const bowlWickets = player.bowling?.wickets || 0;
  const bowlOvers = player.bowling?.overs || 0;
  const econ = bowlOvers > 0 ? bowlRuns / bowlOvers : 0;

  let hasBowlingTag = false;
  if (bowlOvers >= 1) { 
    if (bowlWickets >= 2 && econ <= 6) { tags.push({ name: 'Spearhead', type: 'bowling', desc: 'The lead bowler who takes crucial wickets while keeping runs tight.' }); hasBowlingTag = true; }
    else if (bowlWickets >= 2 && econ <= 8.5) { tags.push({ name: 'Strike Bowler', type: 'bowling', desc: 'A genuine wicket-taker who consistently breaks partnerships.' }); hasBowlingTag = true; }
    else if (bowlWickets >= 2 && econ > 8.5) { tags.push({ name: 'Wildcard', type: 'bowling', desc: 'An unpredictable bowler who might leak runs but has a knack for taking wickets.' }); hasBowlingTag = true; }
    else if (econ <= 6) { tags.push({ name: 'Economist', type: 'bowling', desc: 'A highly disciplined bowler who restricts the flow of runs.' }); hasBowlingTag = true; }
    else if (econ <= 8.5) { tags.push({ name: 'Workhorse', type: 'bowling', desc: 'A reliable bowler who consistently puts in the hard overs for the team.' }); hasBowlingTag = true; }
  }

  if (!hasBowlingTag) {
    tags.push({ name: 'Aspirant', type: 'bowling', desc: 'A developing bowler finding their rhythm.' });
  }

  return tags;
};
