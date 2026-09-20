import { db } from './firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

export const seedDemoTournament = async (userId: string) => {
  try {
    // 1. Create Tournament
    const tournamentRef = await addDoc(collection(db, 'tournaments'), {
      name: "FC Arena World Cup 2026",
      format: "group_knockout",
      status: "ongoing",
      description: "The ultimate 32-player elite championship. From groups to the global final.",
      createdBy: userId,
      createdAt: serverTimestamp()
    });

    const tournamentId = tournamentRef.id;

    // 2. Generate 32 Participants
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const participantIds: string[] = [];
    const groupParticipants: Record<string, string[]> = {};

    for (const group of groups) {
      groupParticipants[group] = [];
      for (let i = 1; i <= 4; i++) {
        const teamName = `Elite ${group}${i}`;
        const playerName = `Player ${group}${i}`;
        const pRef = await addDoc(collection(db, 'tournaments', tournamentId, 'participants'), {
          userId: `demo_user_${group}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          displayName: playerName,
          teamName: teamName,
          ovr: 100 + Math.floor(Math.random() * 20),
          group: group,
          registeredAt: serverTimestamp(),
          stats: { 
            played: 3, 
            won: i === 1 ? 3 : (i === 2 ? 2 : (i === 3 ? 1 : 0)), 
            lost: i === 4 ? 3 : (i === 3 ? 2 : (i === 2 ? 1 : 0)), 
            drawn: 0, 
            goalsFor: 10 - i, 
            goalsAgainst: i * 2, 
            points: i === 1 ? 9 : (i === 2 ? 6 : (i === 3 ? 3 : 0)) 
          }
        });
        participantIds.push(pRef.id);
        groupParticipants[group].push(pRef.id);
      }
    }

    // 3. Create Group Stage Matches (Samples)
    for (const group of groups) {
      const p = groupParticipants[group];
      // Match 1 vs 2
      await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
        homeParticipantId: p[0],
        awayParticipantId: p[1],
        homeScore: 3,
        awayScore: 1,
        status: 'completed',
        stage: 'group',
        group: group,
        updatedAt: serverTimestamp()
      });
      // Match 3 vs 4
      await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
        homeParticipantId: p[2],
        awayParticipantId: p[3],
        homeScore: 2,
        awayScore: 0,
        status: 'completed',
        stage: 'group',
        group: group,
        updatedAt: serverTimestamp()
      });
    }

    // 4. Create Round of 16 (Knockout Roadmap)
    // We'll simulate that the top 2 from each group advanced
    const r16Matches = [
      { h: groupParticipants['A'][0], a: groupParticipants['B'][1] },
      { h: groupParticipants['C'][0], a: groupParticipants['D'][1] },
      { h: groupParticipants['E'][0], a: groupParticipants['F'][1] },
      { h: groupParticipants['G'][0], a: groupParticipants['H'][1] },
      { h: groupParticipants['B'][0], a: groupParticipants['A'][1] },
      { h: groupParticipants['D'][0], a: groupParticipants['C'][1] },
      { h: groupParticipants['F'][0], a: groupParticipants['E'][1] },
      { h: groupParticipants['H'][0], a: groupParticipants['G'][1] },
    ];

    const qfIds: string[] = [];
    for (let i = 0; i < r16Matches.length; i++) {
      const match = r16Matches[i];
      await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
        homeParticipantId: match.h,
        awayParticipantId: match.a,
        homeScore: 2,
        awayScore: 1,
        status: 'completed',
        stage: 'round_of_16',
        updatedAt: serverTimestamp()
      });
      qfIds.push(match.h); // Simulating home team won
    }

    // 5. Create Quarter Finals
    const sfIds: string[] = [];
    for (let i = 0; i < qfIds.length; i += 2) {
      await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
        homeParticipantId: qfIds[i],
        awayParticipantId: qfIds[i+1],
        homeScore: 1,
        awayScore: 0,
        status: 'completed',
        stage: 'quarter_final',
        updatedAt: serverTimestamp()
      });
      sfIds.push(qfIds[i]);
    }

    // 6. Create Semi Finals
    const fIds: string[] = [];
    for (let i = 0; i < sfIds.length; i += 2) {
      await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
        homeParticipantId: sfIds[i],
        awayParticipantId: sfIds[i+1],
        homeScore: 3,
        awayScore: 2,
        status: 'completed',
        stage: 'semi_final',
        updatedAt: serverTimestamp()
      });
      fIds.push(sfIds[i]);
    }

    // 7. Create The Grand Final (Scheduled)
    await addDoc(collection(db, 'tournaments', tournamentId, 'matches'), {
      homeParticipantId: fIds[0],
      awayParticipantId: fIds[1],
      status: 'scheduled',
      stage: 'final',
      updatedAt: serverTimestamp()
    });

    return tournamentId;
  } catch (error) {
    console.error("Error seeding demo:", error);
    throw error;
  }
};
