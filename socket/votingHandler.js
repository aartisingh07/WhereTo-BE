// Map: roomId → { item, votes: Map(userId → vote), timerId, endTime }
const activeVotes = new Map();

const setupVotingHandler = (socket, io) => {
  const getTallies = (roomId) => {
    const session = activeVotes.get(roomId);
    if (!session) return { yes: 0, no: 0, maybe: 0 };

    const tallies = { yes: 0, no: 0, maybe: 0 };
    for (const vote of session.votes.values()) {
      if (tallies[vote] !== undefined) {
        tallies[vote]++;
      }
    }
    return tallies;
  };

  const getVoteList = (roomId) => {
    const session = activeVotes.get(roomId);
    if (!session) return {};
    return Object.fromEntries(session.votes);
  };

  // Start a new voting session
  socket.on('start-vote', ({ roomId, item }) => {
    if (!roomId || !item) return;

    // Clear existing voting timer if any
    const existing = activeVotes.get(roomId);
    if (existing && existing.timerId) {
      clearTimeout(existing.timerId);
    }

    const duration = 30000; // 30 seconds
    const endTime = Date.now() + duration;

    // Set auto-end timer
    const timerId = setTimeout(() => {
      endVotingSession(roomId);
    }, duration);

    activeVotes.set(roomId, {
      item,
      votes: new Map(),
      timerId,
      endTime,
    });

    io.to(roomId).emit('vote-started', {
      item,
      endTime,
      votes: {},
      tallies: { yes: 0, no: 0, maybe: 0 },
    });

    console.log(`🗳️ Voting started in room ${roomId} for: ${item.name || item.title}`);
  });

  // Cast a vote
  socket.on('cast-vote', ({ roomId, vote }) => {
    if (!roomId || !vote) return;
    const session = activeVotes.get(roomId);
    if (!session) return;

    // Register user's vote
    session.votes.set(socket.userId, vote);

    io.to(roomId).emit('vote-update', {
      votes: getVoteList(roomId),
      tallies: getTallies(roomId),
    });
  });

  // Manually end a voting session (host only)
  socket.on('end-vote', ({ roomId }) => {
    if (!roomId) return;
    endVotingSession(roomId);
  });

  const endVotingSession = (roomId) => {
    const session = activeVotes.get(roomId);
    if (!session) return;

    if (session.timerId) {
      clearTimeout(session.timerId);
    }

    const tallies = getTallies(roomId);
    const votes = getVoteList(roomId);

    // Determine result
    let result = 'rejected';
    // If yes votes strictly exceed no votes, it passes
    if (tallies.yes > tallies.no) {
      result = 'approved';
    } else if (tallies.yes === 0 && tallies.no === 0 && tallies.maybe === 0) {
      result = 'no-votes';
    }

    io.to(roomId).emit('vote-result', {
      item: session.item,
      votes,
      tallies,
      result,
    });

    activeVotes.delete(roomId);
    console.log(`🗳️ Voting ended in room ${roomId}. Result: ${result}`);
  };
};

const getActiveVoteSession = (roomId) => {
  const session = activeVotes.get(roomId);
  if (!session) return null;
  if (Date.now() >= session.endTime) {
    return null;
  }
  const tallies = { yes: 0, no: 0, maybe: 0 };
  for (const vote of session.votes.values()) {
    if (tallies[vote] !== undefined) {
      tallies[vote]++;
    }
  }
  return {
    item: session.item,
    endTime: session.endTime,
    votes: Object.fromEntries(session.votes),
    tallies,
  };
};

module.exports = setupVotingHandler;
module.exports.getActiveVoteSession = getActiveVoteSession;
