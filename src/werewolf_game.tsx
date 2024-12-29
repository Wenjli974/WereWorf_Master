import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './components/Card';
import { Button } from './components/Button';
import { Input } from './components/Input';
//import { AlertDialog, AlertDialogAction } from './components/AlertDialog';
import { History, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
//import { Alert, AlertDescription, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './components/AlertDialog';

interface Player {
  id: number;
  role: string;
  alive: boolean;
  votedBy: number[];
}

interface GameEvent {
  time: string;
  event: string;
  privateInfo?: string;
}

const WerewolfGame = () => {
  // 游戏基础状态
  const [gameStage, setGameStage] = useState('setup'); // setup, assign, night, day, vote, end
  const [roundNumber, setRoundNumber] = useState(1);
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameHistory, setGameHistory] = useState<GameEvent[]>([]);
  const [dayPhase, setDayPhase] = useState('discussion'); // discussion, vote
  
  // 夜晚阶段状态
  const [nightPhase, setNightPhase] = useState('waiting');
  const [currentActionPlayer, setCurrentActionPlayer] = useState<number | null>(null);
  const [pendingDeath, setPendingDeath] = useState<number | null>(null);
  const [witchPotions, setWitchPotions] = useState({ save: true, poison: true });
  const [nightDeaths, setNightDeaths] = useState<number[]>([]);
  const [currentVotes, setCurrentVotes] = useState<Record<string, number>>({});
  
  // 计时器状态
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // 游戏配置
  const roles = ['狼人', '平民', '女巫', '预言家'];
  const nightOrder = ['werewolf', 'witch', 'seer'];

  // 1. 首先添加一个背景色状态来反映昼夜
  const [bgColor, setBgColor] = useState('bg-white');

  // 添加语音控制状态
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false);
  const speechSynthesis = window.speechSynthesis;
  
  // 语音播报函数
  const speak = (text: string) => {
    if (!isSpeechEnabled || isCurrentlySpeaking) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.5;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsCurrentlySpeaking(true);
    utterance.onend = () => setIsCurrentlySpeaking(false);
    utterance.onerror = () => setIsCurrentlySpeaking(false);
    
    speechSynthesis.speak(utterance);
  };

  // 停止所有语音播报
  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsCurrentlySpeaking(false);
  };

  // 初始化游戏
  const initializeGame = (count: number) => {
    if (count < 6 || count > 12) {
      alert('游戏人数必须在6-12人之间');
      return;
    }
    
    setPlayerCount(count);
    setRoundNumber(1);
    const initialPlayers = Array(count).fill(null).map((_, index) => ({
      id: index + 1,
      role: '',
      alive: true,
      votedBy: [],
    }));
    setPlayers(initialPlayers);
    setGameStage('assign');
    resetNightState();
    addToHistory('游戏开始！第1回合');
  };

  // 开始新的回合
  const startNewRound = () => {
    setRoundNumber(prev => prev + 1);
    addToHistory(`第${roundNumber + 1}回合开始`);
    startNight();
  };

  // 重置夜晚状态
  const resetNightState = () => {
    setNightPhase('waiting');
    setCurrentActionPlayer(null);
    setPendingDeath(null);
    setNightDeaths([]);
    setCurrentVotes({});
  };

  // 分配角色
  const assignRole = (playerId: number, role: string) => {
    const updatedPlayers = players.map(player => 
      player.id === playerId ? { ...player, role } : player
    );
    setPlayers(updatedPlayers);
    
    // 检查是否所有玩家都已分配角色
    if (updatedPlayers.every(p => p.role)) {
      startNight();
      addToHistory('身份分配完成，天黑请闭眼');
    }
  };

  // 开始夜晚阶段
  const startNight = () => {
    setGameStage('night');
    setNightPhase('werewolf-confirm');
    setBgColor('bg-gray-900'); // 夜晚使用深色背景
    addToHistory('夜晚降临，狼人请睁眼');
  };

  // 开始白天阶段
  const startDay = () => {
    setGameStage('day');
    setDayPhase('discussion');
    setBgColor('bg-blue-100'); // 白天使用浅色背景
    addToHistory('天亮了，开始讨论');
    startTimer(600);
  };

  // 手动结束讨论阶段
  const endDiscussion = () => {
    setTimer(0);
    setTimerActive(false);
    setDayPhase('vote');
    addToHistory('讨论阶段结束，进入投票阶段');
  };

  // 确认角色行动
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);

  const handleTargetSelection = (targetId: string) => {
    setSelectedTarget(parseInt(targetId));
  };

  // 确认夜晚行动
  const confirmNightTarget = () => {
    if (!selectedTarget) return;

    switch (nightPhase) {
      case 'werewolf-action':
        setPendingDeath(selectedTarget);
        addToHistory('狼人完成了行动');
        moveToNextNightPhase();
        break;
      case 'witch-action':
        handleWitchAction('save', selectedTarget);
        break;
      case 'seer-action': {
        const targetPlayer = players.find(p => p.id === selectedTarget);
        if (!targetPlayer) return;
        const isWerewolf = targetPlayer.role === '狼人';
        
        const [seerResult, setSeerResult] = useState<string>('');
        const [showSeerResult, setShowSeerResult] = useState<boolean>(false);
        
        addToHistory('预言家完成了查验');
        moveToNextNightPhase();
        break;
      }
    }
    setSelectedTarget(null);
  };

  // 处理女巫行动
  const handleWitchAction = (action: string, targetId: number) => {
    switch (action) {
      case 'save':
        if (witchPotions.save) {
          setPendingDeath(null);
          setWitchPotions(prev => ({ ...prev, save: false }));
          addToHistory('女巫完成了操作');
        }
        break;
      case 'poison':
        if (witchPotions.poison) {
          setNightDeaths(prev => [...prev, targetId]);
          setWitchPotions(prev => ({ ...prev, poison: false }));
          addToHistory('女巫完成了操作');
        }
        break;
      case 'skip':
        addToHistory('女巫完成了操作');
        break;
    }
    moveToNextNightPhase();
  };

  // 处理白天投票
  const [votedPlayer, setVotedPlayer] = useState<number | null>(null);

  const handleDayVote = (targetId: number) => {
    setVotedPlayer(targetId);
  };

  // 确认投票结果
  const confirmVoteResult = () => {
    if (!votedPlayer) return;
    
    const updatedPlayers = players.map(player => ({
      ...player,
      alive: player.id === votedPlayer ? false : player.alive
    }));
    
    setPlayers(updatedPlayers);
    addToHistory(`${votedPlayer}号玩家被投票出局`);
    playSound('death');
    
    // 检查游戏状态
    const gameStatus = checkGameState();
    if (gameStatus) {
      setGameStage('end');
      addToHistory(`游戏结束，${gameStatus}`);
    } else {
      startNewRound();
    }
    
    setVotedPlayer(null);
    setCurrentVotes({});
  };

  // 处理白天投票结果
  const processDayVoteResults = () => {
    const voteCount: { [key: string]: number } = {};
    Object.values(currentVotes).forEach(targetId => {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    });
    
    let maxVotes = 0;
    let votedOut: number | null = null;
    Object.entries(voteCount).forEach(([playerId, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        votedOut = parseInt(playerId);
      }
    });
    
    if (votedOut) {
      const updatedPlayers = players.map(player => ({
        ...player,
        alive: player.id === votedOut ? false : player.alive
      }));
      setPlayers(updatedPlayers);
      addToHistory(`${votedOut}号玩家被投票出局`);
      playSound('death');
      
      // 立即检查游戏状态
      const gameStatus = checkGameState();
      if (gameStatus) {
        setGameStage('end');
        addToHistory(`游戏结束，${gameStatus}`);
      } else {
        startNewRound();
      }
    }
  };

  // 移动到下一个夜晚阶段
  const moveToNextNightPhase = () => {
    const phases = {
      'werewolf-confirm': 'witch-confirm',
      'werewolf-action': 'witch-confirm',
      'witch-confirm': 'seer-confirm',
      'witch-action': 'seer-confirm',
      'seer-confirm': 'end',
      'seer-action': 'end'
    };

    const nextPhase = phases[nightPhase as keyof typeof phases];
    
    if (nextPhase === 'end') {
      endNight();
    } else {
      setNightPhase(nextPhase);
      switch (nextPhase) {
        case 'witch-confirm':
          if (players.some(p => p.role === '女巫' && p.alive)) {
            addToHistory('女巫请睁眼');
          } else {
            addToHistory('女巫已出局，跳过女巫回合');
            //moveToNextNightPhase();
          }
          break;
        case 'seer-confirm':
          if (players.some(p => p.role === '预言家' && p.alive)) {
            addToHistory('预言家请睁眼');
          } else {
            addToHistory('预言家已出局，跳过预言家回合');
            //moveToNextNightPhase();
          }
          break;
      }
    }
  };

  // 结束夜晚阶段
  const endNight = () => {
    // 处理出局玩家
    const eliminatedPlayers = [...(pendingDeath ? [pendingDeath] : []), ...nightDeaths];
    if (eliminatedPlayers.length > 0) {
      const updatedPlayers = players.map(player => ({
        ...player,
        alive: !eliminatedPlayers.includes(player.id)
      }));
      setPlayers(updatedPlayers);
      eliminatedPlayers.forEach(id => {
        addToHistory(`${id}号玩家出局`);
        playSound('death');
      });
    } else {
      addToHistory('平安夜，无人出局');
    }

    // 检查游戏状态
    const gameStatus = checkGameState();
    if (gameStatus) {
      setGameStage('end');
      addToHistory(`游戏结束，${gameStatus}`);
    } else {
      startDay();
    }
  };

  // 检查游戏状态
  const checkGameState = () => {
    const aliveWolves = players.filter(p => p.role === '狼人' && p.alive);
    const aliveGoodGuys = players.filter(p => p.role !== '狼人' && p.alive);
    
    // 如果存活的玩家全是狼人，狼人胜利
    if (aliveWolves.length > 0 && aliveGoodGuys.length === 0) {
      return '狼人胜利';
    }
    // 如果存活的玩家全是好人，好人胜利
    else if (aliveGoodGuys.length > 0 && aliveWolves.length === 0) {
      return '好人胜利';
    }
    // 如果双方都还有人存活，游戏继续
    return null;
  };

  // 开始计时器
  const startTimer = (seconds: number) => {
    setTimer(seconds);
    setTimerActive(true);
  };

  // 计时器效果
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
      // 时间到，根据当前阶段执行相应操作
      if (gameStage === 'day' && dayPhase === 'discussion') {
        setDayPhase('vote');
        addToHistory('讨论时间结束，开始投票');
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  // 添加历史记录
  const addToHistory = (event: string, privateInfo?: string) => {
    const eventText = event + (event.includes('出局') ? ' (已出局)' : '');
    setGameHistory(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      event: eventText,
      privateInfo
    }]);
    
    // 播报事件内容
    speak(eventText);
  };

  // 播放音效
  const playSound = (type: string) => {
    const audio = new Audio();
    switch(type) {
      case 'timer-start':
        audio.src = '/sounds/start.mp3';
        break;
      case 'timer-end':
        audio.src = '/sounds/end.mp3';
        break;
      case 'death':
        audio.src = '/sounds/death.mp3';
        break;
    }
    audio.play().catch(e => console.log('播放音效失败', e));
  };

  const confirmNightAction = (isConfirmed: boolean) => {
    if (isConfirmed) {
      switch (nightPhase) {
        case 'werewolf-confirm':
          setNightPhase('werewolf-action');
          addToHistory('狼人请选择要击杀的目标');
          break;
        case 'witch-confirm':
          setNightPhase('witch-action');
          if (pendingDeath) {
            addToHistory('女巫请选择是否使用药水');
          } else {
            addToHistory('女巫请选择是否使用药水');
          }
          break;
        case 'seer-confirm':
          setNightPhase('seer-action');
          addToHistory('预言家请选择要查验的对象');
          break;
        default:
          moveToNextNightPhase();
      }
    } else {
      moveToNextNightPhase();
    }
  };

  // 修改预言家行动的函数
  const handleSeerAction = (targetId: number) => {
    const targetPlayer = players.find(p => p.id === targetId);
    if (targetPlayer) {
      // 修改判断逻辑：狼人是坏人，其他角色都是好人
      const isBadGuy = targetPlayer.role === '狼人';
      alert(`${targetId}号玩家是${isBadGuy ? '坏人' : '好人'}`);
      addToHistory('预言家完成了查验');
      moveToNextNightPhase();
    }
  };

  return (
    <div className={`min-h-screen ${bgColor} transition-colors duration-1000`}>
      {/* 顶部状态栏 */}
      <div className="fixed top-0 left-0 right-0 bg-opacity-95 backdrop-blur-sm bg-white shadow-lg p-4 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          {gameStage !== 'setup' && gameStage !== 'assign' && (
            <>
              <div className="text-xl font-bold flex items-center space-x-4">
                <span className="bg-blue-100 px-4 py-2 rounded-full">第 {roundNumber} 回合</span>
                {gameStage === 'night' && <Moon className="text-yellow-400 w-6 h-6" />}
                {gameStage === 'day' && <Sun className="text-yellow-500 w-6 h-6" />}
              </div>
              {timer > 0 && (
                <div className="text-2xl font-mono bg-gray-100 px-6 py-2 rounded-lg shadow">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-6xl mx-auto p-4 pt-24 pb-48">
        <Card className="shadow-xl rounded-xl overflow-hidden">
          <CardContent className="p-8">
            {/* 游戏设置阶段 */}
            {gameStage === 'setup' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-center mb-8">狼人杀游戏设置</h2>
                <div className="max-w-md mx-auto space-y-4">
                  <Input
                    type="number"
                    placeholder="输入游戏人数(6-12人)"
                    onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                    min="6"
                    max="12"
                    className="text-lg p-4 rounded-lg w-full"
                  />
                  <Button 
                    onClick={() => initializeGame(playerCount)}
                    className="w-full py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    开始游戏
                  </Button>
                </div>
              </div>
            )}

            {/* 角色分配阶段 */}
            {gameStage === 'assign' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-center mb-8">角色分配</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {players
                    .filter(player => !player.role)
                    .map((player) => (
                      <div key={player.id} className="bg-white shadow-lg rounded-xl p-6 transition-transform hover:scale-105">
                        <h3 className="text-xl font-bold mb-4">{player.id}号玩家</h3>
                        <select
                          className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500"
                          onChange={(e) => assignRole(player.id, e.target.value)}
                          value={player.role}
                        >
                          <option value="">选择角色</option>
                          {roles.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 夜晚阶段 */}
            {gameStage === 'night' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-center mb-8">夜晚阶段</h2>
                
                {/* 角色确认环节 */}
                {nightPhase.includes('confirm') && (
                  <div className="bg-gray-50 rounded-xl p-8 shadow-inner">
                    <h3 className="text-2xl font-bold mb-6 text-center">
                      {nightPhase === 'werewolf-confirm' && '狼人玩家请确认身份'}
                      {nightPhase === 'witch-confirm' && '女巫玩家请确认身份'}
                      {nightPhase === 'seer-confirm' && '预言家玩家请确认身份'}
                    </h3>
                    <div className="flex gap-4 justify-center">
                      {((nightPhase === 'witch-confirm' && players.some(p => p.role === '女巫' && p.alive)) ||
                        (nightPhase === 'seer-confirm' && players.some(p => p.role === '预言家' && p.alive)) ||
                        nightPhase === 'werewolf-confirm') && (
                        <Button 
                          onClick={() => confirmNightAction(true)}
                          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg"
                        >
                          是，我是该角色
                        </Button>
                      )}
                      <Button 
                        onClick={() => confirmNightAction(false)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg"
                      >
                        {((nightPhase === 'witch-confirm' && !players.some(p => p.role === '女巫' && p.alive)) ||
                          (nightPhase === 'seer-confirm' && !players.some(p => p.role === '预言家' && p.alive)))
                          ? '该角色已出局，跳过'
                          : '不是，跳过'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 角色行动环节 */}
                {nightPhase.includes('action') && (
                  <div className="bg-gray-50 rounded-xl p-8 shadow-inner">
                    <h3 className="text-2xl font-bold mb-6 text-center">
                      {nightPhase === 'werewolf-action' && '狼人请选择击杀目标'}
                      {nightPhase === 'witch-action' && '女巫请选择使用药水'}
                      {nightPhase === 'seer-action' && '预言家请选择查验目标'}
                    </h3>

                    <div className="max-w-md mx-auto">
                      {/* 狼人行动 */}
                      {nightPhase === 'werewolf-action' && (
                        <>
                          <select
                            className="w-full p-4 border rounded-lg mb-6 bg-white shadow-sm"
                            onChange={(e) => handleTargetSelection(e.target.value)}
                            value={selectedTarget || ""}
                          >
                            <option value="">选择目标</option>
                            {players
                              .filter(p => p.alive)
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.id}号玩家
                                </option>
                              ))}
                          </select>
                          {selectedTarget && (
                            <Button 
                              onClick={confirmNightTarget}
                              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg"
                            >
                              确认选择
                            </Button>
                          )}
                        </>
                      )}

                      {/* 女巫行动 */}
                      {nightPhase === 'witch-action' && players.some(p => p.role === '女巫' && p.alive) && (
                        <div className="space-y-6">
                          {pendingDeath && witchPotions.save && (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                              <p className="mb-4">{pendingDeath}号玩家将被出局，是否使用解药？</p>
                              <Button 
                                onClick={() => handleWitchAction('save', pendingDeath)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
                              >
                                使用解药
                              </Button>
                            </div>
                          )}
                          {witchPotions.poison && (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                              <p className="mb-4">是否使用毒药？</p>
                              <select
                                className="w-full p-4 border rounded-lg mb-4"
                                onChange={(e) => handleWitchAction('poison', parseInt(e.target.value))}
                              >
                                <option value="">选择目标</option>
                                {players
                                  .filter(p => p.alive && p.role !== '女巫')
                                  .map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.id}号玩家
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                          <Button 
                            onClick={() => handleWitchAction('skip', 0)}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg"
                          >
                            不使用药水
                          </Button>
                        </div>
                      )}

                      {/* 预言家行动 */}
                      {nightPhase === 'seer-action' && players.some(p => p.role === '预言家' && p.alive) && (
                        <>
                          <select
                            className="w-full p-4 border rounded-lg mb-6 bg-white shadow-sm"
                            onChange={(e) => handleSeerAction(parseInt(e.target.value))}
                            value={selectedTarget || ""}
                          >
                            <option value="">选择目标</option>
                            {players
                              .filter(p => p.alive && p.role !== '预言家')
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.id}号玩家
                                </option>
                              ))}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 白天阶段 */}
            {gameStage === 'day' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-center mb-8">白天阶段</h2>
                
                {dayPhase === 'discussion' && (
                  <div className="bg-blue-50 rounded-xl p-8 shadow-inner">
                    <h3 className="text-2xl font-bold mb-6 text-center">讨论阶段</h3>
                    <div className="flex items-center justify-between max-w-md mx-auto">
                      <div className="text-center">
                        <p className="text-lg mb-2">剩余讨论时间</p>
                        <p className="text-3xl font-mono bg-white px-6 py-3 rounded-lg shadow">
                          {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                        </p>
                      </div>
                      <Button 
                        onClick={endDiscussion}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-4 rounded-lg"
                      >
                        结束讨论
                      </Button>
                    </div>
                  </div>
                )}

                {dayPhase === 'vote' && (
                  <div className="bg-blue-50 rounded-xl p-8 shadow-inner">
                    <h3 className="text-2xl font-bold mb-6 text-center">投票环节</h3>
                    <div className="max-w-md mx-auto space-y-6">
                      <select
                        className="w-full p-4 border rounded-lg bg-white shadow-sm"
                        onChange={(e) => handleDayVote(parseInt(e.target.value))}
                        value={votedPlayer || ""}
                      >
                        <option value="">选择出局玩家</option>
                        {players
                          .filter(p => p.alive)
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.id}号玩家</option>
                          ))}
                      </select>
                      {votedPlayer && (
                        <Button
                          onClick={confirmVoteResult}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg"
                        >
                          确认投票结果并进入下一回合
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 游戏结束展示 */}
            {gameStage === 'end' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-center mb-8">游戏结束</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {players.map(player => (
                    <div 
                      key={player.id} 
                      className={`p-6 rounded-xl shadow-lg transition-all ${
                        player.role === '狼人' ? 'bg-red-50' : 'bg-green-50'
                      } ${!player.alive ? 'opacity-60' : ''}`}
                    >
                      <div className="text-xl font-bold mb-2">
                        {player.id}号玩家 
                        {!player.alive && ' (已出局)'}
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium">
                          角色：{player.role}
                        </div>
                        <div className={`text-sm ${player.role === '狼人' ? 'text-red-600' : 'text-green-600'}`}>
                          阵营：{player.role === '狼人' ? '坏人' : '好人'}
                        </div>
                        <div className="text-sm text-gray-500">
                          状态：{player.alive ? '存活' : '已出局'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 游戏记录 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white bg-opacity-95 backdrop-blur-sm shadow-lg p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold flex items-center">
              <History className="mr-2" />
              游戏记录
            </h3>
            <Button
              onClick={() => {
                if (isCurrentlySpeaking) {
                  stopSpeaking();
                }
                setIsSpeechEnabled(!isSpeechEnabled);
              }}
              className={`p-2 rounded-full transition-colors ${
                isSpeechEnabled 
                  ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {isSpeechEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-4">
            {gameHistory.map((record, index) => (
              <div 
                key={index} 
                className="text-sm bg-gray-50 p-2 rounded flex items-center justify-between group"
                onClick={() => speak(record.event)}
              >
                <span className="text-gray-600">
                  [{record.time}] {record.event}
                </span>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(record.event);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-200 transition-opacity"
                >
                  <Volume2 className="w-4 h-4 text-gray-600" />
                </Button>
                {record.privateInfo && nightPhase === 'seer-action' && (
                  <div className="ml-4 text-blue-600 italic">
                    {record.privateInfo}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WerewolfGame;