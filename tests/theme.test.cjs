const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function boot(storage=new Map(),blocked=false){
  const root={dataset:{},style:{}},events=[],listeners={},writes=[];
  const context={document:{documentElement:root},localStorage:{
    getItem(key){if(blocked)throw Error('storage blocked');return storage.get(key)??null;},
    setItem(key,value){if(blocked)throw Error('storage full');writes.push(key);storage.set(key,value);}
  },CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  addEventListener(type,fn){listeners[type]=fn;},dispatchEvent(event){events.push(event);listeners[event.type]?.(event);}};
  context.window=context;vm.createContext(context);vm.runInContext(read('js/theme.js'),context);
  return {root,events,context,api:context.FEMSTheme,writes};
}
test('본문 없이 저장된 테마를 즉시 적용하고 잘못된 값은 Light Mode로 시작한다',()=>{
  for(const value of [undefined,'light','dark','invalid']){
    const f=boot(new Map([['fems-ui-theme',value]])),expected=value==='dark'?'dark':'light';
    assert.equal(f.root.dataset.theme,expected);assert.equal(f.root.style.colorScheme,expected);
    assert.equal(f.root.style.backgroundColor,expected==='dark'?'#111b22':'#f4f6f7');
    assert.equal(f.writes.length,0);
  }
});
test('양방향 전환은 전용 키만 저장하고 새 페이지에서도 복원한다',()=>{
  const storage=new Map([['project','unchanged']]),f=boot(storage);
  for(const mode of ['dark','light','dark']){
    assert.equal(f.api.setMode(mode),true);assert.equal(f.api.mode,mode);
    assert.equal(boot(storage).root.dataset.theme,mode);
    assert.equal(f.events.at(-1).detail.mode,mode);
  }
  assert.equal(storage.get('project'),'unchanged');assert.deepEqual(f.writes,['fems-ui-theme','fems-ui-theme','fems-ui-theme']);
  assert.equal(f.api.setMode('invalid'),false);assert.equal(f.api.mode,'dark');
});
test('로컬 저장 읽기/쓰기 실패에도 페이지와 테마 전환은 동작한다',()=>{
  const f=boot(new Map(),true);assert.equal(f.api.mode,'light');
  assert.doesNotThrow(()=>f.api.setMode('dark'));assert.equal(f.root.dataset.theme,'dark');
});
test('설정의 테마 선택과 누름 상태를 연결하고 언어/작업 모드 이벤트를 보존한다',()=>{
  const f=boot(new Map([['fems-ui-theme','dark']])),controls=[];
  const button=dataset=>({dataset,attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}});
  const themes=['light','dark'].map(themeChoice=>button({themeChoice}));
  const language=button({language:'en'}),workspace=button({workspaceMode:'monitoring'}),groups=[themes,[language],[workspace]];
  const dialog={open:false,addEventListener(){},querySelectorAll(selector){return selector==='[data-theme-choice]'?themes:groups.map(buttons=>({querySelectorAll:()=>buttons}));}};
  f.context.document.getElementById=id=>id==='settings-dialog'?dialog:{addEventListener(){}};
  f.context.FEMSI18n={setLanguage:value=>controls.push(value)};f.context.FEMSWorkspaceMode={setMode:value=>controls.push(value)};
  vm.runInContext(read('js/settings.js'),f.context);
  assert.deepEqual(themes.map(b=>b.attrs['aria-pressed']),['false','true']);
  themes[0].events.click();assert.equal(f.api.mode,'light');assert.deepEqual(themes.map(b=>b.attrs['aria-pressed']),['true','false']);
  language.events.click();workspace.events.click();assert.deepEqual(controls,['en','monitoring']);
});
test('초기 테마 스크립트는 CSP를 지키며 모든 스타일/본문보다 먼저 동기 실행한다',()=>{
  const html=read('index.html'),tag=html.match(/<script[^>]+src="js\/theme\.js[^>]*><\/script>/)?.[0];
  assert.ok(tag);assert.doesNotMatch(tag,/\s(?:defer|async|type)(?:\s|=|>)/);
  assert.ok(html.indexOf(tag)<html.indexOf('<link'));assert.ok(html.indexOf(tag)<html.indexOf('<body'));
  assert.ok(html.indexOf('css/theme.css')>html.indexOf('css/monitoring.css'));
  assert.doesNotMatch(read('js/theme.js'),/THREE|FEMSScene|FEMSModel|history\.|fetch\(/);
});
