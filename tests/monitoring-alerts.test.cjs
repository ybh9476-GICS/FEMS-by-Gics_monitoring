const test=require('node:test'),assert=require('node:assert/strict');
const {createAlerts,selectAlerts,setRead,unreadCount}=require('../js/monitoring-alerts.js');
const equipment=[{id:'g',name:'GRID',type:'tower'},{id:'e',name:'ESS',type:'ess'},{id:'u',name:'UPS 2',type:'ups'},{id:'s',name:'PV <test>',type:'solar-3x3'},{id:'u1',name:'UPS 1',type:'ups'}];
test('개별 읽음 토글과 전체 읽음은 필터 밖 알림까지 반영하며 새 재생은 초기화된다',()=>{
  const original=createAlerts(equipment,'2026-11-10T07:00:00Z');
  let alerts=setRead(original,original[0].id,true);
  assert.equal(unreadCount(alerts),4);assert.equal(unreadCount(original),5);
  assert.equal(selectAlerts(alerts,{status:'danger'})[0].read,true);
  alerts=setRead(alerts,original[0].id,false);assert.equal(unreadCount(alerts),5);
  alerts=setRead(alerts,null,true);assert.equal(unreadCount(alerts),0);assert.ok(alerts.every(a=>a.read));
  assert.equal(unreadCount(setRead(alerts,original[1].id,false)),1);
  assert.equal(unreadCount(createAlerts(equipment,'2026-11-10T08:00:00Z')),5);
});
test('알림 목업은 실제 설비 이름을 보존하고 미래가 아닌 세션 기준 발생 시각을 만든다',()=>{
  const before=JSON.stringify(equipment),now='2026-11-10T15:01:00.000Z',alerts=createAlerts(equipment,now);
  assert.equal(JSON.stringify(equipment),before);assert.equal(alerts.length,equipment.length);
  assert.ok(alerts.some(a=>a.severity==='danger'));assert.ok(alerts.some(a=>a.severity==='warning'));
  alerts.forEach((a,i)=>{assert.equal(a.equipmentName,equipment[i].name);assert.equal(a.equipmentId,equipment[i].id);assert.ok(Date.parse(a.timestamp)<Date.parse(now));assert.ok(a.message.length>0);});
  assert.ok(alerts[0].timestamp.startsWith('2026-11-10T14:')); // KST 자정 경계도 실제 과거 시각이다.
  assert.deepEqual(createAlerts([],now),[]);assert.deepEqual(createAlerts(equipment,'invalid'),[]);
  assert.deepEqual(createAlerts(equipment,now),alerts);
});
test('상태·설비 필터와 최신순·위험 우선·설비 이름순 정렬은 원본 이력을 변경하지 않는다',()=>{
  const alerts=createAlerts(equipment,'2026-11-10T07:00:00Z'),before=JSON.stringify(alerts);
  const dangerous=selectAlerts(alerts,{status:'danger'});assert.equal(dangerous.length,2);assert.ok(dangerous.every(a=>a.severity==='danger'));
  assert.deepEqual(selectAlerts(alerts,{equipmentType:'ess',status:'warning'}).map(a=>a.equipmentId),['e']);
  assert.equal(selectAlerts(alerts,{equipmentType:'ess',status:'danger'}).length,0);
  assert.deepEqual(selectAlerts(alerts,{equipmentType:'ups'}).map(a=>a.equipmentId),['u','u1']);
  assert.equal(selectAlerts(alerts,{equipmentType:'mcc'}).length,0);
  assert.deepEqual(selectAlerts(alerts,{sort:'severity'}).slice(0,2).map(a=>a.severity),['danger','danger']);
  const names=selectAlerts(alerts,{sort:'equipment'}).map(a=>a.equipmentName);assert.ok(names.indexOf('UPS 1')<names.indexOf('UPS 2'));
  const ordered=selectAlerts([...alerts].reverse());assert.equal(ordered[0].id,alerts[0].id);
  assert.equal(JSON.stringify(alerts),before);
});
test('에셋 종류 필터는 개별 설비 이름과 무관하며 추가 에셋 종류를 구분한다',()=>{
  const items=[{id:'a',name:'같은 이름',type:'custom-a'},{id:'b',name:'다른 이름',type:'custom-a'},{id:'c',name:'같은 이름',type:'custom-b'}];
  const catalog=[{type:'custom-a',name:'펌프 에셋'},{type:'custom-b',name:'압축기 에셋'}];
  const alerts=createAlerts(items,'2026-11-10T08:00:00Z',catalog);
  assert.deepEqual(selectAlerts(alerts,{equipmentType:'custom-a'}).map(a=>a.equipmentId),['a','b']);
  assert.equal(alerts[0].typeName,'펌프 에셋');assert.equal(alerts[2].typeName,'압축기 에셋');
  assert.deepEqual(selectAlerts(alerts,{sort:'equipment'}).map(a=>a.equipmentType),['custom-b','custom-a','custom-a']);
});
