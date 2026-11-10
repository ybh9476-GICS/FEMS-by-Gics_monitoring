(function(root){
  'use strict';
  // Synthetic industrial demo only. No telemetry, network, project mutation or persistence.
  const DAY=86400000,KST=9*3600000,round=(n,d=1)=>Number(n.toFixed(d)),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const stamp=d=>d.toISOString().slice(0,10),hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');
  function createModel(seed=Math.random()){
    const cache=new Map();
    function random(key){let h=Math.floor(seed*1e9)>>>0;for(const c of String(key))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296;}
    function day(date){
      const key=stamp(date);if(cache.has(key))return cache.get(key);
      const month=date.getUTCMonth(),r=random(key),phase=random(key+'phase')*6.28,weekend=[0,6].includes(date.getUTCDay());
      const mean=[-1,1,6,12,18,22,26,27,22,16,9,2][month],temp=mean+(r-.5)*8;
      const condition=r<.12&&temp<3?'snow':r<.26?'rain':r<.55?'cloudy':'clear';
      const sunrise=6.5+Math.cos(month/12*Math.PI*2)*.6,sunset=18.3-Math.cos(month/12*Math.PI*2)*.7;
      const weatherFactor=condition==='rain'?.25:condition==='snow'?.18:condition==='cloudy'?.55:.88;
      const values=[],energy=[0],solar=[],generation=[0];
      for(let m=0;m<=1440;m++){
        const hour=m/60,shift=(Math.tanh((hour-7.5)*1.5)-Math.tanh((hour-19)*1.2))/2;
        const load=(310+(weekend?230:560)*shift)*(0.96+r*.08)*(1+.012*Math.sin(m/5+phase)+.006*Math.sin(m/1.7));
        const pv=300*weatherFactor*Math.max(0,Math.sin(Math.PI*(hour-sunrise)/(sunset-sunrise)))*(hour>=sunrise&&hour<=sunset?1:0);
        values.push(load);solar.push(pv);
        if(m){energy.push(energy[m-1]+(values[m-1]+load)/120);generation.push(generation[m-1]+(solar[m-1]+pv)/120);}
      }
      const result={values,energy,solar,generation,condition,temp,sunrise,sunset,humidity:condition==='rain'||condition==='snow'?85:condition==='cloudy'?68:50};cache.set(key,result);return result;
    }
    const at=(array,m)=>{const i=Math.floor(clamp(m,0,1440));return i===1440?array[i]:array[i]+(array[i+1]-array[i])*(m-i);};
    function snapshot(now,items=[]){
      const local=new Date(now.getTime()+KST),date=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));
      const minutes=local.getUTCHours()*60+local.getUTCMinutes()+local.getUTCSeconds()/60,key=stamp(date),d=day(date);
      const yesterdayDate=new Date(+date-DAY),yesterday=day(yesterdayDate),elapsed='00:00–'+hm(minutes);
      const weekStart=new Date(+date-((date.getUTCDay()+6)%7+7)*DAY),weekEnd=new Date(+weekStart+6*DAY);
      const weekDays=Array.from({length:7},(_,i)=>day(new Date(+weekStart+i*DAY)));
      const previousYear=new Date(Date.UTC(date.getUTCFullYear()-1,date.getUTCMonth(),Math.min(date.getUTCDate(),new Date(Date.UTC(date.getUTCFullYear()-1,date.getUTCMonth()+1,0)).getUTCDate())));
      const total=at(d.energy,minutes),power=at(d.values,minutes),week=weekDays.reduce((s,v)=>s+at(v.energy,minutes),0)/7,year=at(day(previousYear).energy,minutes);
      const bucket=(profile)=>Array.from({length:12},(_,i)=>minutes<=i*120?null:at(profile,Math.min(minutes,(i+1)*120))-profile[i*120]);
      const monthStart=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)),lastMonthStart=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1)),lastMonthEnd=new Date(+monthStart-DAY),yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
      function period(start,end){let sum=0;for(let t=+start;t<=+end;t+=DAY)sum+=t===+date?total:day(new Date(t)).energy[1440];return sum;}
      function peak(array){let value=array[0],time=0;for(let m=1;m<=Math.floor(minutes);m++)if(array[m]>value){value=array[m];time=m;}const current=at(array,minutes);if(current>value){value=current;time=minutes;}return {value:round(value),time:hm(time)};}
      const solarItems=items.filter(i=>i.type.startsWith('solar')),essItems=items.filter(i=>i.type==='ess'),upsItems=items.filter(i=>i.type==='ups');
      const solarPower=solarItems.length?at(d.solar,minutes):0,solarEnergy=solarItems.length?at(d.generation,minutes):0;
      const hour=minutes/60,charge=80*Math.min(hour,6),discharge=54.15*clamp(hour-9,0,8),essPower=hour<6?80:hour>=9&&hour<17?-54.15:0;
      const essCount=essItems.length,soc=clamp(35+(charge*.95-discharge/.95)/10,10,95),dcVoltage=720+soc*.6;
      const solarPeak=peak(d.solar),sitePeak=peak(d.values);
      const weather={mock:true,condition:d.condition==='clear'?(hour>=d.sunrise&&hour<d.sunset?'clear-day':'clear-night'):d.condition,temperature:round(d.temp+3*Math.sin((hour-8)*Math.PI/12)),humidity:round(clamp(d.humidity+7*Math.cos((hour-6)*Math.PI/12),30,98),0)};
      const ups=upsItems.map(item=>{const r=random(item.id),kw=round((25+r*35)*(1+.008*Math.sin(minutes/4+r*6)));return {id:item.id,name:item.name,power:kw,input:round(380+2*Math.sin(minutes/5+r)),output:380,battery:round(98+r*2),dc:540,frequency:60,current:round(kw*1000/(Math.sqrt(3)*380*.96)),load:round(kw),runtime:Math.round(75-kw*.6)};});
      const n=v=>v.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
      const metrics={};
      for(const item of items){
        if(item.type==='tower')metrics[item.id]=[n(1500),n(power),n(power/1500*100)];
        else if(item.type.startsWith('solar')){const weight=t=>t==='solar-3x3'?9:t==='solar-2x2'?4:1,share=weight(item.type)/solarItems.reduce((s,i)=>s+weight(i.type),0);metrics[item.id]=[n(solarEnergy*share),n(clamp(hour-d.sunrise,0,d.sunset-d.sunrise)),n(solarPower*share/.97),n(solarPower*share)];}
        else if(item.type==='ess')metrics[item.id]=[n(charge),n(discharge),n(90.3)];
        else if(item.type==='ups'){const u=ups.find(u=>u.id===item.id);metrics[item.id]=[n(u.input),n(u.output),n(u.battery),n(u.power)];}
        else{const rated={transformer:750,panel:420,mcc:180,distribution:70,compressor:110,pump:22}[item.type]||45,kw=rated*(.65+random(item.id)*.2)*power/850;metrics[item.id]=[n(380+2*Math.sin(minutes/5)),n(kw*1000/(Math.sqrt(3)*380*.96)),n(kw),n(.96)];}
      }
      const days=date.getUTCDate(),weekElapsed=(date.getUTCDay()+6)%7;
      return {timestamp:now.toISOString(),date:key,elapsed,time:hm(minutes),weather,metrics,
        overview:{power,contract:1500,load:power/1500*100,total,peak:sitePeak,today:bucket(d.energy),yesterday:bucket(yesterday.energy),yesterdayDate:stamp(yesterdayDate),week,year,weekRange:stamp(weekStart)+'–'+stamp(weekEnd),yearDate:stamp(previousYear),max:Math.max(total,...weekDays.map(v=>at(v.energy,minutes))),tariff:160},
        emissions:[{start:stamp(yearStart),end:key,value:period(yearStart,date)*.00045},{start:stamp(monthStart),end:key,value:period(monthStart,date)*.00045},{start:stamp(lastMonthStart),end:stamp(lastMonthEnd),value:period(lastMonthStart,lastMonthEnd)*.00045}],
        solar:{capacity:solarItems.length?300:0,power:solarPower,energy:solarEnergy,peak:solarItems.length?solarPeak:{value:0,time:'00:00'},inverters:[.34,.33,.33].map(share=>({power:solarPower*share,efficiency:solarPower>0?97:0}))},
        ess:{count:essCount,charge:charge*essCount,discharge:discharge*essCount,monthCharge:((days-1)*480+charge)*essCount,monthDischarge:((days-1)*433.2+discharge)*essCount,power:essPower*essCount,rated:500*essCount,soc,stored:soc*10*essCount,soh:97.5,voltage:dcVoltage,current:essPower*essCount*1000/dcVoltage,temperature:26+soc*.03,acVoltage:[380.2,379.6,380.5],acCurrent:Math.abs(essPower*essCount)*1000/(Math.sqrt(3)*380*.98),frequency:60,pf:.98,savings:[discharge*essCount*75,(weekElapsed*433.2+discharge)*essCount*75,((days-1)*433.2+discharge)*essCount*75],solarSavings:[solarEnergy*160,Array.from({length:weekElapsed},(_,i)=>day(new Date(+date-(i+1)*DAY)).generation[1440]).reduce((s,v)=>s+v,solarEnergy)*160,Array.from({length:days-1},(_,i)=>day(new Date(+monthStart+i*DAY)).generation[1440]).reduce((s,v)=>s+v,solarEnergy)*160].map(v=>solarItems.length?v:0)},ups};
    }
    return {snapshot};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={createModel};return;}
  const model=createModel();let items=[],inventory='',current=null,timer=null,playing=false;
  const emit=()=>root.dispatchEvent(new CustomEvent('fems-mock-update'));
  function tick(){current=model.snapshot(new Date(),items);emit();}
  function stop(){playing=false;current=null;if(timer!==null)root.clearInterval(timer);timer=null;emit();}
  function start(){if(root.FEMSWorkspaceMode?.mode!=='monitoring'||playing)return;playing=true;tick();timer=root.setInterval(tick,10000);}
  root.FEMSMonitoringMock={get current(){return current;},get playing(){return playing;},get equipment(){return items.map(item=>({...item}));},start,stop,
    configure(state){const next=state.equipment.map(({id,type,name})=>({id,type,name})),key=JSON.stringify(next);if(key!==inventory){inventory=key;items=next;if(current){current=null;stop();}}},
    values:item=>current?.metrics[item?.id],status:id=>current?.metrics[id]?'normal':undefined};
  root.addEventListener('fems-workspace-mode-change',stop);
})(typeof window==='undefined'?globalThis:window);
