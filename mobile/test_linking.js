const getStateFromPath = require('@react-navigation/core/lib/commonjs/getStateFromPath.js').default;

const config1 = {
  screens: {
    Customer: {
      screens: {
        Home: {
          screens: {
            TurfDetail: 'turf/:id',
            PlayerDetail: 'player/:id',
            Notifications: 'notifications',
          },
        },
        'My Cricket': {
          screens: {
            TournamentDetail: 'tournament/:tournamentId',
            MatchSummary: 'match/:id',
            AuctionRegistration: 'tournament/:tournamentId/register',
          },
        },
      },
    },
  },
};

const config2 = {
  screens: {
    Customer: {
      initialRouteName: 'Home',
      screens: {
        Home: {
          initialRouteName: 'HomeMain',
          screens: {
            TurfDetail: 'turf/:id',
            PlayerDetail: 'player/:id',
            Notifications: 'notifications',
          },
        },
        'My Cricket': {
          initialRouteName: 'MyCricketMain',
          screens: {
            TournamentDetail: 'tournament/:tournamentId',
            MatchSummary: 'match/:id',
            AuctionRegistration: 'tournament/:tournamentId/register',
          },
        },
      },
    },
  },
};

console.log("=== Config 1 result ===");
console.log(JSON.stringify(getStateFromPath('match/6a76cdb29f92d5fe8a253035', config1), null, 2));

console.log("\n=== Config 2 (with initialRouteName) result ===");
console.log(JSON.stringify(getStateFromPath('match/6a76cdb29f92d5fe8a253035', config2), null, 2));
