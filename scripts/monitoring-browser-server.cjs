// Isolated, read-only browser regression server. Never serves project write APIs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.argv[2]||4183);
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(req.method!=='GET'||!file.startsWith(root+path.sep)||!['index.html','js','css','vendor','assets','tests'].includes(relative.split('/')[0])||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end('Not found');return;
  }
  const ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.png':'image/png'};
  res.setHeader('Content-Type',(mime[ext]||'application/octet-stream')+'; charset=utf-8');res.setHeader('Cache-Control','no-store');
  let bytes=fs.readFileSync(file);
  if(relative==='index.html')bytes=bytes.toString().replace(/(?=  <script defer src="js\/startup.js)/,'  <script defer src="tests/monitoring-capture.js"></script>\n');
  res.end(bytes);
}).listen(port,'127.0.0.1',()=>console.log(`Monitoring checks: http://127.0.0.1:${port}/tests/monitoring-browser.html`));
