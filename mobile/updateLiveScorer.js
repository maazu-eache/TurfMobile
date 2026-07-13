const fs = require('fs');

let content = fs.readFileSync('./src/features/match/screens/LiveScorerScreen.js', 'utf8');

// 1. Add io and setInitialPlayers imports
if(!content.includes("import io from 'socket.io-client'")) {
    content = content.replace(
        "import api from '../../api/axios';",
        "import api from '../../api/axios';\nimport io from 'socket.io-client';"
    );
    // actually api is not imported, let's just add it
    content = content.replace(
        "import { useDispatch, useSelector } from 'react-redux';",
        "import { useDispatch, useSelector } from 'react-redux';\nimport io from 'socket.io-client';\nimport api from '../../api/axios';"
    );
}

content = content.replace(
    "import { scoreBall, undoBall, fetchLiveState, addMatchScorer }",
    "import { scoreBall, undoBall, fetchLiveState, addMatchScorer, setInitialPlayers, setLiveState }"
);

// 2. Replace polling with socket
const oldUseEffect = `  // Auto-refresh using REST if Socket fails (Socket integration handles realtime in the component usually, but we fallback here)
  useEffect(() => {
    dispatch(fetchLiveState(matchId));
    const interval = setInterval(() => {
      dispatch(fetchLiveState(matchId));
    }, 10000); // Poll every 10s as a fallback
    return () => clearInterval(interval);
  }, [dispatch, matchId]);`;

const newUseEffect = `  // Socket.io for Realtime updates
  useEffect(() => {
    dispatch(fetchLiveState(matchId));
    
    const socketUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
    const socket = io(socketUrl);
    
    socket.emit('join_match', { matchId });
    socket.on('score_update', (data) => {
      dispatch(setLiveState(data));
    });
    
    return () => {
      socket.emit('leave_match', { matchId });
      socket.disconnect();
    };
  }, [dispatch, matchId]);

  // Player Selection Modal State
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [selectedStriker, setSelectedStriker] = useState('');
  const [selectedNonStriker, setSelectedNonStriker] = useState('');
  const [selectedBowler, setSelectedBowler] = useState('');

  useEffect(() => {
    if (liveState && liveState.match?.status === 'in_progress') {
       if (!liveState.striker || !liveState.nonStriker || !liveState.bowler) {
           if (isScorer) setShowPlayerSelect(true);
       } else {
           setShowPlayerSelect(false);
       }
    }
  }, [liveState, isScorer]);

  const handleSetPlayers = async () => {
    if (!selectedStriker || !selectedNonStriker || !selectedBowler) {
       return showCustomAlert('Error', 'Please select all three players');
    }
    if (selectedStriker === selectedNonStriker) {
       return showCustomAlert('Error', 'Striker and Non-Striker cannot be the same');
    }
    
    const res = await dispatch(setInitialPlayers({ 
      matchId, 
      striker: selectedStriker, 
      nonStriker: selectedNonStriker, 
      bowler: selectedBowler 
    }));
    
    if (setInitialPlayers.fulfilled.match(res)) {
       setShowPlayerSelect(false);
    } else {
       showCustomAlert('Error', res.payload);
    }
  };`;

content = content.replace(oldUseEffect, newUseEffect);

// 3. Add Player Selection Modal JSX
const playerModalJSX = `
      {/* Player Selection Modal */}
      <Modal visible={showPlayerSelect} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select Players</Text>
            <Text style={styles.modalSub}>Choose Striker, Non-Striker, and Bowler to start scoring.</Text>
            <ScrollView style={{ width: '100%', marginTop: 10 }}>
              
              <Text style={{color: '#FFF', fontWeight: 'bold', marginBottom: 5}}>Striker (Batting Team)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                {match?.playingXI?.[liveState?.battingTeam === match?.teamA?._id ? 'teamA' : 'teamB']?.map(p => (
                  <TouchableOpacity key={'s_'+p._id} style={[styles.playerChip, selectedStriker === p._id && styles.playerChipActive]} onPress={() => setSelectedStriker(p._id)}>
                    <Text style={[styles.playerChipText, selectedStriker === p._id && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{color: '#FFF', fontWeight: 'bold', marginBottom: 5}}>Non-Striker (Batting Team)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                {match?.playingXI?.[liveState?.battingTeam === match?.teamA?._id ? 'teamA' : 'teamB']?.map(p => (
                  <TouchableOpacity key={'ns_'+p._id} style={[styles.playerChip, selectedNonStriker === p._id && styles.playerChipActive]} onPress={() => setSelectedNonStriker(p._id)}>
                    <Text style={[styles.playerChipText, selectedNonStriker === p._id && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{color: '#FFF', fontWeight: 'bold', marginBottom: 5}}>Bowler (Bowling Team)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                {match?.playingXI?.[liveState?.battingTeam === match?.teamA?._id ? 'teamB' : 'teamA']?.map(p => (
                  <TouchableOpacity key={'b_'+p._id} style={[styles.playerChip, selectedBowler === p._id && styles.playerChipActive]} onPress={() => setSelectedBowler(p._id)}>
                    <Text style={[styles.playerChipText, selectedBowler === p._id && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSetPlayers}>
              <Text style={[styles.actionBtnText, styles.textDark]}>Start Scoring</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
`;

content = content.replace("{/* Add Scorer Modal */}", playerModalJSX + "\n      {/* Add Scorer Modal */}");

// Add player chip styles if missing
if(!content.includes("playerChip:")) {
    const stylesIndex = content.indexOf("const styles = StyleSheet.create({");
    const styleToAdd = `
  playerChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerChipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  playerChipTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },`;
    content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + styleToAdd);
}

fs.writeFileSync('./src/features/match/screens/LiveScorerScreen.js', content);
console.log('LiveScorerScreen.js updated successfully!');
