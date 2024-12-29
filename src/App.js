import React from 'react';
import WerewolfGame from './werewolf_game';

const App = () => {
  return (
    <div>
      <h1>欢迎来到游戏!</h1>
      <p>如果您看到这条消息，说明组件已成功渲染。</p>
      <WerewolfGame />
      <p>调试信息: 组件已加载。</p>
    </div>
  );
};

export default App; 