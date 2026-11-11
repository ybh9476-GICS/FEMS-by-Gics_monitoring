const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const {sampleReply, bubbleLayout} = require('../js/monitoring-companion.js');

function fixture() {
  const elements = new Map(), events = {}, timers = new Map(); let next = 0;
  const element = () => ({
    hidden: false, dataset: {}, attrs: {}, events: {}, children: [], value: '', textContent: '',
    style: {setProperty(k,v){this[k]=v;}}, offsetLeft: 620, offsetTop: 300, offsetWidth: 75, offsetHeight: 92, clientWidth: 750, clientHeight: 500,
    getBoundingClientRect(){return {left:10,top:100,width:75,height:92};},
    setAttribute(k,v){this.attrs[k]=v;}, addEventListener(k,fn){this.events[k]=fn;},
    append(...children){for(const child of children)child.parent=this;this.children.push(...children);},
    get childElementCount(){return this.children.length;},
    remove(){this.parent.children=this.parent.children.filter(e=>e!==this);},
    querySelector(selector){return selector==='.companion-chat-header'?(this.header??=element()):null;}, querySelectorAll(){return [];}, focus(){document.activeElement=this;},
    setPointerCapture(id){this.capture=id;}, hasPointerCapture(id){return this.capture===id;}, releasePointerCapture(){this.capture=null;}
  });
  const document = {body:element(),documentElement:element(),activeElement:null,createElement:element,
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}
  };
  const context = {document,console,Date,innerHeight:900,ResizeObserver:class{observe(){}},FEMSWorkspaceMode:{mode:'editor'},
    addEventListener(k,fn){events[k]=fn;},matchMedia(){return {matches:true};},
    setTimeout(fn){timers.set(++next,fn);return next;},clearTimeout(id){timers.delete(id);}
  }; context.window=context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/monitoring-companion.js'),'utf8'),context);
  const e=id=>document.getElementById('companion-'+id);
  const event=(extras={})=>({key:'',detail:1,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extras});
  return {e,events,event,context,timers,layer:document.getElementById('monitor-companion'),viewport:document.getElementById('viewport'),
    mode(mode){context.FEMSWorkspaceMode.mode=mode;events['fems-workspace-mode-change']();},
    open(){this.mode('monitoring');e('summon').events.click();e('figure').events.click(event());},
    submit(text){e('input').value=text;e('form').events.submit(event());},
    finish(){for(const [id,fn] of timers){timers.delete(id);fn();}}
  };
}
test('캐릭터는 버튼으로만 나타나고 빈 공간 더블클릭 이동 시 열린 채팅을 닫는다',()=>{
  const f=fixture(),move=f.viewport.events['fems-background-dblclick'];
  move({detail:{clientX:310,clientY:300}});assert.ok(f.e('character').hidden);
  f.mode('monitoring');move({detail:{clientX:310,clientY:300}});
  assert.ok(f.e('character').hidden);assert.equal(f.e('summon').attrs['aria-pressed'],'false');
  f.e('summon').events.click();move({detail:{clientX:310,clientY:300}});
  assert.ok(!f.e('character').hidden);assert.equal(f.e('character').style.left,'272.5px');assert.equal(f.e('character').style.top,'254px');
  assert.equal(f.e('summon').attrs['aria-pressed'],'true');
  f.e('figure').events.click(f.event());move({detail:{clientX:5000,clientY:-50}});
  assert.ok(f.e('chat').hidden);assert.equal(f.e('character').style.left,'647px');assert.equal(f.e('character').style.top,'28px');
  move({detail:{clientX:NaN,clientY:5}});assert.equal(f.e('character').style.left,'647px');
});
test('대화창은 작은 작업 화면을 벗어나 브라우저 기준으로 배치되며 입력 차단과 모드 숨김을 유지한다',()=>{
  const f=fixture();f.layer.clientWidth=240;f.layer.clientHeight=180;
  f.e('character').offsetLeft=120;f.e('character').offsetTop=28;
  f.e('chat').offsetWidth=370;f.e('chat').offsetHeight=460;f.open();
  assert.equal(f.e('chat').parent,f.context.document.body);
  assert.equal(f.e('character').parent,f.context.document.body);
  assert.ok(parseFloat(f.e('chat').style.left)+370>f.layer.clientWidth);
  assert.ok(parseFloat(f.e('chat').style.top)+460<=f.context.innerHeight-16);
  assert.equal(f.e('chat').style.maxHeight,undefined);
  const key=f.event({key:'Escape'});f.e('chat').events.keydown(key);
  assert.ok(key.stopped&&key.prevented);assert.ok(f.e('chat').hidden);
  f.e('figure').events.click(f.event());f.mode('editor');assert.ok(f.e('chat').hidden);
});
test('제목 바 드래그는 대화창만 이동하고 닫기 버튼·캐릭터·입력 내용은 유지한다',()=>{
  const f=fixture();f.open();const panel=f.e('chat'),bar=panel.header;
  panel.offsetWidth=370;panel.offsetHeight=575;f.e('input').value='입력 보존';
  const before=f.e('character').style.left;
  bar.events.pointerdown(f.event({button:0,pointerId:2,clientX:100,clientY:100,target:{closest:()=>null}}));
  bar.events.pointermove(f.event({pointerId:2,clientX:1200,clientY:-500}));bar.events.pointerup();
  assert.equal(panel.style.left,'364px');assert.equal(panel.style.top,'16px');
  assert.equal(panel.dataset.placement,'detached');assert.ok(!panel.hidden);
  assert.equal(f.e('character').style.left,before);assert.equal(f.e('input').value,'입력 보존');
  bar.events.pointerdown(f.event({button:0,pointerId:3,target:{closest:()=>({})}}));
  assert.equal(bar.capture,null);
  f.context.document.documentElement.clientWidth=400;f.events.resize();assert.equal(panel.style.left,'16px');
  f.e('close').events.click();assert.ok(panel.hidden);
});
test('호출→캐릭터 클릭 순서, 닫기·숨기기·에디터 전환은 독립적으로 동작한다',()=>{
  const f=fixture();assert.ok(f.layer.hidden);f.mode('monitoring');assert.ok(f.e('character').hidden);
  f.e('summon').events.click();assert.ok(!f.e('character').hidden);assert.ok(f.e('chat').hidden);
  f.e('figure').events.click(f.event());assert.ok(!f.e('chat').hidden);assert.equal(f.e('messages').children.length,1);
  const esc=f.event({key:'Escape'});f.layer.events.keydown(esc);assert.ok(esc.stopped&&esc.prevented);assert.ok(f.e('chat').hidden);
  assert.equal(f.context.document.activeElement,f.e('figure'));
  f.e('figure').events.click(f.event());assert.equal(f.e('messages').children.length,1);
  f.e('summon').events.click();assert.ok(f.e('chat').hidden&&f.e('character').hidden);
  f.mode('editor');assert.ok(f.layer.hidden);f.mode('monitoring');assert.ok(f.e('character').hidden);
});
test('시연 응답은 한 번씩 처리하며 사용자 문자열을 HTML이나 번역으로 해석하지 않는다',()=>{
  const f=fixture();f.open();f.submit('   ');assert.equal(f.timers.size,0);
  const text='<img src=x onerror=alert(1)> 안전';f.submit(text);f.submit('중복');
  assert.equal(f.timers.size,1);assert.equal(f.e('messages').children.length,3);
  const bubble=f.e('messages').children[1].children[0];assert.equal(bubble.textContent,text);assert.ok('data-i18n-skip' in bubble.attrs);
  assert.ok(f.e('send').disabled);f.finish();assert.equal(f.e('messages').children.length,3);
  assert.match(f.e('messages').children[2].children[0].textContent,/안전 센서/);
  f.submit('취소');f.mode('editor');assert.equal(f.timers.size,0);assert.ok(!f.e('messages').children.some(e=>'data-pending' in e.attrs));
});
test('IME 조합·줄바꿈은 전송하지 않고 채팅 키·휠은 카메라와 단축키에 전파하지 않는다',()=>{
  const f=fixture();f.open();f.e('input').value='OEE';
  f.e('input').events.keydown(f.event({key:'Enter',isComposing:true}));
  f.e('input').events.keydown(f.event({key:'Enter',shiftKey:true}));assert.equal(f.timers.size,0);
  f.e('input').events.keydown(f.event({key:'Enter'}));assert.equal(f.timers.size,1);
  for(const name of ['pointerdown','pointermove','pointerup','wheel','dblclick','keydown','keyup']){
    const ev=f.event({key:'f'});f.layer.events[name](ev);assert.ok(ev.stopped,name);
  }
});
test('캐릭터 드래그는 채팅을 닫고 작업 영역 밖 대시보드까지 이동한다',()=>{
  const f=fixture();f.open();const figure=f.e('figure');
  figure.events.pointerdown(f.event({button:0,pointerId:1,clientX:650,clientY:300}));
  figure.events.pointermove(f.event({pointerId:1,clientX:651,clientY:301}));assert.ok(!f.e('chat').hidden);
  figure.events.pointermove(f.event({pointerId:1,clientX:-1000,clientY:3000}));figure.events.pointerup();
  assert.ok(f.e('chat').hidden);
  assert.equal(f.e('character').style.left,'28px');assert.equal(f.e('character').style.top,'780px');
  figure.events.click(f.event());assert.ok(f.e('chat').hidden);
  figure.events.click(f.event({detail:0}));assert.ok(!f.e('chat').hidden);
});
test('말풍선은 우측 패널과 작은 작업 영역에서도 영역 밖으로 벗어나지 않는다',()=>{
  for(const bounds of [{width:1000,height:600},{width:520,height:420},{width:340,height:400}]){
    const size={width:Math.min(370,bounds.width-32),height:Math.min(360,bounds.height-32)};
    for(const left of [28,bounds.width/2,bounds.width-100])for(const top of [28,bounds.height-120]){
      const p=bubbleLayout(bounds,{left,top,width:75,height:92},size);
      assert.ok(p.left>=16&&p.top>=16);assert.ok(p.left+size.width<=bounds.width-16);assert.ok(p.top+size.height<=bounds.height-16);
      assert.ok(p.tailTop>=22&&p.tailTop<=size.height-36);assert.ok(p.tailLeft>=22&&p.tailLeft<=size.width-36);
    }
  }
});
test('원본 시연 응답과 한·영·일 질문의 의미를 유지한다',()=>{
  for(const q of ['불량률','defect rate','不良率'])assert.match(sampleReply(q),/3.2%/);
  for(const q of ['가동률','oee','稼働率'])assert.match(sampleReply(q),/87.5%/);
  for(const q of ['안전','safety','安全'])assert.match(sampleReply(q),/안전 센서/);
  assert.match(sampleReply('에너지'),/Supervisor/);
});
