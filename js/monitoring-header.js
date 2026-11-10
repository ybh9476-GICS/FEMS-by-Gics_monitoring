(function(root){
  'use strict';
  const clock=document.getElementById('monitor-clock'),toggle=document.getElementById('monitor-play-toggle');
  const weather=document.getElementById('monitor-weather'),condition=document.getElementById('monitor-weather-condition');
  const temperature=document.getElementById('monitor-temperature'),humidity=document.getElementById('monitor-humidity');
  const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let timer=null;
  function updateClock(){const now=new Date();clock.textContent=format.format(now);clock.dateTime=now.toISOString();clock.title='한국 표준시 (KST)';}
  function syncClock(){
    if(timer!==null){root.clearInterval(timer);timer=null;}
    if(root.FEMSWorkspaceMode?.mode==='monitoring'&&!document.hidden){updateClock();timer=root.setInterval(updateClock,1000);}
  }
  function setWeather(data){
    const captions={'clear-day':'맑음 (낮)','clear-night':'맑음 (밤)',cloudy:'흐림',rain:'비',snow:'눈'};
    const valid=data&&Object.hasOwn(captions,data.condition)&&Number.isFinite(data.temperature)&&Number.isFinite(data.humidity)&&data.humidity>=0&&data.humidity<=100;
    weather.dataset.weather=valid?data.condition:'unavailable';
    const description=(data?.mock?'전국 날씨 목업 · ':'부산 사하구 · ')+(valid?captions[data.condition]:'날씨 정보 없음');
    condition.setAttribute('aria-label',description);condition.setAttribute('title',description);
    temperature.textContent=valid?data.temperature.toFixed(1)+' °C':'— °C';
    humidity.textContent=valid?data.humidity.toFixed(1)+' %':'— %';
  }
  toggle.addEventListener('click',()=>{
    const mock=root.FEMSMonitoringMock;if(mock?.playing)mock.stop();else mock?.start();
  });
  function syncMock(){
    const mock=root.FEMSMonitoringMock,playing=!!mock?.playing;
    toggle.setAttribute('aria-pressed',String(playing));
    const caption=playing?'정지':'재생';toggle.setAttribute('aria-label',caption);toggle.setAttribute('title',caption);
    setWeather(mock?.current?.weather||null);
  }
  root.addEventListener('fems-mock-update',syncMock);
  root.addEventListener('fems-workspace-mode-change',syncClock);
  document.addEventListener('visibilitychange',syncClock);
  root.FEMSMonitoringHeader={setWeather};
  setWeather(null);syncClock();
})(window);
