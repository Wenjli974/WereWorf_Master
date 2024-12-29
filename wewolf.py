import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Clock, History, Users, Moon, Sun } from 'lucide-react';
import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const WerewolfGame = () => {
  // 游戏基础状态
  const [gameStage, setGameStage] = useState('setup'); // setup, assign, night, day, vote, end
  const [roundNumber, setRoundNumber] = useState(1);
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [dayPhase, setDayPhase] = useState('discussion'); // discussion, vote
  
  // 夜晚阶段状态
  const [nightPhase, setNightPhase] = useState('waiting');
  const [currentActionPlayer, setCurrentActionPlayer] = useState(null);
  const [pendingDeath, setPendingDeath] = useState(null);
  const [witchPotions, setWitchPotions] = useState({ save: true, poison: true });
  const [nightDeaths, setNightDeaths] = useState([]);
  const [currentVotes, setCurrentVotes] = useState({});
  
  // 计时器状态
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // 游戏配置
  const roles = ['狼人', '平民', '女巫', '预言家'];
  const nightOrder = ['werewolf', 'witch', 'seer'];

  // 初始化游戏
  const initializeGame = (count) => {
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
  const assignRole = (playerId, role) => {
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
    addToHistory('夜晚降临，狼人请睁眼');
  };

  // 开始白天阶段
  const startDay = () => {
    setGameStage('day');
    setDayPhase('discussion');
    addToHistory('天亮了，开始讨论');
    startTimer(600); // 设置讨论时间为10分钟
  };

  // 手动结束讨论阶段
  const endDiscussion = () => {
    setTimer(0);
    setTimerActive(false);
    setDayPhase('vote');
    addToHistory('讨论阶段结束，进入投票阶段');
  };

  // 确认角色行动
  const confirmNightAction = (confirmed) => {
    if (!confirmed) {
      moveToNextNightPhase();
      return;
    }

    switch (nightPhase) {
      case 'werewolf-confirm':
        setNightPhase('werewolf-action');
        break;
      case 'witch-confirm':
        setNightPhase('witch-action');
        break;
      case 'seer-confirm':
        setNightPhase('seer-action');
        break;
    }
  };

  // 处理夜晚行动选择
  const [selectedTarget, setSelectedTarget] = useState(null);

  const handleTargetSelection = (targetId) => {
    setSelectedTarget(targetId);
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
        handleWitchAction(selectedTarget);
        break;
      case 'seer-action': {
        const targetPlayer = players.find(p => p.id === selectedTarget);
        const isWerewolf = targetPlayer.role === '狼人';
        setSeerResult(`${selectedTarget}号玩家是${isWerewolf ? '狼人' : '好人'}`);
        setShowSeerResult(true);
        addToHistory('预言家完成了查验');
        break;
      }
    }
    setSelectedTarget(null);
  };

  // 处理女巫行动
  const handleWitchAction = (action, targetId) => {
    if (action === 'save' && witchPotions.save) {
      setPendingDeath(null);
      setWitchPotions(prev => ({ ...prev, save: false }));
      addToHistory('女巫完成了行动');
    } else if (action === 'poison' && witchPotions.poison) {
      setNightDeaths(prev => [...prev, targetId]);
      setWitchPotions(prev => ({ ...prev, poison: false }));
      addToHistory('女巫完成了行动');
    }
    moveToNextNightPhase();
  };

  // 处理白天投票
  const [votedPlayer, setVotedPlayer] = useState(null);

  const handleDayVote = (voterId, targetId) => {
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
    
    // 重置投票状态
    setVotedPlayer(null);
    setCurrentVotes({});
  };

  // 处理白天投票结果
  const processDayVoteResults = () => {
    const voteCount = {};
    Object.values(currentVotes).forEach(targetId => {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    });
    
    let maxVotes = 0;
    let votedOut = null;
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
    }
    
    const gameStatus = checkGameState();
    if (gameStatus) {
      setGameStage('end');
      addToHistory(`游戏结束，${gameStatus}`);
    } else {
      startNewRound();
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

    const nextPhase = phases[nightPhase];
    
    if (nextPhase === 'end') {
      endNight();
    } else {
      setNightPhase(nextPhase);
      switch (nextPhase) {
        case 'witch-confirm':
          addToHistory('女巫请睁眼');
          break;
        case 'seer-confirm':
          addToHistory('预言家请睁眼');
          break;
      }
    }
  };

  // 结束夜晚阶段
  const endNight = () => {
    // 处理死亡玩家
    const deaths = [...(pendingDeath ? [pendingDeath] : []), ...nightDeaths];
    if (deaths.length > 0) {
      const updatedPlayers = players.map(player => ({
        ...player,
        alive: !deaths.includes(player.id)
      }));
      setPlayers(updatedPlayers);
      deaths.forEach(id => {
        addToHistory(`${id}号玩家死亡`);
        playSound('death');
      });
    } else {
      addToHistory('平安夜');
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
    const wolves = players.filter(p => p.role === '狼人' && p.alive).length;
    const villagers = players.filter(p => p.role !== '狼人' && p.alive).length;
    
    if (wolves === 0) {
      return '好人胜利';
    } else if (wolves >= villagers) {
      return '狼人胜利';
    }
    return null;
  };

  // 开始计时器
  const startTimer = (seconds) => {
    setTimer(seconds);
    setTimerActive(true);
  };

  // 计时器效果
  useEffect(() => {
    let interval;
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
  const addToHistory = (event) => {
    setGameHistory(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      event
    }]);
  };

  // 播放音效
  const playSound = (type) => {
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

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="mb-4">
        <CardContent className="p-6">
          {/* 游戏状态展示 */}
          {gameStage !== 'setup' && gameStage !== 'assign' && (
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold">
                第 {roundNumber} 回合
                {gameStage === 'night' && <Moon className="inline-block ml-2" />}
                {gameStage === 'day' && <Sun className="inline-block ml-2" />}
              </div>
              {timer > 0 && (
                <div className="text-xl font-mono">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          )}

          {gameStage === 'setup' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">游戏设置</h2>
              <div className="flex gap-4">
                <Input
                  type="number"
                  placeholder="输入游戏人数(6-12人)"
                  onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                  min="6"
                  max="12"
                />
                <Button onClick={() => initializeGame(playerCount)}>
                  开始游戏
                </Button>
              </div>
            </div>
          )}

          {gameStage === 'assign' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">角色分配</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div key={player.id} className="p-4 border rounded">
                    <h3>{player.id}号玩家</h3>
                    <select
                      className="mt-2 w-full p-2 border rounded"
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

          {gameStage === 'night' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">夜晚阶段</h2>
              
              {/* 角色确认环节 */}
              {nightPhase.includes('confirm') && (
                <div className="p-4 border rounded bg-gray-50">
                  <h3 className="text-xl font-bold mb-4">
                    {nightPhase === 'werewolf-confirm' && '狼人玩家请确认'}
                    {nightPhase === 'witch-confirm' && '女巫玩家请确认'}
                    {nightPhase === 'seer-confirm' && '预言家玩家请确认'}
                  </h3>
                  <div className="flex gap-4">
                    <Button onClick={() => confirmNightAction(true)}>
                      是，我是该角色
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => confirmNightAction(false)}
                    >
                      不是，跳过
                    </Button>
                  </div>
                </div>
              )}

              {/* 角色行动环节 */}
              {nightPhase.includes('action') && (
                <div className="p-4 border rounded">
                  <h3 className="text-xl font-bold mb-4">
                    {nightPhase === 'werewolf-action' && '请选择击杀目标'}
                    {nightPhase === 'witch-action' && '请选择使用药水'}
                    {nightPhase === 'seer-action' && '请选择查验目标'}
                  </h3>

                  {nightPhase === 'witch-action' && (
                    <div className="space-y-4">
                      {pendingDeath && witchPotions.save && (
                        <div>
                          <p>今晚{pendingDeath}号玩家将死亡，是否使用解药？</p>
                          <Button onClick={() => handleWitchAction('save', pendingDeath)}>
                            使用解药
                          </Button>
                        </div>
                      )}
                      {witchPotions.poison && (
                        <div>
                          <p>是否使用毒药？</p>
                          <select
                            className="mt-2 w-full p-2 border rounded"
                            onChange={(e) => handleWitchAction('poison', parseInt(e.target.value))}
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
                        </div>
                      )}
                      <Button onClick={() => moveToNextNightPhase()}>
                        不使用药水
                      </Button>
                    </div>
                  )}

                  {(nightPhase === 'werewolf-action' || nightPhase === 'seer-action') && (
                    <div className="space-y-4">
                      <select
                        className="w-full p-2 border rounded"
                        onChange={(e) => handleTargetSelection(parseInt(e.target.value))}
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
                          className="w-full"
                        >
                          确认选择
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {gameStage === 'day' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">白天阶段</h2>
              
              {dayPhase === 'discussion' && (
                <div className="p-4 border rounded">
                  <h3 className="text-xl font-bold mb-4">讨论阶段</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg">剩余讨论时间:</p>
                      <p className="text-2xl font-mono">
                        {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <Button 
                      onClick={endDiscussion}
                      className="bg-yellow-500 hover:bg-yellow-600"
                    >
                      结束讨论
                    </Button>
                  </div>
                </div>
              )}

              {dayPhase === 'vote' && (
                <div className="p-4 border rounded">
                  <h3 className="text-xl font-bold mb-4">投票结果</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p>请选择投票出局的玩家：</p>
                      <select
                        className="w-full p-2 border rounded mb-4"
                        onChange={(e) => handleDayVote("group", parseInt(e.target.value))}
                        value={votedPlayer || ""}
                      >
                        <option value="">选择出局玩家</option>
                        {players
                          .filter(p => p.alive)
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.id}号玩家
                            </option>
                          ))}
                      </select>
                      {votedPlayer && (
                        <Button
                          onClick={confirmVoteResult}
                          className="w-full bg-red-500 hover:bg-red-600"
                        >
                          确认投票结果并进入下一回合
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 游戏记录 */}
          <div className="mt-8">
            <h3 className="text-xl font-bold flex items-center">
              <History className="mr-2" />
              游戏记录
            </h3>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {gameHistory.map((record, index) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-600">
                    [{record.time}] {record.event}
                  </span>
                  {record.privateInfo && nightPhase === 'seer-action' && (
                    <div className="ml-4 text-blue-600 italic">
                      {record.privateInfo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WerewolfGame;