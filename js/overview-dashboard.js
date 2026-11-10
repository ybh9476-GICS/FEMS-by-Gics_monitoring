(function(root){
  'use strict';
  // Presentation fixtures only: no telemetry, project writes or persistence.
  const host=document.getElementById('monitor-dashboard-content');
  const tools=document.getElementById('monitor-dashboard-tools');
  const left=document.getElementById('dashboard-scroll-left'),right=document.getElementById('dashboard-scroll-right');
  const strip=document.createElement('div');
  strip.className='dashboard-strip';strip.tabIndex=0;
  strip.dataset.dashboardPanel='overview';
  strip.setAttribute('role','region');strip.setAttribute('aria-label','통합 대시보드 예시 · 좌우 스크롤');
  const number=value=>value.toLocaleString('en-US');
  const metric=(value,unit)=>`<strong>${value}</strong><span class="dashboard-unit">${unit}</span>`;
  const point=(angle,radius)=>{const a=angle*Math.PI/180;return [110+radius*Math.cos(a),105-radius*Math.sin(a)];};
  const ticks=Array.from({length:19},(_,i)=>{
    const [x1,y1]=point(180-i*10,77),[x2,y2]=point(180-i*10,91);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${i<8?'tick-low':i<14?'tick-mid':'tick-high'}"/>`;
  }).join('');
  // Consistent illustrative hourly buckets; their sum matches the daily total.
  const today=[980,1240,1510,1370,1490,2090,1960,1410,1530,1830,1660,2349];
  const yesterday=[1480,1190,1580,1660,1200,1480,2250,1900,1600,1820,1810,1510];
  const chartY=value=>128-value/2500*103;
  const bars=today.map((value,i)=>`<rect x="${37+i*28}" y="${chartY(value)}" width="15" height="${128-chartY(value)}" rx="2"><title>${String(i*2).padStart(2,'0')}:00 · ${number(value)} kWh</title></rect>`).join('');
  const labels=today.map((_,i)=>`<text x="${44.5+i*28}" y="143" text-anchor="middle">${String(i*2).padStart(2,'0')}</text>`).join('');
  const grid=[0,1000,2000].map(value=>`<line x1="32" y1="${chartY(value)}" x2="370" y2="${chartY(value)}"/><text x="27" y="${chartY(value)+3}" text-anchor="end">${number(value)}</text>`).join('');
  function comparison(title,value,unit,rows,bars){
    const max=Math.max(...bars.map(row=>row[1]));
    return `<article class="dashboard-card comparison-card"><h3>${title}</h3><div class="dashboard-total">${metric(number(value),unit)}</div><div class="dashboard-comparisons">${rows.map(row=>`<div><span>${row[0]}</span><b>${row[1]} <small>${unit}</small><em>${row[2]}% ↓</em></b></div>`).join('')}</div><div class="dashboard-bars">${bars.map((row,i)=>`<div class="dashboard-bar-row"><span>${row[0]}</span><div class="dashboard-bar-track"><i class="bar-${i}" style="width:${row[1]/max*100}%"></i></div><b>${number(row[1])}</b></div>`).join('')}</div></article>`;
  }
  strip.innerHTML=`
    <article class="dashboard-card power-card"><h3>실시간 전력</h3><div class="dashboard-gauge"><svg viewBox="0 5 220 113" aria-hidden="true"><path class="gauge-track" d="M20 105 A90 90 0 0 1 200 105"/><path class="gauge-fill" d="M20 105 A90 90 0 0 1 200 105" pathLength="100" stroke-dasharray="53 100"/></svg><div class="gauge-value">${metric('372','kW')}</div></div><div class="dashboard-card-footer"><span>부하율</span><b>53<span class="dashboard-unit">%</span></b></div></article>
    <article class="dashboard-card power-card"><header><h3>피크 전력</h3><div class="dashboard-peak">${metric('418','kW')}</div></header><svg class="peak-gauge" viewBox="0 5 220 113" role="img" aria-label="피크 전력 예시 418 kW"><g stroke-width="4">${ticks}</g><path class="gauge-needle" d="M105 104 L163 42 L115 109 Z"/><circle cx="110" cy="105" r="6" class="gauge-needle"/></svg><div class="dashboard-card-footer"><span>발생시간</span><b class="peak-time">04-25 11:47</b></div></article>
    <article class="dashboard-card hourly-card"><header><h3>시간대별 전력 소비량</h3><span class="dashboard-chip">금일 총 사용량 <b>19,419</b> kWh</span></header><svg class="hourly-chart" viewBox="0 20 385 131" role="img" aria-label="시간대별 금일·전일 사용량 예시 그래프, 금일 총 19,419 kWh"><g class="chart-grid">${grid}</g><g class="chart-today">${bars}</g><polyline class="chart-yesterday" points="${yesterday.map((v,i)=>`${44.5+i*28},${chartY(v)}`).join(' ')}"/><g class="chart-labels">${labels}</g></svg><div class="dashboard-legend"><span><i class="legend-today"></i>금일 사용량 (kWh)</span><span><i class="legend-yesterday"></i>전일 사용량 (kWh)</span></div></article>
    ${comparison('당일 전기 사용량',19419,'kWh',[
      ['전주 평균 대비 (00–16시)','−6,069','−23.8'],['작년 동일 대비 (00–16시)','−4,992','−20.4']
    ],[['당일',19419],['평균',25488],['최대',27138]])}
    ${comparison('당일 전기 요금',2496,'천원',[
      ['전주 평균 대비 (00–16시)','−904','−26.6'],['작년 동일 대비 (00–16시)','−384','−13.3']
    ],[['당일',2496],['평균',3399],['최대',3695]])}
    <article class="dashboard-card emissions-card"><h3>온실가스 누적배출량</h3><dl><div><dt>금년 <span>(1/1~10/1)</span></dt><dd>${metric('1,959.33','TOE')}</dd></div><div><dt>당월 <span>(10/1~10/1)</span></dt><dd>${metric('4.47','TOE')}</dd></div><div><dt>전월 <span>(9/1~9/1)</span></dt><dd>${metric('6.88','TOE')}</dd></div></dl></article>`;
  host.append(strip);
  const solar=document.createElement('div');
  solar.className='dashboard-strip';solar.tabIndex=0;solar.hidden=true;solar.dataset.dashboardPanel='solar';
  solar.setAttribute('role','region');solar.setAttribute('aria-label','태양광 대시보드 예시 · 좌우 스크롤');
  solar.innerHTML=`
    <article class="dashboard-card solar-generation-card"><header><h3>발전량 현황</h3><span class="dashboard-chip">태양광 <b>300</b> kW</span></header><div class="solar-generation-body"><div class="solar-output-gauge"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="solar-ring-track" cx="70" cy="70" r="58"/><circle class="solar-ring-value" cx="70" cy="70" r="58" pathLength="300" stroke-dasharray="250 300" transform="rotate(-90 70 70)"/></svg><div class="solar-output-value"><strong>250</strong><span class="dashboard-unit">kW</span></div></div><dl class="solar-generation-stats"><div><dt>일 누적 발전량</dt><dd>${metric('1,000','kWh')}</dd></div><div><dt>일 최대 출력전력</dt><dd>${metric('160','kW')}<time>00:00</time></dd></div></dl></div></article>
    <article class="dashboard-card solar-inverter-card"><header><h3>인버터별 발전 현황</h3><span class="dashboard-chip">태양광 <b>300</b> kW</span></header><table class="solar-inverter-table"><caption class="sr-only">태양광 300 kW 인버터별 발전 현황 · 예시 데이터</caption><thead><tr><th scope="col">인버터</th><th scope="col">운전 상태</th><th scope="col">현재 출력 전력</th><th scope="col">발전 효율</th></tr></thead><tbody><tr><th scope="row">INV 1</th><td><span class="inverter-state running">운전 중</span></td><td><b>78.5</b><span class="dashboard-unit">kW</span></td><td><b>96.7</b><span class="dashboard-unit">%</span></td></tr><tr><th scope="row">INV 2</th><td><span class="inverter-state running">운전 중</span></td><td><span class="inverter-missing" aria-label="데이터 없음">—</span></td><td><span class="inverter-missing" aria-label="데이터 없음">—</span></td></tr><tr><th scope="row">INV 3</th><td><span class="inverter-state standby">대기</span></td><td><span class="inverter-missing" aria-label="데이터 없음">—</span></td><td><span class="inverter-missing" aria-label="데이터 없음">—</span></td></tr></tbody></table></article>`;
  host.append(solar);
  const ups=document.createElement('div');
  ups.className='dashboard-strip';ups.tabIndex=0;ups.hidden=true;ups.dataset.dashboardPanel='ups';
  ups.setAttribute('role','region');ups.setAttribute('aria-label','UPS 대시보드 예시 · 좌우 스크롤');
  const upsValue=(value,unit)=>`<b>${value}</b><span class="dashboard-unit">${unit}</span>`;
  // These three sample devices reproduce the reference layout, not live inventory.
  ups.innerHTML=`${[1,2,3].map(index=>`
    <article class="dashboard-card ups-device-card"><h3 id="ups-device-${index}">UPS ${index}</h3><table class="ups-status-table" aria-labelledby="ups-device-${index}"><thead><tr><th scope="col">입력</th><th scope="col">출력</th><th scope="col">배터리</th><th scope="col">경보</th><th scope="col">유효전력</th></tr></thead><tbody>
      <tr><td>${upsValue('60.0','Hz')}</td><td>${upsValue('60.0','Hz')}</td><td>${upsValue('60.0','Vdc')}</td><td><span class="ups-alarm">기타</span></td><td>${upsValue('45.2','kW')}</td></tr>
      <tr><td>${upsValue('381','Vac')}</td><td>${upsValue('220','Vac')}</td><td>${upsValue('381','%')}</td><td></td><td></td></tr>
      <tr><td></td><td>${upsValue('73.0','A')}</td><td>${upsValue('2','h')}${upsValue('30','m')}</td><td></td><td></td></tr>
      <tr><td></td><td>${upsValue('32.0','%')}</td><td></td><td></td><td></td></tr>
    </tbody></table></article>`).join('')}`;
  host.append(ups);
  const ess=document.createElement('div');
  ess.className='dashboard-strip';ess.tabIndex=0;ess.hidden=true;ess.dataset.dashboardPanel='ess';
  ess.setAttribute('role','region');ess.setAttribute('aria-label','ESS 대시보드 예시 · 좌우 스크롤');
  const savingTable=(title,values)=>`<table class="ess-table ess-savings-table"><caption>${title}</caption><tbody>${['일일','주간','월간'].map((label,i)=>`<tr><th scope="row">${label}</th><td>${upsValue(values[i],'원')}</td></tr>`).join('')}</tbody></table>`;
  ess.innerHTML=`
    <article class="dashboard-card ess-energy-card"><section><h3>충전량 (일/월)</h3><dl><div class="ess-energy-today charging"><dt>일</dt><dd>${metric('3,008,284','kWh')}</dd></div><div><dt>월</dt><dd>${metric('53,008,284','kWh')}</dd></div></dl></section><section><h3>방전량 (일/월)</h3><dl><div class="ess-energy-today discharging"><dt>일</dt><dd>${metric('665,243','kWh')}</dd></div><div><dt>월</dt><dd>${metric('47,871,243','kWh')}</dd></div></dl></section></article>
    <article class="dashboard-card ess-pcs-card"><header><h3>PCS 1</h3><span class="dashboard-chip">전력변환장치</span></header><div class="ess-pcs-body"><div class="ess-pcs-summary"><div class="ess-pcs-gauge"><svg viewBox="0 5 220 110" aria-hidden="true"><path class="gauge-track" d="M20 105 A90 90 0 0 1 200 105"/><path class="ess-discharge-arc" d="M20 105 A90 90 0 0 1 200 105" pathLength="100" stroke-dasharray="85.3 100"/></svg><div>${metric('−853.0','kW')}</div></div><div class="ess-pcs-status"><span>운전 중</span><span class="ess-discharging">방전</span><span>${upsValue('46.0','°C')}</span></div></div><table class="ess-table ess-grid-table" aria-label="PCS 1 계통정보"><thead><tr><th scope="col">계통정보</th><th scope="col">R</th><th scope="col">S</th><th scope="col">T</th></tr></thead><tbody><tr><th scope="row">전압 [V]</th><td>455.5</td><td>459.5</td><td>451.0</td></tr><tr><th scope="row">전류 [A]</th><td>1,082.3</td><td>1,078.9</td><td>1,092.5</td></tr><tr><th scope="row">주파수 [Hz] / 역률</th><td colspan="3">60.0 / 0.999</td></tr></tbody></table></div></article>
    <article class="dashboard-card ess-bms-card"><header><h3>BMS 1</h3><span class="dashboard-chip">배터리 관리장치</span></header><div class="ess-battery" role="img" aria-label="배터리 충전 상태 76.5%"><div><i style="width:76.5%"></i></div></div><table class="ess-table ess-bms-table" aria-label="BMS 1 배터리 상태"><tbody><tr><th scope="col">SOC [%]</th><th scope="col">SOC [kWh]</th><th scope="col">SOH [%]</th></tr><tr class="ess-bms-charge"><td>76.5</td><td>4,453.8</td><td>91.2</td></tr><tr><th scope="col">전압 [V]</th><th scope="col">전류 [A]</th><th scope="col">온도 [°C]</th></tr><tr><td>925.9</td><td>−950.0</td><td>22.0~26.0</td></tr></tbody></table></article>
    <article class="dashboard-card ess-customer-card"><h3>수용가 정보 / 절감액</h3><table class="ess-table ess-tariff-table" aria-label="수용가 정보"><tbody><tr><th scope="row">요금 종류</th><td>산업용(을) 고압 A 선택 III</td></tr><tr><th scope="row">계약 전력</th><td>${upsValue('8,000','kW')}</td></tr></tbody></table><div class="ess-savings">${savingTable('ESS 절감액',['330,911','330,911','9,671,773'])}${savingTable('총 발전 절감액',['0','0','2,587,418'])}</div></article>`;
  host.append(ess);
  const panels={overview:strip,solar,ups,ess};
  let active=strip;
  function update(){left.disabled=!active||active.scrollLeft<=1;right.disabled=!active||active.scrollLeft+active.clientWidth>=active.scrollWidth-1;}
  function scroll(direction){active?.scrollBy({left:direction*Math.max(240,active.clientWidth*.7),behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  left.addEventListener('click',()=>scroll(-1));right.addEventListener('click',()=>scroll(1));
  for(const panel of Object.values(panels)){
  panel.addEventListener('scroll',update,{passive:true});
  // Consume vertical wheel input only when the dashboard can scroll in that direction.
  panel.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?panel.clientWidth:1);
    const canScroll=delta>0?panel.scrollLeft+panel.clientWidth<panel.scrollWidth-1:panel.scrollLeft>0;
    if(canScroll){event.preventDefault();panel.scrollLeft+=delta;}
  },{passive:false});
  new ResizeObserver(update).observe(panel);
  }
  root.FEMSOverviewDashboard={show(name){active=panels[name]||null;for(const panel of Object.values(panels))panel.hidden=panel!==active;tools.hidden=!active;requestAnimationFrame(update);}};
  update();
})(window);
