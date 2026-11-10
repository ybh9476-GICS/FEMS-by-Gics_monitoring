(function(){
  'use strict';
  // This blocking head script runs before styles and before the body is parsed.
  // Theme preferences are separate from project data and the 3D renderer.
  const key='fems-ui-theme',root=document.documentElement;
  const normalize=value=>value==='dark'?'dark':'light';
  let mode='light';
  try{mode=normalize(window.localStorage.getItem(key));}catch(_){}
  function apply(value){
    mode=normalize(value);
    root.dataset.theme=mode;
    root.style.colorScheme=mode;
    root.style.backgroundColor=mode==='dark'?'#111b22':'#f4f6f7';
  }
  apply(mode);
  window.FEMSTheme={
    get mode(){return mode;},
    setMode(value){
      if(value!=='light'&&value!=='dark')return false;
      apply(value);
      // A blocked/full storage must never prevent the UI from working.
      try{window.localStorage.setItem(key,mode);}catch(_){}
      window.dispatchEvent(new CustomEvent('fems-theme-change',{detail:{mode}}));
      return true;
    }
  };
})();
