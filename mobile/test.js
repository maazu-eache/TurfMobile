const payload = { currentOverBalls: [] };
const state = { currentOverBalls: [1, 2, 3] };
console.log(payload.currentOverBalls || state.currentOverBalls);
