(function(root){
  'use strict';
  const num=v=>Number(v).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  const integer=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:0});
  const put=(el,value,raw=false)=>{if(!el)return;if(raw)el.setAttribute('data-i18n-skip','');else el.removeAttribute('data-i18n-skip');if(el.textContent!==String(value))el.textContent=String(value);};
  const amount=(el,value,currency=false,sign='')=>{
    if(!currency){put(el,sign+value,true);return;}
    const unit=document.createElement('span');unit.className='dashboard-unit dashboard-currency';unit.textContent='₩';
    el.setAttribute('data-i18n-skip','');el.replaceChildren(document.createTextNode(sign),unit,document.createTextNode(value));
  };
  const text=(panel,selector,value,raw=false)=>put(panel.querySelector(selector),value,raw);
  const all=(panel,selector)=>Array.from(panel.querySelectorAll(selector));
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const md=value=>value.slice(5).replace('-','/');
  const graphs='.gauge-fill,.gauge-needle,.chart-today,.chart-yesterday,.solar-ring-value,.ess-discharge-arc,.ess-battery i,.dashboard-bar-track i';
  function reconcileUps(ups,items){
    const key=JSON.stringify(items.map(({id,name})=>({id,name})));
    if(ups.dataset.mockInventory===key)return;
    ups.dataset.mockInventory=key;
    const units=[['Hz','Hz','Vdc','','kW'],['Vac','Vac','%'],[null,'A','min'],[null,'%']];
    ups.innerHTML=items.map(u=>`<article class="dashboard-card ups-device-card"><h3 data-i18n-skip>${escape(u.name)}</h3><table class="ups-status-table"><thead><tr>${['입력','출력','배터리','경보','유효전력'].map(t=>'<th scope="col">'+t+'</th>').join('')}</tr></thead><tbody>${units.map(row=>'<tr>'+Array.from({length:5},(_,i)=>'<td>'+(row[i]==null?'':'<b data-i18n-skip>—</b><span class="dashboard-unit">'+row[i]+'</span>')+'</td>').join('')+'</tr>').join('')}</tbody></table></article>`).join('');
  }
  function clear(panels){
    const {overview,solar,ess,ups}=panels;
    for(const panel of Object.values(panels)){
      all(panel,'strong,.dashboard-chip b,.dashboard-bar-row b,.ess-savings-table b,.ess-tariff-table b,.ups-status-table b').forEach(el=>put(el,'—',true));
      all(panel,'[title]').forEach(el=>el.removeAttribute('title'));
    }
    const load=overview.querySelector('.power-card .dashboard-card-footer b');load.firstChild.nodeValue='—';
    text(overview,'.peak-time','—',true);
    overview.querySelector('.peak-gauge').setAttribute('aria-label','피크 전력 데이터 없음');
    overview.querySelector('.hourly-chart').setAttribute('aria-label','시간대별 전력 소비량 데이터 없음');
    all(overview,'.chart-grid text').forEach(el=>put(el,'—',true));
    all(overview,'.chart-today title').forEach(el=>put(el,'',true));
    all(overview,'.dashboard-legend span').forEach((el,i)=>{el.lastChild.nodeValue=(i?'전일':'금일')+' 사용량 (kWh)';});
    all(overview,'.dashboard-comparisons>div').forEach((row,i)=>{
      put(row.querySelector('span'),i%2?'작년 동일 대비':'전주 평균 대비');
      const b=row.querySelector('b');put(b.querySelector('.comparison-value'),'—',true);put(b.querySelector('em'),'—',true);b.classList.remove('mock-increase');
    });
    all(overview,'.emissions-card dt span').forEach(el=>put(el,'',true));
    all(overview,'.emissions-card .dashboard-unit').forEach(el=>put(el,'tCO₂e',true));
    text(solar,'.solar-generation-stats time','—',true);
    text(solar,'caption','인버터별 발전 현황');
    all(solar,'.solar-inverter-table tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td'),state=cells[0].querySelector('span');put(state,'—');state.className='inverter-state';
      for(const cell of [cells[1],cells[2]]){if(cell.querySelector('b'))put(cell.querySelector('b'),'—',true);}
    });
    const status=all(ess,'.ess-pcs-status>span');put(status[0],'—');put(status[1],'—');put(status[2].querySelector('b'),'—',true);
    all(ess,'.ess-grid-table td,.ess-bms-table td').forEach(el=>put(el,'—',true));
    text(ess,'.ess-tariff-table tr:first-child td','—');
    ess.querySelector('.ess-battery').setAttribute('aria-label','배터리 충전 상태 데이터 없음');
    all(ups,'.ups-status-table b').forEach(el=>put(el,'—',true));
  }
  function render(panels,s,equipment=[]){
    reconcileUps(panels.ups,s?s.ups:equipment.filter(item=>item.type==='ups'));
    for(const panel of Object.values(panels))all(panel,graphs).forEach(el=>{el.style.visibility=s?'':'hidden';});
    if(!s){clear(panels);return;}
    const {overview:o,solar:p,ess:e}=s,{overview,solar,ess,ups}=panels;
    const powerCards=all(overview,'.power-card');
    text(powerCards[0],'.gauge-value strong',num(o.power),true);
    const load=powerCards[0].querySelector('.dashboard-card-footer b');load.firstChild.nodeValue=num(o.load);
    powerCards[0].querySelector('.gauge-fill').setAttribute('stroke-dasharray',`${Math.min(100,o.load)} 100`);
    text(powerCards[1],'.dashboard-peak strong',num(o.peak.value),true);
    text(powerCards[1],'.peak-time',md(s.date)+' '+o.peak.time,true);
    const angle=(Math.min(1,o.peak.value/o.contract)-.5)*180;
    powerCards[1].querySelector('.gauge-needle').setAttribute('d','M106 105 L110 18 L114 105 Z');
    powerCards[1].querySelector('.gauge-needle').setAttribute('transform',`rotate(${angle} 110 105)`);
    powerCards[1].querySelector('.peak-gauge').setAttribute('aria-label',`피크 전력 목업 ${num(o.peak.value)} kW`);
    const hourly=overview.querySelector('.hourly-card'),max=Math.max(500,...o.today,...o.yesterday),scale=Math.ceil(max/500)*500,y=v=>128-v/scale*103;
    text(hourly,'.dashboard-chip b',num(o.total),true);
    all(hourly,'.chart-today rect').forEach((bar,i)=>{
      const value=o.today[i];bar.setAttribute('y',y(value||0));bar.setAttribute('height',value==null?0:128-y(value));
      put(bar.querySelector('title'),`${s.date} ${String(i*2).padStart(2,'0')}:00 · ${value==null?'미래 시간':num(value)+' kWh'}`);
    });
    all(hourly,'.chart-grid line').forEach((line,i)=>{line.setAttribute('y1',y(i*scale/2));line.setAttribute('y2',y(i*scale/2));});
    all(hourly,'.chart-grid text').forEach((label,i)=>{label.setAttribute('y',y(i*scale/2)+3);put(label,num(i*scale/2),true);});
    hourly.querySelector('.chart-yesterday').setAttribute('points',o.yesterday.flatMap((v,i)=>v==null?[]:[`${44.5+i*28},${y(v)}`]).join(' '));
    const chart=hourly.querySelector('.hourly-chart');chart.setAttribute('aria-label',`${s.date} / ${o.yesterdayDate} ${s.elapsed} · ${num(o.total)} kWh · 목업`);
    hourly.title=`금일 ${s.date} / 전일 ${o.yesterdayDate} · ${s.elapsed} 동일 시간 비교`;
    all(hourly,'.dashboard-legend span').forEach((label,i)=>{label.lastChild.nodeValue=`${i?'전일':'금일'} ${md(i?o.yesterdayDate:s.date)} (kWh)`;});
    all(overview,'.comparison-card').forEach((card,index)=>{
      const factor=index?o.tariff:1,unit=index?'':'kWh',value=o.total*factor;
      if(index)card.title='목업 단가 ₩'+num(o.tariff)+'/kWh · '+s.date+' '+s.elapsed;
      amount(card.querySelector('.dashboard-total strong'),num(value),!!index);
      all(card,'.dashboard-comparisons>div').forEach((row,i)=>{
        const reference=(i?o.year:o.week)*factor,delta=value-reference,percent=reference?delta/reference*100:0;
        put(row.querySelector('span'),`${i?'작년 동일 대비':'전주 평균 대비'} (${s.elapsed})`);
        row.title=(i?o.yearDate:o.weekRange)+' · '+s.elapsed;
        const b=row.querySelector('b');amount(b.querySelector('.comparison-value'),num(Math.abs(delta)),!!index,delta<0?'−':'+');
        put(b.querySelector('small'),unit);put(b.querySelector('em'),`${percent<0?'−':'+'}${num(Math.abs(percent))}% ${delta<0?'↓':'↑'}`,true);
        b.classList.toggle('mock-increase',delta>0);
      });
      all(card,'.dashboard-bar-row').forEach((row,i)=>{
        const value=[o.total,o.week,o.max][i]*factor;
        row.querySelector('i').style.width=(o.max?value/(o.max*factor)*100:0)+'%';amount(row.querySelector('b'),integer(value),!!index);
      });
    });
    all(overview,'.emissions-card dl>div').forEach((row,i)=>{
      const item=s.emissions[i];text(row,'dt span',`(${md(item.start)}~${md(item.end)})`,true);row.title=item.start+' ~ '+item.end;
      text(row,'dd strong',num(item.value),true);text(row,'.dashboard-unit','tCO₂e',true);
    });
    overview.querySelector('.emissions-card').title='목업 환산 계수 0.45 kgCO₂e/kWh 적용';
    all(solar,'.dashboard-chip b').forEach(el=>put(el,num(p.capacity),true));
    text(solar,'.solar-output-value strong',num(p.power),true);
    solar.querySelector('.solar-ring-value').setAttribute('stroke-dasharray',`${p.power} 300`);
    all(solar,'.solar-generation-stats dd strong').forEach((el,i)=>put(el,num(i?p.peak.value:p.energy),true));
    text(solar,'.solar-generation-stats time',p.peak.time,true);
    text(solar,'caption',`태양광 ${num(p.capacity)} kW 인버터별 발전 현황 · 목업`);
    all(solar,'.solar-inverter-table tbody tr').forEach((row,i)=>{
      const cells=row.querySelectorAll('td'),inv=p.inverters[i],status=cells[0].querySelector('span');
      put(status,inv.power>0?'운전 중':'대기');status.className='inverter-state '+(inv.power>0?'running':'standby');
      for(const [cell,value,unit] of [[cells[1],inv.power,'kW'],[cells[2],inv.efficiency,'%']]){
        if(!cell.querySelector('b'))cell.innerHTML='<b data-i18n-skip></b><span class="dashboard-unit"></span>';
        put(cell.querySelector('b'),num(value),true);put(cell.querySelector('.dashboard-unit'),unit,true);
      }
    });
    all(ess,'.ess-energy-card dd strong').forEach((el,i)=>put(el,num([e.charge,e.monthCharge,e.discharge,e.monthDischarge][i]),true));
    text(ess,'.ess-pcs-gauge strong',num(e.power),true);
    ess.querySelector('.ess-discharge-arc').setAttribute('stroke-dasharray',`${e.rated?Math.abs(e.power)/e.rated*100:0} 100`);
    const status=all(ess,'.ess-pcs-status>span');put(status[0],e.power?'운전 중':'대기');put(status[1],e.power<0?'방전':e.power>0?'충전':'대기');put(status[2].querySelector('b'),num(e.temperature+6),true);
    const gridRows=all(ess,'.ess-grid-table tbody tr');
    all(gridRows[0],'td').forEach((el,i)=>put(el,num(e.acVoltage[i]),true));
    all(gridRows[1],'td').forEach(el=>put(el,num(e.acCurrent),true));text(gridRows[2],'td',num(e.frequency)+' / '+num(e.pf),true);
    ess.querySelector('.ess-battery i').style.width=e.soc+'%';ess.querySelector('.ess-battery').setAttribute('aria-label','배터리 충전 상태 '+num(e.soc)+'%');
    all(ess,'.ess-bms-table td').forEach((el,i)=>put(el,[num(e.soc),num(e.stored),num(e.soh),num(e.voltage),num(e.current),num(e.temperature-1)+'~'+num(e.temperature+1)][i],true));
    text(ess,'.ess-tariff-table b',integer(o.contract),true);
    text(ess,'.ess-tariff-table tr:first-child td','산업용(을) 고압 A 선택 III');
    all(ess,'.ess-savings-table').forEach((table,i)=>{
      all(table,'td b').forEach((el,j)=>amount(el,integer((i?e.solarSavings:e.savings)[j]),true));
      const monday=new Date(s.date+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
      all(table,'tr').forEach((row,j)=>{row.title=(j===0?s.date:j===1?monday.toISOString().slice(0,10):s.date.slice(0,7)+'-01')+' ~ '+s.date+' '+s.time;});
    });
    all(ups,'.ups-device-card').forEach((card,i)=>{
      const u=s.ups[i],rows=all(card,'tbody tr');
      const data=[[[60,'Hz'],[60,'Hz'],[u.dc,'Vdc'],['정상',''],[u.power,'kW']],[[u.input,'Vac'],[u.output,'Vac'],[u.battery,'%']], [null,[u.current,'A'],[u.runtime,'min']],[null,[u.load,'%']]];
      rows.forEach((row,r)=>all(row,'td').forEach((cell,c)=>{
        const entry=data[r][c];if(!entry){put(cell,'');return;}
        if(!cell.querySelector('b'))cell.innerHTML='<b></b><span class="dashboard-unit"></span>';
        put(cell.querySelector('b'),typeof entry[0]==='number'?num(entry[0]):entry[0],typeof entry[0]==='number');put(cell.querySelector('.dashboard-unit'),entry[1],true);
      }));
    });
  }
  root.FEMSMonitoringDashboard={render};
})(window);
