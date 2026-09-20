import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { TournamentList } from './components/TournamentList';
import { TournamentDetail } from './components/TournamentDetail';
import { Layout } from './components/Layout';
import { Profile } from './components/Profile';

function AppContent() {
  const { user, loading } = useFirebase();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'arena' | 'standings' | 'bracket' | 'profile'>('arena');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1221]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/5 border-t-amber-500 rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] italic">Loading FC Arena VS...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (activeTab === 'profile') {
      return <Profile onSelectTournament={(id) => {
        setSelectedTournamentId(id);
        setActiveTab('arena');
      }} />;
    }

    if ((activeTab === 'standings' || activeTab === 'bracket') && !selectedTournamentId) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center mb-6">
            <Target className="w-10 h-10 text-zinc-700" />
          </div>
          <h2 className="text-2xl font-display font-black text-white uppercase italic mb-2">Select Arena</h2>
          <p className="text-zinc-500 text-sm max-w-xs italic mb-8">Please select an active tournament from the Arena to view detailed standings or brackets.</p>
          <button onClick={() => setActiveTab('arena')} className="px-8 py-3 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] italic border border-white/5 hover:bg-white/10 transition-all">Go to Arena</button>
        </div>
      );
    }

    if (selectedTournamentId) {
      return (
        <TournamentDetail 
          tournamentId={selectedTournamentId} 
          onBack={() => setSelectedTournamentId(null)}
          initialTab={activeTab === 'standings' ? 'players' : activeTab === 'bracket' ? 'knockout' : 'group'}
        />
      );
    }

    return <TournamentList onSelectTournament={(id) => {
      setSelectedTournamentId(id);
      setActiveTab('arena');
    }} />;
  };

  return (
    <Layout 
      onBack={() => setSelectedTournamentId(null)} 
      isDetail={!!selectedTournamentId}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onSelectTournament={(id) => {
        setSelectedTournamentId(id);
        setActiveTab('arena');
      }}
    >
      {renderContent()}
    </Layout>
  );
}

function Target(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
